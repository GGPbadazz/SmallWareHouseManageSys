const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');
const backupService = require('../services/backupService');
const router = express.Router();
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { backupsDir, documentUploadsDir, tempUploadDir, ensureDir } = require('../config/paths');

ensureDir(tempUploadDir);
ensureDir(documentUploadsDir);
ensureDir(backupsDir);

// 配置multer用于ZIP文件上传
const upload = multer({
    dest: tempUploadDir,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB限制
    }
});

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
        const { tables, format = 'json', include_images = 'false' } = req.query;
        const includeImages = include_images === 'true';
        const tablesToExport = tables ? tables.split(',') : ['products', 'categories', 'projects', 'transactions', 'documents', 'snapshots', 'admin_settings'];

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
                case 'documents':
                    exportData.documents = db.prepare('SELECT * FROM documents').all();
                    break;
                case 'snapshots':
                    exportData.snapshots = db.prepare('SELECT * FROM monthly_stock_snapshots').all();
                    break;
                case 'admin_settings':
                    exportData.admin_settings = db.prepare('SELECT * FROM admin_settings').all();
                    break;
            }
        });

        const backupData = {
            exportDate: new Date().toISOString(),
            version: '1.0.2',
            tables: tablesToExport,
            include_images: includeImages,
            data: exportData
        };

        // 如果不包含图片或格式为JSON，直接返回JSON
        if (!includeImages || format === 'json') {
            return res.json(backupData);
        }

        // 导出ZIP格式（包含图片）
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${timestamp}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const archive = archiver('zip', {
            zlib: { level: 6 } // 压缩级别
        });

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to create backup archive' });
            }
        });

        // 将压缩流管道到响应
        archive.pipe(res);

        // 添加data.json
        archive.append(JSON.stringify(backupData, null, 2), { name: 'data.json' });

        // 添加uploads/documents目录
        const uploadsDir = documentUploadsDir;
        if (fs.existsSync(uploadsDir)) {
            archive.directory(uploadsDir, 'uploads/documents');
            console.log('✅ 添加图片目录到备份');
        } else {
            console.log('⚠️ 图片目录不存在，跳过');
        }

        // 完成压缩
        archive.finalize();
        
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
        
        const backupDir = backupsDir;
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
        const backupDir = backupsDir;
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
        const backupDir = backupsDir;
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

