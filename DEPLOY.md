# BARCODESYS 系统部署指南

## 🚀 快速部署

### 系统要求
- **操作系统**: Linux (Ubuntu 18.04+ / CentOS 7+ / Debian 9+) 或 macOS
- **内存**: 最少 2GB RAM
- **存储**: 最少 10GB 可用空间
- **软件**: Docker 和 Docker Compose

### 一键部署
```bash
# 1. 获取项目
git clone https://github.com/GGPbadazz/SmallWareHouseManageSys.git
cd SmallWareHouseManageSys

# 2. 执行部署
chmod +x deploy.sh
./deploy.sh

# 3. 访问系统
# 前端: http://localhost
# 后端: http://localhost:3003
```

## 🛠 环境配置

### Docker 安装 (Ubuntu/Debian)
```bash
# 更新包索引
sudo apt update

# 安装必要依赖
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list

# 安装 Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 将用户添加到 docker 组
sudo usermod -aG docker $USER
```

### Docker Compose 安装
```bash
# 下载最新版本的 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 添加执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

## 🎯 部署步骤

### 生产环境部署
```bash
# 1. 克隆项目到服务器
git clone https://github.com/GGPbadazz/SmallWareHouseManageSys.git
cd SmallWareHouseManageSys

# 2. 设置环境变量（可选）
export NODE_ENV=production
export FRONTEND_PORT=80
export BACKEND_PORT=3003

# 3. 执行部署
chmod +x deploy.sh
./deploy.sh

# 4. 验证部署
docker compose ps
docker compose logs -f
```

### 配置防火墙（如需要）
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 3003/tcp
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=3003/tcp
sudo firewall-cmd --reload
```

## 📋 管理命令

### 基本操作
```bash
# 启动服务
./deploy.sh

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看服务状态
docker compose ps

# 查看服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 数据管理
```bash
# 备份数据库
docker compose exec backend cp /app/database/inventory.db /app/backups/inventory-$(date +%Y%m%d-%H%M%S).db

# 进入后端容器
docker compose exec backend /bin/sh

# 进入前端容器
docker compose exec frontend /bin/sh
```

### 更新部署
```bash
# 拉取最新代码
git pull origin main

# 重新构建并部署
./deploy.sh --clean
```

### 4. 运行部署脚本
```bash
# 生产环境部署
./deploy-prod.sh

## 🔧 故障排除

### 常见问题

**问题：端口被占用**
```bash
# 检查端口占用
sudo lsof -i :80
sudo lsof -i :3003

# 停止占用端口的服务
sudo kill -9 <PID>
```

**问题：Docker 权限不足**
```bash
# 添加用户到 docker 组
sudo usermod -aG docker $USER

# 重新登录后生效
```

**问题：服务无法启动**
```bash
# 查看详细日志
docker compose logs -f

# 检查配置文件
docker compose config
```

**问题：前端无法连接后端**
- 检查 `.env` 文件中的 `CORS_ORIGIN` 配置
- 确保防火墙允许相应端口
- 检查 nginx 配置文件

## 🔒 安全建议

### 生产环境安全
1. **修改默认密码**: 首次登录后立即修改 admin 密码
2. **配置 HTTPS**: 使用 Let's Encrypt 或其他 SSL 证书
3. **防火墙配置**: 只开放必要的端口（80, 443, SSH）
4. **定期备份**: 设置自动数据库备份任务
5. **更新系统**: 定期更新操作系统和 Docker

### SSL/HTTPS 配置（可选）
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

## 📞 技术支持

如果遇到问题，请：
1. 查看日志：`docker compose logs -f`
2. 检查系统状态：`docker compose ps`
3. 参考 README.md 文档
4. 提交 GitHub Issue

---

**部署完成后访问地址：**
- 🌐 **前端界面**: http://your-server-ip
- 🔧 **后端API**: http://your-server-ip:3003
- 👤 **默认登录**: admin / admin123
```bash
# 完全清理（包括数据）
docker-compose down -v --rmi all
```

## 故障排除

### 1. 端口被占用
```bash
# 检查端口占用
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3003

# 杀死占用端口的进程
sudo kill -9 <PID>
```

### 2. Docker 权限问题
```bash
# 确保用户在 docker 组中
sudo usermod -aG docker $USER
# 重新登录以生效
```

### 3. 内存不足
```bash
# 检查内存使用
free -h
docker stats
```

### 4. 数据库初始化失败
```bash
# 删除数据库文件重新初始化
rm -rf ./server/database/*.db*
docker-compose restart backend
```

## 安全建议

1. **修改默认密码**: 登录后立即修改 admin 用户密码
2. **配置 HTTPS**: 使用 Nginx 反向代理配置 SSL 证书
3. **防火墙设置**: 只开放必要的端口
4. **定期备份**: 设置定时任务备份数据库
5. **监控日志**: 定期检查应用日志

## 更新部署

### 1. 停止服务
```bash
docker-compose down
```

### 2. 更新代码
```bash
git pull  # 如果使用 git
# 或者重新上传文件
```

### 3. 重新构建并启动
```bash
docker-compose up --build -d
```

---

如有问题，请检查 Docker 日志或联系系统管理员。
