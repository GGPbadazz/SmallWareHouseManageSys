#!/bin/bash
# 项目清理脚本 - 删除临时文件和不需要的文件

echo "🧹 开始清理项目..."

# 删除 macOS 系统文件
echo "删除 .DS_Store 文件..."
find . -name ".DS_Store" -type f -delete 2>/dev/null || true

# 删除编辑器临时文件
echo "删除编辑器临时文件..."
find . -name "*~" -type f -delete 2>/dev/null || true
find . -name "*.swp" -type f -delete 2>/dev/null || true
find . -name "*.swo" -type f -delete 2>/dev/null || true

# 删除日志文件
echo "删除日志文件..."
find . -name "*.log" -type f -delete 2>/dev/null || true

# 删除临时文件
echo "删除临时文件..."
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.temp" -type f -delete 2>/dev/null || true

# 清理数据库备份文件（可选，取消注释启用）
# echo "清理旧的数据库备份文件..."
# find ./server/backups -name "*.db" -mtime +7 -delete 2>/dev/null || true

echo "✅ 项目清理完成！"

echo ""
echo "📊 当前项目大小："
du -sh . 2>/dev/null || echo "无法计算项目大小"

echo ""
echo "📁 主要目录大小："
du -sh client/ server/ 2>/dev/null || echo "无法计算目录大小"
