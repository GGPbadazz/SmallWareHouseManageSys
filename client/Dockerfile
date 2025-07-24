# 构建阶段 - 使用国内镜像源
FROM ixnlx5suo70o70.xuanyuan.run/library/node:18-alpine as build-stage

WORKDIR /app

# 设置npm国内镜像源
RUN npm config set registry https://registry.npmmirror.com

# 复制package.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段 - 使用国内镜像源
FROM ixnlx5suo70o70.xuanyuan.run/library/nginx:alpine as production-stage

# 复制构建结果到nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
