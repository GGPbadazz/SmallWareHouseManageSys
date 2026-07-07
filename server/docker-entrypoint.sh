#!/bin/sh

# Docker容器启动脚本
# 确保所有系统组件正确初始化

echo "🐳 启动仓库管理系统..."

# 检查数据库目录
if [ ! -d "/app/database" ]; then
    echo "📁 创建数据库目录..."
    mkdir -p /app/database
fi

# 检查备份目录
if [ ! -d "/app/backups" ]; then
    echo "📁 创建备份目录..."
    mkdir -p /app/backups
fi

# 设置正确的权限
chown -R node:node /app/database /app/backups

# 检查数据库是否需要初始化
echo "🔍 检查数据库状态..."
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const dbPath = '/app/database/inventory.db';

if (!fs.existsSync(dbPath)) {
    console.log('📄 数据库文件不存在，需要初始化');
    process.exit(1);
}

try {
    const db = new Database(dbPath);
    const tables = db.prepare(\`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('products', 'categories', 'transactions', 'admin_settings')\`).all();
    db.close();
    
    if (tables.length < 4) {
        console.log('📄 数据库表不完整，需要重新初始化');
        process.exit(1);
    } else {
        console.log('✅ 数据库完整，跳过初始化');
        process.exit(0);
    }
} catch (error) {
    console.log('❌ 数据库检查失败，需要重新初始化');
    process.exit(1);
}
"

# 根据检查结果决定是否初始化数据库
if [ $? -ne 0 ]; then
    echo "🔧 正在重新初始化数据库..."
    rm -f /app/database/inventory.db*
    npm run init-db
    echo "✅ 数据库初始化完成"
fi

# 运行数据库迁移脚本（适用于已有数据库升级）
echo "🔄 运行数据库迁移脚本..."
if [ -f "/app/scripts/migrate-add-supplier.js" ]; then
    node /app/scripts/migrate-add-supplier.js || echo "⚠️ supplier迁移跳过或失败"
fi
echo "✅ 数据库迁移检查完成"

echo "⏰ 时区设置: ${TZ:-UTC}"
echo "📊 快照系统: ${SNAPSHOT_ENABLED:-true}"
echo "🔄 快照计划: ${SNAPSHOT_SCHEDULE:-'0 2 1 * *'}"

# 启动OCR Server（后台运行，模型常驻内存）
echo "🔍 启动OCR Server..."
if [ -f "/app/scripts/ocr_server.py" ]; then
    # 测试 RapidOCR 是否可用
    if python3 -c "from rapidocr_onnxruntime import RapidOCR" 2>/dev/null; then
        echo "✅ RapidOCR 库检测成功"
        OCR_WORKERS=${OCR_WORKERS:-2} python3 /app/scripts/ocr_server.py > /tmp/ocr_server.log 2>&1 &
        OCR_PID=$!
        echo "✅ OCR Server已启动 (PID: $OCR_PID, Workers: ${OCR_WORKERS:-2})"
        # 等待OCR Server初始化并验证
        sleep 5
        if curl -s http://127.0.0.1:5555/health | grep -q '"ocr_available": true'; then
            echo "✅ OCR Server 就绪，引擎已加载"
        else
            echo "⚠️ OCR Server 启动但引擎未加载，查看日志: /tmp/ocr_server.log"
        fi
    else
        echo "⚠️ RapidOCR 库不可用，将使用模拟模式"
    fi
else
    echo "⚠️ OCR Server脚本不存在，将使用传统模式"
fi

# 启动Node.js应用
echo "🚀 启动应用服务器..."
exec npm start
