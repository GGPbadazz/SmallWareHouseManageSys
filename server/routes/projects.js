const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const router = express.Router();

// 领用单位/部门管理 API
// 注：此模块管理系统中的领用单位和部门信息，用于出库时记录物品的去向

// Get all departments/units
router.get('/', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT p.*, COUNT(t.id) as transaction_count 
            FROM projects p 
            LEFT JOIN transactions t ON p.id = t.project_id 
            GROUP BY p.id 
            ORDER BY p.name ASC
        `);
        const projects = stmt.all();

        res.json(projects);
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Get project by ID
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        const stmt = db.prepare(`
            SELECT p.*, COUNT(t.id) as transaction_count 
            FROM projects p 
            LEFT JOIN transactions t ON p.id = t.project_id 
            WHERE p.id = ? 
            GROUP BY p.id
        `);
        const project = stmt.get(id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Create new project
router.post('/', [
    body('name').isLength({ min: 1 }).withMessage('Project name is required')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;

        const stmt = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)');
        const result = stmt.run(name, description || null);

        const getStmt = db.prepare('SELECT * FROM projects WHERE id = ?');
        const project = getStmt.get(result.lastInsertRowid);

        res.status(201).json(project);
    } catch (error) {
        console.error('Create project error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Project with this name already exists' });
        }
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Update project
router.put('/:id', [
    body('name').isLength({ min: 1 }).withMessage('Project name is required')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { name, description } = req.body;

        const stmt = db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?');
        const result = stmt.run(name, description || null, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const getStmt = db.prepare('SELECT * FROM projects WHERE id = ?');
        const project = getStmt.get(id);

        res.json(project);
    } catch (error) {
        console.error('Update project error:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Project with this name already exists' });
        }
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Delete project
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if project has transactions
        const checkStmt = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE project_id = ?');
        const { count } = checkStmt.get(id);
        
        if (count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete project with existing transactions. Please reassign transactions first.' 
            });
        }

        const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Get transactions by project
router.get('/:id/transactions', (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const stmt = db.prepare(`
            SELECT t.*, p.name as product_name, p.barcode, pr.name as project_name
            FROM transactions t 
            LEFT JOIN products p ON t.product_id = p.id 
            LEFT JOIN projects pr ON t.project_id = pr.id 
            WHERE t.project_id = ? 
            ORDER BY t.created_at DESC 
            LIMIT ? OFFSET ?
        `);
        const transactions = stmt.all(id, parseInt(limit), parseInt(offset));

        // Get total count
        const countStmt = db.prepare('SELECT COUNT(*) as total FROM transactions WHERE project_id = ?');
        const { total } = countStmt.get(id);

        res.json({
            transactions,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Get project transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch project transactions' });
    }
});

module.exports = router;
