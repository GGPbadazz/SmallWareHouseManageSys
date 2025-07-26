#!/bin/bash
# 创建完整部署包的脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "📦 创建 Barcode System 部署包..."

DEPLOY_DIR="barcodesys-deploy"
PACKAGE_NAME="barcodesys-deploy-$(date +%Y%m%d_%H%M%S).tar.gz"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    log_error "Docker 未运行，无法构建镜像"
    exit 1
fi

# 检测 Docker Compose 命令
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    log_error "Docker Compose 未找到"
    exit 1
fi

# 返回项目根目录
cd "$(dirname "$0")/.."

log_info "当前目录: $(pwd)"

# 构建 Docker 镜像
log_info "🔨 构建 Docker 镜像..."
$COMPOSE_CMD build

if [ $? -ne 0 ]; then
    log_error "镜像构建失败"
    exit 1
fi

log_success "镜像构建完成"

# 导出 Docker 镜像
log_info "📤 导出 Docker 镜像..."

# 确保部署目录存在
if [ ! -d "$DEPLOY_DIR" ]; then
    log_error "部署目录不存在: $DEPLOY_DIR"
    log_info "请先运行脚本创建部署文件夹"
    exit 1
fi

# 导出应用镜像
log_info "导出后端镜像..."
docker save barcodesys-backend:latest > "$DEPLOY_DIR/images/barcodesys-backend.tar"

log_info "导出前端镜像..."  
docker save barcodesys-frontend:latest > "$DEPLOY_DIR/images/barcodesys-frontend.tar"

# 导出基础镜像（可选）
log_info "导出基础镜像..."
docker save nq0z7orjp17t6j.xuanyuan.run/library/node:latest > "$DEPLOY_DIR/images/node-latest.tar" 2>/dev/null || \
docker save node:20-alpine > "$DEPLOY_DIR/images/node-latest.tar" 2>/dev/null || \
log_warning "无法导出 Node.js 基础镜像"

docker save nq0z7orjp17t6j.xuanyuan.run/library/nginx:latest > "$DEPLOY_DIR/images/nginx-latest.tar" 2>/dev/null || \
docker save nginx:alpine > "$DEPLOY_DIR/images/nginx-latest.tar" 2>/dev/null || \
log_warning "无法导出 Nginx 基础镜像"

log_success "镜像导出完成"

# 设置执行权限
log_info "🔧 设置文件权限..."
find "$DEPLOY_DIR" -name "*.sh" -exec chmod +x {} \;

# 创建部署包信息文件
log_info "📋 创建部署包信息..."
cat > "$DEPLOY_DIR/PACKAGE_INFO.txt" << EOF
Barcode System 部署包信息
========================

打包时间: $(date)
打包版本: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
Git 分支: $(git branch --show-current 2>/dev/null || echo "unknown")

包含内容:
- Docker 镜像文件
- 配置文件
- 部署脚本
- 管理脚本

系统要求:
- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 内存
- 至少 5GB 磁盘空间

快速部署:
1. 解压部署包
2. 进入目录: cd barcodesys-deploy
3. 运行部署: ./deploy.sh

更多信息请查看 README.md
EOF

# 显示部署包内容
log_info "📊 部署包内容："
find "$DEPLOY_DIR" -type f | sort

# 计算部署包大小
log_info "💾 计算部署包大小..."
package_size=$(du -sh "$DEPLOY_DIR" | cut -f1)
log_info "部署包大小: $package_size"

# 创建压缩包
log_info "🗜️  创建压缩包..."
tar -czf "$PACKAGE_NAME" "$DEPLOY_DIR"

if [ $? -eq 0 ]; then
    compressed_size=$(ls -lh "$PACKAGE_NAME" | awk '{print $5}')
    log_success "部署包创建成功: $PACKAGE_NAME"
    log_info "压缩包大小: $compressed_size"
else
    log_error "压缩包创建失败"
    exit 1
fi

# 生成校验和
log_info "🔐 生成校验和..."
if command -v sha256sum &> /dev/null; then
    sha256sum "$PACKAGE_NAME" > "${PACKAGE_NAME}.sha256"
    log_success "SHA256 校验和: ${PACKAGE_NAME}.sha256"
elif command -v shasum &> /dev/null; then
    shasum -a 256 "$PACKAGE_NAME" > "${PACKAGE_NAME}.sha256"  
    log_success "SHA256 校验和: ${PACKAGE_NAME}.sha256"
fi

echo ""
echo "🎉 部署包创建完成！"
echo ""
echo "📦 部署包信息："
echo "   文件名: $PACKAGE_NAME"
echo "   大小: $compressed_size"
echo "   位置: $(pwd)/$PACKAGE_NAME"
echo ""
echo "🚀 使用方法："
echo "   1. 将 $PACKAGE_NAME 上传到目标服务器"
echo "   2. 解压: tar -xzf $PACKAGE_NAME"
echo "   3. 进入目录: cd $DEPLOY_DIR"
echo "   4. 部署: ./deploy.sh"
echo ""
echo "📋 部署包包含："
echo "   ✅ Docker 镜像文件"
echo "   ✅ 配置文件"
echo "   ✅ 一键部署脚本"
echo "   ✅ 管理和维护脚本"
echo "   ✅ 完整使用文档"
