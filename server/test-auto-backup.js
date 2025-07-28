#!/usr/bin/env node
/**
 * 自动备份功能测试脚本
 * 用于验证自动备份功能是否正常工作
 */

const backupService = require('./services/backupService');
const db = require('./database/connection');

console.log('🧪 开始测试自动备份功能...\n');

// 测试1: 检查备份设置
console.log('📋 测试1: 检查备份设置');
const settings = backupService.getBackupSettings();
console.log('当前备份设置:', settings);
console.log('✅ 备份设置读取成功\n');

// 测试2: 检查上次备份时间
console.log('📋 测试2: 检查上次备份时间');
const lastBackupResult = db.prepare(`
    SELECT value FROM admin_settings WHERE key = 'last_backup'
`).get();

if (lastBackupResult) {
    const lastBackup = new Date(lastBackupResult.value);
    const now = new Date();
    const diffHours = (now - lastBackup) / (1000 * 60 * 60);
    console.log(`上次备份时间: ${lastBackup.toLocaleString()}`);
    console.log(`距离现在: ${diffHours.toFixed(2)} 小时`);
} else {
    console.log('未找到上次备份记录');
}
console.log('✅ 备份时间检查完成\n');

// 测试3: 手动触发自动备份
console.log('📋 测试3: 手动触发自动备份');
backupService.performAutoBackup().then(result => {
    console.log('自动备份结果:', result);
    
    if (result.success) {
        console.log('✅ 自动备份执行成功');
        console.log(`备份文件: ${result.filename}`);
    } else {
        console.log('⚠️ 自动备份跳过或失败');
        console.log(`原因: ${result.message}`);
    }
    
    // 测试4: 验证备份文件是否存在
    if (result.success && result.filename) {
        const fs = require('fs');
        const path = require('path');
        const backupPath = path.join(__dirname, 'backups', result.filename);
        
        console.log('\n📋 测试4: 验证备份文件');
        if (fs.existsSync(backupPath)) {
            const stats = fs.statSync(backupPath);
            console.log(`✅ 备份文件存在`);
            console.log(`文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
            console.log(`创建时间: ${stats.birthtime.toLocaleString()}`);
        } else {
            console.log('❌ 备份文件不存在');
        }
    }
    
    // 测试5: 列出所有备份文件
    console.log('\n📋 测试5: 列出所有备份文件');
    const fs = require('fs');
    const path = require('path');
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
        
        console.log(`找到 ${files.length} 个备份文件:`);
        files.forEach((file, index) => {
            console.log(`${index + 1}. ${file.filename} (${(file.size / 1024).toFixed(2)} KB, ${file.created.toLocaleString()})`);
        });
    } else {
        console.log('备份目录不存在');
    }
    
    console.log('\n🎉 自动备份功能测试完成！');
    process.exit(0);
    
}).catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
});
