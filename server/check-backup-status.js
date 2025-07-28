#!/usr/bin/env node
/**
 * 备份状态检查工具
 * 快速查看自动备份功能状态
 */

const db = require('./database/connection');
const fs = require('fs');
const path = require('path');

console.log('📊 备份系统状态检查\n');

// 1. 检查备份设置
const settingsQuery = db.prepare(`
    SELECT key, value FROM admin_settings 
    WHERE key IN ('backup.autoBackup', 'backup.frequency', 'backup.retentionCount', 'auto_backup_enabled', 'backup_retention_days')
`);
const settings = settingsQuery.all();

console.log('🔧 备份设置:');
if (settings.length > 0) {
    settings.forEach(setting => {
        console.log(`  ${setting.key}: ${setting.value}`);
    });
} else {
    console.log('  未找到备份设置，使用默认值');
}

// 2. 检查上次备份时间
const lastBackupResult = db.prepare(`
    SELECT value FROM admin_settings WHERE key = 'last_backup'
`).get();

if (lastBackupResult) {
    const lastBackup = new Date(lastBackupResult.value);
    const now = new Date();
    const diffHours = (now - lastBackup) / (1000 * 60 * 60);
    console.log(`\n⏰ 上次备份: ${lastBackup.toLocaleString()}`);
    console.log(`⏳ 距离现在: ${diffHours.toFixed(2)} 小时`);
} else {
    console.log('\n⚠️  未找到上次备份记录');
}

// 3. 列出备份文件
const backupDir = path.join(__dirname, 'backups');
if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.db') && file.startsWith('backup_'))
        .map(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            return {
                filename: file,
                size: stats.size,
                created: stats.birthtime
            };
        })
        .sort((a, b) => b.created - a.created);
    
    console.log(`\n📁 备份文件 (${files.length} 个):`);
    files.forEach((file, index) => {
        const sizeKB = (file.size / 1024).toFixed(2);
        const timeStr = file.created.toLocaleString();
        console.log(`  ${index + 1}. ${file.filename}`);
        console.log(`     大小: ${sizeKB} KB | 创建时间: ${timeStr}`);
    });
} else {
    console.log('\n❌ 备份目录不存在');
}

console.log('\n✅ 状态检查完成');
