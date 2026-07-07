const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { resolveUploadPath, toStoredUploadPath } = require('../config/paths');

// 财务精度计算工具类
class PrecisionCalculator {
    // 精度常量
    static STORAGE_DECIMALS = 2;    // 数据库存储精度（总金额、库存价值）
    static PRICE_DECIMALS = 4;       // 单价精度
    static CALCULATION_DECIMALS = 6; // 中间计算精度
    // 注意：显示时不做格式化，直接显示数据库原值（这样可以区分2位和4位的产品）

    static round(number, decimals = this.CALCULATION_DECIMALS) {
        if (isNaN(number) || number === null || number === undefined) {
            return 0;
        }
        const factor = Math.pow(10, decimals);
        return Math.round((number + Number.EPSILON) * factor) / factor;
    }

    static add(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a * factor + b * factor)) / factor;
    }

    static subtract(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a * factor - b * factor)) / factor;
    }

    static multiply(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round(a * b * factor) / factor;
    }

    static divide(a, b) {
        if (b === 0 || isNaN(b)) return 0;
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a / b) * factor) / factor;
    }

    static formatStorage(number) {
        if (isNaN(number) || number === null || number === undefined) {
            return 0;
        }
        return this.round(number, this.STORAGE_DECIMALS);
    }

    static formatCalculation(number) {
        if (isNaN(number) || number === null || number === undefined) {
            return 0;
        }
        return this.round(number, this.CALCULATION_DECIMALS);
    }

    /**
     * 单价格式化（4位小数）
     * @param {number} number - 要格式化的数字
     * @returns {number} 格式化后的数字（四舍五入到4位小数）
     */
    static formatPrice(number) {
        if (isNaN(number) || number === null || number === undefined) {
            return 0;
        }
        return this.round(number, this.PRICE_DECIMALS);
    }
}

// 加权平均成本计算函数 - 支持直接使用总价值或单价
const calculateWeightedAveragePrice = (currentStock, currentStockValue, inboundQuantity, inboundUnitPrice, inboundTotalValue = null) => {
    // 计算入库总价值，强制2位小数
    const actualInboundTotalValue = inboundTotalValue !== null ? 
        PrecisionCalculator.round(inboundTotalValue, 2) :  // ☃2位
        PrecisionCalculator.round(
            PrecisionCalculator.multiply(inboundQuantity, inboundUnitPrice),
            2  // ☃2位
        );
    
    if (currentStock === 0) {
        const newUnitPrice = inboundTotalValue !== null ? 
            PrecisionCalculator.divide(actualInboundTotalValue, inboundQuantity) : 
            inboundUnitPrice;
        
        return {
            unitPrice: PrecisionCalculator.formatPrice(newUnitPrice),  // 4位
            totalValue: actualInboundTotalValue  // 已经是2位
        };
    }
    
    // 直接使用实际的库存价值（可能是4位历史数据）
    const currentTotalValue = currentStockValue;
    const newTotalValue = PrecisionCalculator.add(currentTotalValue, actualInboundTotalValue);
    const newTotalQuantity = PrecisionCalculator.add(currentStock, inboundQuantity);
    
    // 使用精确计算得出单价，保持总价值的精确性
    const unitPrice = PrecisionCalculator.divide(newTotalValue, newTotalQuantity);
    
    return {
        unitPrice: PrecisionCalculator.formatPrice(unitPrice),       // 4位
        totalValue: PrecisionCalculator.round(newTotalValue, 2)      // ★强制2位（自动转换）
    };
};

