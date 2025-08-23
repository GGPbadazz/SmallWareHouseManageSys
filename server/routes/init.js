const express = require('express');
const db = require('../database/connection');
const router = express.Router();

// 数据初始化：将现有产品库存转换为初始入库交易记录
router.post('/initialize-stock', (req, res) => {
    try {
        const { initDate = '2025-07-01 00:00:00', description = '系统初始化库存' } = req.body;
        
        console.log('🚀 开始数据初始化：将现有产品库存转换为入库交易记录');
        
        // 检查是否已经初始化过
        const existingInitCount = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE purpose LIKE '%系统初始化%' OR purpose LIKE '%初始库存%'
        `).get();
        
        if (existingInitCount.count > 0) {
            return res.status(400).json({ 
                error: '系统已经初始化过，请勿重复操作',
                existing_init_records: existingInitCount.count
            });
        }
        
        // 获取所有有库存或有价值的产品（包括库存为0但有价值的产品）
        const productsWithStock = db.prepare(`
            SELECT 
                id,
                name,
                barcode,
                stock,
                current_unit_price,
                total_cost_value,
                category_id
            FROM products 
            WHERE stock > 0 OR total_cost_value > 0
            ORDER BY category_id, name
        `).all();
        
        if (productsWithStock.length === 0) {
            return res.status(400).json({ error: '没有找到有库存的产品' });
        }
        
        console.log(`📦 找到 ${productsWithStock.length} 个有库存的产品`);
        
        // 开始事务
        const transaction = db.transaction(() => {
            let successCount = 0;
            const results = [];
            
            for (const product of productsWithStock) {
                try {
                    // 完全使用产品的总成本价值，不进行任何修改或计算
                    let totalPrice = product.total_cost_value || 0;
                    
                    // 如果产品没有总成本价值，则使用单价*数量作为备选方案
                    if (totalPrice === 0 && product.current_unit_price > 0) {
                        totalPrice = product.stock * product.current_unit_price;
                        console.log(`⚠️  产品 ${product.name} 使用单价计算总价: ${totalPrice}`);
                    } else if (totalPrice === 0) {
                        // 如果都没有，设置默认值
                        totalPrice = product.stock * 0.01;
                        console.log(`⚠️  产品 ${product.name} 没有价格信息，设置为默认值`);
                    }
                    
                    // 计算单价仅用于记录显示（总价 ÷ 数量）
                    let unitPrice = product.stock > 0 ? totalPrice / product.stock : 0;
                    
                    // 如果产品库存为0但有价值，创建价值记录但不创建库存交易
                    if (product.stock === 0 && totalPrice > 0) {
                        console.log(`💰 产品 ${product.name} 库存为0但有价值 ¥${totalPrice}，跳过交易记录创建`);
                        
                        results.push({
                            product_id: product.id,
                            product_name: product.name,
                            barcode: product.barcode,
                            quantity: 0,
                            unit_price: 0,
                            total_price: totalPrice,
                            transaction_id: null,
                            note: '库存为0但保留价值，未创建交易记录'
                        });
                        
                        successCount++;
                        continue;
                    }
                    
                    // 只为有库存的产品创建交易记录
                    if (product.stock > 0) {
                    const insertTransaction = db.prepare(`
                        INSERT INTO transactions (
                            product_id,
                            type,
                            quantity,
                            unit_price,
                            total_price,
                            requester_name,
                            purpose,
                            stock_before,
                            stock_after,
                            stock_unit_price,
                            stock_value,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `);
                    
                    const result = insertTransaction.run(
                        product.id,
                        'IN',
                        product.stock,
                        unitPrice,
                        totalPrice,
                        'system',
                        `${description} - ${product.name}`,
                        0,               // stock_before (初始化前库存为0)
                        product.stock,   // stock_after (初始化后库存)
                        unitPrice,       // stock_unit_price (库存单价，等于计算出的单价)
                        totalPrice,      // stock_value (库存总价值，等于total_price)
                        initDate
                    );
                    
                    results.push({
                        product_id: product.id,
                        product_name: product.name,
                        barcode: product.barcode,
                        quantity: product.stock,
                        unit_price: unitPrice,
                        total_price: totalPrice,
                        transaction_id: result.lastInsertRowid
                    });
                    
                    successCount++;
                    }
                    
                } catch (error) {
                    console.error(`❌ 初始化产品 ${product.name} 失败:`, error);
                    throw error;
                }
            }
            
            return { successCount, results };
        });
        
        const { successCount, results } = transaction();
        
        console.log(`✅ 数据初始化完成，成功处理 ${successCount} 个产品`);
        
        res.json({
            success: true,
            message: `数据初始化完成，成功创建 ${successCount} 条初始入库记录`,
            init_date: initDate,
            processed_products: successCount,
            total_products: productsWithStock.length,
            results: results
        });
        
    } catch (error) {
        console.error('❌ 数据初始化失败:', error);
        res.status(500).json({ 
            error: '数据初始化失败', 
            details: error.message 
        });
    }
});

// 检查初始化状态
router.get('/init-status', (req, res) => {
    try {
        // 检查是否有初始化记录
        const initRecords = db.prepare(`
            SELECT 
                COUNT(*) as count,
                MIN(created_at) as first_init_date,
                MAX(created_at) as last_init_date
            FROM transactions 
            WHERE purpose LIKE '%系统初始化%' OR purpose LIKE '%初始库存%'
        `).get();
        
        // 获取所有产品的库存统计
        const stockStats = db.prepare(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN stock > 0 THEN 1 END) as products_with_stock,
                SUM(stock) as total_stock_quantity,
                SUM(total_cost_value) as total_stock_value
            FROM products
        `).get();
        
        // 获取交易记录统计
        const transactionStats = db.prepare(`
            SELECT 
                COUNT(*) as total_transactions,
                COUNT(CASE WHEN type = 'IN' THEN 1 END) as in_transactions,
                COUNT(CASE WHEN type = 'OUT' THEN 1 END) as out_transactions,
                MIN(created_at) as first_transaction_date,
                MAX(created_at) as last_transaction_date
            FROM transactions
        `).get();
        
        const isInitialized = initRecords.count > 0;
        
        res.json({
            is_initialized: isInitialized,
            init_records: initRecords,
            stock_stats: stockStats,
            transaction_stats: transactionStats,
            recommendations: {
                need_initialization: !isInitialized && stockStats.products_with_stock > 0,
                message: isInitialized 
                    ? '系统已完成初始化' 
                    : stockStats.products_with_stock > 0 
                        ? '建议进行数据初始化，将现有库存转换为交易记录'
                        : '暂无需要初始化的库存数据'
            }
        });
        
    } catch (error) {
        console.error('检查初始化状态失败:', error);
        res.status(500).json({ error: '检查初始化状态失败' });
    }
});

