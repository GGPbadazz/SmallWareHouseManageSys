#!/bin/bash
# 开发环境启动脚本（使用 Docker + Nginx）

echo "🚀 启动开发环境（Docker + Nginx）"

# 检查 Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 停止现有服务
echo "🛑 停止现有开发服务..."
docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

# 启动开发环境
echo "🔨 启动开发环境..."
docker-compose -f docker-compose.dev.yml up --build -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 服务状态："
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "🎉 开发环境启动完成！"
echo ""
echo "📱 访问方式："
echo "  🔥 直接访问前端 (Vite热重载): http://localhost:5715"
echo "  🌐 通过 Nginx 访问 (模拟生产): http://localhost:8080" 
echo "  🔧 后端 API: http://localhost:3003"
echo ""
echo "📝 常用命令："
echo "  查看日志: docker-compose -f docker-compose.dev.yml logs -f"
echo "  停止服务: docker-compose -f docker-compose.dev.yml down"
echo "  重启服务: docker-compose -f docker-compose.dev.yml restart"
