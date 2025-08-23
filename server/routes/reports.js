const express = require('express');
const db = require('../database/connection');
const router = express.Router();

// Get dashboard stats
router.get('/stats', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        
        // Get today's transactions
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = ?
        `).get(today).count;
        
        // Calculate total inventory value - 修复：使用正确的库存价值计算
        const totalValue = db.prepare('SELECT SUM(COALESCE(total_cost_value, 0)) as total FROM products').get().total || 0;
        
        res.json({
            total_products: totalProducts,
            low_stock_count: lowStockCount,
            today_transactions: todayTransactions,
            total_value: totalValue // 修复：使用正确的库存总价值
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Get inventory status report
router.get('/inventory-status', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        const zeroStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock = 0').get().count;
        const totalStockValue = db.prepare('SELECT SUM(COALESCE(total_cost_value, 0)) as total FROM products').get().total || 0;

        // Get low stock products
        const lowStockProducts = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.stock <= p.min_stock 
            ORDER BY p.stock ASC
        `).all();

        // Get category distribution
        const categoryDistribution = db.prepare(`
            SELECT c.name, COUNT(p.id) as product_count, SUM(p.stock) as total_stock
            FROM categories c 
            LEFT JOIN products p ON c.id = p.category_id 
            GROUP BY c.id, c.name 
            ORDER BY product_count DESC
        `).all();

        res.json({
            summary: {
                totalProducts,
                lowStockItems,
                zeroStockItems,
                totalStockValue,
                healthScore: totalProducts > 0 ? ((totalProducts - lowStockItems) / totalProducts * 100).toFixed(1) : 0
            },
            lowStockProducts,
            categoryDistribution
        });
    } catch (error) {
        console.error('Inventory status report error:', error);
        res.status(500).json({ error: 'Failed to generate inventory status report' });
    }
});

// Get transaction flow report
router.get('/transaction-flow', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = '';
        const params = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE DATE(t.created_at) BETWEEN ? AND ?';
            params.push(startDate, endDate);
        } else if (startDate) {
            dateFilter = 'WHERE DATE(t.created_at) >= ?';
            params.push(startDate);
        } else if (endDate) {
            dateFilter = 'WHERE DATE(t.created_at) <= ?';
            params.push(endDate);
        }

        // Get transaction summary
        const transactionSummary = db.prepare(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) as total_in,
                SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as total_out,
                COUNT(CASE WHEN type = 'IN' THEN 1 END) as in_transactions,
                COUNT(CASE WHEN type = 'OUT' THEN 1 END) as out_transactions
            FROM transactions t ${dateFilter}
        `).get(...params);

        // Get daily transaction volume
        const dailyVolume = db.prepare(`
            SELECT 
                DATE(t.created_at) as date,
                COUNT(*) as transaction_count,
                SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) as in_quantity,
                SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as out_quantity
            FROM transactions t ${dateFilter}
            GROUP BY DATE(t.created_at)
            ORDER BY date DESC
            LIMIT 30
        `).all(...params);

        // Get top products by transaction volume
        const topProducts = db.prepare(`
            SELECT 
                p.name,
                p.barcode,
                COUNT(t.id) as transaction_count,
                SUM(t.quantity) as total_quantity,
                SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE 0 END) as in_quantity,
                SUM(CASE WHEN t.type = 'OUT' THEN t.quantity ELSE 0 END) as out_quantity
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            ${dateFilter}
            GROUP BY p.id, p.name, p.barcode
            ORDER BY transaction_count DESC
            LIMIT 10
        `).all(...params);

        // Get project usage
        const projectUsage = db.prepare(`
            SELECT 
                pr.name as project_name,
                COUNT(t.id) as transaction_count,
                SUM(t.quantity) as total_quantity
            FROM transactions t
            LEFT JOIN projects pr ON t.project_id = pr.id
            ${dateFilter}
            WHERE pr.name IS NOT NULL
            GROUP BY pr.id, pr.name
            ORDER BY transaction_count DESC
            LIMIT 10
        `).all(...params);

        res.json({
            summary: transactionSummary,
            dailyVolume,
            topProducts,
            projectUsage
        });
    } catch (error) {
        console.error('Transaction flow report error:', error);
        res.status(500).json({ error: 'Failed to generate transaction flow report' });
    }
});

// Get monthly summary report
router.get('/monthly-summary', (req, res) => {
    try {
        const { year, month } = req.query;
        const currentYear = year || new Date().getFullYear();
        const currentMonth = month || (new Date().getMonth() + 1);

        // Get monthly statistics
        const monthlyStats = db.prepare(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) as total_in,
                SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as total_out,
                COUNT(DISTINCT product_id) as products_affected,
                COUNT(DISTINCT requester_name) as unique_requesters
            FROM transactions 
            WHERE strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
        `).get(currentYear.toString(), currentMonth.toString().padStart(2, '0'));

        // Get daily breakdown
        const dailyBreakdown = db.prepare(`
            SELECT 
                strftime('%d', created_at) as day,
                COUNT(*) as transactions,
                SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) as in_quantity,
                SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as out_quantity
            FROM transactions 
            WHERE strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
            GROUP BY strftime('%d', created_at)
            ORDER BY day
        `).all(currentYear.toString(), currentMonth.toString().padStart(2, '0'));

        // Get most active requesters
        const activeRequesters = db.prepare(`
            SELECT 
                requester_name,
                requester_department,
                COUNT(*) as transaction_count,
                SUM(quantity) as total_quantity
            FROM transactions 
            WHERE strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
            AND requester_name IS NOT NULL
            GROUP BY requester_name, requester_department
            ORDER BY transaction_count DESC
            LIMIT 10
        `).all(currentYear.toString(), currentMonth.toString().padStart(2, '0'));

        res.json({
            period: {
                year: currentYear,
                month: currentMonth
            },
            summary: monthlyStats,
            dailyBreakdown,
            activeRequesters
        });
    } catch (error) {
        console.error('Monthly summary report error:', error);
        res.status(500).json({ error: 'Failed to generate monthly summary report' });
    }
});

