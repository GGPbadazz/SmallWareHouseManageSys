const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 支持多种环境变量名的数据库路径配置
const dbPath = process.env.DB_PATH 
    ? (path.isAbsolute(process.env.DB_PATH) 
        ? process.env.DB_PATH 
        : path.join(__dirname, process.env.DB_PATH))
    : path.join(__dirname, 'database', 'inventory.db');

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
            WHERE type='table' AND name IN ('products', 'categories', 'transactions', 'admin_settings')
        `).all();
        
        const hasRequiredTables = tables.length >= 4;
        
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

// 如果数据库已初始化，则跳过
if (isDatabaseInitialized()) {
    console.log('📄 数据库已存在且已初始化，跳过初始化步骤');
    process.exit(0);
}

// 确保database目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log('🚀 首次启动：正在初始化数据库...');

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
    FOREIGN KEY (project_id) REFERENCES projects (id)
);

-- 管理员设置表
CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
('admin_password', '$2a$10$42jsbjFJV.ALyDcuhVwFQugSeSfuI3F9PuwYzuvgwehErVLCvyAqm'),
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

} catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
    process.exit(1);
} finally {
    // 关闭数据库连接
    db.close();
}