// 更新产品的库存信息 - 直接使用交易计算的单价和库存价值
const updateProductWeightedPrice = (productId, newStock, newUnitPrice, exactStockValue = null) => {
    // 关键修复：如果库存为0，则单价和库存价值都应该为0
    if (newStock <= 0) {
        newStock = 0;
        newUnitPrice = 0;
        exactStockValue = 0;
    }
    
    // 使用精确计算格式化数值
    const formattedStock = PrecisionCalculator.formatStorage(newStock);
    const formattedUnitPrice = PrecisionCalculator.formatPrice(newUnitPrice);  // 4位
    
    // ★★★ 关键：强制四舍五入为2位小数
    const newStockValue = exactStockValue !== null ? 
        PrecisionCalculator.round(exactStockValue, 2) : 0;  // ★2位
    
    const updateStmt = db.prepare(`
        UPDATE products 
        SET stock = ?,
            current_unit_price = ?,
            total_cost_value = ?,
            price = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    
    updateStmt.run(formattedStock, formattedUnitPrice, newStockValue, formattedUnitPrice, productId);
    
    return {
        stock: formattedStock,
        unitPrice: formattedUnitPrice,
        stockValue: newStockValue
    };
};

// 计算平均价格的函数（保留向后兼容）
const calculateAveragePrice = (currentStock, currentStockValue, incomingQuantity, incomingUnitPrice) => {
    const result = calculateWeightedAveragePrice(currentStock, currentStockValue, incomingQuantity, incomingUnitPrice);
    return result.unitPrice;
};

// Get all transactions
router.get('/', (req, res) => {
    try {
        const { limit = 50, offset = 0, type, product_id, project_id, start_date, end_date } = req.query;
        
        let query = `
            SELECT t.*, 
                   p.name as product_name, p.barcode, p.stock as current_stock,
                   p.current_unit_price, p.total_cost_value,
                   pr.name as project_name,
                   d.supplier as supplier
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
            LEFT JOIN documents d ON t.document_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            query += ` AND t.type = ?`;
            params.push(type);
        }

        if (product_id) {
            query += ` AND t.product_id = ?`;
            params.push(product_id);
        }

        if (project_id) {
            query += ` AND t.project_id = ?`;
            params.push(project_id);
        }

        // 添加日期范围筛选
        if (start_date) {
            query += ` AND DATE(t.created_at) >= DATE(?)`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(t.created_at) <= DATE(?)`;
            params.push(end_date);
        }

        query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const stmt = db.prepare(query);
        const transactions = stmt.all(...params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM transactions t WHERE 1=1`;
        const countParams = [];

        if (type) {
            countQuery += ` AND t.type = ?`;
            countParams.push(type);
        }

        if (product_id) {
            countQuery += ` AND t.product_id = ?`;
            countParams.push(product_id);
        }

        if (project_id) {
            countQuery += ` AND t.project_id = ?`;
            countParams.push(project_id);
        }

        // 添加日期范围筛选到计数查询
        if (start_date) {
            countQuery += ` AND DATE(t.created_at) >= DATE(?)`;
            countParams.push(start_date);
        }

        if (end_date) {
            countQuery += ` AND DATE(t.created_at) <= DATE(?)`;
            countParams.push(end_date);
        }

        const countStmt = db.prepare(countQuery);
        const { total } = countStmt.get(...countParams);

        res.json({
            transactions,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// 获取删除日志的接口 - 必须在 /:id 路由之前
router.get('/deleted-logs', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // 获取删除日志总数
        const totalCount = db.prepare('SELECT COUNT(*) as total FROM deleted_transactions_log').get().total;
        
        // 获取删除日志列表（JOIN documents表获取图片路径）
        const logs = db.prepare(`
            SELECT dtl.*, 
                   d.image_path as document_image_path,
                   d.document_number as document_number
            FROM deleted_transactions_log dtl
            LEFT JOIN documents d ON dtl.document_id = d.id
            ORDER BY dtl.deleted_at DESC 
            LIMIT ? OFFSET ?
        `).all(limit, offset);
        
        res.json({
            logs: logs,
            total: totalCount,
            page: page,
            totalPages: Math.ceil(totalCount / limit)
        });
    } catch (error) {
        console.error('获取删除日志失败:', error);
        res.status(500).json({ error: '获取删除日志失败' });
    }
});

// Get recent transactions summary. Keep recent routes before /:id.
router.get('/recent/summary', (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const recentTransactions = db.prepare(`
            SELECT t.*, p.name as product_name, p.barcode, pr.name as project_name
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
            ORDER BY t.created_at DESC 
            LIMIT ?
        `).all(parseInt(limit));

        const todayStats = db.prepare(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) as total_in,
                SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as total_out
            FROM transactions 
            WHERE DATE(created_at) = DATE('now')
        `).get();

        res.json({ recentTransactions, todayStats });
    } catch (error) {
        console.error('Get recent transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch recent transactions' });
    }
});

router.get(['/recent', '/recent/:limit'], (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 20;
        const transactions = db.prepare(`
            SELECT t.*, 
                   p.name as product_name, 
                   p.barcode,
                   p.stock as current_stock,
                   p.current_unit_price,
                   p.total_cost_value,
                   COALESCE(t.total_price, t.quantity * t.unit_price) as transaction_value,
                   pr.name as project_name
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
            ORDER BY t.id DESC 
            LIMIT ?
        `).all(limit);

        res.json(transactions);
    } catch (error) {
        console.error('Get recent transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch recent transactions' });
    }
});

// Get transaction by ID
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        const stmt = db.prepare(`
            SELECT t.*, p.name as product_name, p.barcode, pr.name as project_name
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
            WHERE t.id = ?
        `);
        const transaction = stmt.get(id);
        
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(transaction);
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// Create new transaction (single item)
router.post('/', [
    body('product_id').isInt({ min: 1 }).withMessage('Valid product ID is required'),
    body('type').isIn(['IN', 'OUT']).withMessage('Type must be IN or OUT'),
    body('quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be a positive number (minimum 0.001)'),
    body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('total_value').optional().isFloat({ min: 0 }).withMessage('Total value must be a positive number')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            product_id,
            type,
            quantity,
            requester_name,
            requester_department,
            project_id,
            purpose,
            signature,
            unit_price,
            total_value
        } = req.body;

        // 出库时验证用途说明是否填写
        if (type === 'OUT' && (!purpose || purpose.trim() === '')) {
            return res.status(400).json({ 
                error: '出库时必须填写用途说明',
                errors: [{ field: 'purpose', message: '出库时用途说明为必填项' }]
            });
        }

        // 计算单价和总价值 - 使用精确计算
        let calculatedUnitPrice = PrecisionCalculator.formatCalculation(unit_price || 0);
        let calculatedTotalPrice = unit_price ? PrecisionCalculator.multiply(quantity, unit_price) : 0;
        
        // 如果提供了总价值而不是单价，计算单价
        if (!unit_price && total_value && quantity > 0) {
            calculatedUnitPrice = PrecisionCalculator.divide(total_value, quantity);
            calculatedTotalPrice = PrecisionCalculator.formatCalculation(total_value);
        }

        // Start transaction
        const transaction = db.transaction(() => {
            // Get current product state
            const productStmt = db.prepare(`
                SELECT id, name, stock, current_unit_price, total_cost_value, price 
                FROM products WHERE id = ?
            `);
            const product = productStmt.get(product_id);
            
            if (!product) {
                throw new Error('Product not found');
            }

            // 记录交易前状态
            const stockBefore = product.stock;
            const unitPriceBefore = product.current_unit_price || product.price || 0;
            const stockValueBefore = product.total_cost_value || 0;

            // 验证出库库存充足
            if (type === 'OUT' && product.stock < quantity) {
                throw new Error(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
            }

            // 计算交易后状态
            let stockAfter, unitPriceAfter, stockValueAfter;
            
            if (type === 'IN') {
                // 入库：计算新的加权平均单价和精确的库存价值
                if (!calculatedUnitPrice || calculatedUnitPrice <= 0) {
                    throw new Error('入库时必须提供有效的单价或总价值');
                }
                
                // 如果提供了总价值，直接使用；否则从单价计算
                const inboundTotalValue = total_value ? 
                    PrecisionCalculator.round(total_value, 2) :  // ★2位
                    null;
                
                const weightedResult = calculateWeightedAveragePrice(
                    stockBefore, 
                    stockValueBefore, 
                    quantity, 
                    calculatedUnitPrice,
                    inboundTotalValue
                );
                
                stockAfter = PrecisionCalculator.add(stockBefore, quantity);
                unitPriceAfter = weightedResult.unitPrice;  // 4位
                stockValueAfter = weightedResult.totalValue;  // ★2位（自动转换）
                
                // 如果使用总价值输入，更新calculatedTotalPrice
                if (inboundTotalValue !== null) {
                    calculatedTotalPrice = inboundTotalValue;
                } else {
                    calculatedTotalPrice = PrecisionCalculator.round(
                        PrecisionCalculator.multiply(quantity, calculatedUnitPrice),
                        2  // ★2位
                    );
                }
                
            } else { // type === 'OUT'
                // 出库：使用当前加权平均单价
                calculatedUnitPrice = unitPriceBefore;  // 4位
                
                // 如果是完全清空库存，出库总价等于剩余库存价值（避免计算误差）
                if (quantity >= stockBefore) {
                    calculatedTotalPrice = PrecisionCalculator.round(stockValueBefore, 2);  // ★2位
                    stockAfter = 0;
                    unitPriceAfter = 0;  // 交易后库存单价为0（库存清空）
                    stockValueAfter = 0;  // ★2位
                    // 注意：calculatedUnitPrice保持为unitPriceBefore，记录出库时的实际单价
                } else {
                    // 部分出库：使用精确计算，总价保疙2位小数
                    const rawTotalPrice = PrecisionCalculator.multiply(quantity, calculatedUnitPrice);
                    calculatedTotalPrice = PrecisionCalculator.round(rawTotalPrice, 2);  // ★2位
                    stockAfter = PrecisionCalculator.subtract(stockBefore, quantity);
                    unitPriceAfter = unitPriceBefore;  // 4位
                    
                    // ★★★ 关键：新库存价值强制2位（自动转换历史4位数据）
                    stockValueAfter = PrecisionCalculator.round(
                        stockValueBefore - calculatedTotalPrice,  // stockValueBefore可能是4位
                        2  // ★2位
                    );

                }
            }

            // 创建交易记录
            const currentTime = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Shanghai'});
            const transactionStmt = db.prepare(`
                INSERT INTO transactions 
                (product_id, type, quantity, unit_price, total_price, 
                 stock_before, stock_after, stock_unit_price, stock_value,
                 requester_name, requester_department, project_id, purpose, signature, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = transactionStmt.run(
                product_id,
                type,
                PrecisionCalculator.formatStorage(quantity),           // 数量3位
                PrecisionCalculator.formatPrice(calculatedUnitPrice),  // ★单价4位
                PrecisionCalculator.round(calculatedTotalPrice, 2),    // ★总价2位
                PrecisionCalculator.formatStorage(stockBefore),
                PrecisionCalculator.formatStorage(stockAfter),
                PrecisionCalculator.formatPrice(unitPriceAfter),       // ★单价4位
                PrecisionCalculator.round(stockValueAfter, 2),         // ★库存价值2位
                requester_name || null,
                requester_department || null,
                project_id || null,
                purpose || null,
                signature || null,
                currentTime
            );

            // 更新产品状态 - 使用精确的库存价值
            updateProductWeightedPrice(product_id, stockAfter, unitPriceAfter, stockValueAfter);

            return result.lastInsertRowid;
        });

        const transactionId = transaction();

        // 获取创建的交易记录（包含完整信息）
        const getStmt = db.prepare(`
            SELECT t.*, p.name as product_name, p.barcode, pr.name as project_name,
                   p.stock as current_stock, p.current_unit_price, p.total_cost_value
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
            WHERE t.id = ?
        `);
        const createdTransaction = getStmt.get(transactionId);

        // 格式化返回数据的精度
        const formattedTransaction = {
            ...createdTransaction,
            quantity: PrecisionCalculator.formatStorage(createdTransaction.quantity),
            unit_price: PrecisionCalculator.formatStorage(createdTransaction.unit_price),
            total_price: PrecisionCalculator.formatStorage(createdTransaction.total_price),
            stock_before: PrecisionCalculator.formatStorage(createdTransaction.stock_before),
            stock_after: PrecisionCalculator.formatStorage(createdTransaction.stock_after),
            stock_unit_price: PrecisionCalculator.formatStorage(createdTransaction.stock_unit_price),
            stock_value: PrecisionCalculator.formatStorage(createdTransaction.stock_value),
            current_stock: PrecisionCalculator.formatStorage(createdTransaction.current_stock),
            current_unit_price: PrecisionCalculator.formatStorage(createdTransaction.current_unit_price),
            total_cost_value: PrecisionCalculator.formatStorage(createdTransaction.total_cost_value)
        };

        console.log('Transaction created successfully:', {
            id: transactionId,
            type: type,
            product: createdTransaction.product_name,
            quantity: quantity,
            unitPrice: calculatedUnitPrice,
            totalPrice: calculatedTotalPrice,
            newStock: createdTransaction.current_stock,
            newUnitPrice: createdTransaction.current_unit_price,
            newStockValue: createdTransaction.total_cost_value
        });

        res.status(201).json(formattedTransaction);
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: error.message || 'Failed to create transaction' });
    }
});

