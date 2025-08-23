#!/usr/bin/env node

/**
 * Docker容器启动时的快照系统初始化脚本
 * 确保快照表和索引都已正确创建
 */

const path = require('path');
const fs = require('fs');

// 设置数据库路径
const DATABASE_PATH = process.env.DATABASE_PATH || './database/inventory.db';

console.log('🐳 Docker容器快照系统初始化...');
console.log(`📁 数据库路径: ${DATABASE_PATH}`);

// 检查数据库文件是否存在
if (!fs.existsSync(DATABASE_PATH)) {
    console.error('❌ 数据库文件不存在:', DATABASE_PATH);
    process.exit(1);
}

try {
    // 引入快照表创建脚本
    require('./create-snapshot-table.js');
    console.log('✅ 快照系统初始化完成');
} catch (error) {
    console.error('❌ 快照系统初始化失败:', error.message);
    // 不退出进程，让主应用继续启动
    console.log('⚠️  将在主应用启动时重试快照系统初始化');
}
