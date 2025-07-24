const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'inventory.db');

// 确保database目录存在
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接
const db = new sqlite3.Database(dbPath);

// 数据库表结构
const createTables = `
-- 商品分类表
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    barcode TEXT UNIQUE,
    category_id INTEGER,
    unit_price DECIMAL(10,2) DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id)
);

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    stock_after INTEGER NOT NULL,
    stock_unit_price DECIMAL(10,2),
    stock_value DECIMAL(10,2),
    requester_name TEXT,
    project_name TEXT,
    purpose TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
);
`;

// 初始化示例数据
const insertSampleData = `
-- 插入示例分类
INSERT OR IGNORE INTO categories (name, description) VALUES 
('PP材质物品', 'PP材质相关产品'),
('工具', '各类工具产品'),
('螺丝', '各类螺丝产品'),
('电仪', '电仪相关产品'),
('金属零件', '金属零件产品'),
('阀门', '阀门相关产品'),
('一次性', '一次性用品'),
('劳保', '劳保用品');

-- 插入示例产品
INSERT OR IGNORE INTO products (name, barcode, category_id, unit_price, current_stock) VALUES 
('PP化工管道', 'PP001', 1, 25.00, 122),
('304不锈钢管', '6008390TBE6000', 2, 10.45, 57),
('M10×30六角螺栓', 'SS003123', 3, 8.09, 280),
('M5×15平头螺丝', 'SS004', 3, 2.65, 394),
('M6×20螺丝', 'SS002', 3, 3.04, 305),
('M8×25不锈钢螺丝', 'SS001', 3, 5.32, 230),
('温度传感器PT100', 'EI001', 4, 277.90, 31),
('铝合金支架', 'MJ002', 5, 120.00, 12),
('球阀DN25', 'VL001', 6, 320.00, 6);
`;

console.log('🚀 正在初始化数据库...');

db.serialize(() => {
    // 创建表结构
    db.exec(createTables, (err) => {
        if (err) {
            console.error('❌ 创建表结构失败:', err.message);
            return;
        }
        console.log('✅ 数据库表结构创建成功');
    });

    // 插入示例数据
    db.exec(insertSampleData, (err) => {
        if (err) {
            console.error('❌ 插入示例数据失败:', err.message);
            return;
        }
        console.log('✅ 示例数据插入成功');
    });
});

db.close((err) => {
    if (err) {
        console.error('❌ 关闭数据库连接失败:', err.message);
    } else {
        console.log('🎉 数据库初始化完成！');
        console.log('💡 数据库文件位置:', dbPath);
    }
});
