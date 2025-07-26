#!/bin/bash
# 使用预构建Docker镜像的一键部署脚本

set -e

echo "🚀 开始部署小型仓库管理系统（使用预构建镜像）..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "📝 创建环境变量文件..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件，设置您的Docker Hub用户名"
    echo "   示例: DOCKER_USERNAME=ggpbadazz"
    echo "   然后重新运行此脚本"
    exit 1
fi

# 创建数据持久化目录
mkdir -p ./data

# 停止现有服务（如果有）
echo "🛑 停止现有服务..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# 拉取最新镜像
echo "📥 拉取最新镜像..."
docker-compose -f docker-compose.prod.yml pull

# 启动服务
echo "🔨 启动服务..."
docker-compose -f docker-compose.prod.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🎉 部署完成！"
echo "🌐 前端访问地址: http://localhost"
echo "🔧 后端API地址: http://localhost:3000"
echo ""
echo "📊 查看运行状态: docker-compose -f docker-compose.prod.yml ps"
echo "📝 查看日志: docker-compose -f docker-compose.prod.yml logs -f"
echo "🛑 停止服务: docker-compose -f docker-compose.prod.yml down"