// 清除初始化数据（危险操作，仅用于测试）
router.delete('/clear-init-data', (req, res) => {
    try {
        const { confirm } = req.body;
        
        if (confirm !== 'CONFIRM_CLEAR_INIT_DATA') {
            return res.status(400).json({ 
                error: '请提供正确的确认码：CONFIRM_CLEAR_INIT_DATA' 
            });
        }
        
        console.log('⚠️  开始清除初始化数据（危险操作）');
        
        // 删除所有初始化相关的交易记录
        const deleteResult = db.prepare(`
            DELETE FROM transactions 
            WHERE purpose LIKE '%系统初始化%' OR purpose LIKE '%初始库存%'
        `).run();
        
        console.log(`🗑️  已删除 ${deleteResult.changes} 条初始化交易记录`);
        
        res.json({
            success: true,
            message: `已清除 ${deleteResult.changes} 条初始化数据`,
            deleted_records: deleteResult.changes
        });
        
    } catch (error) {
        console.error('清除初始化数据失败:', error);
        res.status(500).json({ error: '清除初始化数据失败' });
    }
});

// 重新计算产品库存和价值（基于交易记录）
router.post('/recalculate-stock', (req, res) => {
    try {
        console.log('🔄 开始重新计算产品库存和价值');
        
        // 获取所有产品
        const allProducts = db.prepare('SELECT id, name, total_cost_value FROM products ORDER BY id').all();
        
        const transaction = db.transaction(() => {
            let updatedCount = 0;
            const results = [];
            
            for (const product of allProducts) {
                // 基于交易记录计算库存数量
                const stockCalc = db.prepare(`
                    SELECT 
                        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0) as calculated_stock
                    FROM transactions 
                    WHERE product_id = ?
                `).get(product.id);
                
                const calculatedStock = Math.max(0, stockCalc.calculated_stock || 0);
                
                // 如果有库存，保持原有的总成本价值不变，只重新计算单价
                let finalUnitPrice = 0;
                
                if (calculatedStock > 0 && product.total_cost_value > 0) {
                    // 根据原有的总成本价值和新的库存数量计算单价
                    finalUnitPrice = product.total_cost_value / calculatedStock;
                } else {
                    finalUnitPrice = 0;
                }
                
                // 更新产品表 - 只更新库存数量和单价，不更新总成本价值
                const updateResult = db.prepare(`
                    UPDATE products 
                    SET 
                        stock = ?,
                        current_unit_price = ?,
                        updated_at = ?
                    WHERE id = ?
                `).run(
                    calculatedStock,
                    Math.round(finalUnitPrice * 100) / 100,
                    new Date().toISOString(),
                    product.id
                );
                
                if (updateResult.changes > 0) {
                    updatedCount++;
                    results.push({
                        product_id: product.id,
                        product_name: product.name,
                        calculated_stock: calculatedStock,
                        calculated_unit_price: Math.round(finalUnitPrice * 100) / 100,
                        calculated_value: product.total_cost_value || 0  // 返回原有的总成本价值
                    });
                }
            }
            
            return { updatedCount, results };
        });
        
        const { updatedCount, results } = transaction();
        
        console.log(`✅ 库存重新计算完成，更新了 ${updatedCount} 个产品`);
        
        res.json({
            success: true,
            message: `库存重新计算完成，更新了 ${updatedCount} 个产品`,
            updated_products: updatedCount,
            total_products: allProducts.length,
            results: results.filter(r => r.calculated_stock > 0 || r.calculated_value > 0) // 只返回有库存的产品
        });
        
    } catch (error) {
        console.error('重新计算库存失败:', error);
        res.status(500).json({ error: '重新计算库存失败' });
    }
});

module.exports = router;
