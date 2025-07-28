#!/bin/bash
# 一键启动脚本 - 使用中国镜像源

echo "🇨🇳 启动 BARCODESYS - 中国镜像源优化版"
echo "=================================="

# 显示可用选项
echo "请选择启动方式："
echo "1. 开发环境 (推荐)"
echo "2. 生产环境"
echo "3. 传统方式启动"
echo "4. 查看系统状态"
echo "5. 停止所有服务"
echo ""

read -p "请输入选项 (1-5): " choice

case $choice in
    1)
        echo "🚀 启动开发环境 (中国镜像源)..."
        ./docker-china.sh dev up
        ;;
    2)
        echo "🚀 启动生产环境 (中国镜像源)..."
        ./docker-china.sh prod up
        ;;
    3)
        echo "🚀 启动传统开发环境..."
        ./start.sh dev
        ;;
    4)
        echo "📊 查看系统状态..."
        ./check-status.sh
        ;;
    5)
        echo "🛑 停止所有服务..."
        ./start.sh stop
        ./docker-china.sh dev down
        ./docker-china.sh prod down
        ;;
    *)
        echo "❌ 无效选项，退出"
        exit 1
        ;;
esac
