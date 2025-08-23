const Database = require('better-sqlite3');
const path = require('path');

// 数据库连接
const dbPath = path.join(__dirname, '../database/inventory.db');
const db = Database(dbPath);

// 精度计算器
class PrecisionCalculator {
  static round(value) {
    return Math.round(value * 10000) / 10000;
  }
  
  static multiply(a, b) {
    return this.round(a * b);
  }
  
  static divide(a, b) {
    if (b === 0) return 0;
    return this.round(a / b);
  }
  
  static add(a, b) {
    return this.round(a + b);
  }
  
  static subtract(a, b) {
    return this.round(a - b);
  }
}

// 加权平均价格计算（使用实际库存价值）
function calculateWeightedAveragePrice(currentStock, currentStockValue, incomingQuantity, incomingUnitPrice) {
  const incomingValue = PrecisionCalculator.multiply(incomingQuantity, incomingUnitPrice);
  const totalValue = PrecisionCalculator.add(currentStockValue, incomingValue);
  const totalStock = PrecisionCalculator.add(currentStock, incomingQuantity);
  
  if (totalStock <= 0) return 0;
  return PrecisionCalculator.divide(totalValue, totalStock);
}

async function fixHistoricalData() {
  console.log('🔄 开始修复历史数据...');
  
  try {
    // 开始事务
    db.exec('BEGIN TRANSACTION');
    
    // 1. 首先检查交易表结构
    console.log('📋 检查交易表结构...');
    const tableInfo = db.prepare("PRAGMA table_info(transactions)").all();
    console.log('交易表字段:', tableInfo.map(col => col.name));
    
    // 检查是否有库存相关字段
    const hasStockFields = tableInfo.some(col => 
      ['stock_after', 'stock_unit_price', 'stock_value'].includes(col.name)
    );
    
    if (!hasStockFields) {
      console.log('❌ 交易表缺少库存字段，请先运行数据库升级脚本');
      return;
    }
    
    // 2. 获取所有产品
    console.log('📦 获取所有产品...');
    const products = db.prepare(`
      SELECT DISTINCT product_id 
      FROM transactions 
      ORDER BY product_id
    `).all();
    
    console.log(`找到 ${products.length} 个产品需要修复`);
    
    let totalTransactions = 0;
    let fixedTransactions = 0;
    
    // 3. 逐个产品修复
    for (const { product_id } of products) {
      console.log(`\n🔧 修复产品 ID: ${product_id}`);
      
      // 获取该产品的所有交易记录（按时间排序）
      const transactions = db.prepare(`
        SELECT * FROM transactions 
        WHERE product_id = ? 
        ORDER BY created_at ASC, id ASC
      `).all(product_id);
      
      console.log(`  - 找到 ${transactions.length} 笔交易`);
      totalTransactions += transactions.length;
      
      // 初始化库存状态
      let currentStock = 0;
      let currentStockValue = 0;
      let currentUnitPrice = 0;
      
      // 逐笔交易重新计算
      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        let needsUpdate = false;
        
        if (transaction.type === 'IN') {
          // 入库：计算加权平均价格
          const newUnitPrice = calculateWeightedAveragePrice(
            currentStock, 
            currentStockValue, 
            transaction.quantity, 
            transaction.unit_price
          );
          
          currentStock = PrecisionCalculator.add(currentStock, transaction.quantity);
          currentStockValue = PrecisionCalculator.add(currentStockValue, 
            PrecisionCalculator.multiply(transaction.quantity, transaction.unit_price));
          currentUnitPrice = newUnitPrice;
          
        } else {
          // 出库：减少库存
          currentStock = Math.max(0, PrecisionCalculator.subtract(currentStock, transaction.quantity));
          currentStockValue = currentStock > 0 ? 
            PrecisionCalculator.multiply(currentStock, currentUnitPrice) : 0;
          
          if (currentStock === 0) {
            currentUnitPrice = 0;
            currentStockValue = 0;
          }
        }
        
        // 检查是否需要更新
        const stockAfter = PrecisionCalculator.round(currentStock);
        const stockUnitPrice = PrecisionCalculator.round(currentUnitPrice);
        const stockValue = PrecisionCalculator.round(currentStockValue);
        
        if (transaction.stock_after !== stockAfter || 
            transaction.stock_unit_price !== stockUnitPrice || 
            transaction.stock_value !== stockValue) {
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          // 更新交易记录
          db.prepare(`
            UPDATE transactions 
            SET 
              stock_after = ?,
              stock_unit_price = ?,
              stock_value = ?
            WHERE id = ?
          `).run(stockAfter, stockUnitPrice, stockValue, transaction.id);
          
          fixedTransactions++;
          
          if (fixedTransactions % 100 === 0) {
            console.log(`  ✅ 已修复 ${fixedTransactions} 笔交易`);
          }
        }
      }
      
      // 更新产品的当前库存信息
      if (transactions.length > 0) {
        db.prepare(`
          UPDATE products 
          SET 
            stock = ?,
            current_unit_price = ?,
            total_cost_value = ?
          WHERE id = ?
        `).run(
          PrecisionCalculator.round(currentStock),
          PrecisionCalculator.round(currentUnitPrice),
          PrecisionCalculator.round(currentStockValue),
          product_id
        );
        
        console.log(`  📊 产品最终状态: 库存=${currentStock}, 单价=${currentUnitPrice}, 价值=${currentStockValue}`);
      }
    }
    
    // 4. 验证修复结果
    console.log('\n🔍 验证修复结果...');
    const inconsistentTransactions = db.prepare(`
      SELECT COUNT(*) as count
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      WHERE t.id = (
        SELECT MAX(id) FROM transactions t2 
        WHERE t2.product_id = t.product_id
      )
      AND (
        t.stock_after != p.stock OR 
        t.stock_unit_price != p.current_unit_price OR 
        t.stock_value != p.total_cost_value
      )
    `).get();
    
    if (inconsistentTransactions.count > 0) {
      console.log(`⚠️  发现 ${inconsistentTransactions.count} 个产品的最新交易与产品表不一致`);
      
      // 修复产品表与最新交易的不一致
      db.exec(`
        UPDATE products 
        SET 
          stock = (
            SELECT stock_after FROM transactions 
            WHERE product_id = products.id 
            ORDER BY created_at DESC, id DESC 
            LIMIT 1
          ),
          current_unit_price = (
            SELECT stock_unit_price FROM transactions 
            WHERE product_id = products.id 
            ORDER BY created_at DESC, id DESC 
            LIMIT 1
          ),
          total_cost_value = (
            SELECT stock_value FROM transactions 
            WHERE product_id = products.id 
            ORDER BY created_at DESC, id DESC 
            LIMIT 1
          )
        WHERE id IN (
          SELECT DISTINCT product_id FROM transactions
        )
      `);
      
      console.log('✅ 已同步产品表与最新交易记录');
    }
    
    // 提交事务
    db.exec('COMMIT');
    
    console.log('\n🎉 历史数据修复完成！');
    console.log(`📊 统计信息:`);
    console.log(`  - 总产品数: ${products.length}`);
    console.log(`  - 总交易数: ${totalTransactions}`);
    console.log(`  - 修复交易数: ${fixedTransactions}`);
    console.log(`  - 修复率: ${((fixedTransactions / totalTransactions) * 100).toFixed(2)}%`);
    
  } catch (error) {
    // 回滚事务
    db.exec('ROLLBACK');
    console.error('❌ 修复过程中发生错误:', error);
    throw error;
  }
}

// 运行修复
if (require.main === module) {
  fixHistoricalData()
    .then(() => {
      console.log('✅ 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { fixHistoricalData };
