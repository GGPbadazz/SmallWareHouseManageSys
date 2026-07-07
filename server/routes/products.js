const express = require('express');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const db = require('../database/connection');
const router = express.Router();

// Get all products with optional search and filters
router.get('/', (req, res) => {
    try {
        const { search, category, lowStock, limit = 100, offset = 0, all = false } = req.query;
        console.log('📊 GET /api/products - Query params:', { search, category, lowStock, limit, offset, all });
        
        let query = `
            SELECT p.*, c.name as category_name,
                   t_latest.stock_value as latest_transaction_stock_value,
                   t_latest.stock_unit_price as latest_transaction_unit_price
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            LEFT JOIN (
                SELECT DISTINCT product_id,
                       FIRST_VALUE(stock_value) OVER (PARTITION BY product_id ORDER BY created_at DESC) as stock_value,
                       FIRST_VALUE(stock_unit_price) OVER (PARTITION BY product_id ORDER BY created_at DESC) as stock_unit_price
                FROM transactions
            ) t_latest ON p.id = t_latest.product_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR p.name_en LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (category) {
            query += ` AND p.category_id = ?`;
            params.push(category);
        }

        if (lowStock === 'true') {
            query += ` AND p.stock <= p.min_stock`;
        }

        query += ` ORDER BY p.name ASC`;
        
        // 如果请求所有产品（用于条码管理等功能），不应用limit和offset
        if (all !== 'true') {
            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));
        }

        const stmt = db.prepare(query);
        const products = stmt.all(...params);
        console.log('📦 Products found:', products.length, 'Query:', query.substring(0, 100), '...', 'Params:', params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM products p WHERE 1=1`;
        const countParams = [];
        
        if (search) {
            countQuery += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR p.name_en LIKE ?)`;
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        if (category) {
            countQuery += ` AND p.category_id = ?`;
            countParams.push(category);
        }

        if (lowStock === 'true') {
            countQuery += ` AND p.stock <= p.min_stock`;
        }

        const countStmt = db.prepare(countQuery);
        const { total } = countStmt.get(...countParams);

        res.json({
            products,
            total,
            limit: all === 'true' ? total : parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// 产品数据导出功能
router.get('/export', (req, res) => {
    try {
        console.log('🔄 开始导出产品数据');
        
        // 获取所有产品数据，包含类别信息
        const query = `
            SELECT 
                p.name,
                p.name_en,
                p.barcode,
                c.name as category_name,
                p.location,
                p.supplier,
                p.description,
                p.stock,
                p.min_stock,
                p.current_unit_price,
                p.total_cost_value,
                p.created_at,
                p.updated_at
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY c.name ASC, p.name ASC
        `;
        
        const products = db.prepare(query).all();
        
        // 创建CSV内容
        const headers = [
            'name', 'name_en', 'barcode', 'category_name', 'location', 
            'supplier', 'description', 'stock', 'min_stock', 'current_unit_price',
            'total_cost_value', 'created_at', 'updated_at'
        ];
        
        const csvContent = [
            headers.join(','),
            ...products.map(product => 
                headers.map(header => {
                    const value = product[header] || '';
                    // 处理包含逗号或换行符的值
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(',')
            )
        ].join('\n');
        
        // 设置响应头
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.csv"`);
        
        console.log(`✅ 导出完成，共 ${products.length} 个产品`);
        res.send('\uFEFF' + csvContent); // 添加BOM以支持中文
        
    } catch (error) {
        console.error('❌ 产品导出失败:', error);
        res.status(500).json({ error: '产品数据导出失败' });
    }
});

