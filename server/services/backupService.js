const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

class BackupService {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups');
        this.dbPath = path.join(__dirname, '../database/inventory.db');
        
        // 确保备份目录存在
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    // 创建备份
    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `backup_${timestamp}.db`);

            // 复制数据库文件
            fs.copyFileSync(this.dbPath, backupPath);

            // 更新最后备份时间
            db.prepare(`
                INSERT OR REPLACE INTO admin_settings (key, value, updated_at) 
                VALUES (?, ?, datetime('now'))
            `).run('last_backup', new Date().toISOString());

            return {
                success: true,
                backup_path: backupPath,
                filename: `backup_${timestamp}.db`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('创建备份失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 清理旧备份
    cleanOldBackups(retentionCount = 7) {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(file => file.endsWith('.db') && file.startsWith('backup_'))
                .map(file => {
                    const filePath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: file,
                        path: filePath,
                        created: stats.birthtime
                    };
                })
                .sort((a, b) => b.created - a.created);

            if (files.length > retentionCount) {
                const filesToDelete = files.slice(retentionCount);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    console.log(`已删除旧备份: ${file.filename}`);
                });
            }

            return { success: true, cleaned: files.length - retentionCount };
        } catch (error) {
            console.error('清理旧备份失败:', error);
            return { success: false, error: error.message };
        }
    }

    // 获取备份设置
    getBackupSettings() {
        try {
            const settings = db.prepare(`
                SELECT key, value FROM admin_settings 
                WHERE key IN ('backup.autoBackup', 'backup.frequency', 'backup.retentionCount')
            `).all();

            const backupSettings = {
                autoBackup: false,
                frequency: 'daily',
                retentionCount: 7
            };

            settings.forEach(setting => {
                const key = setting.key.split('.')[1];
                if (key === 'autoBackup') {
                    backupSettings.autoBackup = setting.value === 'true';
                } else if (key === 'retentionCount') {
                    backupSettings.retentionCount = parseInt(setting.value);
                } else {
                    backupSettings[key] = setting.value;
                }
            });

            return backupSettings;
        } catch (error) {
            console.error('获取备份设置失败:', error);
            return {
                autoBackup: false,
                frequency: 'daily',
                retentionCount: 7
            };
        }
    }

    // 执行自动备份
    async performAutoBackup() {
        const settings = this.getBackupSettings();
        
        if (!settings.autoBackup) {
            return { success: false, message: '自动备份未启用' };
        }

        // 检查是否需要备份
        const lastBackupStr = db.prepare(`
            SELECT value FROM admin_settings WHERE key = 'last_backup'
        `).get()?.value;

        if (lastBackupStr) {
            const lastBackup = new Date(lastBackupStr);
            const now = new Date();
            const diffHours = (now - lastBackup) / (1000 * 60 * 60);

            let intervalHours;
            switch (settings.frequency) {
                case 'hourly':
                    intervalHours = 1;
                    break;
                case 'daily':
                    intervalHours = 24;
                    break;
                case 'weekly':
                    intervalHours = 24 * 7;
                    break;
                case 'monthly':
                    intervalHours = 24 * 30;
                    break;
                default:
                    intervalHours = 24;
            }

            if (diffHours < intervalHours) {
                return { 
                    success: false, 
                    message: `距离上次备份时间不足，还需等待 ${Math.ceil(intervalHours - diffHours)} 小时` 
                };
            }
        }

        // 创建备份
        const result = this.createBackup();
        
        if (result.success) {
            // 清理旧备份
            this.cleanOldBackups(settings.retentionCount);
            console.log(`自动备份完成: ${result.filename}`);
        }

        return result;
    }

    // 启动自动备份调度器
    startAutoBackupScheduler() {
        // 每小时检查一次是否需要自动备份
        setInterval(() => {
            this.performAutoBackup().then(result => {
                if (result.success) {
                    console.log('自动备份成功:', result.filename);
                }
            }).catch(error => {
                console.error('自动备份失败:', error);
            });
        }, 60 * 60 * 1000); // 每小时检查一次

        console.log('自动备份调度器已启动');
    }
}

module.exports = new BackupService();
