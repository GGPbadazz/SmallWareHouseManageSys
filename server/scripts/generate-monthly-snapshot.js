const db = require('../database/connection');

/**
 * 生成指定月份的库存快照
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 */
const generateMonthlySnapshot = async (year, month) => {
    console.log(`🚀 开始生成 ${year}年${month}月 的库存快照...`);
    
    try {
        // 开始事务
        const transaction = db.transaction(() => {
            // 构建月份范围
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
            const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
            const nextYear = month == 12 ? parseInt(year) + 1 : year;
            const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01 00:00:00`;
            
            console.log(`📅 月份范围: ${startDate} 至 ${endDate}`);
            
            // 删除已存在的快照（重新生成）
            const deleteExistingSQL = `DELETE FROM monthly_stock_snapshots WHERE year = ? AND month = ?`;
            const deleteResult = db.prepare(deleteExistingSQL).run(year, month);
            if (deleteResult.changes > 0) {
                console.log(`🗑️ 删除了 ${deleteResult.changes} 条现有快照记录`);
            }
            
            // 获取需要生成快照的产品列表
            // 包括：当月有交易的产品 + 当前有库存的产品
            const getActiveProductsSQL = `
                SELECT DISTINCT p.id as product_id, p.name, p.barcode, p.category_id, c.name as category_name
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.id IN (
                    -- 当月有交易的产品
                    SELECT DISTINCT product_id FROM transactions 
                    WHERE created_at >= ? AND created_at < ?
                    UNION
                    -- 截止月末有库存的产品（通过历史交易计算）
                    SELECT t.product_id
                    FROM transactions t
                    WHERE t.created_at < ?
                    GROUP BY t.product_id
                    HAVING SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END) > 0
                )
            `;
            
            const activeProducts = db.prepare(getActiveProductsSQL).all(startDate, endDate, endDate);
            console.log(`📦 发现 ${activeProducts.length} 个需要生成快照的产品`);
            
            if (activeProducts.length === 0) {
                console.log('⚠️ 没有产品需要生成快照');
                return { count: 0 };
            }
            
            // 为每个活跃产品生成快照
            const insertSnapshotSQL = `
                INSERT INTO monthly_stock_snapshots (
                    year, month, product_id,
                    ending_stock, ending_unit_price, ending_stock_value,
                    in_quantity, out_quantity, net_quantity,
                    total_in_value, total_out_value, net_value,
                    transaction_count,
                    product_name, product_barcode, category_id, category_name,
                    snapshot_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const insertStmt = db.prepare(insertSnapshotSQL);
            let snapshotCount = 0;
            
            // 获取当前中国时间 (UTC+8)
            const now = new Date();
            const chinaTimeString = now.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
            const snapshotDate = chinaTimeString;
            
            activeProducts.forEach(product => {
                // 计算截止月末的库存状态
                const stockQuery = `
                    SELECT 
                        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0) as ending_stock,
                        COALESCE(SUM(CASE WHEN type = 'IN' THEN COALESCE(total_price, quantity * unit_price) 
                                         ELSE -COALESCE(total_price, quantity * unit_price) END), 0) as ending_stock_value
                    FROM transactions
                    WHERE product_id = ? AND created_at < ?
                `;
                
                const stockResult = db.prepare(stockQuery).get(product.product_id, endDate);
                
                // 计算当月交易统计
                const monthlyStatsQuery = `
                    SELECT 
                        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END), 0) as in_quantity,
                        COALESCE(SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END), 0) as out_quantity,
                        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END), 0) as net_quantity,
                        COALESCE(SUM(CASE WHEN type = 'IN' THEN COALESCE(total_price, quantity * unit_price) ELSE 0 END), 0) as total_in_value,
                        COALESCE(SUM(CASE WHEN type = 'OUT' THEN COALESCE(total_price, quantity * unit_price) ELSE 0 END), 0) as total_out_value,
                        COALESCE(SUM(CASE WHEN type = 'IN' THEN COALESCE(total_price, quantity * unit_price) 
                                         ELSE -COALESCE(total_price, quantity * unit_price) END), 0) as net_value,
                        COUNT(*) as transaction_count
                    FROM transactions
                    WHERE product_id = ? AND created_at >= ? AND created_at < ?
                `;
                
                const monthlyStats = db.prepare(monthlyStatsQuery).get(product.product_id, startDate, endDate) || {
                    in_quantity: 0, out_quantity: 0, net_quantity: 0,
                    total_in_value: 0, total_out_value: 0, net_value: 0,
                    transaction_count: 0
                };
                
                // 计算期末单价
                const endingStock = Math.max(0, stockResult.ending_stock || 0);
                const endingStockValue = Math.max(0, stockResult.ending_stock_value || 0);
                const endingUnitPrice = endingStock > 0 ? endingStockValue / endingStock : 0;
                
                // 只为有库存或有交易的产品生成快照
                if (endingStock > 0 || monthlyStats.transaction_count > 0) {
                    insertStmt.run(
                        year, month, product.product_id,
                        endingStock,
                        Math.round(endingUnitPrice * 10000) / 10000,  // 单价保持4位
                        Math.round(endingStockValue * 100) / 100,      // 库存价值改为2位
                        monthlyStats.in_quantity,
                        monthlyStats.out_quantity,
                        monthlyStats.net_quantity,
                        Math.round(monthlyStats.total_in_value * 100) / 100,  // 入库总额2位
                        Math.round(monthlyStats.total_out_value * 100) / 100, // 出库总额2位
                        Math.round(monthlyStats.net_value * 100) / 100,       // 净值2位
                        monthlyStats.transaction_count,
                        product.name,
                        product.barcode,
                        product.category_id,
                        product.category_name,
                        snapshotDate
                    );
                    snapshotCount++;
                }
            });
            
            return { count: snapshotCount };
        });
        
        // 执行事务
        const result = transaction();
        
        console.log(`✅ ${year}年${month}月 库存快照生成完成，共 ${result.count} 个产品`);
        return { 
            success: true, 
            count: result.count, 
            message: `${year}年${month}月快照生成成功，包含${result.count}个产品` 
        };
        
    } catch (error) {
        console.error(`❌ 生成 ${year}年${month}月 快照失败:`, error);
        return { 
            success: false, 
            count: 0, 
            message: `快照生成失败: ${error.message}` 
        };
    }
};

