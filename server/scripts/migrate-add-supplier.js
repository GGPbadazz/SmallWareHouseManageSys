/**
 * 数据库迁移脚本 - 为 documents 表添加 supplier 字段
 * 供应商字段用于入库单，记录本次入库的供应商信息
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH 
    ? (path.isAbsolute(process.env.DB_PATH) 
        ? process.env.DB_PATH 
        : path.join(__dirname, '..', process.env.DB_PATH))
    : path.join(__dirname, '..', 'database', 'inventory.db');

console.log('📦 开始迁移: 为 documents 表添加 supplier 字段');
console.log('📂 数据库路径:', dbPath);

const db = new Database(dbPath);

try {
    // 检查 supplier 字段是否已存在
    const tableInfo = db.prepare("PRAGMA table_info(documents)").all();
    const hasSupplier = tableInfo.some(col => col.name === 'supplier');

    if (hasSupplier) {
        console.log('✅ supplier 字段已存在，无需迁移');
    } else {
        // 添加 supplier 字段
        db.prepare(`
            ALTER TABLE documents ADD COLUMN supplier TEXT
        `).run();
        console.log('✅ 成功添加 supplier 字段到 documents 表');
    }

    console.log('🎉 迁移完成！');
} catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
} finally {
    db.close();
}
