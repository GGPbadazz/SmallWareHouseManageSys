#!/bin/bash
# 系统启动状态检查脚本

echo "🔍 BARCODESYS 系统状态检查"
echo "=================================="

# 检查后端服务
echo "📡 检查后端服务 (端口 3003)..."
if curl -s http://localhost:3003/api/auth/verify > /dev/null 2>&1; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务未运行"
    echo "   启动命令: cd server && npm run dev"
fi

# 检查前端服务
echo "🖥️  检查前端服务 (端口 5715)..."
if curl -s http://localhost:5715 > /dev/null 2>&1; then
    echo "✅ 前端服务运行正常"
else
    echo "❌ 前端服务未运行"
    echo "   启动命令: cd client && npm run dev"
fi

# 检查 Nginx 服务
echo "🌐 检查 Nginx 代理 (端口 8081)..."
if curl -s http://localhost:8081 > /dev/null 2>&1; then
    echo "✅ Nginx 代理运行正常"
    
    # 检查 API 代理
    echo "🔗 检查 API 代理..."
    if curl -s http://localhost:8081/api/auth/verify > /dev/null 2>&1; then
        echo "✅ API 代理工作正常"
    else
        echo "⚠️  API 代理可能有问题"
    fi
else
    echo "❌ Nginx 代理未运行"
    echo "   启动命令: sudo brew services start nginx"
fi

# 检查 Docker 服务
echo "🐳 检查 Docker 服务..."
if docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -q barcodesys; then
    echo "✅ Docker 容器运行中:"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep barcodesys
else
    echo "❌ 没有运行的 Docker 容器"
    echo "   启动命令: ./start-dev-nginx.sh 或 ./deploy-prod.sh"
fi

echo ""
echo "🎯 访问地址总结:"
echo "  开发环境 (热重载): http://localhost:5715"
echo "  Nginx 代理 (模拟生产): http://localhost:8081"
echo "  后端 API: http://localhost:3003"
echo "  Docker 开发环境: http://localhost:8080"
echo "  Docker 生产环境: http://localhost:80"

echo ""
echo "📊 端口占用情况:"
lsof -i :3003 -i :5715 -i :8080 -i :8081 -i :80 2>/dev/null | grep LISTEN || echo "  没有检测到相关端口占用"