// Get low stock alert report
router.get('/low-stock-alert', (req, res) => {
    try {
        const { threshold } = req.query;
        
        let query = `
            SELECT p.*, c.name as category_name,
                   (p.stock * 100.0 / NULLIF(p.min_stock, 0)) as stock_ratio
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.stock <= p.min_stock
        `;
        
        if (threshold) {
            query += ` AND p.stock <= ${parseInt(threshold)}`;
        }
        
        query += ` ORDER BY stock_ratio ASC, p.stock ASC`;
        
        const lowStockProducts = db.prepare(query).all();

        // Get category-wise low stock summary
        const categoryLowStock = db.prepare(`
            SELECT c.name as category_name,
                   COUNT(p.id) as low_stock_count,
                   COUNT(CASE WHEN p.stock = 0 THEN 1 END) as zero_stock_count
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.stock <= p.min_stock
            GROUP BY c.id, c.name
            ORDER BY low_stock_count DESC
        `).all();

        // Get reorder suggestions
        const reorderSuggestions = db.prepare(`
            SELECT p.*, c.name as category_name,
                   (p.min_stock * 2 - p.stock) as suggested_order_quantity
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.stock <= p.min_stock
            ORDER BY suggested_order_quantity DESC
        `).all();

        res.json({
            lowStockProducts,
            categoryLowStock,
            reorderSuggestions,
            summary: {
                totalLowStock: lowStockProducts.length,
                criticalItems: lowStockProducts.filter(p => p.stock === 0).length,
                warningItems: lowStockProducts.filter(p => p.stock > 0).length
            }
        });
    } catch (error) {
        console.error('Low stock alert report error:', error);
        res.status(500).json({ error: 'Failed to generate low stock alert report' });
    }
});

