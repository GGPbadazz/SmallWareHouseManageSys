const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');
const backupService = require('../services/backupService');
const router = express.Router();

// Get system settings
router.get('/', (req, res) => {
    try {
        const settings = db.prepare(`
            SELECT key, value, updated_at 
            FROM admin_settings 
            WHERE key != 'admin_password'
        `).all();

        // Convert to object format
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = {
                value: setting.value,
                updated_at: setting.updated_at
            };
        });

        res.json(settingsObj);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update system settings
router.put('/', (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings format' });
        }

        const updateStmt = db.prepare(`
            INSERT OR REPLACE INTO admin_settings (key, value, updated_at) 
            VALUES (?, ?, datetime('now'))
        `);

        const transaction = db.transaction((settings) => {
            Object.entries(settings).forEach(([key, value]) => {
                if (key !== 'admin_password') { // Prevent password update through this endpoint
                    updateStmt.run(key, value);
                }
            });
        });

        transaction(settings);

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get system information
router.get('/system-info', (req, res) => {
    try {
        const dbInfo = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM categories) as total_categories,
                (SELECT COUNT(*) FROM projects) as total_projects,
                (SELECT COUNT(*) FROM transactions) as total_transactions
        `).get();

        const lastBackup = db.prepare(`
            SELECT value FROM admin_settings WHERE key = 'last_backup'
        `).get();

        const systemVersion = db.prepare(`
            SELECT value FROM admin_settings WHERE key = 'system_version'
        `).get();

        res.json({
            database: dbInfo,
            lastBackup: lastBackup?.value || null,
            systemVersion: systemVersion?.value || '1.0.0',
            serverTime: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        console.error('Get system info error:', error);
        res.status(500).json({ error: 'Failed to fetch system information' });
    }
});

// Change admin password
router.put('/admin-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        // Get current password hash
        const currentHash = db.prepare(`
            SELECT value FROM admin_settings WHERE key = 'admin_password'
        `).get();

        if (!currentHash || !bcrypt.compareSync(currentPassword, currentHash.value)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const newHash = bcrypt.hashSync(newPassword, 10);

        // Update password
        const updateStmt = db.prepare(`
            UPDATE admin_settings 
            SET value = ?, updated_at = datetime('now') 
            WHERE key = 'admin_password'
        `);

        updateStmt.run(newHash);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Export/Import data
router.get('/export', (req, res) => {
    try {
        const { tables } = req.query;
        const tablesToExport = tables ? tables.split(',') : ['products', 'categories', 'projects', 'transactions'];

        const exportData = {};

        tablesToExport.forEach(table => {
            switch (table) {
                case 'products':
                    exportData.products = db.prepare(`
                        SELECT p.*, c.name as category_name 
                        FROM products p 
                        LEFT JOIN categories c ON p.category_id = c.id
                    `).all();
                    break;
                case 'categories':
                    exportData.categories = db.prepare('SELECT * FROM categories').all();
                    break;
                case 'projects':
                    exportData.projects = db.prepare('SELECT * FROM projects').all();
                    break;
                case 'transactions':
                    exportData.transactions = db.prepare(`
                        SELECT t.*, p.name as product_name, p.barcode, pr.name as project_name
                        FROM transactions t
                        LEFT JOIN products p ON t.product_id = p.id
                        LEFT JOIN projects pr ON t.project_id = pr.id
                    `).all();
                    break;
            }
        });

        res.json({
            exportDate: new Date().toISOString(),
            tables: tablesToExport,
            data: exportData
        });
    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Backup data endpoint
router.post('/backup', (req, res) => {
    try {
        const result = backupService.createBackup();
        
        if (result.success) {
            // 清理旧备份
            const settings = backupService.getBackupSettings();
            backupService.cleanOldBackups(settings.retentionCount);
            
            res.json({
                message: result.success ? 'Database backup created successfully' : 'Backup failed',
                backup_path: result.backup_path,
                timestamp: result.timestamp,
                filename: result.filename
            });
        } else {
            res.status(500).json({ error: result.error || 'Failed to create backup' });
        }
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// Manual trigger auto backup
router.post('/backup/auto', async (req, res) => {
    try {
        const result = await backupService.performAutoBackup();
        
        if (result.success) {
            res.json({
                message: 'Auto backup completed successfully',
                backup_path: result.backup_path,
                timestamp: result.timestamp,
                filename: result.filename
            });
        } else {
            res.status(400).json({ 
                error: result.message || 'Auto backup failed',
                message: result.message
            });
        }
    } catch (error) {
        console.error('Auto backup error:', error);
        res.status(500).json({ error: 'Failed to perform auto backup' });
    }
});

// List backup files
router.get('/backup/list', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(backupDir)) {
            return res.json({ backups: [] });
        }

        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.db'))
            .map(file => {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    created_at: stats.birthtime.toISOString(),
                    modified_at: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ backups: files });
    } catch (error) {
        console.error('List backups error:', error);
        res.status(500).json({ error: 'Failed to list backup files' });
    }
});

// Download backup file
router.get('/backup/download/:filename', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const { filename } = req.params;
        const backupDir = path.join(__dirname, '../backups');
        const filePath = path.join(backupDir, filename);

        // Security check - ensure filename is safe
        if (!filename.match(/^backup_[\d\-T]+\.db$/)) {
            return res.status(400).json({ error: 'Invalid filename format' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
                res.status(500).json({ error: 'Failed to download backup file' });
            }
        });
    } catch (error) {
        console.error('Download backup error:', error);
        res.status(500).json({ error: 'Failed to download backup file' });
    }
});

// Delete backup file
router.delete('/backup/:filename', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        
        const { filename } = req.params;
        const backupDir = path.join(__dirname, '../backups');
        const filePath = path.join(backupDir, filename);

        // Security check - ensure filename is safe
        if (!filename.match(/^backup_[\d\-T]+\.db$/)) {
            return res.status(400).json({ error: 'Invalid filename format' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }

        fs.unlinkSync(filePath);
        res.json({ message: 'Backup file deleted successfully' });
    } catch (error) {
        console.error('Delete backup error:', error);
        res.status(500).json({ error: 'Failed to delete backup file' });
    }
});

// Change password endpoint
router.post('/password', (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters long' });
        }

        // Get current password hash
        const currentHash = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get('admin_password');
        
        if (!currentHash) {
            return res.status(500).json({ error: 'Admin password not found' });
        }

        // Verify current password
        const isValid = bcrypt.compareSync(currentPassword, currentHash.value);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const newHash = bcrypt.hashSync(newPassword, 10);

        // Update password
        db.prepare(`
            INSERT OR REPLACE INTO admin_settings (key, value, updated_at) 
            VALUES (?, ?, datetime('now'))
        `).run('admin_password', newHash);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// System cleanup
router.post('/cleanup', (req, res) => {
    try {
        const { days = 90 } = req.body;

        // Clean old transactions (older than specified days)
        const deleteOldTransactions = db.prepare(`
            DELETE FROM transactions 
            WHERE created_at < datetime('now', '-${days} days')
        `);

        const result = deleteOldTransactions.run();

        // Run VACUUM to reclaim space
        db.exec('VACUUM');

        res.json({
            message: 'System cleanup completed',
            transactionsDeleted: result.changes
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: 'Failed to cleanup system' });
    }
});

module.exports = router;