// Create bulk transactions
router.post('/bulk', [
    body('transactions').isArray({ min: 1 }).withMessage('Transactions array is required'),
    body('transactions.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID is required for each transaction'),
    body('transactions.*.type').isIn(['IN', 'OUT']).withMessage('Type must be IN or OUT for each transaction'),
    body('transactions.*.quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be a positive number (minimum 0.001) for each transaction'),
    body('transactions.*.unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('transactions.*.total_value').optional().isFloat({ min: 0 }).withMessage('Total value must be a positive number')
], (req, res) => {
    try {
        // 添加调试日志
        console.log('接收到批量交易请求:', JSON.stringify(req.body, null, 2))
        
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
            console.error('验证错误:', validationErrors.array())
            return res.status(400).json({ errors: validationErrors.array() });
        }

        const { transactions: transactionList, global } = req.body;

        // Start database transaction
        const dbTransaction = db.transaction(() => {
            const results = [];
            const processingErrors = [];

            for (let i = 0; i < transactionList.length; i++) {
                const txn = transactionList[i];
                
                try {
                    // 出库时验证用途说明是否填写
                    if (txn.type === 'OUT') {
                        const purposeToCheck = txn.purpose || global?.purpose;
                        if (!purposeToCheck || purposeToCheck.trim() === '') {
                            processingErrors.push({ 
                                index: i, 
                                error: `出库时必须填写用途说明 - 产品ID: ${txn.product_id}` 
                            });
                            continue;
                        }
                    }

                    // Get current product state
                    const productStmt = db.prepare(`
                        SELECT id, name, stock, current_unit_price, total_cost_value, price 
                        FROM products WHERE id = ?
                    `);
                    const product = productStmt.get(txn.product_id);
                    
                    if (!product) {
                        processingErrors.push({ index: i, error: 'Product not found' });
                        continue;
                    }

                    // 记录交易前状态
                    const stockBefore = product.stock;
                    const unitPriceBefore = product.current_unit_price || product.price || 0;
                    const stockValueBefore = product.total_cost_value || 0;

                    // 验证出库库存充足
                    if (txn.type === 'OUT' && product.stock < txn.quantity) {
                        processingErrors.push({ 
                            index: i, 
                            error: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${txn.quantity}` 
                        });
                        continue;
                    }

                    // 计算价格信息 - 支持单价或总价值输入
                    let calculatedUnitPrice = PrecisionCalculator.formatCalculation(txn.unit_price || 0);
                    let calculatedTotalPrice = txn.unit_price ? PrecisionCalculator.multiply(txn.quantity, txn.unit_price) : 0;
                    
                    // 如果提供了总价值而不是单价，计算单价
                    if (!txn.unit_price && txn.total_value && txn.quantity > 0) {
                        calculatedUnitPrice = PrecisionCalculator.divide(txn.total_value, txn.quantity);
                        calculatedTotalPrice = PrecisionCalculator.formatCalculation(txn.total_value);
                    }

                    // 计算交易后状态
                    let stockAfter, unitPriceAfter, stockValueAfter;
                    
                    if (txn.type === 'IN') {
                        // 入库：计算新的加权平均单价和精确的库存价值
                        if (!calculatedUnitPrice || calculatedUnitPrice <= 0) {
                            processingErrors.push({ 
                                index: i, 
                                error: `入库时必须提供有效的单价或总价值 - 产品: ${product.name}` 
                            });
                            continue;
                        }
                        
                        // 如果提供了总价值，直接使用；否则从单价计算
                        const inboundTotalValue = txn.total_value ? 
                            PrecisionCalculator.round(txn.total_value, 2) :  // ★2位
                            null;
                        
                        const weightedResult = calculateWeightedAveragePrice(
                            stockBefore, 
                            stockValueBefore, 
                            txn.quantity, 
                            calculatedUnitPrice,
                            inboundTotalValue
                        );
                        
                        stockAfter = PrecisionCalculator.add(stockBefore, txn.quantity);
                        unitPriceAfter = weightedResult.unitPrice;  // 4位
                        stockValueAfter = weightedResult.totalValue;  // ★2位
                        
                        // 如果使用总价值输入，更新calculatedTotalPrice
                        if (inboundTotalValue !== null) {
                            calculatedTotalPrice = inboundTotalValue;
                        } else {
                            calculatedTotalPrice = PrecisionCalculator.round(
                                PrecisionCalculator.multiply(txn.quantity, calculatedUnitPrice),
                                2  // ★2位
                            );
                        }
                        
                    } else { // type === 'OUT'
                        // 出库：使用当前加权平均单价
                        calculatedUnitPrice = unitPriceBefore;  // 4位
                        
                        // 如果是完全清空库存，出库总价等于剩余库存价值（避免计算误差）
                        if (txn.quantity >= stockBefore) {
                            calculatedTotalPrice = PrecisionCalculator.round(stockValueBefore, 2);  // ★2位
                            stockAfter = 0;
                            unitPriceAfter = 0;  // 交易后库存单价为0（库存清空）
                            stockValueAfter = 0;  // ★2位
                            // 注意：calculatedUnitPrice保持为unitPriceBefore，记录出库时的实际单价
                        } else {
                            // 部分出库：使用精确计算，总价保留2位小数
                            const rawTotalPrice = PrecisionCalculator.multiply(txn.quantity, calculatedUnitPrice);
                            calculatedTotalPrice = PrecisionCalculator.round(rawTotalPrice, 2);  // ★2位
                            stockAfter = PrecisionCalculator.subtract(stockBefore, txn.quantity);
                            unitPriceAfter = unitPriceBefore;  // 4位
                            
                            // ★★★ 关键：新库存价值强制2位（自动转换历史4位数据）
                            stockValueAfter = PrecisionCalculator.round(
                                stockValueBefore - calculatedTotalPrice,
                                2  // ★2位
                            );
                        }
                    }

                    // 创建交易记录
                    const currentTime = new Date().toLocaleString('sv-SE', {timeZone: 'Asia/Shanghai'});
                    const transactionStmt = db.prepare(`
                        INSERT INTO transactions 
                        (product_id, type, quantity, requester_name, 
                         project_id, purpose, signature, unit_price, total_price, 
                         stock_after, stock_unit_price, stock_value, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    
                    const result = transactionStmt.run(
                        txn.product_id,
                        txn.type,
                        txn.quantity,
                        txn.requester_name || global?.requester_name || null,
                        txn.project_id || global?.project_id || null,
                        txn.purpose || global?.purpose || null,
                        txn.signature || global?.signature || null,
                        PrecisionCalculator.formatPrice(calculatedUnitPrice),  // ★单价4位
                        PrecisionCalculator.round(calculatedTotalPrice, 2),    // ★总价2位
                        stockAfter,
                        PrecisionCalculator.formatPrice(unitPriceAfter),       // ★单价4位
                        PrecisionCalculator.round(stockValueAfter, 2),         // ★库存价值2位
                        currentTime
                    );

                    // 更新产品状态 - 使用精确的库存价值
                    updateProductWeightedPrice(txn.product_id, stockAfter, unitPriceAfter, stockValueAfter);

                    results.push({
                        index: i,
                        transaction_id: result.lastInsertRowid,
                        product_name: product.name,
                        unit_price: calculatedUnitPrice,
                        total_price: calculatedTotalPrice,
                        unit_price_before: unitPriceBefore,
                        unit_price_after: unitPriceAfter,
                        stock_before: stockBefore,
                        stock_after: stockAfter,
                        stock_value_after: stockValueAfter,
                        success: true
                    });
                } catch (error) {
                    console.error(`批量交易处理错误 (索引 ${i}):`, error);
                    processingErrors.push({ index: i, error: error.message });
                }
            }

            if (processingErrors.length > 0 && results.length === 0) {
                throw new Error('All transactions failed');
            }

            return { results, processingErrors };
        });

        const { results, processingErrors } = dbTransaction();

        res.status(201).json({
            message: 'Bulk transaction completed',
            successful: results.length,
            failed: processingErrors.length,
            results,
            errors: processingErrors
        });
    } catch (error) {
        console.error('Bulk transaction error:', error);
        res.status(500).json({ error: error.message || 'Failed to process bulk transactions' });
    }
});

// 交易作废功能 - 删除交易并回滚产品状态
router.delete('/:id', (req, res) => {
    const transactionId = parseInt(req.params.id);
    
    if (!transactionId || isNaN(transactionId)) {
        return res.status(400).json({ error: '无效的交易ID' });
    }
    
    const transaction = db.transaction(() => {
        try {
            // 1. 获取要删除的交易详情（包括document_id）
            const transactionToDelete = db.prepare(`
                SELECT t.*, p.name as product_name
                FROM transactions t
                JOIN products p ON t.product_id = p.id
                WHERE t.id = ?
            `).get(transactionId);
            
            if (!transactionToDelete) {
                throw new Error('交易记录不存在');
            }
            
            // 2. 检查是否有后续交易
            const laterTransactions = db.prepare(`
                SELECT COUNT(*) as count FROM transactions 
                WHERE product_id = ? AND id > ?
            `).get(transactionToDelete.product_id, transactionId);
            
            if (laterTransactions.count > 0) {
                throw new Error('无法删除此交易，因为该产品在此之后还有其他交易记录。请先删除后续交易。');
            }
            
            // 3. 获取前一个交易的状态信息（用于回滚）
            const previousTransaction = db.prepare(`
                SELECT stock_after, stock_unit_price, stock_value 
                FROM transactions 
                WHERE product_id = ? AND id < ? 
                ORDER BY id DESC LIMIT 1
            `).get(transactionToDelete.product_id, transactionId);
            
            // 4. 确定回滚后的状态
            const rollbackState = previousTransaction || {
                stock_after: 0,
                stock_unit_price: 0,
                stock_value: 0
            };
            
            // 5. 记录删除日志（包括document_id）
            db.prepare(`
                INSERT INTO deleted_transactions_log 
                (original_transaction_id, product_id, product_name, type, quantity, 
                 unit_price, total_price, stock_before, stock_after, 
                 stock_unit_price, stock_value, original_date, document_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                transactionToDelete.id,
                transactionToDelete.product_id,
                transactionToDelete.product_name,
                transactionToDelete.type,
                transactionToDelete.quantity,
                transactionToDelete.unit_price,
                transactionToDelete.total_price,
                transactionToDelete.stock_before,
                transactionToDelete.stock_after,
                transactionToDelete.stock_unit_price,
                transactionToDelete.stock_value,
                transactionToDelete.created_at,
                transactionToDelete.document_id || null
            );
            
            // 6. 将products表回滚到前一个交易的状态
            // ★ 强制精度：stock_value→2位，unit_price→4位（防止历史4位数据污染）
            db.prepare(`
                UPDATE products 
                SET stock = ?, 
                    current_unit_price = ?, 
                    total_cost_value = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                PrecisionCalculator.formatStorage(rollbackState.stock_after),
                PrecisionCalculator.formatPrice(rollbackState.stock_unit_price),
                PrecisionCalculator.round(rollbackState.stock_value, 2),
                transactionToDelete.product_id
            );
            
            // 7. 删除交易记录（但不删除关联的单据和图片）
            db.prepare('DELETE FROM transactions WHERE id = ?').run(transactionId);
            
            // 7.5 检查该单据是否还有其他交易记录，如果没有则将单据状态改为cancelled
            if (transactionToDelete.document_id) {
                const remainingTransactions = db.prepare(
                    'SELECT COUNT(*) as count FROM transactions WHERE document_id = ?'
                ).get(transactionToDelete.document_id);
                
                if (remainingTransactions.count === 0) {
                    // 该单据已没有交易记录，将其状态改为cancelled，并修改单据号以释放原单据号
                    const currentTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
                    const doc = db.prepare('SELECT document_number FROM documents WHERE id = ?').get(transactionToDelete.document_id);
                    
                    if (doc) {
                        // 修改单据号：添加 _cancelled_时间戳 后缀，这样可以释放原单据号供重用
                        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
                        const newDocNumber = `${doc.document_number}_cancelled_${timestamp}`;
                        
                        db.prepare(`
                            UPDATE documents 
                            SET document_number = ?, status = 'cancelled', cancelled_at = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        `).run(newDocNumber, currentTime, transactionToDelete.document_id);
                        
                        console.log(`[单据作废] 单据ID ${transactionToDelete.document_id} 已无交易记录，状态已更新为cancelled，单据号从 ${doc.document_number} 改为 ${newDocNumber}`);
                    }
                }
            }
            
            // 8. 如果有关联的单据图片，重命名为作废状态
            let renamedImagePath = null;
            if (transactionToDelete.document_id) {
                const document = db.prepare('SELECT image_path, image_filename FROM documents WHERE id = ?')
                    .get(transactionToDelete.document_id);
                
                const oldPath = resolveUploadPath(document?.image_path);
                if (oldPath && fs.existsSync(oldPath)) {
                    const dir = path.dirname(oldPath);
                    const ext = path.extname(oldPath);
                    const baseName = path.basename(oldPath, ext);
                    
                    // 新文件名：原名_已作废_时间戳
                    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
                    const newFilename = `${baseName}_已作废_${timestamp}${ext}`;
                    const newPath = path.join(dir, newFilename);
                    
                    try {
                        fs.renameSync(oldPath, newPath);
                        // 更新数据库中的图片路径
                        db.prepare('UPDATE documents SET image_path = ?, image_filename = ? WHERE id = ?')
                            .run(toStoredUploadPath(newPath), newFilename, transactionToDelete.document_id);
                        renamedImagePath = toStoredUploadPath(newPath);
                        console.log(`[图片作废] 已重命名: ${baseName}${ext} -> ${newFilename}`);
                    } catch (renameErr) {
                        console.warn(`[图片作废] 重命名失败:`, renameErr.message);
                    }
                }
            }
            
            return {
                success: true,
                message: '交易已成功作废，产品状态已回滚',
                deletedTransaction: transactionToDelete,
                rolledBackTo: rollbackState,
                renamedImagePath
            };
            
        } catch (error) {
            throw error;
        }
    });
    
    try {
        const result = transaction();
        res.json(result);
    } catch (error) {
        console.error('作废交易失败:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
