const express = require('express');
const db = require('../database/connection');
const { generateMonthlySnapshot, generateHistoricalSnapshots, getSnapshotStats } = require('../scripts/generate-monthly-snapshot');

const router = express.Router();

/**
 * 手动生成月度快照
 * POST /api/snapshots/generate
 * Body: { year: 2025, month: 7 }
 */
router.post('/generate', async (req, res) => {
    try {
        const { year, month } = req.body;
        
        // 参数验证
        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({ 
                error: '请提供有效的年份和月份',
                example: { year: 2025, month: 7 }
            });
        }
        
        const result = await generateMonthlySnapshot(parseInt(year), parseInt(month));
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                data: {
                    year: parseInt(year),
                    month: parseInt(month),
                    productCount: result.count,
                    generatedAt: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.message
            });
        }
        
    } catch (error) {
        console.error('手动生成快照API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '生成快照失败',
            details: error.message 
        });
    }
});

/**
 * 生成当前月份快照
 * POST /api/snapshots/generate-current
 */
router.post('/generate-current', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // JavaScript月份从0开始
        
        const result = await generateMonthlySnapshot(currentYear, currentMonth);
        
        if (result.success) {
            res.json({
                success: true,
                message: `${currentYear}年${currentMonth}月快照生成成功`,
                data: {
                    year: currentYear,
                    month: currentMonth,
                    productCount: result.count,
                    generatedAt: new Date().toISOString()
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.message
            });
        }
        
    } catch (error) {
        console.error('生成当前月份快照API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '生成当前月份快照失败',
            details: error.message 
        });
    }
});

/**
 * 批量生成历史快照
 * POST /api/snapshots/generate-batch
 * Body: { startYear: 2025, startMonth: 1, endYear: 2025, endMonth: 6 }
 */
router.post('/generate-batch', async (req, res) => {
    try {
        const { startYear, startMonth, endYear, endMonth } = req.body;
        
        // 参数验证
        if (!startYear || !startMonth || !endYear || !endMonth ||
            startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
            return res.status(400).json({ 
                error: '请提供有效的开始和结束年月',
                example: { startYear: 2025, startMonth: 1, endYear: 2025, endMonth: 6 }
            });
        }
        
        const results = await generateHistoricalSnapshots(
            parseInt(startYear), parseInt(startMonth),
            parseInt(endYear), parseInt(endMonth)
        );
        
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        res.json({
            success: successCount > 0,
            message: `批量生成完成: ${successCount}/${totalCount} 个月份成功`,
            data: {
                totalMonths: totalCount,
                successCount: successCount,
                failureCount: totalCount - successCount,
                results: results
            }
        });
        
    } catch (error) {
        console.error('批量生成快照API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '批量生成快照失败',
            details: error.message 
        });
    }
});

/**
 * 获取快照列表和统计
 * GET /api/snapshots/list?year=2025&month=7
 */
router.get('/list', (req, res) => {
    try {
        const { year, month } = req.query;
        
        let query = `
            SELECT 
                year, month, 
                COUNT(*) as product_count,
                SUM(ending_stock_value) as total_value,
                SUM(ending_stock) as total_stock,
                SUM(transaction_count) as total_transactions,
                MAX(snapshot_date) as snapshot_date,
                MIN(snapshot_date) as first_snapshot_date
            FROM monthly_stock_snapshots
        `;
        
        const params = [];
        const conditions = [];
        
        if (year) {
            conditions.push('year = ?');
            params.push(parseInt(year));
        }
        
        if (month) {
            conditions.push('month = ?');
            params.push(parseInt(month));
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' GROUP BY year, month ORDER BY year DESC, month DESC';
        
        const snapshots = db.prepare(query).all(...params);
        
        // 格式化数据
        const formattedSnapshots = snapshots.map(snapshot => ({
            ...snapshot,
            total_value: Math.round(snapshot.total_value * 100) / 100,
            snapshot_date: new Date(snapshot.snapshot_date).toLocaleString('zh-CN')
        }));
        
        res.json({
            success: true,
            data: {
                snapshots: formattedSnapshots,
                totalMonths: formattedSnapshots.length
            }
        });
        
    } catch (error) {
        console.error('获取快照列表API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '获取快照列表失败',
            details: error.message 
        });
    }
});

/**
 * 获取指定月份的详细快照数据
 * GET /api/snapshots/detail/:year/:month
 */
