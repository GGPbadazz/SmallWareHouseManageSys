const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const router = express.Router();

// Get all categories
router.get('/', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT c.*, COUNT(p.id) as product_count 
            FROM categories c 
            LEFT JOIN products p ON c.id = p.category_id 
            GROUP BY c.id 
            ORDER BY c.name ASC
        `);
        const categories = stmt.all();

        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get category by ID
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        const stmt = db.prepare(`
            SELECT c.*, COUNT(p.id) as product_count 
            FROM categories c 
            LEFT JOIN products p ON c.id = p.category_id 
            WHERE c.id = ? 
            GROUP BY c.id
        `);
        const category = stmt.get(id);
        
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

// Create new category
router.post('/', [
    body('name').isLength({ min: 1 }).withMessage('Category name is required')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;

        const stmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
        const result = stmt.run(name, description || null);

        const getStmt = db.prepare('SELECT * FROM categories WHERE id = ?');
        const category = getStmt.get(result.lastInsertRowid);

        res.status(201).json(category);
    } catch (error) {
        console.error('Create category error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Category with this name already exists' });
        }
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category
router.put('/:id', [
    body('name').isLength({ min: 1 }).withMessage('Category name is required')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, description } = req.body;

        const stmt = db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?');
        const result = stmt.run(name, description || null, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const getStmt = db.prepare('SELECT * FROM categories WHERE id = ?');
        const category = getStmt.get(id);

        res.json(category);
    } catch (error) {
        console.error('Update category error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Category with this name already exists' });
        }
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if category has products
        const checkStmt = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?');
        const { count } = checkStmt.get(id);
        
        if (count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with existing products. Please reassign products first.' 
            });
        }

        const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// Get products by category
router.get('/:id/products', (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const stmt = db.prepare(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.category_id = ? 
            ORDER BY p.name ASC 
            LIMIT ? OFFSET ?
        `);
        const products = stmt.all(id, parseInt(limit), parseInt(offset));

        // Get total count
        const countStmt = db.prepare('SELECT COUNT(*) as total FROM products WHERE category_id = ?');
        const { total } = countStmt.get(id);

        res.json({
            products,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get category products error:', error);
        res.status(500).json({ error: 'Failed to fetch category products' });
    }
});

module.exports = router;
