# 使用国内镜像源的Node.js基础镜像
FROM ixnlx5suo70o70.xuanyuan.run/library/node:18-alpine

# 设置工作目录
WORKDIR /app

# 设置npm国内镜像源
RUN npm config set registry https://registry.npmmirror.com

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 初始化数据库
RUN npm run init-db

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["npm", "start"]
