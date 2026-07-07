# CPU-optimized Dockerfile with RapidOCR (pure ONNX, better compatibility)
FROM node:20-slim

# 安装Python和依赖（包含编译工具用于better-sqlite3）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    curl ca-certificates \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxrender1 libxext6 \
    build-essential make g++ \
    && rm -rf /var/lib/apt/lists/*

# 安装RapidOCR（纯ONNX实现，无需PaddlePaddle，更好的CPU兼容性）
# 使用BuildKit缓存挂载加速pip安装
RUN --mount=type=cache,target=/root/.cache/pip \
    pip3 install --break-system-packages \
    rapidocr_onnxruntime \
    opencv-python-headless \
    pillow \
    "numpy<2.0"

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖（使用BuildKit缓存挂载）
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# 复制应用代码
COPY . .

# 创建必要目录
RUN mkdir -p /app/database /app/backups /app/data /app/jobs /app/scripts

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3003
ENV DB_PATH=/app/database/inventory.db
ENV DATABASE_PATH=/app/database/inventory.db

# 初始化数据库
RUN rm -f /app/database/inventory.db && npm run init-db

# 创建快照表
RUN node scripts/docker-init-snapshots.js || echo "Will initialize snapshots at runtime"

# 复制Docker启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 暴露端口
EXPOSE 3003

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl --fail --silent http://localhost:3003/api/products > /dev/null || exit 1

# 启动应用
ENTRYPOINT ["docker-entrypoint.sh"]
