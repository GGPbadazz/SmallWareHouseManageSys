const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const router = express.Router();

// 财务精度计算工具类
class PrecisionCalculator {
    // 精度常量
    static STORAGE_DECIMALS = 4;    // 数据库存储精度
    static CALCULATION_DECIMALS = 6; // 中间计算精度
    static DISPLAY_DECIMALS = 4;     // 用户界面显示精度

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
}

// 加权平均成本计算函数 - 使用精确的精度计算
const calculateWeightedAveragePrice = (currentStock, currentStockValue, inboundQuantity, inboundPrice) => {
    if (currentStock === 0) {
        const totalValue = PrecisionCalculator.multiply(inboundQuantity, inboundPrice);
        return {
            unitPrice: PrecisionCalculator.formatCalculation(inboundPrice),
            totalValue: PrecisionCalculator.formatCalculation(totalValue)
        };
    }
    
    // 关键修复：直接使用实际的库存价值，而不是通过单价重新计算
    const currentTotalValue = PrecisionCalculator.formatCalculation(currentStockValue);
    const inboundTotalValue = PrecisionCalculator.multiply(inboundQuantity, inboundPrice);
    const newTotalValue = PrecisionCalculator.add(currentTotalValue, inboundTotalValue);
    const newTotalQuantity = PrecisionCalculator.add(currentStock, inboundQuantity);
    
    // 使用精确计算得出单价，保持总价值的精确性
    const unitPrice = PrecisionCalculator.divide(newTotalValue, newTotalQuantity);
    
    return {
        unitPrice: PrecisionCalculator.formatCalculation(unitPrice),
        totalValue: PrecisionCalculator.formatCalculation(newTotalValue)
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
    const formattedUnitPrice = PrecisionCalculator.formatStorage(newUnitPrice);
    
    // 直接使用交易计算出的库存价值，不进行重新计算
    const newStockValue = exactStockValue !== null ? 
        exactStockValue : 0;
    
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
        const { limit = 50, offset = 0, type, product_id, project_id } = req.query;
        
        let query = `
            SELECT t.*, 
                   p.name as product_name, p.barcode, p.stock as current_stock,
                   p.current_unit_price, p.total_cost_value,
                   pr.name as project_name
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
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
                }
                
                const weightedResult = calculateWeightedAveragePrice(
                    stockBefore, 
                    stockValueBefore, 
                    quantity, 
                    calculatedUnitPrice
                );
                
                stockAfter = PrecisionCalculator.add(stockBefore, quantity);
                unitPriceAfter = weightedResult.unitPrice;
                stockValueAfter = weightedResult.totalValue;
                
            } else { // type === 'OUT'
                // 出库：使用当前加权平均单价，使用精确计算
                calculatedUnitPrice = unitPriceBefore;
                
                // 如果是完全清空库存，出库总价等于剩余库存价值（避免计算误差）
                if (quantity >= stockBefore) {
                    calculatedTotalPrice = stockValueBefore;
                    stockAfter = 0;
                    unitPriceAfter = 0;  // 交易后库存单价为0（库存清空）
                    stockValueAfter = 0;
                    // 注意：calculatedUnitPrice保持为unitPriceBefore，记录出库时的实际单价
                } else {
                    // 部分出库：使用精确计算
                    calculatedTotalPrice = PrecisionCalculator.multiply(quantity, calculatedUnitPrice);
                    stockAfter = PrecisionCalculator.subtract(stockBefore, quantity);
                    unitPriceAfter = unitPriceBefore; // 出库不改变加权平均单价
                    stockValueAfter = PrecisionCalculator.subtract(stockValueBefore, calculatedTotalPrice);
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
                PrecisionCalculator.formatStorage(quantity),
                PrecisionCalculator.formatStorage(calculatedUnitPrice),
                PrecisionCalculator.formatStorage(calculatedTotalPrice),
                PrecisionCalculator.formatStorage(stockBefore),
                PrecisionCalculator.formatStorage(stockAfter),
                PrecisionCalculator.formatStorage(unitPriceAfter), // 库存单价：交易后的库存单价（库存清空时为0）
                PrecisionCalculator.formatStorage(stockValueAfter),
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

// Get recent transactions
router.get('/recent/:limit?', (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 20;
        
        const stmt = db.prepare(`
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
            ORDER BY t.created_at DESC 
            LIMIT ?
        `);
        const transactions = stmt.all(limit);

        res.json(transactions);
    } catch (error) {
        console.error('Get recent transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch recent transactions' });
    }
});

// Create bulk transactions
router.post('/bulk', [
    body('transactions').isArray({ min: 1 }).withMessage('Transactions array is required'),
    body('transactions.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID is required for each transaction'),
    body('transactions.*.type').isIn(['IN', 'OUT']).withMessage('Type must be IN or OUT for each transaction'),
    body('transactions.*.quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be a positive number (minimum 0.001) for each transaction'),
    body('transactions.*.unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number')
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

                    // 计算价格信息
                    let calculatedUnitPrice = txn.unit_price;
                    let calculatedTotalPrice = txn.unit_price ? txn.unit_price * txn.quantity : 0;

                    // 计算交易后状态
                    let stockAfter, unitPriceAfter, stockValueAfter;
                    
                    if (txn.type === 'IN') {
                        // 入库：计算新的加权平均单价和精确的库存价值
                        if (!calculatedUnitPrice || calculatedUnitPrice <= 0) {
                            processingErrors.push({ 
                                index: i, 
                                error: `Unit price is required for inbound transaction of ${product.name}` 
                            });
                            continue;
                        }
                        
                        const weightedResult = calculateWeightedAveragePrice(
                            stockBefore, 
                            stockValueBefore, 
                            txn.quantity, 
                            calculatedUnitPrice
                        );
                        
                        stockAfter = stockBefore + txn.quantity;
                        unitPriceAfter = weightedResult.unitPrice;
                        stockValueAfter = weightedResult.totalValue;
                        
                    } else { // type === 'OUT'
                        // 出库：使用当前加权平均单价
                        calculatedUnitPrice = unitPriceBefore;
                        
                        // 如果是完全清空库存，出库总价等于剩余库存价值（避免计算误差）
                        if (txn.quantity >= stockBefore) {
                            calculatedTotalPrice = stockValueBefore;
                            stockAfter = 0;
                            unitPriceAfter = 0;  // 交易后库存单价为0（库存清空）
                            stockValueAfter = 0;
                            // 注意：calculatedUnitPrice保持为unitPriceBefore，记录出库时的实际单价
                        } else {
                            // 部分出库
                            calculatedTotalPrice = txn.quantity * calculatedUnitPrice;
                            stockAfter = stockBefore - txn.quantity;
                            unitPriceAfter = unitPriceBefore; // 出库不改变加权平均单价
                            stockValueAfter = stockValueBefore - calculatedTotalPrice;
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
                        calculatedUnitPrice,
                        calculatedTotalPrice,
                        stockAfter,
                        unitPriceAfter,        // stock_unit_price
                        stockValueAfter,       // stock_value
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

// Get recent transactions summary
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

        res.json({
            recentTransactions,
            todayStats
        });
    } catch (error) {
        console.error('Get recent transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch recent transactions' });
    }
});

// Get recent transactions for dashboard
router.get('/recent', (req, res) => {
    try {
        const query = `
            SELECT t.*, p.name as product_name, p.barcode, pr.name as project_name
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
            ORDER BY t.created_at DESC 
            LIMIT 10
        `;
        
        const stmt = db.prepare(query);
        const transactions = stmt.all();

        res.json(transactions);
    } catch (error) {
        console.error('Recent transactions error:', error);
        res.status(500).json({ error: 'Failed to get recent transactions' });
    }
});

module.exports = router;
