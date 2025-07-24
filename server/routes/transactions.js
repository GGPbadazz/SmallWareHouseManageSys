const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const router = express.Router();

// 加权平均成本计算函数
const calculateWeightedAveragePrice = (currentStock, currentPrice, inboundQuantity, inboundPrice) => {
    if (currentStock === 0) {
        return inboundPrice; // 库存为0时，直接使用入库价格
    }
    
    const currentTotalValue = currentStock * currentPrice;
    const inboundTotalValue = inboundQuantity * inboundPrice;
    const newTotalValue = currentTotalValue + inboundTotalValue;
    const newTotalQuantity = currentStock + inboundQuantity;
    
    return Math.round((newTotalValue / newTotalQuantity) * 100) / 100; // 保留两位小数
};

// 更新产品的加权平均价格和库存价值
const updateProductWeightedPrice = (productId, newStock, newUnitPrice) => {
    const newStockValue = newStock * newUnitPrice;
    
    const updateStmt = db.prepare(`
        UPDATE products 
        SET stock = ?,
            current_unit_price = ?,
            total_cost_value = ?,
            price = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    
    updateStmt.run(newStock, newUnitPrice, newStockValue, newUnitPrice, productId);
    
    return {
        stock: newStock,
        unitPrice: newUnitPrice,
        stockValue: newStockValue
    };
};

// 计算平均价格的函数（保留向后兼容）
const calculateAveragePrice = (currentStock, currentPrice, incomingQuantity, incomingUnitPrice) => {
    return calculateWeightedAveragePrice(currentStock, currentPrice, incomingQuantity, incomingUnitPrice);
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
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number')
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
            project_id,
            purpose,
            signature,
            unit_price
        } = req.body;

        // 计算单价和总价值
        let calculatedUnitPrice = unit_price;
        let calculatedTotalPrice = unit_price ? unit_price * quantity : 0;

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
                // 入库：计算新的加权平均单价
                if (!calculatedUnitPrice || calculatedUnitPrice <= 0) {
                    throw new Error('Unit price is required for inbound transactions');
                }
                
                stockAfter = stockBefore + quantity;
                unitPriceAfter = calculateWeightedAveragePrice(
                    stockBefore, 
                    unitPriceBefore, 
                    quantity, 
                    calculatedUnitPrice
                );
                stockValueAfter = stockAfter * unitPriceAfter;
                
            } else { // type === 'OUT'
                // 出库：使用当前加权平均单价，不改变单价
                calculatedUnitPrice = unitPriceBefore;
                calculatedTotalPrice = quantity * calculatedUnitPrice;
                
                stockAfter = stockBefore - quantity;
                unitPriceAfter = unitPriceBefore; // 出库不改变加权平均单价
                stockValueAfter = stockAfter * unitPriceAfter;
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
                product_id,
                type,
                quantity,
                requester_name || null,
                project_id || null,
                purpose || null,
                signature || null,
                calculatedUnitPrice,
                calculatedTotalPrice,
                stockAfter,
                unitPriceAfter,        // stock_unit_price: 交易后的加权平均单价
                stockValueAfter,       // stock_value: 交易后的库存价值
                currentTime
            );

            // 更新产品状态
            updateProductWeightedPrice(product_id, stockAfter, unitPriceAfter);

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

        res.status(201).json(createdTransaction);
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
                   t.stock_unit_price,
                   t.stock_value,
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
    body('transactions.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer for each transaction'),
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
                        // 入库：计算新的加权平均单价
                        if (!calculatedUnitPrice || calculatedUnitPrice <= 0) {
                            processingErrors.push({ 
                                index: i, 
                                error: `Unit price is required for inbound transaction of ${product.name}` 
                            });
                            continue;
                        }
                        
                        stockAfter = stockBefore + txn.quantity;
                        unitPriceAfter = calculateWeightedAveragePrice(
                            stockBefore, 
                            unitPriceBefore, 
                            txn.quantity, 
                            calculatedUnitPrice
                        );
                        stockValueAfter = stockAfter * unitPriceAfter;
                        
                    } else { // type === 'OUT'
                        // 出库：使用当前加权平均单价
                        calculatedUnitPrice = unitPriceBefore;
                        calculatedTotalPrice = txn.quantity * calculatedUnitPrice;
                        
                        stockAfter = stockBefore - txn.quantity;
                        unitPriceAfter = unitPriceBefore; // 出库不改变加权平均单价
                        stockValueAfter = stockAfter * unitPriceAfter;
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

                    // 更新产品状态
                    updateProductWeightedPrice(txn.product_id, stockAfter, unitPriceAfter);

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