// Get comprehensive analytics
router.get('/analytics', (req, res) => {
    try {
        const { period = '30' } = req.query; // days
        
        // Get overall statistics
        const overallStats = db.prepare(`
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) as total_in,
                SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as total_out,
                COUNT(DISTINCT product_id) as products_transacted,
                COUNT(DISTINCT requester_name) as unique_requesters
            FROM transactions 
            WHERE created_at >= datetime('now', '-${period} days')
        `).get();

        // Get trend data
        const trendData = db.prepare(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as transaction_count,
                SUM(CASE WHEN type = 'IN' THEN quantity ELSE 0 END) as in_quantity,
                SUM(CASE WHEN type = 'OUT' THEN quantity ELSE 0 END) as out_quantity
            FROM transactions 
            WHERE created_at >= datetime('now', '-${period} days')
            GROUP BY DATE(created_at)
            ORDER BY date
        `).all();

        // Get category performance
        const categoryPerformance = db.prepare(`
            SELECT 
                c.name as category_name,
                COUNT(t.id) as transaction_count,
                SUM(t.quantity) as total_quantity,
                AVG(p.stock) as avg_stock,
                COUNT(CASE WHEN p.stock <= p.min_stock THEN 1 END) as low_stock_count
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE t.created_at >= datetime('now', '-${period} days')
            GROUP BY c.id, c.name
            ORDER BY transaction_count DESC
        `).all();

        res.json({
            period: `${period} days`,
            overallStats,
            trendData,
            categoryPerformance
        });
    } catch (error) {
        console.error('Analytics report error:', error);
        res.status(500).json({ error: 'Failed to generate analytics report' });
    }
});

// Get dashboard stats for reports center
router.get('/dashboard', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const monthlyTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) >= DATE('now', '-30 days')
        `).get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        
        // Calculate health score (simplified)
        const healthScore = Math.max(0, Math.min(100, 100 - (lowStockItems / totalProducts * 100)));

        res.json({
            totalProducts: totalProducts,
            monthlyTransactions: monthlyTransactions,
            lowStockItems: lowStockItems,
            healthScore: Math.round(healthScore)
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to get dashboard stats' });
    }
});

// Generate report
router.post('/generate/:type', (req, res) => {
    try {
        const { type } = req.params;
        const timestamp = new Date().toISOString();
        
        let report = {};
        
        switch(type) {
            case 'inventory':
                report = {
                    type: 'inventory',
                    title: '库存状态报告',
                    generated_at: timestamp,
                    data: generateInventoryReport()
                };
                break;
            case 'transactions':
                report = {
                    type: 'transactions',
                    title: '交易流水报告',
                    generated_at: timestamp,
                    data: generateTransactionReport()
                };
                break;
            case 'low-stock':
                report = {
                    type: 'low-stock',
                    title: '低库存预警',
                    generated_at: timestamp,
                    data: generateLowStockReport()
                };
                break;
            case 'comprehensive':
                report = {
                    type: 'comprehensive',
                    title: '综合分析报告',
                    generated_at: timestamp,
                    data: generateComprehensiveReport()
                };
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        res.json(report);
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Get report history
router.get('/history', (req, res) => {
    try {
        // Mock report history - in a real app, this would be stored in database
        const mockHistory = [
            {
                id: 1,
                title: '库存状态报告 - 2024年12月',
                generated_at: '2024-12-09 14:30:25',
                file_size: '2.3MB',
                type: 'inventory'
            },
            {
                id: 2,
                title: '交易流水报告 - Q4 2024',
                generated_at: '2024-12-08 16:45:10',
                file_size: '5.1MB',
                type: 'transactions'
            },
            {
                id: 3,
                title: '供应商统计报告',
                generated_at: '2024-12-07 09:20:36',
                file_size: '1.8MB',
                type: 'comprehensive'
            }
        ];

        res.json(mockHistory);
    } catch (error) {
        console.error('Report history error:', error);
        res.status(500).json({ error: 'Failed to get report history' });
    }
});

function generateInventoryReport() {
    const products = db.prepare('SELECT * FROM products ORDER BY stock ASC').all();
    const categories = db.prepare('SELECT * FROM categories').all();
    
    return {
        products: products,
        categories: categories,
        summary: {
            total_products: products.length,
            low_stock_count: products.filter(p => p.stock <= p.min_stock).length,
            out_of_stock_count: products.filter(p => p.stock === 0).length
        }
    };
}

function generateTransactionReport() {
    const transactions = db.prepare(`
        SELECT t.*, p.name as product_name 
        FROM transactions t 
        LEFT JOIN products p ON t.product_id = p.id 
        ORDER BY t.created_at DESC 
        LIMIT 100
    `).all();
    
    return {
        transactions: transactions,
        summary: {
            total_transactions: transactions.length,
            in_transactions: transactions.filter(t => t.type === 'IN').length,
            out_transactions: transactions.filter(t => t.type === 'OUT').length
        }
    };
}

function generateLowStockReport() {
    const lowStockProducts = db.prepare(`
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.stock <= p.min_stock 
        ORDER BY p.stock ASC
    `).all();
    
    return {
        products: lowStockProducts,
        summary: {
            total_low_stock: lowStockProducts.length,
            critical_stock: lowStockProducts.filter(p => p.stock === 0).length
        }
    };
}

function generateComprehensiveReport() {
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
    const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
    
    return {
        overview: {
            total_products: totalProducts,
            total_transactions: totalTransactions,
            low_stock_items: lowStockItems,
            health_score: Math.max(0, Math.min(100, 100 - (lowStockItems / totalProducts * 100)))
        }
    };
}

module.exports = router;
