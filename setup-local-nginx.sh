#!/bin/bash
# 本地 Nginx 开发环境设置脚本

echo "🔧 设置本地 Nginx 开发环境"

# 检查是否已安装 nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    if command -v brew &> /dev/null; then
        brew install nginx
    else
        echo "❌ 请先安装 Homebrew 或手动安装 Nginx"
        exit 1
    fi
else
    echo "✅ Nginx 已安装"
fi

# nginx 配置目录
NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
NGINX_CONF_FILE="$NGINX_CONF_DIR/barcodesys-dev.conf"

# 创建配置目录
sudo mkdir -p "$NGINX_CONF_DIR"

# 复制配置文件
echo "📝 创建 Nginx 配置文件..."
sudo cp nginx-local-dev.conf "$NGINX_CONF_FILE"

echo "✅ 配置文件已创建: $NGINX_CONF_FILE"

# 测试配置
echo "🧪 测试 Nginx 配置..."
if sudo nginx -t; then
    echo "✅ Nginx 配置测试通过"
else
    echo "❌ Nginx 配置测试失败"
    exit 1
fi

# 重启 nginx
echo "🔄 重启 Nginx..."
sudo brew services restart nginx

echo ""
echo "🎉 本地 Nginx 开发环境设置完成！"
echo ""
echo "📋 使用说明："
echo "  1. 启动后端: npm run dev:server 或 cd server && npm run dev"
echo "  2. 启动前端: npm run dev:client 或 cd client && npm run dev"
echo "  3. 通过 Nginx 访问: http://localhost:8081"
echo "  4. 直接访问前端: http://localhost:5715"
echo ""
echo "🔧 管理命令:"
echo "  启动 Nginx: sudo brew services start nginx"
echo "  停止 Nginx: sudo brew services stop nginx"
echo "  重启 Nginx: sudo brew services restart nginx"
echo "  查看状态: sudo brew services list | grep nginx"
