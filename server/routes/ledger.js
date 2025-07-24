const express = require('express');
const db = require('../database/connection');
const router = express.Router();

// 获取月度账本数据
router.get('/monthly', (req, res) => {
    try {
        const { year = 2025, month = 7 } = req.query;
        
        // 构建月份范围
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
        const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
        const nextYear = month == 12 ? parseInt(year) + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01 00:00:00`;

        // 构建上个月的范围（用于计算期初库存）
        const prevMonth = month == 1 ? 12 : parseInt(month) - 1;
        const prevYear = month == 1 ? parseInt(year) - 1 : year;
        const prevMonthStart = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01 00:00:00`;

        // 首先获取所有类别信息
        const allCategoriesQuery = `
            SELECT 
                c.id as category_id,
                c.name as category_name,
                c.description as category_description,
                SUM(COALESCE(p.total_cost_value, 0)) as category_stock_value,
                COUNT(p.id) as total_products_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id
            GROUP BY c.id, c.name, c.description
            ORDER BY c.name ASC
        `;

        const allCategories = db.prepare(allCategoriesQuery).all();

        // 获取有交易记录的产品信息（当前月份）
        const transactionQuery = `
            SELECT 
                c.id as category_id,
                p.id as product_id,
                p.name as product_name,
                p.barcode,
                p.stock as current_stock,
                p.current_unit_price,
                p.total_cost_value,
                COUNT(t.id) as transaction_count,
                SUM(CASE WHEN t.type = 'IN' THEN t.quantity * t.unit_price ELSE -t.quantity * t.unit_price END) as total_amount
            FROM products p
            INNER JOIN categories c ON c.id = p.category_id
            INNER JOIN transactions t ON p.id = t.product_id
            WHERE t.created_at >= ? AND t.created_at < ?
            GROUP BY c.id, p.id, p.name
            ORDER BY c.name ASC, p.name ASC
        `;

        const transactionResults = db.prepare(transactionQuery).all(startDate, endDate);

        // 获取期初库存数据（上个月底的状态）
        const beginningStockQuery = `
            SELECT 
                p.id as product_id,
                COALESCE(stock_after, 0) as beginning_stock,
                COALESCE(stock_unit_price, 0) as beginning_unit_price,
                COALESCE(stock_value, 0) as beginning_stock_value
            FROM products p
            LEFT JOIN (
                SELECT 
                    product_id,
                    stock_after,
                    stock_unit_price,
                    stock_value,
                    ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY created_at DESC) as rn
                FROM transactions 
                WHERE created_at >= ? AND created_at < ?
            ) last_transaction ON p.id = last_transaction.product_id AND last_transaction.rn = 1
            WHERE p.id IN (SELECT DISTINCT product_id FROM transactions WHERE created_at >= ? AND created_at < ?)
        `;

        const beginningStockResults = db.prepare(beginningStockQuery).all(prevMonthStart, startDate, startDate, endDate);
        
        // 创建期初库存映射
        const beginningStockMap = new Map();
        beginningStockResults.forEach(row => {
            beginningStockMap.set(row.product_id, {
                beginning_stock: row.beginning_stock,
                beginning_unit_price: row.beginning_unit_price,
                beginning_stock_value: row.beginning_stock_value
            });
        });

        // 创建所有类别的映射，包括没有交易记录的类别
        const categoriesMap = new Map();

        // 初始化所有类别
        allCategories.forEach(categoryRow => {
            categoriesMap.set(categoryRow.category_id, {
                id: categoryRow.category_id,
                name: categoryRow.category_name,
                description: categoryRow.category_description,
                products: [],
                total_amount: 0,
                category_stock_value: categoryRow.category_stock_value || 0,
                total_products_count: categoryRow.total_products_count || 0
            });
        });

        // 处理有交易记录的产品
        transactionResults.forEach(row => {
            const category = categoriesMap.get(row.category_id);
            if (category) {
                // 获取期初库存数据
                const beginningData = beginningStockMap.get(row.product_id) || {
                    beginning_stock: 0,
                    beginning_unit_price: 0,
                    beginning_stock_value: 0
                };

                category.products.push({
                    id: row.product_id,
                    name: row.product_name,
                    barcode: row.barcode,
                    // 期初库存信息
                    beginning_stock: beginningData.beginning_stock,
                    beginning_unit_price: beginningData.beginning_unit_price,
                    beginning_stock_value: beginningData.beginning_stock_value,
                    // 期末库存信息（重命名）
                    ending_stock: row.current_stock,
                    ending_unit_price: row.current_unit_price,
                    ending_stock_value: row.total_cost_value,
                    // 交易信息
                    transaction_count: row.transaction_count,
                    total_amount: row.total_amount
                });

                category.total_amount += row.total_amount;
            }
        });

        const categories = Array.from(categoriesMap.values());

        // 计算期初期末汇总
        const summary = {
            total_categories: allCategories.length, // 显示所有类别数量
            total_products: transactionResults.length, // 有交易记录的产品数量
            total_transaction_amount: categories.reduce((sum, cat) => sum + cat.total_amount, 0),
            total_stock_value: categories.reduce((sum, cat) => sum + cat.category_stock_value, 0)
        };

        res.json({
            year: parseInt(year),
            month: parseInt(month),
            categories,
            summary
        });

    } catch (error) {
        console.error('获取月度账本数据错误:', error);
        res.status(500).json({ error: '获取月度账本数据失败' });
    }
});

