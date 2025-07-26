#!/bin/bash

# 创建部署包压缩文件

echo "📦 创建部署包..."

# 进入项目根目录
cd /Users/zhouzheng/Documents/JZCHEMAPP/BARCODESYS

# 创建压缩包
tar -czf barcodesys-deploy-$(date +%Y%m%d-%H%M%S).tar.gz deploy-package/

echo "✅ 部署包创建完成!"
echo "📁 文件位置: $(pwd)/barcodesys-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"
echo ""
echo "📋 部署包内容:"
echo "   - 完整的server和client源代码"
echo "   - 已配置的Docker文件 (Node.js 22 + better-sqlite3)"
echo "   - 自动部署脚本"
echo "   - 开发和生产环境配置"
echo ""
echo "🚀 使用方法:"
echo "   1. 上传压缩包到服务器"
echo "   2. 解压: tar -xzf barcodesys-deploy-*.tar.gz"
echo "   3. 进入目录: cd deploy-package"
echo "   4. 运行部署: ./deploy.sh"
