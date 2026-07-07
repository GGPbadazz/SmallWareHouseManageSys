const express = require('express');
const db = require('../database/connection');
const router = express.Router();

// 将浮点数四舍五入到2位小数，消除浮点累加噪声（如 0.7000000002）
const round2 = v => Math.round((v || 0) * 100) / 100;

// 获取月度账本数据 - 优先使用快照数据
router.get('/monthly', (req, res) => {
    try {
        const { year = 2025, month = 7 } = req.query;
        const now = new Date();
        const isCurrentMonth = (parseInt(year) === now.getFullYear() && parseInt(month) === now.getMonth() + 1);
        
        console.log(`📊 查询账本: ${year}年${month}月, 当前月份: ${isCurrentMonth}`);
        
        // 构建月份范围
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
        const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
        const nextYear = month == 12 ? parseInt(year) + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01 00:00:00`;

        // 构建上个月的范围（用于计算期初库存）
        const prevMonth = month == 1 ? 12 : parseInt(month) - 1;
        const prevYear = month == 1 ? parseInt(year) - 1 : year;

        // 获取期初库存数据的函数
        const getBeginningStock = () => {
            // 统一逻辑：无论当前月份还是历史月份，都优先使用上月快照
            console.log(`� 查询期初库存: 使用${prevYear}年${prevMonth}月快照数据`);
            
            // 优先使用上月快照
            const snapshotQuery = `
                SELECT 
                    product_id,
                    ending_stock as beginning_stock,
                    ending_unit_price as beginning_unit_price,
                    ending_stock_value as beginning_stock_value
                FROM monthly_stock_snapshots
                WHERE year = ? AND month = ?
            `;
            
            const snapshotResults = db.prepare(snapshotQuery).all(prevYear, prevMonth);
            
            if (snapshotResults.length > 0) {
                console.log(`✅ 找到${snapshotResults.length}个产品的上月快照数据`);
                return snapshotResults;
            }
            
            // 如果没有上月快照，使用历史交易计算期初库存
            console.log('🔄 上月快照不存在，基于历史交易计算期初库存');
            const historicalQuery = `
                SELECT 
                    t.product_id,
                    SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END) as beginning_stock,
                    SUM(CASE WHEN t.type = 'IN' THEN COALESCE(t.total_price, t.quantity * t.unit_price) 
                             ELSE -COALESCE(t.total_price, t.quantity * t.unit_price) END) as beginning_stock_value
                FROM transactions t
                WHERE t.created_at < ?
                GROUP BY t.product_id
                HAVING beginning_stock > 0
            `;
            
            const historicalResults = db.prepare(historicalQuery).all(startDate);
            
            if (historicalResults.length > 0) {
                console.log(`✅ 基于历史交易计算出${historicalResults.length}个产品的期初库存`);
                return historicalResults.map(row => ({
                    ...row,
                    beginning_unit_price: row.beginning_stock > 0 ? (row.beginning_stock_value / row.beginning_stock) : 0,
                    beginning_stock_value: row.beginning_stock_value
                }));
            }
            
            // 如果完全没有历史数据，返回空数组（期初库存为0）
            console.log('📦 没有找到任何历史数据，期初库存为0');
            return [];
        };

        // 获取期末库存数据的函数
        const getEndingStock = () => {
            if (isCurrentMonth) {
                console.log('🔄 当前月份: 使用产品表当前库存作为期末库存');
                // 当前月份：直接使用产品表中的当前库存（这是最准确的）
                const currentStockQuery = `
                    SELECT 
                        id as product_id,
                        stock as ending_stock,
                        current_unit_price as ending_unit_price,
                        total_cost_value as ending_stock_value
                    FROM products
                    WHERE stock >= 0
                `;
                
                return db.prepare(currentStockQuery).all();
            } else {
                console.log('📸 历史月份: 使用快照数据获取期末库存');
                // 历史月份：使用当月快照
                const snapshotQuery = `
                    SELECT 
                        product_id,
                        ending_stock,
                        ending_unit_price,
                        ending_stock_value
                    FROM monthly_stock_snapshots
                    WHERE year = ? AND month = ?
                `;
                
                const snapshotResults = db.prepare(snapshotQuery).all(year, month);
                
                if (snapshotResults.length > 0) {
                    return snapshotResults;
                }
                
                // 如果没有当月快照，使用历史计算
                console.log('🔄 当月快照不存在，使用历史交易计算');
                const historicalQuery = `
                    SELECT 
                        t.product_id,
                        SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END) as ending_stock,
                        SUM(CASE WHEN t.type = 'IN' THEN COALESCE(t.total_price, t.quantity * t.unit_price) 
                                 ELSE -COALESCE(t.total_price, t.quantity * t.unit_price) END) as ending_stock_value
                    FROM transactions t
                    WHERE t.created_at < ?
                    GROUP BY t.product_id
                    HAVING ending_stock >= 0
                `;
                
                const historicalResults = db.prepare(historicalQuery).all(endDate);
                return historicalResults.map(row => ({
                    ...row,
                    ending_unit_price: row.ending_stock > 0 ? row.ending_stock_value / row.ending_stock : 0
                }));
            }
        };

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
                COUNT(CASE WHEN t.type = 'IN' THEN 1 END) as in_count,
                COUNT(CASE WHEN t.type = 'OUT' THEN 1 END) as out_count,
                SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE 0 END) as in_quantity,
                SUM(CASE WHEN t.type = 'OUT' THEN t.quantity ELSE 0 END) as out_quantity,
                SUM(CASE WHEN t.type = 'IN' THEN COALESCE(t.total_price, t.quantity * t.unit_price) ELSE 0 END) as in_amount,
                SUM(CASE WHEN t.type = 'OUT' THEN COALESCE(t.total_price, t.quantity * t.unit_price) ELSE 0 END) as out_amount,
                SUM(CASE WHEN t.type = 'IN' THEN COALESCE(t.total_price, t.quantity * t.unit_price) 
                         ELSE -COALESCE(t.total_price, t.quantity * t.unit_price) END) as total_amount
            FROM products p
            INNER JOIN categories c ON c.id = p.category_id
            INNER JOIN transactions t ON p.id = t.product_id
            WHERE t.created_at >= ? AND t.created_at < ?
            GROUP BY c.id, p.id, p.name
            ORDER BY c.name ASC, p.name ASC
        `;

        const transactionResults = db.prepare(transactionQuery).all(startDate, endDate);

        // 获取期初和期末库存数据
        const beginningStockResults = getBeginningStock();
        const endingStockResults = getEndingStock();
        
        // 创建期初库存映射
        const beginningStockMap = new Map();
        beginningStockResults.forEach(row => {
            const beginningStock = Math.max(0, row.beginning_stock);
            const beginningStockValue = Math.max(0, row.beginning_stock_value);
            let beginningUnitPrice = row.beginning_unit_price || 0;
            
            if (beginningStock > 0 && beginningUnitPrice === 0) {
                beginningUnitPrice = beginningStockValue / beginningStock;
            }
            
            beginningStockMap.set(row.product_id, {
                beginning_stock: beginningStock,
                beginning_unit_price: beginningUnitPrice,
                beginning_stock_value: beginningStockValue
            });
        });

        // 创建期末库存映射
        const endingStockMap = new Map();
        endingStockResults.forEach(row => {
            const endingStock = Math.max(0, row.ending_stock);
            const endingStockValue = Math.max(0, row.ending_stock_value);
            let endingUnitPrice = row.ending_unit_price || 0;
            
            if (endingStock > 0 && endingUnitPrice === 0) {
                endingUnitPrice = endingStockValue / endingStock;
            }
            
            endingStockMap.set(row.product_id, {
                ending_stock: endingStock,
                ending_unit_price: endingUnitPrice,
                ending_stock_value: endingStockValue
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
                total_in_count: 0,
                total_out_count: 0,
                total_in_amount: 0,
                total_out_amount: 0,
                category_stock_value: categoryRow.category_stock_value || 0,
                total_products_count: categoryRow.total_products_count || 0
            });
        });

        // 检查是否需要展示所有有库存的产品（通过查询参数控制）
        const showAllProducts = req.query.showAll === 'true';
        
        let allProductsWithStock = new Set();
        
        if (showAllProducts) {
            // 展示所有有期初或期末库存的产品（包括当月没有交易的产品）
            beginningStockResults.forEach(row => allProductsWithStock.add(row.product_id));
            endingStockResults.forEach(row => allProductsWithStock.add(row.product_id));
        }
        
        // 始终添加所有有当月交易记录的产品
        transactionResults.forEach(row => allProductsWithStock.add(row.product_id));
        
        // 获取这些产品的基本信息
        const productInfoQuery = `
            SELECT p.id, p.name, p.barcode, c.id as category_id
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.id IN (${Array.from(allProductsWithStock).map(() => '?').join(',')})
        `;
        const productInfoResults = allProductsWithStock.size > 0 
            ? db.prepare(productInfoQuery).all(...Array.from(allProductsWithStock))
            : [];

        // 创建当月交易汇总映射
        const monthlyTransactionMap = new Map();
        transactionResults.forEach(row => {
            monthlyTransactionMap.set(row.product_id, {
                transaction_count: row.transaction_count,
                in_count: row.in_count,
                out_count: row.out_count,
                in_quantity: row.in_quantity || 0,
                out_quantity: row.out_quantity || 0,
                in_amount: round2(row.in_amount),
                out_amount: round2(row.out_amount),
                total_amount: round2(row.total_amount)
            });
        });

        // 处理所有有库存的产品
        productInfoResults.forEach(product => {
            const category = categoriesMap.get(product.category_id);
            if (category) {
                // 获取期初库存数据
                const beginningData = beginningStockMap.get(product.id) || {
                    beginning_stock: 0,
                    beginning_unit_price: 0,
                    beginning_stock_value: 0
                };

                // 获取期末库存数据
                const endingData = endingStockMap.get(product.id) || {
                    ending_stock: 0,
                    ending_unit_price: 0,
                    ending_stock_value: 0
                };

                // 获取当月交易信息
                const monthlyTransaction = monthlyTransactionMap.get(product.id) || {
                    transaction_count: 0,
                    in_count: 0,
                    out_count: 0,
                    in_quantity: 0,
                    out_quantity: 0,
                    in_amount: 0,
                    out_amount: 0,
                    total_amount: 0
                };

                category.products.push({
                    id: product.id,
                    name: product.name,
                    barcode: product.barcode,
                    // 期初库存信息
                    beginning_stock: beginningData.beginning_stock,
                    beginning_unit_price: beginningData.beginning_unit_price,
                    beginning_stock_value: beginningData.beginning_stock_value,
                    // 期末库存信息
                    ending_stock: endingData.ending_stock,
                    ending_unit_price: endingData.ending_unit_price,
                    ending_stock_value: endingData.ending_stock_value,
                    // 交易信息
                    transaction_count: monthlyTransaction.transaction_count,
                    in_count: monthlyTransaction.in_count,
                    out_count: monthlyTransaction.out_count,
                    in_quantity: monthlyTransaction.in_quantity,
                    out_quantity: monthlyTransaction.out_quantity,
                    in_amount: monthlyTransaction.in_amount,
                    out_amount: monthlyTransaction.out_amount,
                    total_amount: monthlyTransaction.total_amount
                });

                category.total_amount += monthlyTransaction.total_amount;
                category.total_in_count += monthlyTransaction.in_count;
                category.total_out_count += monthlyTransaction.out_count;
                category.total_in_amount = round2(category.total_in_amount + monthlyTransaction.in_amount);
                category.total_out_amount = round2(category.total_out_amount + monthlyTransaction.out_amount);
            }
        });

        const categories = Array.from(categoriesMap.values());
        
        // 重新计算每个类别的库存值（基于该类别下所有产品的期末库存数据）
        categories.forEach(category => {
            // 获取该类别下所有产品的期末库存值
            const categoryProductsQuery = `
                SELECT id FROM products WHERE category_id = ?
            `;
            const categoryProducts = db.prepare(categoryProductsQuery).all(category.id);
            
            // 计算该类别下所有产品的期末库存总值
            let categoryTotalStockValue = 0;
            categoryProducts.forEach(product => {
                const endingData = endingStockMap.get(product.id);
                if (endingData) {
                    categoryTotalStockValue += (endingData.ending_stock_value || 0);
                }
            });
            
            category.category_stock_value = round2(categoryTotalStockValue);
        });

        // 计算期初期末汇总
        // 计算实际的期末库存总值（基于期末库存数据）
        const actualTotalStockValue = round2(
            Array.from(endingStockMap.values())
                .reduce((sum, data) => sum + (data.ending_stock_value || 0), 0)
        );
        
        const summary = {
            total_categories: allCategories.length, // 显示所有类别数量
            total_products: transactionResults.length, // 有交易记录的产品数量
            total_transaction_amount: round2(categories.reduce((sum, cat) => sum + cat.total_amount, 0)),
            total_in_count: categories.reduce((sum, cat) => sum + cat.total_in_count, 0),
            total_out_count: categories.reduce((sum, cat) => sum + cat.total_out_count, 0),
            total_in_amount: round2(categories.reduce((sum, cat) => sum + cat.total_in_amount, 0)),
            total_out_amount: round2(categories.reduce((sum, cat) => sum + cat.total_out_amount, 0)),
            total_stock_value: actualTotalStockValue // 使用实际的期末库存总值
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
            SELECT 
                p.*,
                c.name as category_name 
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

        // 获取分页的交易记录 - 直接使用交易表存储的值
        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const transactionsQuery = `
            SELECT 
                t.*,
                pr.name as project_name,
                p.name as product_name,
                p.barcode,
                d.image_path as document_image_path,
                d.supplier as supplier,
                d.document_number as document_number
            FROM transactions t
            LEFT JOIN projects pr ON t.project_id = pr.id
            LEFT JOIN products p ON t.product_id = p.id
            LEFT JOIN documents d ON t.document_id = d.id
            WHERE t.product_id = ? AND t.created_at >= ? AND t.created_at < ?
            ORDER BY t.created_at ASC
            LIMIT ? OFFSET ?
        `;

        const transactions = db.prepare(transactionsQuery).all(
            id, startDate, endDate, parseInt(pageSize), offset
        );

        // 直接使用交易表中存储的正确数据，不重新计算total_price
        const enrichedTransactions = transactions.map(transaction => ({
            ...transaction
            // 移除了 total_price 的重新计算，使用数据库中存储的正确值
        }));

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
                SUM(CASE WHEN t.type = 'IN' THEN COALESCE(t.total_price, t.quantity * t.unit_price) 
                         ELSE -COALESCE(t.total_price, t.quantity * t.unit_price) END) as total_amount,
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

// 获取月度入库记录（面向财务使用）
router.get('/inbound-records', (req, res) => {
    try {
        const { year = 2025, month = 7 } = req.query;
        
        // 构建月份范围
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01 00:00:00`;
        const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
        const nextYear = month == 12 ? parseInt(year) + 1 : year;
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01 00:00:00`;

        // 获取入库记录
        const inboundQuery = `
            SELECT 
                t.id,
                t.type,
                t.quantity,
                t.unit_price,
                t.total_price,
                t.stock_after,
                t.stock_value,
                t.created_at,
                p.id as product_id,
                p.name as product_name,
                p.barcode as product_barcode,
                p.supplier as supplier,
                c.id as category_id,
                c.name as category_name,
                pr.name as project_name,
                d.document_number as document_number
            FROM transactions t
            INNER JOIN products p ON t.product_id = p.id
            INNER JOIN categories c ON p.category_id = c.id
            LEFT JOIN projects pr ON t.project_id = pr.id
            LEFT JOIN documents d ON t.document_id = d.id
            WHERE t.type = 'IN' 
                AND t.created_at >= ? 
                AND t.created_at < ?
            ORDER BY c.name ASC, t.created_at ASC
        `;

        const inboundRecords = db.prepare(inboundQuery).all(startDate, endDate);

        res.json({
            success: true,
            records: inboundRecords,
            summary: {
                total_records: inboundRecords.length,
                period: `${year}年${month}月`,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('获取入库记录错误:', error);
        res.status(500).json({ error: '获取入库记录失败' });
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
                t.total_price,
                t.requester_name,
                t.purpose,
                t.stock_after,
                t.stock_value,
                t.created_at,
                p.id as product_id,
                p.name as product_name,
                p.barcode as product_barcode,
                c.id as category_id,
                c.name as category_name,
                pr.name as project_name,
                pr.description as department,
                d.document_number as document_number
            FROM transactions t
            INNER JOIN products p ON t.product_id = p.id
            INNER JOIN categories c ON p.category_id = c.id
            LEFT JOIN projects pr ON t.project_id = pr.id
            LEFT JOIN documents d ON t.document_id = d.id
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