// 获取产品的交易详情
router.get('/product/:id/transactions', (req, res) => {
    try {
        const { id } = req.params;
        const { year = 2025, month = 7, page = 1, pageSize = 10 } = req.query;

        // 构建月份范围
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
        const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
        const nextYear = month == 12 ? parseInt(year) + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01 00:00:00`;

        // 获取产品信息
        const product = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ?
        `).get(id);

        if (!product) {
            return res.status(404).json({ error: '产品不存在' });
        }

        // 获取交易记录总数
        const countQuery = `
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.product_id = ? AND t.created_at >= ? AND t.created_at < ?
        `;
        const { total } = db.prepare(countQuery).get(id, startDate, endDate);

        // 获取分页的交易记录
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const transactionsQuery = `
            SELECT 
                t.*,
                t.quantity * t.unit_price as total_price,
                pr.name as project_name,
                p.name as product_name,
                p.barcode
            FROM transactions t
            LEFT JOIN projects pr ON t.project_id = pr.id
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.product_id = ? AND t.created_at >= ? AND t.created_at < ?
            ORDER BY t.created_at ASC
            LIMIT ? OFFSET ?
        `;

        const transactions = db.prepare(transactionsQuery).all(
            id, startDate, endDate, parseInt(pageSize), offset
        );

        // 为了显示交易后库存，需要计算每笔交易后的库存状态
        // 获取月初库存
        const monthStartStock = db.prepare(`
            SELECT stock FROM products WHERE id = ?
        `).get(id).stock || 0;

        // 重新计算每笔交易后的库存和价值
        let runningStock = monthStartStock;
        let runningUnitPrice = product.current_unit_price || 0;

        const enrichedTransactions = transactions.map(transaction => {
            if (transaction.type === 'IN') {
                // 入库：更新库存和加权平均价格
                const currentValue = runningStock * runningUnitPrice;
                const incomingValue = transaction.quantity * transaction.unit_price;
                runningStock += transaction.quantity;
                runningUnitPrice = runningStock > 0 ? (currentValue + incomingValue) / runningStock : transaction.unit_price;
            } else {
                // 出库：减少库存
                runningStock = Math.max(0, runningStock - transaction.quantity);
            }

            return {
                ...transaction,
                stock_after: runningStock,
                stock_unit_price: Math.round(runningUnitPrice * 100) / 100,
                stock_value: Math.round(runningStock * runningUnitPrice * 100) / 100
            };
        });

        res.json({
            product,
            transactions: enrichedTransactions,
            pagination: {
                current_page: parseInt(page),
                page_size: parseInt(pageSize),
                total_records: total,
                total_pages: Math.ceil(total / parseInt(pageSize))
            }
        });

    } catch (error) {
        console.error('获取产品交易详情错误:', error);
        res.status(500).json({ error: '获取产品交易详情失败' });
    }
});

// 获取类别汇总信息
router.get('/category/:id/summary', (req, res) => {
    try {
        const { id } = req.params;
        const { year = 2025, month = 7 } = req.query;

        // 构建月份范围
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
        const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
        const nextYear = month == 12 ? parseInt(year) + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01 00:00:00`;

        // 获取类别信息
        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!category) {
            return res.status(404).json({ error: '类别不存在' });
        }

        // 获取该类别的汇总信息
        const summaryQuery = `
            SELECT 
                COUNT(DISTINCT p.id) as product_count,
                COUNT(t.id) as transaction_count,
                SUM(CASE WHEN t.type = 'IN' THEN t.quantity * t.unit_price ELSE -t.quantity * t.unit_price END) as total_amount,
                SUM(p.total_cost_value) as total_stock_value
            FROM products p
            LEFT JOIN transactions t ON p.id = t.product_id AND t.created_at >= ? AND t.created_at < ?
            WHERE p.category_id = ?
        `;

        const summary = db.prepare(summaryQuery).get(startDate, endDate, id);

        res.json({
            category,
            summary
        });

    } catch (error) {
        console.error('获取类别汇总信息错误:', error);
        res.status(500).json({ error: '获取类别汇总信息失败' });
    }
});

// 获取月度出库记录（面向财务使用）
router.get('/outbound-records', (req, res) => {
    try {
        const { year = 2025, month = 7 } = req.query;
        
        // 构建月份范围
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
        const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
        const nextYear = month == 12 ? parseInt(year) + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01 00:00:00`;

        // 获取出库记录，按大类和产品分组
        const outboundQuery = `
            SELECT 
                t.id,
                t.type,
                t.quantity,
                t.unit_price,
                t.requester_name,
                t.purpose,
                t.stock_after,
                t.created_at,
                p.id as product_id,
                p.name as product_name,
                p.barcode as product_barcode,
                c.id as category_id,
                c.name as category_name,
                pr.name as project_name,
                pr.description as department
            FROM transactions t
            INNER JOIN products p ON t.product_id = p.id
            INNER JOIN categories c ON p.category_id = c.id
            LEFT JOIN projects pr ON t.project_id = pr.id
            WHERE t.type = 'OUT' 
                AND t.created_at >= ? 
                AND t.created_at < ?
            ORDER BY c.name ASC, p.name ASC, t.created_at ASC
        `;

        const outboundRecords = db.prepare(outboundQuery).all(startDate, endDate);

        res.json({
            success: true,
            records: outboundRecords,
            summary: {
                total_records: outboundRecords.length,
                period: `${year}年${month}月`,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('获取出库记录错误:', error);
        res.status(500).json({ error: '获取出库记录失败' });
    }
});

module.exports = router;
