const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, 'inventory.db'));

// Create tables
const createTables = () => {
    // Categories table
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Projects table
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Products table
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_en TEXT,
            barcode TEXT UNIQUE NOT NULL,
            category_id INTEGER,
            location TEXT,
            supplier TEXT,
            description TEXT,
            stock INTEGER DEFAULT 0,
            min_stock INTEGER DEFAULT 0,
            barcode_image TEXT,
            qr_code_image TEXT,
            barcode_updated_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    `);

    // Transactions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
            quantity INTEGER NOT NULL,
            requester_name TEXT,
            requester_department TEXT,
            project_id INTEGER,
            purpose TEXT,
            signature TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products (id),
            FOREIGN KEY (project_id) REFERENCES projects (id)
        )
    `);

    // Admin settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('Database tables created successfully!');
    
    // Add barcode image columns if they don't exist (migration)
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();
    const hasBarcodeImage = tableInfo.some(col => col.name === 'barcode_image');
    const hasQRCodeImage = tableInfo.some(col => col.name === 'qr_code_image');
    const hasBarcodeUpdatedAt = tableInfo.some(col => col.name === 'barcode_updated_at');

    if (!hasBarcodeImage) {
        db.exec(`ALTER TABLE products ADD COLUMN barcode_image TEXT`);
        console.log('Added barcode_image column to products table');
    }
    if (!hasQRCodeImage) {
        db.exec(`ALTER TABLE products ADD COLUMN qr_code_image TEXT`);
        console.log('Added qr_code_image column to products table');
    }
    if (!hasBarcodeUpdatedAt) {
        db.exec(`ALTER TABLE products ADD COLUMN barcode_updated_at DATETIME`);
        console.log('Added barcode_updated_at column to products table');
    }
};

// Insert initial data
const insertInitialData = () => {
    try {
        // 检查类别和项目是否已经存在
        const existingCategories = db.prepare('SELECT COUNT(*) as count FROM categories').get();
        const existingProjects = db.prepare('SELECT COUNT(*) as count FROM projects').get();
        
        // 只有在没有任何类别和项目时才插入默认数据
        if (existingCategories.count > 0 && existingProjects.count > 0) {
            console.log('Database already has categories and projects, skipping initial data insertion');
            
            // 仍然插入管理员密码和系统设置（如果不存在）
            const bcrypt = require('bcryptjs');
            const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
            
            const insertSetting = db.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)');
            insertSetting.run('admin_password', defaultPasswordHash);

            // Insert system configuration settings
            const systemSettings = [
                ['system_name', '备品备件管理系统'],
                ['system_version', '1.0.0'],
                ['low_stock_threshold', '10'],
                ['auto_backup_enabled', 'true'],
                ['backup_retention_days', '30'],
                ['default_currency', 'CNY'],
                ['company_name', '公司名称'],
                ['company_address', '公司地址'],
                ['notification_email', 'admin@company.com'],
                ['last_backup', new Date().toISOString()]
            ];

            systemSettings.forEach(([key, value]) => {
                insertSetting.run(key, value);
            });
            
            return;
        }

        // Insert default categories (用户需要的8个类别)
        const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)');
        const defaultCategories = [
            ['螺丝', '螺丝类零件'],
            ['金属零件', '金属制零部件'],
            ['电仪', '电气仪表设备'],
            ['PP材质物品', 'PP塑料材质物品'],
            ['阀门', '各类阀门设备'],
            ['劳保', '劳保用品'],
            ['工具', '工具设备'],
            ['一次性', '一次性用品']
        ];
        
        defaultCategories.forEach(([name, description]) => {
            insertCategory.run(name, description);
        });

        // Insert default projects (用户需要的8个部门)
        const insertProject = db.prepare('INSERT OR IGNORE INTO projects (name, description) VALUES (?, ?)');
        const defaultProjects = [
            ['二车间', '二车间部门'],
            ['三车间', '三车间部门'],
            ['制冷剂', '制冷剂部门'],
            ['公共系统', '公共系统部门'],
            ['分析室', '分析室部门'],
            ['四车间', '四车间部门'],
            ['研发', '研发部门'],
            ['机修', '机修部门']
        ];
        
        defaultProjects.forEach(([name, description]) => {
            insertProject.run(name, description);
        });

        // 注释掉示例产品插入，只保留基础类别和项目
        /*
        // Insert sample products
        const insertProduct = db.prepare(`
            INSERT OR IGNORE INTO products 
            (name, name_en, barcode, category_id, location, supplier, description, stock, min_stock) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const sampleProducts = [
            // ... 示例产品数据已注释
        ];

        sampleProducts.forEach(product => {
            insertProduct.run(...product);
        });
        */

        console.log('Basic categories and projects inserted (sample products skipped)');

        // Insert admin password hash (default: admin123)
        const bcrypt = require('bcryptjs');
        const defaultPasswordHash = bcrypt.hashSync('admin123', 10);
        
        const insertSetting = db.prepare('INSERT OR IGNORE INTO admin_settings (key, value) VALUES (?, ?)');
        insertSetting.run('admin_password', defaultPasswordHash);

        // Insert system configuration settings
        const systemSettings = [
            ['system_name', '备品备件管理系统'],
            ['system_version', '1.0.0'],
            ['low_stock_threshold', '10'],
            ['auto_backup_enabled', 'true'],
            ['backup_retention_days', '30'],
            ['default_currency', 'CNY'],
            ['company_name', '公司名称'],
            ['company_address', '公司地址'],
            ['notification_email', 'admin@company.com'],
            ['last_backup', new Date().toISOString()]
        ];

        systemSettings.forEach(([key, value]) => {
            insertSetting.run(key, value);
        });

        console.log('Initial data inserted successfully!');
    } catch (error) {
        console.error('Error inserting initial data:', error);
    }
};

// Run initialization
createTables();
insertInitialData();

// Add debug logging
console.log('Verifying database setup...');
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get();
const transactionCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get();

console.log(`Products: ${productCount.count}`);
console.log(`Categories: ${categoryCount.count}`);
console.log(`Projects: ${projectCount.count}`);
console.log(`Transactions: ${transactionCount.count}`);

db.close();
console.log('Database initialization completed!');
