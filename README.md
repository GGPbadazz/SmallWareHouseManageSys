# 🏭 SmallWareHouseManageSys - 小型仓库管理系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue)](https://www.docker.com/)

一个专为小型企业和工厂设计的现代化仓库管理系统，支持备品备件管理、条码扫描、月度财务报表等功能。系统采用 Vue.js + Node.js + SQLite 技术栈。

## ✨ 核心功能

- **库存管理**：商品管理、实时库存、低库存预警
- **出入库操作**：条码扫描、批量操作、详细记录
- **月度账本**：财务报表、成本核算、Excel导出
- **报表中心**：库存报告、交易统计、数据分析

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 1. 克隆项目
git clone <your-repository-url>
cd SmallWareHouseManageSys

# 2. 配置环境变量
# 编辑 docker-compose.yml 并设置你的 JWT_SECRET

# 3. 使用Docker Compose启动
docker-compose up -d

# 4. 访问应用
# 前端: http://localhost:8080
# 后端: http://localhost:3004
```

### 本地开发

```bash
# 1. 安装后端依赖
cd server && npm install

# 2. 安装前端依赖  
cd ../client && npm install

# 3. 启动后端服务
cd ../server && npm run dev

# 4. 启动前端服务
cd ../client && npm run dev
```

## 🛠 技术架构

**前端**: Vue.js 3 + Vite + Pinia + Vue Router  
**后端**: Node.js + Express.js + SQLite + Better-SQLite3  
**部署**: Docker + Docker Compose + Nginx  

## 📁 项目结构

```
SmallWareHouseManageSys/
├── client/          # 前端Vue.js应用
├── server/          # 后端Node.js应用
├── docker-compose.yml
└── README.md
```

## 🔧 配置说明

运行应用前，请确保：

1. **设置JWT密钥**: 在 `docker-compose.yml` 中更新 `JWT_SECRET` 环境变量
2. **数据库配置**: SQLite数据库将在首次运行时自动创建
3. **时区设置**: 默认时区为 `Asia/Shanghai`，如需要可以修改

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。

---

⭐ 如果这个项目对您有帮助，请给我们一个Star！⭐