// 产品数据导入功能
router.post('/import', require('multer')({ storage: require('multer').memoryStorage() }).single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '请选择要导入的文件' });
        }
        
        console.log(`🚀 开始导入文件: ${req.file.originalname}`);
        
        // 解析CSV文件
        const csvContent = req.file.buffer.toString('utf8').replace(/^\uFEFF/, ''); // 移除BOM
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            return res.status(400).json({ 
                success: false, 
                message: '文件格式错误：至少需要标题行和一行数据' 
            });
        }
        
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const requiredHeaders = ['name', 'category_name', 'stock', 'min_stock', 'current_unit_price'];
        
        // 检查必需的列
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            return res.status(400).json({
                success: false,
                message: `缺少必需的列: ${missingHeaders.join(', ')}`
            });
        }
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        // 开始事务
        const transaction = db.transaction(() => {
            for (let i = 1; i < lines.length; i++) {
                try {
                    const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
                    
                    if (values.length !== headers.length) {
                        errorCount++;
                        errors.push(`第${i + 1}行: 列数不匹配`);
                        continue;
                    }
                    
                    // 构建产品数据对象
                    const productData = {};
                    headers.forEach((header, index) => {
                        productData[header] = values[index] || null;
                    });
                    
                    // 查找或创建类别
                    let categoryId = null;
                    if (productData.category_name) {
                        let category = db.prepare('SELECT id FROM categories WHERE name = ?').get(productData.category_name);
                        if (!category) {
                            const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
                            const result = insertCategory.run(productData.category_name);
                            categoryId = result.lastInsertRowid;
                        } else {
                            categoryId = category.id;
                        }
                    }
                    
                    // 插入或更新产品
                    const insertProduct = db.prepare(`
                        INSERT INTO products (
                            name, name_en, barcode, category_id, location, supplier, 
                            description, stock, min_stock, price, current_unit_price, 
                            total_cost_value, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    `);
                    
                    const stock = parseFloat(productData.stock) || 0;
                    const unitPrice = parseFloat(productData.current_unit_price) || 0;
                    
                    // 使用CSV文件中提供的total_cost_value，如果没有则计算
                    let totalValue = parseFloat(productData.total_cost_value);
                    if (isNaN(totalValue) || totalValue === undefined || totalValue === null) {
                        totalValue = stock * unitPrice;
                        console.log(`Calculated total value for ${productData.name}: ${totalValue} (${stock} × ${unitPrice})`);
                    } else {
                        console.log(`Using provided total value for ${productData.name}: ${totalValue}`);
                    }
                    // 确保总价值保持四位小数精度
                    totalValue = parseFloat(totalValue.toFixed(4));
                    
                    insertProduct.run(
                        productData.name,
                        productData.name_en || null,
                        productData.barcode || null,
                        categoryId,
                        productData.location || null,
                        productData.supplier || null,
                        productData.description || null,
                        stock,
                        parseFloat(productData.min_stock) || 0,
                        unitPrice, // price字段
                        unitPrice, // current_unit_price字段  
                        totalValue
                    );
                    
                    successCount++;
                } catch (error) {
                    errorCount++;
                    errors.push(`第${i + 1}行: ${error.message}`);
                }
            }
        });
        
        transaction();
        
        console.log(`✅ 导入完成: 成功${successCount}个, 失败${errorCount}个`);
        
        res.json({
            success: true,
            message: `导入完成: 成功${successCount}个产品, 失败${errorCount}个`,
            details: {
                successCount,
                errorCount,
                errors: errors.slice(0, 10) // 只返回前10个错误
            }
        });
        
    } catch (error) {
        console.error('❌ 产品导入失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '产品数据导入失败',
            error: error.message 
        });
    }
});

