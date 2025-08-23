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
        console.log('Settings update request received:', JSON.stringify(req.body, null, 2));
        const { settings } = req.body;
        
        if (!settings || typeof settings !== 'object') {
            console.log('Invalid settings format:', settings);
            return res.status(400).json({ error: 'Invalid settings format' });
        }

        const updateStmt = db.prepare(`
            INSERT OR REPLACE INTO admin_settings (key, value, updated_at) 
            VALUES (?, ?, datetime('now'))
        `);

        const transaction = db.transaction((settings) => {
            Object.entries(settings).forEach(([key, value]) => {
                if (key !== 'admin_password') { // Prevent password update through this endpoint
                    console.log(`Updating setting: ${key} = ${value} (${typeof value})`);
                    updateStmt.run(key, String(value));
                }
            });
        });

        transaction(settings);
        console.log('Settings updated successfully');

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings', details: error.message });
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

        // 单独查询快照信息，避免表不存在的错误
        let totalSnapshots = 0;
        let latestSnapshot = null;
        
        try {
            totalSnapshots = db.prepare(`
                SELECT COUNT(DISTINCT year || '-' || month) as count 
                FROM monthly_stock_snapshots
            `).get()?.count || 0;
            
            const latest = db.prepare(`
                SELECT year, month FROM monthly_stock_snapshots 
                ORDER BY year DESC, month DESC 
                LIMIT 1
            `).get();
            
            if (latest) {
                latestSnapshot = `${latest.year}年${latest.month}月`;
            }
        } catch (error) {
            console.log('Snapshot table not found or error querying snapshots:', error.message);
        }

        const lastBackup = db.prepare(`
            SELECT value FROM admin_settings WHERE key = 'last_backup'
        `).get();

        const systemVersion = db.prepare(`
            SELECT value FROM admin_settings WHERE key = 'system_version'
        `).get();

        res.json({
            database: {
                ...dbInfo,
                total_snapshots: totalSnapshots
            },
            lastBackup: lastBackup?.value || null,
            systemVersion: systemVersion?.value || '1.0.0',
            serverTime: new Date().toISOString(),
            uptime: process.uptime(),
            latestSnapshot: latestSnapshot
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

        // Security check - allow backup files with ISO timestamp format
        // Pattern matches: backup_2025-07-26T15-06-48-972Z.db
        if (!filename.match(/^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db$/)) {
            console.log('Invalid filename format:', filename);
            return res.status(400).json({ error: 'Invalid filename format' });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found' });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        
        // Set proper headers for file download
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stats.size);

        // Create read stream and pipe to response
        const fileStream = fs.createReadStream(filePath);
        
        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to read backup file' });
            }
        });

        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Download backup error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download backup file' });
        }
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

        // Security check - allow backup files with ISO timestamp format
        // Pattern matches: backup_2025-07-26T15-06-48-972Z.db
        if (!filename.match(/^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db$/)) {
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

// Reset system - delete all products, transactions and snapshots, keep categories and projects
router.post('/reset-system', (req, res) => {
    try {
        let productsDeleted = 0;
        let transactionsDeleted = 0;
        let snapshotsDeleted = 0;
        
        // Use transaction for the deletions
        const transaction = db.transaction(() => {
            // Delete all transactions first (due to foreign key constraints)
            const deleteTransactions = db.prepare('DELETE FROM transactions');
            const transactionResult = deleteTransactions.run();
            
            // Delete all snapshots
            const deleteSnapshots = db.prepare('DELETE FROM monthly_stock_snapshots');
            const snapshotResult = deleteSnapshots.run();
            
            // Delete all products
            const deleteProducts = db.prepare('DELETE FROM products');
            const productResult = deleteProducts.run();
            
            // Reset any auto-increment sequences
            db.exec("DELETE FROM sqlite_sequence WHERE name='products'");
            db.exec("DELETE FROM sqlite_sequence WHERE name='transactions'");
            
            return {
                productsDeleted: productResult.changes,
                transactionsDeleted: transactionResult.changes,
                snapshotsDeleted: snapshotResult.changes
            };
        });
        
        const result = transaction();
        productsDeleted = result.productsDeleted;
        transactionsDeleted = result.transactionsDeleted;
        snapshotsDeleted = result.snapshotsDeleted;
        
        // Run VACUUM outside of transaction
        db.exec('VACUUM');
        
        res.json({
            message: 'System reset completed successfully',
            productsDeleted: productsDeleted,
            transactionsDeleted: transactionsDeleted,
            snapshotsDeleted: snapshotsDeleted,
            note: 'Categories and projects have been preserved'
        });
    } catch (error) {
        console.error('System reset error:', error);
        res.status(500).json({ error: 'Failed to reset system' });
    }
});

// Fix product prices - 修复产品价格数据
router.post('/fix-prices', (req, res) => {
    console.log('开始修复产品价格数据...');

    try {
        // 获取所有产品
        const products = db.prepare(`
            SELECT id, name, stock, price, current_unit_price, total_cost_value 
            FROM products
        `).all();

        console.log(`找到 ${products.length} 个产品`);

        let updated = 0;
        const results = [];

        const updateStmt = db.prepare(`
            UPDATE products 
            SET current_unit_price = ?, total_cost_value = ? 
            WHERE id = ?
        `);

        // 开始事务
        const transaction = db.transaction(() => {
            for (const product of products) {
                let needsUpdate = false;
                let newCurrentUnitPrice = product.current_unit_price;
                let newTotalCostValue = product.total_cost_value;

                // 如果current_unit_price为0但price有值，则使用price
                if ((product.current_unit_price === 0 || product.current_unit_price === null) && product.price > 0) {
                    newCurrentUnitPrice = parseFloat(product.price.toFixed(2));
                    needsUpdate = true;
                }

                // 如果total_cost_value为0但有库存和单价，则计算总价值
                if ((product.total_cost_value === 0 || product.total_cost_value === null) && 
                    product.stock > 0 && newCurrentUnitPrice > 0) {
                    newTotalCostValue = parseFloat((product.stock * newCurrentUnitPrice).toFixed(2));
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    updateStmt.run(newCurrentUnitPrice, newTotalCostValue, product.id);
                    updated++;
                    
                    results.push({
                        id: product.id,
                        name: product.name,
                        stock: product.stock,
                        oldPrice: product.price,
                        oldCurrentUnitPrice: product.current_unit_price,
                        oldTotalCostValue: product.total_cost_value,
                        newCurrentUnitPrice: newCurrentUnitPrice,
                        newTotalCostValue: newTotalCostValue
                    });
                }
            }
        });

        transaction();

        // 验证结果
        const verifyStmt = db.prepare(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN current_unit_price > 0 THEN 1 END) as with_unit_price,
                COUNT(CASE WHEN total_cost_value > 0 THEN 1 END) as with_total_value,
                SUM(total_cost_value) as total_inventory_value
            FROM products
        `);

        const verification = verifyStmt.get();

        console.log(`修复完成！更新了 ${updated} 个产品的价格数据`);

        res.json({
            message: `价格修复完成！更新了 ${updated} 个产品`,
            updated: updated,
            verification: {
                totalProducts: verification.total_products,
                withUnitPrice: verification.with_unit_price,
                withTotalValue: verification.with_total_value,
                totalInventoryValue: verification.total_inventory_value || 0
            },
            details: results.slice(0, 10) // 只返回前10个详细结果，避免响应过大
        });

    } catch (error) {
        console.error('修复过程中出现错误:', error);
        res.status(500).json({ error: '价格修复失败: ' + error.message });
    }
});

module.exports = router;
