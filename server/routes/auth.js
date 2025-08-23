const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const router = express.Router();

// JWT middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Admin login
router.post('/login', [
    body('username').isLength({ min: 1 }).withMessage('Username is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;
        
        // 验证用户名（可以设置为固定的管理员用户名，比如 'admin'）
        if (username !== 'admin') {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Get admin password from database
        const stmt = db.prepare('SELECT value FROM admin_settings WHERE key = ?');
        const result = stmt.get('admin_password');
        
        if (!result) {
            return res.status(500).json({ error: 'Admin password not configured' });
        }

        const isValidPassword = await bcrypt.compare(password, result.value);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            token,
            message: 'Login successful',
            expiresIn: '24h'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Change admin password
router.post('/change-password', authenticateToken, [
    body('currentPassword').isLength({ min: 1 }).withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;
        
        // Get current admin password
        const stmt = db.prepare('SELECT value FROM admin_settings WHERE key = ?');
        const result = stmt.get('admin_password');
        
        if (!result) {
            return res.status(500).json({ error: 'Admin password not configured' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, result.value);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password in database
        const updateStmt = db.prepare('UPDATE admin_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
        updateStmt.run(hashedPassword, 'admin_password');

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Password change failed' });
    }
});

// Verify token
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.user 
    });
});

module.exports = router;