router.get('/detail/:year/:month', (req, res) => {
    try {
        const { year, month } = req.params;
        
        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({ 
                error: '请提供有效的年份和月份' 
            });
        }
        
        const detailQuery = `
            SELECT 
                id, product_id, product_name, product_barcode,
                category_id, category_name,
                ending_stock, ending_unit_price, ending_stock_value,
                in_quantity, out_quantity, net_quantity,
                total_in_value, total_out_value, net_value,
                transaction_count, snapshot_date
            FROM monthly_stock_snapshots
            WHERE year = ? AND month = ?
            ORDER BY category_name, product_name
        `;
        
        const details = db.prepare(detailQuery).all(parseInt(year), parseInt(month));
        
        if (details.length === 0) {
            return res.status(404).json({
                success: false,
                error: `未找到 ${year}年${month}月 的快照数据`
            });
        }
        
        // 按分类分组
        const groupedByCategory = details.reduce((acc, item) => {
            const categoryName = item.category_name;
            if (!acc[categoryName]) {
                acc[categoryName] = {
                    category_id: item.category_id,
                    category_name: categoryName,
                    products: [],
                    summary: {
                        product_count: 0,
                        total_value: 0,
                        total_stock: 0,
                        total_transactions: 0
                    }
                };
            }
            
            acc[categoryName].products.push({
                id: item.id,
                product_id: item.product_id,
                product_name: item.product_name,
                product_barcode: item.product_barcode,
                ending_stock: item.ending_stock,
                ending_unit_price: item.ending_unit_price,
                ending_stock_value: item.ending_stock_value,
                monthly_stats: {
                    in_quantity: item.in_quantity,
                    out_quantity: item.out_quantity,
                    net_quantity: item.net_quantity,
                    total_in_value: item.total_in_value,
                    total_out_value: item.total_out_value,
                    net_value: item.net_value,
                    transaction_count: item.transaction_count
                }
            });
            
            // 更新分类汇总
            acc[categoryName].summary.product_count++;
            acc[categoryName].summary.total_value += item.ending_stock_value;
            acc[categoryName].summary.total_stock += item.ending_stock;
            acc[categoryName].summary.total_transactions += item.transaction_count;
            
            return acc;
        }, {});
        
        const categories = Object.values(groupedByCategory);
        
        res.json({
            success: true,
            data: {
                year: parseInt(year),
                month: parseInt(month),
                categories: categories,
                summary: {
                    total_categories: categories.length,
                    total_products: details.length,
                    total_value: categories.reduce((sum, cat) => sum + cat.summary.total_value, 0),
                    total_stock: categories.reduce((sum, cat) => sum + cat.summary.total_stock, 0),
                    total_transactions: categories.reduce((sum, cat) => sum + cat.summary.total_transactions, 0)
                }
            }
        });
        
    } catch (error) {
        console.error('获取快照详情API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '获取快照详情失败',
            details: error.message 
        });
    }
});

/**
 * 删除指定月份的快照
 * DELETE /api/snapshots/:year/:month
 */
router.delete('/:year/:month', (req, res) => {
    try {
        const { year, month } = req.params;
        
        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({ 
                error: '请提供有效的年份和月份' 
            });
        }
        
        const deleteSQL = `DELETE FROM monthly_stock_snapshots WHERE year = ? AND month = ?`;
        const result = db.prepare(deleteSQL).run(parseInt(year), parseInt(month));
        
        if (result.changes > 0) {
            res.json({ 
                success: true,
                message: `已删除 ${year}年${month}月 的快照数据`,
                deletedCount: result.changes 
            });
        } else {
            res.status(404).json({ 
                success: false,
                error: `未找到 ${year}年${month}月 的快照数据` 
            });
        }
        
    } catch (error) {
        console.error('删除快照API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '删除快照失败',
            details: error.message 
        });
    }
});

/**
 * 清理旧快照（删除6个月前的快照）
 * DELETE /api/snapshots/cleanup
 */
router.delete('/cleanup', (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const cutoffYear = sixMonthsAgo.getFullYear();
        const cutoffMonth = sixMonthsAgo.getMonth() + 1; // JavaScript月份从0开始
        
        // 删除指定时间之前的快照
        const deleteStmt = db.prepare(`
            DELETE FROM monthly_stock_snapshots 
            WHERE (year < ? OR (year = ? AND month < ?))
        `);
        
        const result = deleteStmt.run(cutoffYear, cutoffYear, cutoffMonth);
        
        res.json({
            success: true,
            message: `成功清理了 ${result.changes} 个旧快照`,
            data: {
                deleted_count: result.changes,
                cutoff_date: `${cutoffYear}年${cutoffMonth}月`
            }
        });
        
    } catch (error) {
        console.error('清理旧快照API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '清理旧快照失败',
            details: error.message 
        });
    }
});

/**
 * 快照数据统计概览
 * GET /api/snapshots/stats
 */
router.get('/stats', (req, res) => {
    try {
        const stats = getSnapshotStats();
        
        // 计算总体统计
        const totalProducts = stats.reduce((sum, s) => sum + s.product_count, 0);
        const totalValue = stats.reduce((sum, s) => sum + s.total_value, 0);
        const monthsWithSnapshots = stats.length;
        
        res.json({
            success: true,
            data: {
                overview: {
                    total_months: monthsWithSnapshots,
                    total_product_snapshots: totalProducts,
                    total_value: Math.round(totalValue * 100) / 100,
                    latest_snapshot: stats.length > 0 ? stats[0] : null
                },
                monthly_stats: stats
            }
        });
        
    } catch (error) {
        console.error('获取快照统计API错误:', error);
        res.status(500).json({ 
            success: false,
            error: '获取快照统计失败',
            details: error.message 
        });
    }
});

module.exports = router;
