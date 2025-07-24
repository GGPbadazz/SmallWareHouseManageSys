FROM node:22-alpine

# 安装python和make以支持better-sqlite3编译
RUN apk add --no-cache python3 make g++

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建数据库目录
RUN mkdir -p /app/database

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["npm", "start"]
