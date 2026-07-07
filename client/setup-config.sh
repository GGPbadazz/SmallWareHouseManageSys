#!/bin/bash
# 前端配置脚本 - 配置相机服务地址

echo "=============================================="
echo "  仓库管理系统 - 前端配置"
echo "=============================================="
echo ""
echo "请选择相机服务地址配置方式："
echo ""
echo "  1. 手动输入相机服务地址"
echo "  2. 使用本地地址 (localhost:8766)"
echo "  3. 保持当前配置不变"
echo ""
read -p "请输入选项 [1/2/3]: " choice

case $choice in
    1)
        read -p "请输入相机服务地址 (例如: http://camera-host:8766): " camera_url
        if [ -z "$camera_url" ]; then
            echo "地址不能为空，使用默认值"
            camera_url="http://localhost:8766"
        fi
        ;;
    2)
        camera_url="http://localhost:8766"
        ;;
    3)
        echo "保持当前配置不变"
        exit 0
        ;;
    *)
        echo "无效选项，使用默认值"
        camera_url="http://localhost:8766"
        ;;
esac

# 写入.env文件
cat > .env << EOF
# 相机服务地址 (Windows机器)
VITE_CAMERA_SERVICE_URL=${camera_url}
EOF

echo ""
echo "=============================================="
echo "配置完成！"
echo "相机服务地址: ${camera_url}"
echo "配置文件: .env"
echo "=============================================="
echo ""
echo "接下来请运行:"
echo "  npm install"
echo "  npm run build"
