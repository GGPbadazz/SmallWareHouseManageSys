#!/bin/bash
# 开发环境启动脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[DEV]${NC} $1"
}

show_help() {
    echo "🚀 BARCODESYS 开发环境启动脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  install     安装所有依赖"
    echo "  init        初始化数据库"
    echo "  dev         启动开发服务器 (默认)"
    echo "  build       构建生产版本"
    echo "  clean       清理依赖和缓存"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 install  # 安装依赖"
    echo "  $0 init     # 初始化数据库"
    echo "  $0 dev      # 启动开发服务器"
}

# 检查Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js 14.18.0+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    print_info "Node.js 版本: $NODE_VERSION"
}

# 安装依赖
install_deps() {
    print_info "安装项目依赖..."
    
    # 安装后端依赖
    print_status "安装后端依赖..."
    cd server
    npm install
    cd ..
    
    # 安装前端依赖
    print_status "安装前端依赖..."
    cd client
    npm install
    cd ..
    
    print_status "依赖安装完成"
}

# 初始化数据库
init_database() {
    print_info "初始化数据库..."
    cd server
    if [ -f "init-database.js" ]; then
        node init-database.js
        print_status "数据库初始化完成"
    else
        npm run init-db
        print_status "数据库初始化完成"
    fi
    cd ..
}

# 启动开发服务器
start_dev() {
    print_info "启动开发服务器..."
    
    # 检查依赖是否已安装
    if [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
        print_warning "依赖未安装，正在安装..."
        install_deps
    fi
    
    # 检查数据库是否存在
    if [ ! -f "server/database/inventory.db" ]; then
        print_warning "数据库不存在，正在初始化..."
        init_database
    fi
    
    print_status "启动后端服务器 (端口: 3003)..."
    cd server
    npm run dev &
    SERVER_PID=$!
    cd ..
    
    sleep 3
    
    print_status "启动前端服务器 (端口: 5173)..."
    cd client
    npm run dev &
    CLIENT_PID=$!
    cd ..
    
    print_status "开发服务器已启动！"
    echo ""
    echo "🌐 访问地址:"
    echo "   前端: http://localhost:5173"
    echo "   后端: http://localhost:3003"
    echo ""
    echo "📋 停止服务: Ctrl+C"
    
    # 等待进程结束
    wait $SERVER_PID $CLIENT_PID
}

# 构建生产版本
build_prod() {
    print_info "构建生产版本..."
    
    # 构建前端
    cd client
    npm run build
    cd ..
    
    print_status "生产版本构建完成"
    print_info "生产文件位于: client/dist/"
}

# 清理
clean_all() {
    print_info "清理依赖和缓存..."
    
    # 清理前端
    if [ -d "client/node_modules" ]; then
        rm -rf client/node_modules
        print_status "已清理前端依赖"
    fi
    
    if [ -d "client/dist" ]; then
        rm -rf client/dist
        print_status "已清理前端构建文件"
    fi
    
    # 清理后端
    if [ -d "server/node_modules" ]; then
        rm -rf server/node_modules
        print_status "已清理后端依赖"
    fi
    
    # 清理package-lock文件
    find . -name "package-lock.json" -delete
    
    print_status "清理完成"
}

# 主函数
main() {
    case ${1:-"dev"} in
        "install")
            check_node
            install_deps
            ;;
        "init")
            init_database
            ;;
        "dev")
            check_node
            start_dev
            ;;
        "build")
            check_node
            build_prod
            ;;
        "clean")
            clean_all
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "无效的选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 捕获Ctrl+C信号
trap 'print_warning "正在停止服务..."; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0' INT

main "$@"
