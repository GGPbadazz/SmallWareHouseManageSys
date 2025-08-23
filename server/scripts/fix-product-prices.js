const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../database/inventory.db'));

// 高精度修复产品价格的脚本
const fixProductPrices = () => {
    console.log('开始高精度修复产品价格数据...');
    console.log('计算精度：6位小数，存储精度：4位小数');

    try {
        // 获取所有产品
        const products = db.prepare(`
            SELECT id, name, stock, price, current_unit_price, total_cost_value 
            FROM products
        `).all();

        console.log(`找到 ${products.length} 个产品`);

        let updated = 0;

        const updateStmt = db.prepare(`
            UPDATE products 
            SET price = ?, current_unit_price = ?, total_cost_value = ? 
            WHERE id = ?
        `);

        // 开始事务
        const transaction = db.transaction(() => {
            for (const product of products) {
                // 获取该产品最近的交易记录来计算加权平均价格
                const recentTransactions = db.prepare(`
                    SELECT unit_price, quantity, type, created_at
                    FROM transactions 
                    WHERE product_id = ? AND unit_price > 0
                    ORDER BY created_at DESC
                    LIMIT 50
                `).all(product.id);

                let needsUpdate = false;
                let newPrice = product.price;
                let newCurrentUnitPrice = product.current_unit_price;
                let newTotalCostValue = product.total_cost_value;

                // 如果有交易记录，计算加权平均价格
                if (recentTransactions.length > 0) {
                    // 计算入库交易的加权平均价格（6位小数精度）
                    const inboundTransactions = recentTransactions.filter(t => t.type === 'IN');
                    
                    if (inboundTransactions.length > 0) {
                        let totalValue = 0;
                        let totalQuantity = 0;
                        
                        for (const transaction of inboundTransactions) {
                            // 使用6位小数进行计算
                            const value = parseFloat((transaction.unit_price * transaction.quantity).toFixed(6));
                            totalValue = parseFloat((totalValue + value).toFixed(6));
                            totalQuantity = parseFloat((totalQuantity + transaction.quantity).toFixed(6));
                        }
                        
                        if (totalQuantity > 0) {
                            // 计算加权平均价格，6位小数精度
                            const weightedAveragePrice = parseFloat((totalValue / totalQuantity).toFixed(6));
                            // 存储时保留4位小数
                            const finalPrice = parseFloat(weightedAveragePrice.toFixed(4));
                            
                            newPrice = finalPrice;
                            needsUpdate = true;
                            
                            console.log(`产品: ${product.name}`);
                            console.log(`  入库交易数: ${inboundTransactions.length}`);
                            console.log(`  总价值: ${totalValue.toFixed(6)}`);
                            console.log(`  总数量: ${totalQuantity.toFixed(3)}`);
                            console.log(`  计算精度: ${weightedAveragePrice.toFixed(6)}`);
                            console.log(`  存储价格: ${finalPrice.toFixed(4)}`);
                        }
                    }
                }

                // 如果产品有库存，使用计算出的价格更新current_unit_price
                if (product.stock > 0) {
                    if (newPrice > 0) {
                        newCurrentUnitPrice = newPrice;
                        // 计算总价值（6位小数计算，4位小数存储）
                        const calculatedTotalValue = parseFloat((product.stock * newPrice).toFixed(6));
                        newTotalCostValue = parseFloat(calculatedTotalValue.toFixed(4));
                        needsUpdate = true;
                    }
                } else {
                    // 如果没有库存，清零库存相关价格
                    if (newCurrentUnitPrice !== 0 || newTotalCostValue !== 0) {
                        newCurrentUnitPrice = 0;
                        newTotalCostValue = 0;
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    updateStmt.run(newPrice, newCurrentUnitPrice, newTotalCostValue, product.id);
                    updated++;
                    console.log(`更新产品: ${product.name}`);
                    console.log(`  库存: ${product.stock}`);
                    console.log(`  价格: ${product.price} -> ${newPrice}`);
                    console.log(`  当前单价: ${product.current_unit_price} -> ${newCurrentUnitPrice}`);
                    console.log(`  总价值: ${product.total_cost_value} -> ${newTotalCostValue}`);
                    console.log('---');
                }
            }
        });

        transaction();

        console.log(`高精度修复完成！更新了 ${updated} 个产品的价格数据`);
        console.log('计算精度：6位小数，存储精度：4位小数');

        // 验证结果
        const verifyStmt = db.prepare(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN price > 0 THEN 1 END) as with_price,
                COUNT(CASE WHEN current_unit_price > 0 THEN 1 END) as with_unit_price,
                COUNT(CASE WHEN total_cost_value > 0 THEN 1 END) as with_total_value,
                SUM(total_cost_value) as total_inventory_value,
                AVG(CASE WHEN price > 0 THEN price END) as avg_price
            FROM products
        `);

        const verification = verifyStmt.get();
        console.log('\n验证结果:');
        console.log(`总产品数: ${verification.total_products}`);
        console.log(`有价格的产品: ${verification.with_price}`);
        console.log(`有当前单价的产品: ${verification.with_unit_price}`);
        console.log(`有总价值的产品: ${verification.with_total_value}`);
        console.log(`平均产品价格: ¥${verification.avg_price ? verification.avg_price.toFixed(4) : '0.0000'}`);
        console.log(`库存总价值: ¥${verification.total_inventory_value ? verification.total_inventory_value.toFixed(4) : '0.0000'}`);

        // 显示一些样例数据
        const sampleProducts = db.prepare(`
            SELECT name, stock, price, current_unit_price, total_cost_value 
            FROM products 
            WHERE price > 0 
            ORDER BY total_cost_value DESC 
            LIMIT 5
        `).all();

        console.log('\n价值最高的5个产品样例:');
        sampleProducts.forEach(p => {
            console.log(`${p.name}: 库存${p.stock}, 单价¥${p.price}, 总值¥${p.total_cost_value}`);
        });

    } catch (error) {
        console.error('高精度修复过程中出现错误:', error);
    } finally {
        db.close();
    }
};

// 如果直接运行此脚本
if (require.main === module) {
    fixProductPrices();
}

module.exports = { fixProductPrices };
