const express = require('express');
const db = require('../database/connection');
const router = express.Router();

// 导入精度计算工具类
class PrecisionCalculator {
    // 精度常量
    static STORAGE_DECIMALS = 2;    // 数据库存储精度（总金额、库存价值）
    static PRICE_DECIMALS = 4;      // 单价精度
    static DISPLAY_DECIMALS = 2;    // 显示精度
    static PRECISION_FACTOR = Math.pow(10, this.PRICE_DECIMALS);

    // 格式化用于存储的数值（保留2位小数）
    static formatStorage(value) {
        return parseFloat(Number(value).toFixed(this.STORAGE_DECIMALS));
    }

    // 格式化单价（保留4位小数）
    static formatPrice(value) {
        return parseFloat(Number(value).toFixed(this.PRICE_DECIMALS));
    }

    // 格式化用于计算的数值（保留6位小数以提高计算精度）
    static formatCalculation(value) {
        return parseFloat(Number(value).toFixed(6));
    }

    // 精确加法
    static add(a, b) {
        return this.formatCalculation((a * this.PRECISION_FACTOR + b * this.PRECISION_FACTOR) / this.PRECISION_FACTOR);
    }

    // 精确减法
    static subtract(a, b) {
        return this.formatCalculation((a * this.PRECISION_FACTOR - b * this.PRECISION_FACTOR) / this.PRECISION_FACTOR);
    }

    // 精确乘法
    static multiply(a, b) {
        return this.formatCalculation(a * b);
    }

    // 精确除法
    static divide(a, b) {
        if (b === 0) return 0;
        return this.formatCalculation(a / b);
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
                    // 🔧 修复：直接使用产品的总成本价值，完全不进行任何计算
                    let totalPrice = product.total_cost_value || 0;
                    
                    // 如果产品没有总成本价值，则使用单价*数量作为备选方案
                    if (totalPrice === 0 && product.current_unit_price > 0) {
                        totalPrice = product.current_unit_price * product.stock;
                        console.log(`⚠️  产品 ${product.name} 使用单价计算总价: ${totalPrice}`);
                    } else if (totalPrice === 0) {
                        // 如果都没有，设置默认值
                        totalPrice = product.stock * 0.01;
                        console.log(`⚠️  产品 ${product.name} 没有价格信息，设置为默认值`);
                    }
                    
                    // 🔧 修复：初始化时完全不进行精度计算，直接使用原始值
                    // 直接使用产品已有的单价，或者简单计算单价（但不影响总价）
                    let unitPrice = product.current_unit_price || (product.stock > 0 ? totalPrice / product.stock : 0);
                    
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
                    
                    // 只为有库存的产品创建交易记录，直接使用现有价值而不重新计算
                    if (product.stock > 0) {
                        // 🔧 修复：初始化时直接使用原始数据库值，避免任何精度计算
                        // 完全保持原始价值不变，不进行任何数学运算
                        const finalUnitPrice = unitPrice;              // 使用计算的单价（仅用于记录）
                        const finalTotalValue = product.total_cost_value || 0;  // 直接使用数据库原始值
                        
                        console.log(`📦 产品 ${product.name}: 库存=${product.stock}, 单价=${finalUnitPrice}, 总价=${finalTotalValue} (使用数据库原始值)`);
                    
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
                            finalUnitPrice,      // 使用现有单价，不重新计算
                            finalTotalValue,     // 使用现有总价值，不重新计算
                            'system',
                            `${description} - ${product.name}`,
                            0,                   // stock_before (初始化前库存为0)
                            product.stock,       // stock_after (初始化后库存)
                            finalUnitPrice,      // stock_unit_price (库存单价)
                            finalTotalValue,     // stock_value (库存总价值)
                            initDate
                        );
                        
                        // 🔧 修复：初始化时不修改产品表的价格信息
                        // 初始化只是记录历史状态，不应该改变现有的价格数据
                        // 保持产品表中的原有价格不变
                        
                        results.push({
                            product_id: product.id,
                            product_name: product.name,
                            barcode: product.barcode,
                            quantity: product.stock,
                            unit_price: finalUnitPrice,
                            total_price: finalTotalValue,
                            transaction_id: result.lastInsertRowid,
                            note: '使用现有价值进行初始化，未重新计算价格'
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

module.exports = router;
