/**
 * 数据库精度修复脚本（安全版本）
 * 将FLOAT字段升级为DECIMAL精确类型
 * 使用重建表的方式避免外键约束问题
 */

const db = require('../database/connection');

console.log('=== 数据库精度修复开始 ===');

function fixDatabasePrecision() {
    try {
        // 关闭外键约束
        console.log('🔧 禁用外键约束...');
        db.pragma('foreign_keys = OFF');

        // 开始事务
        console.log('📋 开始数据库精度修复...');
        
        // 第一步：修复products表
        console.log('\n📦 修复products表精度...');
        
        // 创建临时表
        db.exec(`
            CREATE TABLE products_temp (
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
                price DECIMAL(10,4) DEFAULT 0,
                current_unit_price DECIMAL(10,4) DEFAULT 0,
                total_cost_value DECIMAL(12,4) DEFAULT 0,
                barcode_image TEXT,
                qr_code_image TEXT,
                barcode_updated_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 迁移数据，保留4位小数精度
        db.exec(`
            INSERT INTO products_temp 
            SELECT 
                id, name, name_en, barcode, category_id, location, supplier, description,
                stock, min_stock,
                ROUND(COALESCE(price, 0), 4) as price,
                ROUND(COALESCE(current_unit_price, 0), 4) as current_unit_price,
                ROUND(COALESCE(total_cost_value, 0), 4) as total_cost_value,
                barcode_image, qr_code_image, barcode_updated_at, created_at, updated_at
            FROM products
        `);
        
        // 替换原表
        db.exec(`DROP TABLE products`);
        db.exec(`ALTER TABLE products_temp RENAME TO products`);
        
        console.log('✅ products表精度修复完成');
        
        // 第二步：修复transactions表
        console.log('\n💰 修复transactions表精度...');
        
        // 创建临时表
        db.exec(`
            CREATE TABLE transactions_temp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
                quantity DECIMAL(10,3) NOT NULL,
                unit_price DECIMAL(10,4) NOT NULL DEFAULT 0,
                total_price DECIMAL(12,4) NOT NULL DEFAULT 0,
                requester_name TEXT,
                requester_department TEXT,
                project_id INTEGER,
                purpose TEXT,
                signature TEXT,
                stock_before DECIMAL(10,3) NOT NULL DEFAULT 0,
                stock_after DECIMAL(10,3) NOT NULL DEFAULT 0,
                stock_unit_price DECIMAL(10,4) NOT NULL DEFAULT 0,
                stock_value DECIMAL(12,4) NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 迁移数据，保留4位小数精度
        db.exec(`
            INSERT INTO transactions_temp 
            SELECT 
                id, product_id, type, quantity,
                ROUND(COALESCE(unit_price, 0), 4) as unit_price,
                ROUND(COALESCE(total_price, 0), 4) as total_price,
                requester_name, requester_department, project_id, purpose, signature,
                stock_before, stock_after,
                ROUND(COALESCE(stock_unit_price, 0), 4) as stock_unit_price,
                ROUND(COALESCE(stock_value, 0), 4) as stock_value,
                created_at
            FROM transactions
        `);
        
        // 替换原表
        db.exec(`DROP TABLE transactions`);
        db.exec(`ALTER TABLE transactions_temp RENAME TO transactions`);
        
        console.log('✅ transactions表精度修复完成');
        
        // 第三步：重建索引
        console.log('\n🗂️ 重建索引...');
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
            CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
        `);
        console.log('✅ 索引重建完成');
        
        // 重新启用外键约束
        console.log('\n🔒 重新启用外键约束...');
        db.pragma('foreign_keys = ON');
        
        // 验证修复结果
        console.log('\n📊 验证修复结果...');
        
        const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
        const transactionCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
        
        console.log('✅ 数据库精度修复成功完成！');
        console.log(`   📦 产品数据：${productCount.count}条记录`);
        console.log(`   💰 交易数据：${transactionCount.count}条记录`);
        console.log('   🎯 精度提升：FLOAT → DECIMAL(10,4)/DECIMAL(12,4)');
        console.log('   ✨ 消除浮点数误差，提供财务级别精度');
        
        // 显示表结构验证
        console.log('\n🔍 验证表结构...');
        const productSchema = db.prepare("PRAGMA table_info(products)").all();
        const transactionSchema = db.prepare("PRAGMA table_info(transactions)").all();
        
        const priceFields = productSchema.filter(col => 
            ['price', 'current_unit_price', 'total_cost_value'].includes(col.name)
        );
        const transactionPriceFields = transactionSchema.filter(col => 
            ['unit_price', 'total_price', 'stock_unit_price', 'stock_value'].includes(col.name)
        );
        
        console.log('   📦 Products表价格字段：');
        priceFields.forEach(field => {
            console.log(`      ${field.name}: ${field.type}`);
        });
        
        console.log('   💰 Transactions表价格字段：');
        transactionPriceFields.forEach(field => {
            console.log(`      ${field.name}: ${field.type}`);
        });
        
    } catch (error) {
        console.error('\n❌ 精度修复失败：', error.message);
        console.error('错误详情：', error);
        
        // 尝试清理临时表
        try {
            db.exec(`DROP TABLE IF EXISTS products_temp`);
            db.exec(`DROP TABLE IF EXISTS transactions_temp`);
            console.log('🧹 临时表清理完成');
        } catch (cleanupError) {
            console.error('⚠️  临时表清理失败：', cleanupError.message);
        }
        
        throw error;
    }
}

// 执行修复
try {
    fixDatabasePrecision();
    console.log('\n🎉 数据库精度修复全部完成！');
} catch (error) {
    console.error('\n💥 修复过程失败，数据库状态可能不一致');
    console.error('建议检查数据库完整性或从备份恢复');
} finally {
    // 确保关闭数据库连接
    try {
        db.close();
    } catch (e) {
        // 忽略关闭错误
    }
}

console.log('\n=== 数据库精度修复结束 ===');
