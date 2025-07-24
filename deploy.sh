#!/bin/bash
# 一键部署库存管理系统

echo "🚀 开始部署库存管理系统..."

# 创建数据持久化目录
mkdir -p ./data

# 停止现有服务（如果有）
echo "🛑 停止现有服务..."
docker-compose down

# 构建并启动服务
echo "🔨 构建并启动服务..."
docker-compose up --build -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

echo ""
echo "🎉 部署完成！"
echo "🌐 前端访问地址: http://localhost"
echo "🔧 后端API地址: http://localhost:3000"
echo ""
echo "📊 查看运行状态: docker-compose ps"
echo "📝 查看日志: docker-compose logs -f"
echo "🛑 停止服务: docker-compose down"
echo "🧹 完全清理: docker-compose down -v --rmi all"
