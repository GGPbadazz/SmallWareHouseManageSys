const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { dbPath, databaseDir, ensureDir } = require('./config/paths');

// 检查数据库是否已存在且已初始化
const isDatabaseInitialized = () => {
    if (!fs.existsSync(dbPath)) {
        return false;
    }
    
    try {
        const db = new Database(dbPath);
        
        // 检查关键表是否存在
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('products', 'categories', 'transactions', 'admin_settings', 'deleted_transactions_log')
        `).all();
        
        const hasRequiredTables = tables.length >= 5;
        
        // 检查是否有基础数据（分类和项目）
        let hasBasicData = false;
        if (hasRequiredTables) {
            const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
            const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
            hasBasicData = categoryCount > 0 && projectCount > 0;
        }
        
        db.close();
        return hasRequiredTables && hasBasicData;
    } catch (error) {
        return false;
    }
};

const createInitialAdminPasswordHash = () => {
    let initialPassword = process.env.INIT_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;

    if (!initialPassword) {
        initialPassword = crypto.randomBytes(12).toString('base64url');
        console.warn('⚠️ 未设置 INIT_ADMIN_PASSWORD，已生成一次性初始管理员密码:', initialPassword);
        console.warn('⚠️ 请首次登录后立即修改管理员密码，生产部署建议在 .env 中显式设置 INIT_ADMIN_PASSWORD');
    }

    if (initialPassword.length < 8) {
        throw new Error('INIT_ADMIN_PASSWORD must be at least 8 characters long');
    }

    return bcrypt.hashSync(initialPassword, 10);
};

const initializeDatabaseIfNeeded = () => {
    // 如果数据库已初始化，则跳过
    if (isDatabaseInitialized()) {
        console.log('📄 数据库已存在且已初始化，跳过初始化步骤');
        return false;
    }

    // 确保database目录存在
    const dbDir = path.dirname(dbPath);
    ensureDir(databaseDir);
    ensureDir(dbDir);

    console.log('🚀 首次启动：正在初始化数据库...');

    const adminPasswordHash = createInitialAdminPasswordHash();

    // 创建数据库连接
    const db = new Database(dbPath);

// 数据库表结构
const createTables = `
-- 商品分类表
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT,
    barcode TEXT UNIQUE,
    category_id INTEGER,
    location TEXT,
    supplier TEXT,
    description TEXT,
    stock DECIMAL(10,3) DEFAULT 0,
    min_stock DECIMAL(10,3) DEFAULT 0,
    price FLOAT DEFAULT 0,
    current_unit_price FLOAT DEFAULT 0,
    total_cost_value FLOAT DEFAULT 0,
    barcode_image TEXT,
    qr_code_image TEXT,
    barcode_updated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id)
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    document_id INTEGER,
    document_number TEXT,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity DECIMAL(10,3) NOT NULL,
    unit_price FLOAT DEFAULT 0,
    total_price FLOAT DEFAULT 0,
    requester_name TEXT,
    requester_department TEXT,
    project_id INTEGER,
    purpose TEXT,
    signature TEXT,
    stock_before DECIMAL(10,3) DEFAULT 0,
    stock_after DECIMAL(10,3) DEFAULT 0,
    stock_unit_price FLOAT DEFAULT 0,
    stock_value FLOAT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id),
    FOREIGN KEY (project_id) REFERENCES projects (id),
    FOREIGN KEY (document_id) REFERENCES documents (id)
);

-- 管理员设置表
CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 删除交易日志表
CREATE TABLE IF NOT EXISTS deleted_transactions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_transaction_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity DECIMAL(10,3) NOT NULL,
    unit_price FLOAT DEFAULT 0,
    total_price FLOAT DEFAULT 0,
    stock_before DECIMAL(10,3) DEFAULT 0,
    stock_after DECIMAL(10,3) DEFAULT 0,
    stock_unit_price FLOAT DEFAULT 0,
    stock_value FLOAT DEFAULT 0,
    original_date DATETIME NOT NULL,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_reason TEXT DEFAULT '手动作废',
    FOREIGN KEY (product_id) REFERENCES products (id)
);

-- 单据表
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_number TEXT UNIQUE NOT NULL,
    original_number TEXT,
    document_type TEXT NOT NULL CHECK (document_type IN ('IN', 'OUT')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
    requester_name TEXT,
    project_id INTEGER,
    purpose TEXT,
    notes TEXT,
    supplier TEXT,
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
);
`;

// 初始化基础数据（分类、项目、管理员设置）
const insertBasicData = `
-- 插入基础分类 (与现有系统的9个分类保持一致)
INSERT OR IGNORE INTO categories (name, description) VALUES 
('螺丝', '螺丝类零件'),
('金属', '金属制零部件'),
('电仪', '电气仪表设备'),
('PP材质', 'PP塑料材质物品'),
('阀门', '各类阀门设备'),
('劳保', '劳保用品'),
('工具', '工具设备'),
('一次性', '一次性用品'),
('油漆', '油漆');

-- 插入基础项目 (与现有系统的8个项目保持一致)
INSERT OR IGNORE INTO projects (name, description) VALUES 
('二车间', '二车间部门'),
('三车间', '三车间部门'),
('制冷剂', '制冷剂部门'),
('公共系统', '公共系统部门'),
('分析室', '分析室部门'),
('四车间', '四车间部门'),
('研发', '研发部门'),
('机修', '机修部门');

-- 插入管理员设置 (与现有系统设置保持一致)
INSERT OR IGNORE INTO admin_settings (key, value) VALUES 
('admin_password', '${adminPasswordHash}'),
('system_name', '备品备件管理系统'),
('system_version', '1.0.0'),
('low_stock_threshold', '10'),
('auto_backup_enabled', 'true'),
('backup_retention_days', '30'),
('default_currency', 'CNY'),
('company_name', '公司名称'),
('company_address', '公司地址'),
('notification_email', 'admin@company.com'),
('general.systemName', '备品备件管理系统'),
('general.timezone', 'auto'),
('general.language', 'zh-CN'),
('inventory.defaultMinStock', '10'),
('inventory.lowStockThreshold', '5'),
('inventory.updateInterval', '30'),
('security.sessionTimeout', '60'),
('backup.autoBackup', 'true'),
('backup.frequency', 'daily'),
('backup.retentionCount', '7');
`;

console.log('🚀 首次启动：正在初始化数据库...');

try {
    // 创建表结构
    console.log('📋 创建数据库表结构...');
    db.exec(createTables);
    console.log('✅ 数据库表结构创建成功');

    // 插入基础数据（分类、项目、管理员设置）
    console.log('📦 插入基础数据（分类、项目、管理员设置）...');
    db.exec(insertBasicData);
    console.log('✅ 基础数据插入成功');

    console.log('🎉 数据库初始化完成！');
    console.log('💡 数据库文件位置:', dbPath);
    console.log('📝 提示：产品数据请通过导入功能添加');
    return true;

} catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
    throw err;
} finally {
    // 关闭数据库连接
    db.close();
}
};

if (require.main === module) {
    initializeDatabaseIfNeeded();
}

module.exports = {
    initializeDatabaseIfNeeded,
    isDatabaseInitialized
};
