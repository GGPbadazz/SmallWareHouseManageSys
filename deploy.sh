#!/bin/bash
# BARCODESYS 一键部署脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🚀 开始部署 BARCODESYS 仓库管理系统..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose
if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建必要的目录
print_status "📁 创建数据目录..."
mkdir -p ./server/database
mkdir -p ./server/backups

# 停止现有服务
print_status "🛑 停止现有服务..."
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

# 清理旧容器和镜像（可选）
if [ "$1" = "--clean" ]; then
    print_warning "🧹 清理旧容器和镜像..."
    docker system prune -f
fi

# 构建并启动服务
print_status "🔨 构建并启动服务..."
if command -v docker-compose &> /dev/null; then
    docker-compose up --build -d
else
    docker compose up --build -d
fi

# 等待服务启动
print_status "⏳ 等待服务启动..."
sleep 15

# 检查服务状态
print_status "📊 检查服务状态..."
if command -v docker-compose &> /dev/null; then
    docker-compose ps
else
    docker compose ps
fi

# 检查服务健康状态
print_status "🩺 检查服务健康状态..."
sleep 10

# 显示访问信息
print_status "🎉 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "  前端界面: http://localhost"
echo "  后端API:  http://localhost:3003"
echo ""
echo "� 管理命令:"
if command -v docker-compose &> /dev/null; then
    echo "  查看日志: docker-compose logs -f"
    echo "  停止服务: docker-compose down"
    echo "  重启服务: docker-compose restart"
else
    echo "  查看日志: docker compose logs -f"
    echo "  停止服务: docker compose down"
    echo "  重启服务: docker compose restart"
fi
echo ""
print_status "✅ 系统已成功部署并运行！"
