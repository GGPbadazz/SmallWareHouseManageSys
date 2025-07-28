#!/bin/bash
# 智能启动脚本

show_help() {
    echo "🚀 BARCODESYS 智能启动脚本"
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  dev       启动开发环境 (后端 + 前端)"
    echo "  nginx     启动开发环境 + Nginx 代理"  
    echo "  docker    启动 Docker 开发环境"
    echo "  china     启动 Docker 环境 (中国镜像源)"
    echo "  prod      启动生产环境"
    echo "  status    检查服务状态"
    echo "  stop      停止所有服务"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 dev      # 启动开发环境"
    echo "  $0 nginx    # 启动开发环境并配置 Nginx"
    echo "  $0 china    # 启动中国镜像源 Docker 环境"
    echo "  $0 status   # 检查当前状态"
}

start_dev() {
    echo "🚀 启动开发环境..."
    
    # 检查并安装依赖
    if [ ! -d "server/node_modules" ]; then
        echo "📦 安装后端依赖..."
        cd server && npm install && cd ..
    fi
    
    if [ ! -d "client/node_modules" ]; then
        echo "📦 安装前端依赖..."
        cd client && npm install && cd ..
    fi
    
    echo "🔧 启动后端服务..."
    cd server && npm run dev &
    BACKEND_PID=$!
    
    sleep 3
    
    echo "🎨 启动前端服务..."
    cd ../client && npm run dev &
    FRONTEND_PID=$!
    
    cd ..
    
    echo ""
    echo "✅ 开发环境启动完成!"
    echo "🌐 前端地址: http://localhost:5715"
    echo "🔧 后端地址: http://localhost:3003"
    echo ""
    echo "按 Ctrl+C 停止服务"
    
    # 等待进程
    wait $BACKEND_PID $FRONTEND_PID
}

start_nginx() {
    echo "🌐 启动开发环境 + Nginx..."
    
    # 启动基本开发环境
    start_dev &
    
    # 确保 Nginx 运行
    echo "🔧 配置 Nginx..."
    if ! command -v nginx &> /dev/null; then
        echo "⚠️  Nginx 未安装，运行设置脚本..."
        ./setup-local-nginx.sh
    else
        sudo brew services start nginx
    fi
    
    echo ""
    echo "✅ Nginx 开发环境启动完成!"
    echo "🔥 开发地址: http://localhost:5715 (热重载)"
    echo "🌐 Nginx 地址: http://localhost:8081 (模拟生产)"
    echo "🔧 后端地址: http://localhost:3003"
}

start_docker() {
    echo "🐳 启动 Docker 开发环境..."
    ./start-dev-nginx.sh
}

start_china() {
    echo "🇨🇳 启动中国镜像源 Docker 环境..."
    echo "正在使用镜像源: docker.xuanyuan.run"
    ./docker-china.sh dev up
}

start_prod() {
    echo "🚀 启动生产环境..."
    ./deploy-prod.sh
}

stop_all() {
    echo "🛑 停止所有服务..."
    
    # 停止 Node 进程
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    # 停止 Docker 容器
    docker-compose down 2>/dev/null || true
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    
    echo "✅ 所有服务已停止"
}

# 主逻辑
case "${1:-help}" in
    "dev")
        start_dev
        ;;
    "nginx")
        start_nginx
        ;;
    "docker")
        start_docker
        ;;
    "china")
        start_china
        ;;
    "prod")
        start_prod
        ;;
    "status")
        ./check-status.sh
        ;;
    "stop")
        stop_all
        ;;
    "help"|*)
        show_help
        ;;
esac
