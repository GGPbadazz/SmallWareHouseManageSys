const express = require('express');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const db = require('../database/connection');
const router = express.Router();

// Get all products with optional search and filters
router.get('/', (req, res) => {
    try {
        const { search, category, lowStock, limit = 100, offset = 0 } = req.query;
        
        let query = `
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
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

        query += ` ORDER BY p.name ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const stmt = db.prepare(query);
        const products = stmt.all(...params);

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
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
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

// Create new product
router.post('/', [
    body('name').isLength({ min: 1 }).withMessage('Product name is required'),
    body('barcode').isLength({ min: 1 }).withMessage('Barcode is required'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a positive integer'),
    body('min_stock').isInt({ min: 0 }).withMessage('Minimum stock must be a positive integer'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
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
            price
        } = req.body;

        const stmt = db.prepare(`
            INSERT INTO products 
            (name, name_en, barcode, category_id, location, supplier, description, stock, min_stock, price) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            name,
            name_en || null,
            barcode,
            category_id || null,
            location || null,
            supplier || null,
            description || null,
            stock || 0,
            min_stock || 0,
            price || 0
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
    body('barcode').isLength({ min: 1 }).withMessage('Barcode is required'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a positive integer'),
    body('min_stock').isInt({ min: 0 }).withMessage('Minimum stock must be a positive integer'),
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
            barcode_image,
            qr_code_image,
            barcode_updated_at
        } = req.body;

        const stmt = db.prepare(`
            UPDATE products 
            SET name = ?, name_en = ?, barcode = ?, category_id = ?, location = ?, 
                supplier = ?, description = ?, stock = ?, min_stock = ?, price = ?,
                barcode_image = ?, qr_code_image = ?, barcode_updated_at = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `);

        const result = stmt.run(
            name,
            name_en || null,
            barcode,
            category_id || null,
            location || null,
            supplier || null,
            description || null,
            stock || 0,
            min_stock || 0,
            price || 0,
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

// Get product statistics
router.get('/stats/overview', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        const totalValue = db.prepare('SELECT SUM(stock * COALESCE(price, 0)) as total FROM products').get().total || 0;
        
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

// Get product statistics for dashboard
router.get('/stats', (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        
        // Get today's transactions
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = ?
        `).get(today).count;
        
        // Calculate total inventory value
        const totalValue = db.prepare('SELECT SUM(stock * price) as total FROM products WHERE price IS NOT NULL').get().total || 0;
        
        res.json({
            totalProducts: totalProducts,
            lowStockItems: lowStockItems,
            todayTransactions: todayTransactions,
            totalValue: Math.round(totalValue * 100) / 100
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Search products endpoint
router.get('/search', (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }

        const searchQuery = `
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.name LIKE ? OR p.barcode LIKE ? OR p.name_en LIKE ? OR c.name LIKE ?
            ORDER BY p.name ASC
            LIMIT 10
        `;
        
        const searchTerm = `%${q}%`;
        const stmt = db.prepare(searchQuery);
        const results = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm);

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Get enhanced statistics with growth data
router.get('/stats/dashboard', (req, res) => {
    try {
        // Current statistics
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        const totalValue = db.prepare('SELECT SUM(stock * COALESCE(price, 0)) as total FROM products').get().total || 0;
        
        const todayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = DATE('now')
        `).get().count;

        // Growth calculations
        // Monthly change (comparing to last month)
        const lastMonthProducts = db.prepare(`
            SELECT COUNT(DISTINCT product_id) as count 
            FROM transactions 
            WHERE created_at >= DATE('now', '-1 month', 'start of month') 
            AND created_at < DATE('now', 'start of month')
        `).get().count;
        
        const monthlyChange = lastMonthProducts > 0 
            ? Math.round(((totalProducts - lastMonthProducts) / lastMonthProducts) * 100 * 100) / 100
            : 0;

        // Transaction growth (comparing today to yesterday)
        const yesterdayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = DATE('now', '-1 day')
        `).get().count;
        
        const transactionGrowth = yesterdayTransactions > 0
            ? Math.round(((todayTransactions - yesterdayTransactions) / yesterdayTransactions) * 100 * 100) / 100
            : (todayTransactions > 0 ? 100 : 0);

        // Value growth (comparing current month to last month)
        const lastMonthValue = db.prepare(`
            SELECT SUM(t.quantity * COALESCE(t.unit_price, 0)) as total 
            FROM transactions t
            WHERE t.type = 'IN' 
            AND t.created_at >= DATE('now', '-1 month', 'start of month') 
            AND t.created_at < DATE('now', 'start of month')
        `).get().total || 0;
        
        const currentMonthValue = db.prepare(`
            SELECT SUM(t.quantity * COALESCE(t.unit_price, 0)) as total 
            FROM transactions t
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
            totalValue: Math.round(totalValue * 100) / 100,
            monthlyChange,
            transactionGrowth,
            valueGrowth
        });
    } catch (error) {
        console.error('Get enhanced stats error:', error);
        res.status(500).json({ error: 'Failed to fetch enhanced statistics' });
    }
});

module.exports = router;
