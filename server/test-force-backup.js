#!/usr/bin/env node
/**
 * 强制执行自动备份测试
 * 临时修改上次备份时间来测试自动备份功能
 */

const db = require('./database/connection');
const backupService = require('./services/backupService');

console.log('🔧 强制执行自动备份测试...\n');

// 保存当前的上次备份时间
const currentLastBackup = db.prepare(`
    SELECT value FROM admin_settings WHERE key = 'last_backup'
`).get();

console.log('当前上次备份时间:', currentLastBackup ? new Date(currentLastBackup.value).toLocaleString() : '无记录');

// 临时设置上次备份时间为25小时前
const testTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
console.log('设置测试时间为:', new Date(testTime).toLocaleString());

db.prepare(`
    INSERT OR REPLACE INTO admin_settings (key, value)
    VALUES ('last_backup', ?)
`).run(testTime);

console.log('✅ 测试时间设置完成\n');

// 现在执行自动备份
console.log('📦 执行自动备份...');
backupService.performAutoBackup().then(result => {
    console.log('自动备份结果:', result);
    
    if (result.success) {
        console.log('✅ 自动备份执行成功！');
        console.log(`备份文件: ${result.filename}`);
        
        // 验证备份文件
        const fs = require('fs');
        const path = require('path');
        const backupPath = path.join(__dirname, 'backups', result.filename);
        
        if (fs.existsSync(backupPath)) {
            const stats = fs.statSync(backupPath);
            console.log(`文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
            console.log(`创建时间: ${stats.birthtime.toLocaleString()}`);
        }
    } else {
        console.log('❌ 自动备份失败');
        console.log(`原因: ${result.message}`);
    }
    
    // 恢复原始的上次备份时间（如果存在）
    if (currentLastBackup) {
        console.log('\n🔄 恢复原始备份时间...');
        db.prepare(`
            INSERT OR REPLACE INTO admin_settings (key, value)
            VALUES ('last_backup', ?)
        `).run(currentLastBackup.value);
        console.log('✅ 原始时间已恢复');
    }
    
    console.log('\n🎉 强制备份测试完成！');
    process.exit(0);
    
}).catch(error => {
    // 出错时也要恢复原始时间
    if (currentLastBackup) {
        db.prepare(`
            INSERT OR REPLACE INTO admin_settings (key, value)
            VALUES ('last_backup', ?)
        `).run(currentLastBackup.value);
    }
    console.error('❌ 测试失败:', error);
    process.exit(1);
});
