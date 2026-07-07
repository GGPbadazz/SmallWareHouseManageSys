# Production-stable Dockerfile for client
FROM node:20-alpine as build-stage

WORKDIR /app

# 复制package.json
COPY package*.json ./

# 安装依赖（使用BuildKit缓存挂载）
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# 复制源代码
COPY . .

# 设置Vite构建时的环境变量 - 摄像头服务地址
ARG VITE_CAMERA_SERVICE_URL=http://localhost:8766
ENV VITE_CAMERA_SERVICE_URL=$VITE_CAMERA_SERVICE_URL

# 构建应用
RUN npm run build

# 生产阶段 - 使用稳定的nginx版本
FROM nginx:1.25-alpine as production-stage

# 复制构建结果到nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 创建nginx用户的必要目录
RUN mkdir -p /var/cache/nginx/client_temp && \
    mkdir -p /var/cache/nginx/proxy_temp && \
    mkdir -p /var/cache/nginx/fastcgi_temp && \
    mkdir -p /var/cache/nginx/uwsgi_temp && \
    mkdir -p /var/cache/nginx/scgi_temp

# 暴露端口
EXPOSE 80

# 健康检查 - 使用127.0.0.1而非localhost避免IPv6解析问题
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