/**
 * 批量生成历史快照
 * @param {number} startYear - 开始年份
 * @param {number} startMonth - 开始月份
 * @param {number} endYear - 结束年份  
 * @param {number} endMonth - 结束月份
 */
const generateHistoricalSnapshots = async (startYear, startMonth, endYear, endMonth) => {
    console.log(`🔄 开始批量生成历史快照: ${startYear}年${startMonth}月 至 ${endYear}年${endMonth}月`);
    
    const results = [];
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const result = await generateMonthlySnapshot(currentYear, currentMonth);
        results.push({ year: currentYear, month: currentMonth, ...result });
        
        // 移动到下一个月
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`🎉 批量生成完成: ${successCount}/${results.length} 个月份成功`);
    
    return results;
};

/**
 * 查看快照统计信息
 */
const getSnapshotStats = () => {
    try {
        const statsQuery = `
            SELECT 
                year, month, 
                COUNT(*) as product_count,
                SUM(ending_stock_value) as total_value,
                MAX(snapshot_date) as snapshot_date
            FROM monthly_stock_snapshots
            GROUP BY year, month 
            ORDER BY year DESC, month DESC
        `;
        
        const stats = db.prepare(statsQuery).all();
        return stats;
    } catch (error) {
        console.error('获取快照统计失败:', error);
        return [];
    }
};

// 如果直接运行此脚本，生成当前月份的快照用于测试
if (require.main === module) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    console.log('🧪 测试模式：生成当前月份快照');
    generateMonthlySnapshot(currentYear, currentMonth)
        .then(result => {
            console.log('测试结果:', result);
            
            console.log('\n📊 当前快照统计:');
            const stats = getSnapshotStats();
            console.table(stats);
        })
        .catch(error => {
            console.error('测试失败:', error);
        });
}

module.exports = {
    generateMonthlySnapshot,
    generateHistoricalSnapshots,
    getSnapshotStats
};