// Restore backup from ZIP file upload
router.post('/backup/restore-zip', upload.single('backup_file'), (req, res) => {
    let tempFilePath = null;
    let tempExtractPath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未上传备份文件' });
        }

        tempFilePath = req.file.path;
        console.log('📦 开始恢复ZIP备份:', req.file.originalname);

        // 解压ZIP文件
        const zip = new AdmZip(tempFilePath);
        tempExtractPath = path.join(tempUploadDir, 'extract_' + Date.now());
        fs.mkdirSync(tempExtractPath, { recursive: true });
        
        zip.extractAllTo(tempExtractPath, true);
        console.log('✅ ZIP文件解压完成');

        // 读取data.json
        const dataJsonPath = path.join(tempExtractPath, 'data.json');
        if (!fs.existsSync(dataJsonPath)) {
            throw new Error('备份文件中缺少data.json');
        }

        const backup_data = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
        
        if (!backup_data || !backup_data.data) {
            throw new Error('无效的备份数据格式');
        }

        console.log('开始恢复数据库数据...');
        
        // 临时禁用外键约束（必须在事务外）
        db.pragma('foreign_keys = OFF');
        
        // 使用事务来恢复数据（与原restore端点相同的逻辑）
        const restoreTransaction = db.transaction(() => {
            const data = backup_data.data;
            const stats = {
                categories: 0,
                projects: 0,
                products: 0,
                transactions: 0,
                documents: 0,
                snapshots: 0,
                settings: 0,
                images: 0
            };

            // 1. 清空现有数据
            console.log('清空现有数据...');
            
            db.prepare('DELETE FROM transactions').run();
            db.prepare('DELETE FROM documents').run();
            db.prepare('DELETE FROM products').run();
            db.prepare('DELETE FROM categories').run();
            db.prepare('DELETE FROM projects').run();
            db.prepare('DELETE FROM monthly_stock_snapshots').run();
            
            // 重置自增序列
            db.exec("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories', 'projects', 'transactions', 'documents', 'monthly_stock_snapshots')");
            
            // 2. 恢复类别
            if (data.categories && data.categories.length > 0) {
                console.log(`恢复 ${data.categories.length} 个类别...`);
                const insertCategory = db.prepare(`
                    INSERT INTO categories (id, name, description, created_at)
                    VALUES (?, ?, ?, ?)
                `);
                
                for (const category of data.categories) {
                    insertCategory.run(
                        category.id,
                        category.name,
                        category.description || null,
                        category.created_at || new Date().toISOString()
                    );
                    stats.categories++;
                }
            }

            // 3. 恢复单位/部门
            if (data.projects && data.projects.length > 0) {
                console.log(`恢复 ${data.projects.length} 个单位/部门...`);
                const insertProject = db.prepare(`
                    INSERT INTO projects (id, name, description, created_at)
                    VALUES (?, ?, ?, ?)
                `);
                
                for (const project of data.projects) {
                    insertProject.run(
                        project.id,
                        project.name,
                        project.description || null,
                        project.created_at || new Date().toISOString()
                    );
                    stats.projects++;
                }
            }

            // 4. 恢复产品
            if (data.products && data.products.length > 0) {
                console.log(`恢复 ${data.products.length} 个产品...`);
                const insertProduct = db.prepare(`
                    INSERT INTO products (
                        id, name, name_en, barcode, category_id, description, 
                        stock, min_stock, price, current_unit_price, total_cost_value,
                        location, supplier, barcode_image, qr_code_image, barcode_updated_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const product of data.products) {
                    insertProduct.run(
                        product.id,
                        product.name,
                        product.name_en || null,
                        product.barcode || null,
                        product.category_id,
                        product.description || null,
                        product.stock || 0,
                        product.min_stock || 0,
                        product.price || 0,
                        product.current_unit_price || 0,
                        product.total_cost_value || 0,
                        product.location || null,
                        product.supplier || null,
                        product.barcode_image || null,
                        product.qr_code_image || null,
                        product.barcode_updated_at || null,
                        product.created_at || new Date().toISOString(),
                        product.updated_at || new Date().toISOString()
                    );
                    stats.products++;
                }
            }

            // 5. 恢复单据
            if (data.documents && data.documents.length > 0) {
                console.log(`恢复 ${data.documents.length} 个单据...`);
                const insertDocument = db.prepare(`
                    INSERT INTO documents (
                        id, document_number, original_number, document_type, status,
                        requester_name, project_id, purpose, notes, supplier,
                        image_path, image_filename, total_value, total_quantity, item_count,
                        ocr_confidence, ocr_raw_text, created_at, submitted_at, cancelled_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const doc of data.documents) {
                    insertDocument.run(
                        doc.id,
                        doc.document_number,
                        doc.original_number || null,
                        doc.document_type,
                        doc.status || 'draft',
                        doc.requester_name || null,
                        doc.project_id || null,
                        doc.purpose || null,
                        doc.notes || null,
                        doc.supplier || null,
                        doc.image_path || null,
                        doc.image_filename || null,
                        doc.total_value || 0,
                        doc.total_quantity || 0,
                        doc.item_count || 0,
                        doc.ocr_confidence || null,
                        doc.ocr_raw_text || null,
                        doc.created_at || new Date().toISOString(),
                        doc.submitted_at || null,
                        doc.cancelled_at || null,
                        doc.updated_at || new Date().toISOString()
                    );
                    stats.documents++;
                }
            }

            // 6. 恢复交易记录
            if (data.transactions && data.transactions.length > 0) {
                console.log(`恢复 ${data.transactions.length} 条交易记录...`);
                const insertTransaction = db.prepare(`
                    INSERT INTO transactions (
                        id, product_id, document_id, document_number, type, quantity,
                        unit_price, total_price, requester_name, requester_department,
                        project_id, purpose, signature, stock_before, stock_after,
                        stock_unit_price, stock_value, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const txn of data.transactions) {
                    insertTransaction.run(
                        txn.id,
                        txn.product_id,
                        txn.document_id || null,
                        txn.document_number || null,
                        txn.type,
                        txn.quantity,
                        txn.unit_price || 0,
                        txn.total_price || 0,
                        txn.requester_name || null,
                        txn.requester_department || null,
                        txn.project_id || null,
                        txn.purpose || null,
                        txn.signature || null,
                        txn.stock_before || 0,
                        txn.stock_after || 0,
                        txn.stock_unit_price || 0,
                        txn.stock_value || 0,
                        txn.created_at || new Date().toISOString()
                    );
                    stats.transactions++;
                }
            }

            // 7. 恢复快照
            if (data.snapshots && data.snapshots.length > 0) {
                console.log(`恢复 ${data.snapshots.length} 条快照记录...`);
                const insertSnapshot = db.prepare(`
                    INSERT INTO monthly_stock_snapshots (
                        id, year, month, product_id, product_name, product_barcode,
                        category_id, category_name,
                        ending_stock, ending_unit_price, ending_stock_value,
                        in_quantity, out_quantity, net_quantity,
                        total_in_value, total_out_value, net_value,
                        transaction_count, snapshot_date, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const snapshot of data.snapshots) {
                    insertSnapshot.run(
                        snapshot.id,
                        snapshot.year,
                        snapshot.month,
                        snapshot.product_id,
                        snapshot.product_name,
                        snapshot.product_barcode || null,
                        snapshot.category_id || null,
                        snapshot.category_name || null,
                        snapshot.ending_stock || 0,
                        snapshot.ending_unit_price || 0,
                        snapshot.ending_stock_value || 0,
                        snapshot.in_quantity || 0,
                        snapshot.out_quantity || 0,
                        snapshot.net_quantity || 0,
                        snapshot.total_in_value || 0,
                        snapshot.total_out_value || 0,
                        snapshot.net_value || 0,
                        snapshot.transaction_count || (snapshot.in_count || 0) + (snapshot.out_count || 0),
                        snapshot.snapshot_date || new Date().toISOString(),
                        snapshot.created_at || new Date().toISOString()
                    );
                    stats.snapshots++;
                }
            }

            // 8. 恢复部分系统设置
            if (data.admin_settings && data.admin_settings.length > 0) {
                console.log(`恢复系统设置...`);
                const insertSetting = db.prepare(`
                    INSERT OR REPLACE INTO admin_settings (key, value, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                `);
                
                const allowedKeys = ['last_backup', 'backup.autoBackup', 'backup.frequency', 'backup.retentionCount'];
                
                for (const setting of data.admin_settings) {
                    if (allowedKeys.includes(setting.key)) {
                        insertSetting.run(
                            setting.key,
                            setting.value,
                            setting.created_at || new Date().toISOString(),
                            setting.updated_at || new Date().toISOString()
                        );
                        stats.settings++;
                    }
                }
            }

            return stats;
        });

        const result = restoreTransaction();
        
        // 重新启用外键约束
        db.pragma('foreign_keys = ON');
        
        console.log('✅ 数据库数据恢复完成:', result);

        // 9. 恢复图片文件
        if (backup_data.include_images) {
            const uploadsSourceDir = path.join(tempExtractPath, 'uploads/documents');
            const uploadsTargetDir = documentUploadsDir;
            
            if (fs.existsSync(uploadsSourceDir)) {
                console.log('开始恢复图片文件...');
                
                // 删除现有图片目录
                if (fs.existsSync(uploadsTargetDir)) {
                    fs.rmSync(uploadsTargetDir, { recursive: true, force: true });
                }
                
                // 复制图片目录
                fs.mkdirSync(uploadsTargetDir, { recursive: true });
                copyDirRecursive(uploadsSourceDir, uploadsTargetDir);
                
                // 统计图片数量
                const imageFiles = countFiles(uploadsTargetDir, '.jpg');
                result.images = imageFiles;
                console.log(`✅ 恢复 ${imageFiles} 个图片文件`);
            } else {
                console.log('⚠️ 备份中不包含图片文件');
            }
        }

        // 清理临时文件
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        if (tempExtractPath && fs.existsSync(tempExtractPath)) {
            fs.rmSync(tempExtractPath, { recursive: true, force: true });
        }

        console.log('🎉 备份恢复完成');
        
        res.json({
            message: '备份恢复成功',
            stats: result
        });
        
    } catch (error) {
        console.error('恢复ZIP备份失败:', error);
        
        // 清理临时文件
        try {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            if (tempExtractPath && fs.existsSync(tempExtractPath)) {
                fs.rmSync(tempExtractPath, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            console.error('清理临时文件失败:', cleanupError);
        }
        
        res.status(500).json({ 
            error: '恢复备份失败: ' + error.message,
            details: error.stack
        });
    }
});

// 辅助函数：递归复制目录
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 辅助函数：统计文件数量
function countFiles(dir, ext) {
    let count = 0;
    
    if (!fs.existsSync(dir)) {
        return 0;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            count += countFiles(fullPath, ext);
        } else if (!ext || entry.name.endsWith(ext)) {
            count++;
        }
    }
    
    return count;
}

// Restore backup from JSON data (保留原有端点，用于JSON格式恢复)
router.post('/backup/restore', (req, res) => {
    try {
        const { backup_data } = req.body;
        
        if (!backup_data || !backup_data.data) {
            return res.status(400).json({ error: '无效的备份数据格式' });
        }

        console.log('开始恢复备份数据...');
        
        // 临时禁用外键约束（必须在事务外）
        db.pragma('foreign_keys = OFF');
        
        // 使用事务来恢复数据
        const restoreTransaction = db.transaction(() => {
            const data = backup_data.data;
            const stats = {
                categories: 0,
                projects: 0,
                products: 0,
                transactions: 0,
                documents: 0,
                snapshots: 0,
                settings: 0
            };

            // 1. 清空现有数据（除了admin_settings中的密码等关键配置）
            console.log('清空现有数据...');
            
            db.prepare('DELETE FROM transactions').run();
            db.prepare('DELETE FROM documents').run();
            db.prepare('DELETE FROM products').run();
            db.prepare('DELETE FROM categories').run();
            db.prepare('DELETE FROM projects').run();
            db.prepare('DELETE FROM monthly_stock_snapshots').run();
            
            // 重置自增序列，避免ID冲突
            db.exec("DELETE FROM sqlite_sequence WHERE name IN ('products', 'categories', 'projects', 'transactions', 'documents', 'monthly_stock_snapshots')");
            
            // 2. 恢复类别
            if (data.categories && data.categories.length > 0) {
                console.log(`恢复 ${data.categories.length} 个类别...`);
                const insertCategory = db.prepare(`
                    INSERT INTO categories (id, name, description, created_at)
                    VALUES (?, ?, ?, ?)
                `);
                
                for (const category of data.categories) {
                    insertCategory.run(
                        category.id,
                        category.name,
                        category.description || null,
                        category.created_at || new Date().toISOString()
                    );
                    stats.categories++;
                }
            }

            // 3. 恢复单位/部门
            if (data.projects && data.projects.length > 0) {
                console.log(`恢复 ${data.projects.length} 个单位/部门...`);
                const insertProject = db.prepare(`
                    INSERT INTO projects (id, name, description, created_at)
                    VALUES (?, ?, ?, ?)
                `);
                
                for (const project of data.projects) {
                    insertProject.run(
                        project.id,
                        project.name,
                        project.description || null,
                        project.created_at || new Date().toISOString()
                    );
                    stats.projects++;
                }
            }

            // 4. 恢复产品
            if (data.products && data.products.length > 0) {
                console.log(`恢复 ${data.products.length} 个产品...`);
                const insertProduct = db.prepare(`
                    INSERT INTO products (
                        id, name, name_en, barcode, category_id, description, 
                        stock, min_stock, price, current_unit_price, total_cost_value,
                        location, supplier, barcode_image, qr_code_image, barcode_updated_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const product of data.products) {
                    insertProduct.run(
                        product.id,
                        product.name,
                        product.name_en || null,
                        product.barcode || null,
                        product.category_id,
                        product.description || null,
                        product.stock || 0,
                        product.min_stock || 0,
                        product.price || 0,
                        product.current_unit_price || 0,
                        product.total_cost_value || 0,
                        product.location || null,
                        product.supplier || null,
                        product.barcode_image || null,
                        product.qr_code_image || null,
                        product.barcode_updated_at || null,
                        product.created_at || new Date().toISOString(),
                        product.updated_at || new Date().toISOString()
                    );
                    stats.products++;
                }
            }

            // 5. 恢复单据
            if (data.documents && data.documents.length > 0) {
                console.log(`恢复 ${data.documents.length} 个单据...`);
                const insertDocument = db.prepare(`
                    INSERT INTO documents (
                        id, document_number, original_number, document_type, status,
                        requester_name, project_id, purpose, notes, supplier,
                        image_path, image_filename, total_value, total_quantity, item_count,
                        ocr_confidence, ocr_raw_text, created_at, submitted_at, cancelled_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const doc of data.documents) {
                    insertDocument.run(
                        doc.id,
                        doc.document_number,
                        doc.original_number || null,
                        doc.document_type,
                        doc.status || 'draft',
                        doc.requester_name || null,
                        doc.project_id || null,
                        doc.purpose || null,
                        doc.notes || null,
                        doc.supplier || null,
                        doc.image_path || null,
                        doc.image_filename || null,
                        doc.total_value || 0,
                        doc.total_quantity || 0,
                        doc.item_count || 0,
                        doc.ocr_confidence || null,
                        doc.ocr_raw_text || null,
                        doc.created_at || new Date().toISOString(),
                        doc.submitted_at || null,
                        doc.cancelled_at || null,
                        doc.updated_at || new Date().toISOString()
                    );
                    stats.documents++;
                }
            }

            // 6. 恢复交易记录
            if (data.transactions && data.transactions.length > 0) {
                console.log(`恢复 ${data.transactions.length} 条交易记录...`);
                const insertTransaction = db.prepare(`
                    INSERT INTO transactions (
                        id, product_id, document_id, document_number, type, quantity,
                        unit_price, total_price, requester_name, requester_department,
                        project_id, purpose, signature, stock_before, stock_after,
                        stock_unit_price, stock_value, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const txn of data.transactions) {
                    insertTransaction.run(
                        txn.id,
                        txn.product_id,
                        txn.document_id || null,
                        txn.document_number || null,
                        txn.type,
                        txn.quantity,
                        txn.unit_price || 0,
                        txn.total_price || 0,
                        txn.requester_name || null,
                        txn.requester_department || null,
                        txn.project_id || null,
                        txn.purpose || null,
                        txn.signature || null,
                        txn.stock_before || 0,
                        txn.stock_after || 0,
                        txn.stock_unit_price || 0,
                        txn.stock_value || 0,
                        txn.created_at || new Date().toISOString()
                    );
                    stats.transactions++;
                }
            }

            // 7. 恢复快照
            if (data.snapshots && data.snapshots.length > 0) {
                console.log(`恢复 ${data.snapshots.length} 条快照记录...`);
                const insertSnapshot = db.prepare(`
                    INSERT INTO monthly_stock_snapshots (
                        id, year, month, product_id, product_name, product_barcode,
                        category_id, category_name,
                        ending_stock, ending_unit_price, ending_stock_value,
                        in_quantity, out_quantity, net_quantity,
                        total_in_value, total_out_value, net_value,
                        transaction_count, snapshot_date, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                for (const snapshot of data.snapshots) {
                    insertSnapshot.run(
                        snapshot.id,
                        snapshot.year,
                        snapshot.month,
                        snapshot.product_id,
                        snapshot.product_name,
                        snapshot.product_barcode || null,
                        snapshot.category_id || null,
                        snapshot.category_name || null,
                        snapshot.ending_stock || 0,
                        snapshot.ending_unit_price || 0,
                        snapshot.ending_stock_value || 0,
                        snapshot.in_quantity || 0,
                        snapshot.out_quantity || 0,
                        snapshot.net_quantity || 0,
                        snapshot.total_in_value || 0,
                        snapshot.total_out_value || 0,
                        snapshot.net_value || 0,
                        snapshot.transaction_count || (snapshot.in_count || 0) + (snapshot.out_count || 0),
                        snapshot.snapshot_date || new Date().toISOString(),
                        snapshot.created_at || new Date().toISOString()
                    );
                    stats.snapshots++;
                }
            }

            // 8. 恢复部分系统设置（保留密码等敏感配置）
            if (data.admin_settings && data.admin_settings.length > 0) {
                console.log(`恢复系统设置...`);
                const insertSetting = db.prepare(`
                    INSERT OR REPLACE INTO admin_settings (key, value, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                `);
                
                // 只恢复非敏感的设置
                const allowedKeys = ['last_backup', 'backup.autoBackup', 'backup.frequency', 'backup.retentionCount'];
                
                for (const setting of data.admin_settings) {
                    if (allowedKeys.includes(setting.key)) {
                        insertSetting.run(
                            setting.key,
                            setting.value,
                            setting.created_at || new Date().toISOString(),
                            setting.updated_at || new Date().toISOString()
                        );
                        stats.settings++;
                    }
                }
            }

            return stats;
        });

        const result = restoreTransaction();
        
        // 重新启用外键约束
        db.pragma('foreign_keys = ON');
        
        console.log('备份恢复成功:', result);
        
        res.json({
            message: '备份恢复成功',
            stats: result
        });
        
    } catch (error) {
        console.error('恢复备份失败:', error);
        res.status(500).json({ 
            error: '恢复备份失败: ' + error.message,
            details: error.stack
        });
    }
});

// System cleanup
router.post('/cleanup', (req, res) => {
    try {
        const requestedDays = parseInt(req.body?.days ?? 90, 10);
        const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 90, 1), 3650);

        // Clean old transactions (older than specified days)
        const deleteOldTransactions = db.prepare(`
            DELETE FROM transactions 
            WHERE created_at < datetime('now', ?)
        `);

        const result = deleteOldTransactions.run(`-${days} days`);

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
        let documentsDeleted = 0;
        
        // Disable foreign keys before deletion
        db.pragma('foreign_keys = OFF');
        
        // Use transaction for the deletions
        const transaction = db.transaction(() => {
            // Delete all transactions first (due to foreign key constraints)
            const deleteTransactions = db.prepare('DELETE FROM transactions');
            const transactionResult = deleteTransactions.run();
            
            // Delete all documents
            const deleteDocuments = db.prepare('DELETE FROM documents');
            const documentResult = deleteDocuments.run();
            
            // Delete all snapshots
            const deleteSnapshots = db.prepare('DELETE FROM monthly_stock_snapshots');
            const snapshotResult = deleteSnapshots.run();
            
            // Delete all products
            const deleteProducts = db.prepare('DELETE FROM products');
            const productResult = deleteProducts.run();
            
            // Reset any auto-increment sequences
            db.exec("DELETE FROM sqlite_sequence WHERE name='products'");
            db.exec("DELETE FROM sqlite_sequence WHERE name='transactions'");
            db.exec("DELETE FROM sqlite_sequence WHERE name='documents'");
            
            return {
                productsDeleted: productResult.changes,
                transactionsDeleted: transactionResult.changes,
                snapshotsDeleted: snapshotResult.changes,
                documentsDeleted: documentResult.changes
            };
        });
        
        const result = transaction();
        productsDeleted = result.productsDeleted;
        transactionsDeleted = result.transactionsDeleted;
        snapshotsDeleted = result.snapshotsDeleted;
        documentsDeleted = result.documentsDeleted;
        
        // Re-enable foreign keys after transaction
        db.pragma('foreign_keys = ON');
        
        // Run VACUUM outside of transaction
        db.exec('VACUUM');
        
        res.json({
            message: 'System reset completed successfully',
            productsDeleted: productsDeleted,
            transactionsDeleted: transactionsDeleted,
            snapshotsDeleted: snapshotsDeleted,
            documentsDeleted: documentsDeleted,
            note: 'Categories and projects have been preserved'
        });
    } catch (error) {
        console.error('System reset error:', error);
        // Re-enable foreign keys on error
        db.pragma('foreign_keys = ON');
        res.status(500).json({ error: 'Failed to reset system' });
    }
});

module.exports = router;