// Get product statistics. Keep stats/search routes before /:identifier.
router.get('/stats/overview', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        const totalValue = db.prepare('SELECT SUM(COALESCE(total_cost_value, 0)) as total FROM products').get().total || 0;
        
        const todayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = DATE('now')
        `).get().count;

        res.json({
            totalProducts,
            lowStockItems,
            todayTransactions,
            totalValue
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

router.get('/stats/dashboard', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        const totalValue = db.prepare('SELECT SUM(COALESCE(total_cost_value, 0)) as total FROM products').get().total || 0;
        
        const todayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = DATE('now')
        `).get().count;

        const lastMonthProducts = db.prepare(`
            SELECT COUNT(DISTINCT product_id) as count 
            FROM transactions 
            WHERE created_at >= DATE('now', '-1 month', 'start of month') 
            AND created_at < DATE('now', 'start of month')
        `).get().count;
        
        const monthlyChange = lastMonthProducts > 0 
            ? Math.round(((totalProducts - lastMonthProducts) / lastMonthProducts) * 100 * 100) / 100
            : 0;

        const yesterdayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = DATE('now', '-1 day')
        `).get().count;
        
        const transactionGrowth = yesterdayTransactions > 0
            ? Math.round(((todayTransactions - yesterdayTransactions) / yesterdayTransactions) * 100 * 100) / 100
            : (todayTransactions > 0 ? 100 : 0);

        const lastMonthValue = db.prepare(`
            SELECT SUM(t.quantity * COALESCE(p.price, 0)) as total 
            FROM transactions t
            JOIN products p ON t.product_id = p.id
            WHERE t.type = 'IN' 
            AND t.created_at >= DATE('now', '-1 month', 'start of month') 
            AND t.created_at < DATE('now', 'start of month')
        `).get().total || 0;
        
        const currentMonthValue = db.prepare(`
            SELECT SUM(t.quantity * COALESCE(p.price, 0)) as total 
            FROM transactions t
            JOIN products p ON t.product_id = p.id
            WHERE t.type = 'IN' 
            AND t.created_at >= DATE('now', 'start of month')
        `).get().total || 0;
        
        const valueGrowth = lastMonthValue > 0
            ? Math.round(((currentMonthValue - lastMonthValue) / lastMonthValue) * 100 * 100) / 100
            : (currentMonthValue > 0 ? 100 : 0);

        res.json({
            totalProducts,
            lowStockItems,
            todayTransactions,
            totalValue: Math.round(totalValue * 10000) / 10000,
            monthlyChange,
            transactionGrowth,
            valueGrowth
        });
    } catch (error) {
        console.error('Get enhanced stats error:', error);
        res.status(500).json({ error: 'Failed to fetch enhanced statistics' });
    }
});

router.get('/stats', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = ?
        `).get(today).count;
        const totalValue = db.prepare('SELECT SUM(COALESCE(total_cost_value, 0)) as total FROM products').get().total || 0;

        res.json({
            totalProducts,
            lowStockItems,
            todayTransactions,
            totalValue: Math.round(totalValue * 10000) / 10000
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Search products endpoint. Keep this before /:identifier.
router.get('/search', (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }

        const searchTerm = `%${q}%`;
        const results = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.name_en LIKE ? OR c.name LIKE ?
            ORDER BY p.name ASC
            LIMIT 10
        `).all(searchTerm, searchTerm, searchTerm, searchTerm);

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Get product by ID or barcode
router.get('/:identifier', (req, res) => {
    try {
        const { identifier } = req.params;
        
        // Try to find by ID first, then by barcode
        let stmt = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ? OR p.barcode = ?
        `);
        
        const product = stmt.get(identifier, identifier);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

//Create new product
router.post('/', [
    body('name').isLength({ min: 1 }).withMessage('Product name is required'),
    body('category_id').notEmpty().withMessage('Category is required').custom(value => {
        // 接受字符串或数字形式的category_id
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 1) {
            throw new Error('Category must be a valid ID');
        }
        return true;
    }),
    body('barcode').optional({ checkFalsy: true }).isLength({ min: 1 }).withMessage('Barcode must not be empty if provided'),
    body('stock').isFloat({ min: 0 }).withMessage('Stock must be a positive number'),
    body('min_stock').isFloat({ min: 0 }).withMessage('Minimum stock must be a positive number'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number')
], (req, res) => {
    try {
        console.log('Create product request body:', JSON.stringify(req.body, null, 2));
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            name,
            name_en,
            barcode,
            category_id,
            location,
            supplier,
            description,
            stock,
            min_stock,
            price,
            current_unit_price,
            total_cost_value,
            barcode_image,
            qr_code_image,
            barcode_updated_at
        } = req.body;

        console.log('Extracted fields:', { name, category_id, stock, price, current_unit_price, total_cost_value });

        // 额外验证：确保category_id不为空并转换为整数
        const categoryIdInt = parseInt(category_id);
        if (!category_id || category_id === '' || category_id === null || category_id === undefined || isNaN(categoryIdInt)) {
            console.log('Category ID validation failed:', { category_id, categoryIdInt });
            return res.status(400).json({ 
                error: '产品类别为必填项，请选择一个类别',
                errors: [{ field: 'category_id', message: 'Category is required' }]
            });
        }

        // 检查产品名称是否已存在
        const nameCheckStmt = db.prepare(`SELECT id FROM products WHERE name = ?`);
        const existingProduct = nameCheckStmt.get(name);
        if (existingProduct) {
            console.log(`Product name "${name}" already exists with ID: ${existingProduct.id}`);
            return res.status(400).json({ 
                error: `产品名称"${name}"已存在，产品名称必须唯一` 
            });
        }

        // 验证类别是否存在
        if (categoryIdInt) {
            const categoryCheckStmt = db.prepare(`SELECT id FROM categories WHERE id = ?`);
            const existingCategory = categoryCheckStmt.get(categoryIdInt);
            if (!existingCategory) {
                console.log(`Category with ID ${categoryIdInt} does not exist`);
                return res.status(400).json({ 
                    error: `类别ID"${categoryIdInt}"不存在，请选择有效的类别` 
                });
            }
        }

        // 如果没有提供total_cost_value，但提供了单价和库存，则自动计算
        let calculatedTotalCostValue = total_cost_value;
        if (calculatedTotalCostValue === undefined || calculatedTotalCostValue === null || calculatedTotalCostValue === '') {
            if ((price || current_unit_price) && stock) {
                const unitPrice = current_unit_price || price || 0;
                calculatedTotalCostValue = parseFloat((unitPrice * stock).toFixed(4));
                console.log(`Auto-calculated total cost value for "${name}": ${calculatedTotalCostValue} (${unitPrice} × ${stock})`);
            } else {
                calculatedTotalCostValue = 0;
            }
        } else {
            // 使用提供的total_cost_value，确保格式正确（最多4位小数）
            calculatedTotalCostValue = parseFloat(parseFloat(calculatedTotalCostValue).toFixed(4));
            console.log(`Using provided total cost value for "${name}": ${calculatedTotalCostValue}`);
        }

        // 如果没有current_unit_price但有price，则使用price作为current_unit_price
        const finalCurrentUnitPrice = current_unit_price || price || 0;

        const stmt = db.prepare(`
            INSERT INTO products 
            (name, name_en, barcode, category_id, location, supplier, description, stock, min_stock, price, current_unit_price, total_cost_value, barcode_image, qr_code_image, barcode_updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            name,
            name_en || null,
            barcode || null,  // 允许条码为空
            categoryIdInt || null,
            location || null,
            supplier || null,
            description || null,
            stock || 0,
            min_stock || 0,
            price || 0,
            parseFloat((finalCurrentUnitPrice || 0).toFixed(4)),
            parseFloat((calculatedTotalCostValue || 0).toFixed(4)),
            barcode_image || null,
            qr_code_image || null,
            barcode_updated_at || null
        );

        // Get the created product
        const getStmt = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ?
        `);
        const product = getStmt.get(result.lastInsertRowid);

        res.status(201).json(product);
    } catch (error) {
        console.error('Create product error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Product with this barcode already exists' });
        }
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Update product
router.put('/:id', [
    body('name').isLength({ min: 1 }).withMessage('Product name is required'),
    body('barcode').optional({ checkFalsy: true }).isLength({ min: 1 }).withMessage('Barcode must not be empty if provided'),
    body('stock').isFloat({ min: 0 }).withMessage('Stock must be a positive number'),
    body('min_stock').isFloat({ min: 0 }).withMessage('Minimum stock must be a positive number'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const {
            name,
            name_en,
            barcode,
            category_id,
            location,
            supplier,
            description,
            stock,
            min_stock,
            price,
            current_unit_price,
            total_cost_value,
            barcode_image,
            qr_code_image,
            barcode_updated_at
        } = req.body;

        // 检查产品名称是否已被其他产品使用
        const nameCheckStmt = db.prepare(`SELECT id FROM products WHERE name = ? AND id != ?`);
        const existingProduct = nameCheckStmt.get(name, id);
        if (existingProduct) {
            return res.status(400).json({ 
                error: `产品名称"${name}"已被其他产品使用，产品名称必须唯一` 
            });
        }

        // 使用提供的total_cost_value，如果没有提供则自动计算
        let calculatedTotalCostValue = total_cost_value;
        if (calculatedTotalCostValue === undefined || calculatedTotalCostValue === null) {
            if ((price || current_unit_price) && stock) {
                const unitPrice = current_unit_price || price || 0;
                calculatedTotalCostValue = parseFloat((unitPrice * stock).toFixed(4));
                console.log(`Auto-calculated total cost value for "${name}": ${calculatedTotalCostValue} (${unitPrice} × ${stock})`);
            } else {
                calculatedTotalCostValue = 0;
            }
        } else {
            // 使用提供的total_cost_value，确保格式正确（最多4位小数）
            calculatedTotalCostValue = parseFloat(parseFloat(calculatedTotalCostValue).toFixed(4));
            console.log(`Using provided total cost value for "${name}": ${calculatedTotalCostValue}`);
        }

        // 如果没有current_unit_price但有price，则使用price作为current_unit_price
        const finalCurrentUnitPrice = current_unit_price !== undefined ? current_unit_price : (price || 0);

        const stmt = db.prepare(`
            UPDATE products 
            SET name = ?, name_en = ?, barcode = ?, category_id = ?, location = ?, 
                supplier = ?, description = ?, stock = ?, min_stock = ?, price = ?,
                current_unit_price = ?, total_cost_value = ?,
                barcode_image = ?, qr_code_image = ?, barcode_updated_at = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);

        const result = stmt.run(
            name,
            name_en || null,
            barcode || null,  // 允许条码为空
            category_id || null,
            location || null,
            supplier || null,
            description || null,
            stock || 0,
            min_stock || 0,
            price || 0,
            parseFloat((finalCurrentUnitPrice || 0).toFixed(4)),
            parseFloat((calculatedTotalCostValue || 0).toFixed(4)),
            barcode_image || null,
            qr_code_image || null,
            barcode_updated_at || null,
            id
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Get the updated product
        const getStmt = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ?
        `);
        const product = getStmt.get(id);

        res.json(product);
    } catch (error) {
        console.error('Update product error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Product with this barcode already exists' });
        }
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // First check if product exists
        const checkStmt = db.prepare('SELECT id FROM products WHERE id = ?');
        const existingProduct = checkStmt.get(id);
        
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        // Check for foreign key constraints - delete related transactions first
        const deleteTransactionsStmt = db.prepare('DELETE FROM transactions WHERE product_id = ?');
        deleteTransactionsStmt.run(id);
        
        // Now delete the product
        const stmt = db.prepare('DELETE FROM products WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        console.error('Error details:', error.code, error.message);
        res.status(500).json({ error: 'Failed to delete product: ' + error.message });
    }
});

// Generate QR code for product
router.get('/:id/qrcode', async (req, res) => {
    try {
        const { id } = req.params;
        
        const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
        const product = stmt.get(id);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const qrData = {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            timestamp: new Date().toISOString()
        };

        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'M'
        });

        res.json({
            qrCode: qrCodeDataURL,
            data: qrData
        });
    } catch (error) {
        console.error('QR code generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

module.exports = router;
