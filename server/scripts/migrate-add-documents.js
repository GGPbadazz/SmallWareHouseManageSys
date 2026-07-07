/**
 * 数据库迁移脚本：添加单据管理功能
 * 
 * 新增表：
 * - documents: 单据表
 * 
 * 修改表：
 * - transactions: 添加 document_id 和 document_number 字段
 * 
 * 运行方式: node scripts/migrate-add-documents.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库路径
const dbPath = process.env.DB_PATH 
    ? (path.isAbsolute(process.env.DB_PATH) 
        ? process.env.DB_PATH 
        : path.join(__dirname, '..', process.env.DB_PATH))
    : path.join(__dirname, '..', 'database', 'inventory.db');

console.log('📦 数据库迁移：添加单据管理功能');
console.log('📍 数据库路径:', dbPath);

// 检查数据库是否存在
if (!fs.existsSync(dbPath)) {
    console.error('❌ 数据库文件不存在:', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

// 检查表是否已存在
const tableExists = (tableName) => {
    const result = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
    `).get(tableName);
    return !!result;
};

// 检查列是否已存在
const columnExists = (tableName, columnName) => {
    try {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        return columns.some(col => col.name === columnName);
    } catch (error) {
        return false;
    }
};

const migrate = db.transaction(() => {
    console.log('\n🚀 开始迁移...\n');

    // 1. 创建单据表
    if (!tableExists('documents')) {
        console.log('📋 创建 documents 表...');
        db.exec(`
            CREATE TABLE documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_number TEXT UNIQUE NOT NULL,
                original_number TEXT,
                document_type TEXT NOT NULL CHECK (document_type IN ('IN', 'OUT')),
                status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
                requester_name TEXT,
                project_id INTEGER,
                purpose TEXT,
                image_path TEXT,
                image_filename TEXT,
                total_value REAL DEFAULT 0,
                total_quantity REAL DEFAULT 0,
                item_count INTEGER DEFAULT 0,
                ocr_confidence REAL,
                ocr_raw_text TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                submitted_at DATETIME,
                cancelled_at DATETIME,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        `);
        
        // 创建索引
        db.exec(`CREATE INDEX idx_documents_number ON documents(document_number)`);
        db.exec(`CREATE INDEX idx_documents_type ON documents(document_type)`);
        db.exec(`CREATE INDEX idx_documents_status ON documents(status)`);
        db.exec(`CREATE INDEX idx_documents_created ON documents(created_at)`);
        
        console.log('✅ documents 表创建成功');
    } else {
        console.log('⏭️  documents 表已存在，跳过');
    }

    // 2. 修改 transactions 表，添加 document_id 和 document_number 字段
    if (!columnExists('transactions', 'document_id')) {
        console.log('📋 添加 transactions.document_id 字段...');
        db.exec(`ALTER TABLE transactions ADD COLUMN document_id INTEGER REFERENCES documents(id)`);
        console.log('✅ document_id 字段添加成功');
    } else {
        console.log('⏭️  transactions.document_id 字段已存在，跳过');
    }

    if (!columnExists('transactions', 'document_number')) {
        console.log('📋 添加 transactions.document_number 字段...');
        db.exec(`ALTER TABLE transactions ADD COLUMN document_number TEXT`);
        console.log('✅ document_number 字段添加成功');
    } else {
        console.log('⏭️  transactions.document_number 字段已存在，跳过');
    }

    // 3. 创建单据图片目录
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'documents');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('📁 创建单据图片目录:', uploadsDir);
    }

    console.log('\n✅ 迁移完成！\n');
});

try {
    migrate();
    
    // 验证迁移结果
    console.log('📊 验证迁移结果:');
    
    const documentsTable = tableExists('documents');
    console.log(`   - documents 表: ${documentsTable ? '✅ 存在' : '❌ 不存在'}`);
    
    const docIdColumn = columnExists('transactions', 'document_id');
    console.log(`   - transactions.document_id: ${docIdColumn ? '✅ 存在' : '❌ 不存在'}`);
    
    const docNumColumn = columnExists('transactions', 'document_number');
    console.log(`   - transactions.document_number: ${docNumColumn ? '✅ 存在' : '❌ 不存在'}`);
    
    // 显示 documents 表结构
    console.log('\n📋 documents 表结构:');
    const columns = db.prepare('PRAGMA table_info(documents)').all();
    columns.forEach(col => {
        console.log(`   - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
    });
    
} catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
} finally {
    db.close();
}

console.log('\n🎉 数据库迁移脚本执行完毕！');
