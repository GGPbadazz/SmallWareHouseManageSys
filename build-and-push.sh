#!/bin/bash

# Docker镜像构建和推送脚本（适配私有镜像源）
# 使用方法: ./build-and-push.sh

set -e

REGISTRY="nq0z7orjp17t6j.xuanyuan.run"
IMAGE_TAG=${1:-latest}
PROJECT_NAME="smallwarehouse"

echo "🚀 开始构建和推送Docker镜像到私有镜像源..."
echo "🏠 镜像仓库: $REGISTRY"
echo "🏷️  镜像标签: $IMAGE_TAG"

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 构建镜像
echo "🔨 构建前端镜像..."
docker build -t $REGISTRY/$PROJECT_NAME-frontend:$IMAGE_TAG ./client

echo "🔨 构建后端镜像..."
docker build -t $REGISTRY/$PROJECT_NAME-backend:$IMAGE_TAG ./server

# 显示构建的镜像
echo "📋 构建完成的镜像:"
docker images | grep "$REGISTRY/$PROJECT_NAME"

# 推送镜像
echo "📤 推送前端镜像到私有镜像源..."
docker push $REGISTRY/$PROJECT_NAME-frontend:$IMAGE_TAG

echo "📤 推送后端镜像到私有镜像源..."
docker push $REGISTRY/$PROJECT_NAME-backend:$IMAGE_TAG

echo "✅ 镜像推送完成！"
echo ""
echo "🌐 您的镜像已上传到："
echo "   前端: docker pull $REGISTRY/$PROJECT_NAME-frontend:$IMAGE_TAG"
echo "   后端: docker pull $REGISTRY/$PROJECT_NAME-backend:$IMAGE_TAG"
echo "   后端: docker pull $DOCKER_USERNAME/$PROJECT_NAME-backend:$IMAGE_TAG"
echo ""
echo "📝 更新docker-compose.yml以使用远程镜像:"
echo "   将 'build: ./client' 替换为 'image: $DOCKER_USERNAME/$PROJECT_NAME-frontend:$IMAGE_TAG'"
echo "   将 'build: ./server' 替换为 'image: $DOCKER_USERNAME/$PROJECT_NAME-backend:$IMAGE_TAG'"
