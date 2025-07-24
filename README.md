# 库存管理系统 (BARCODESYS)

一个基于 Vue.js + Node.js + SQLite 的库存管理系统，支持商品管理、出入库记录、月度账本等功能。

## 🚀 快速开始

### 方式一：Docker部署（推荐）

```bash
# 克隆项目
git clone https://github.com/GGPbadazz/SmallWareHouseManageSys.git
cd SmallWareHouseManageSys

# 一键部署
./deploy.sh

# 访问应用
# 前端: http://localhost
# 后端API: http://localhost:3000
```

### 方式二：本地开发

```bash
# 安装后端依赖并初始化数据库
cd server
npm run setup

# 安装前端依赖
cd ../client
npm install

# 启动开发服务器
./start-dev.sh
```

## 🐳 Docker命令

```bash
# 构建并启动
docker-compose up --build -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 完全清理
docker-compose down -v --rmi all
```

## 项目结构

```
BARCODESYS/
├── client/                # Vue.js 前端应用
│   ├── src/
│   │   ├── components/    # 页面组件
│   │   ├── router/        # 路由配置
│   │   ├── services/      # API 服务
│   │   ├── stores/        # 状态管理
│   │   └── views/         # 视图页面
├── server/                # Node.js 后端 API
│   ├── database/          # 数据库文件
│   ├── routes/            # API 路由
│   ├── scripts/           # 数据库初始化脚本
│   └── services/          # 后端服务
├── start-dev.sh           # 开发环境启动脚本
├── start-server.sh        # 生产环境启动脚本
└── package.json           # 根目录配置文件
```

## 功能特性

- **📊 出库入库**: 条码扫描、批量操作、实时库存更新
- **📦 库存管理**: 产品管理、库存查询、批量编辑
- **📒 月度账本**: 每月出入库汇总、分类统计、详情查看
- **📈 报告中心**: 库存报告、交易统计、数据分析
- **🏷️ 条码管理**: 条码生成、产品关联、批量导入
- **⚙️ 系统设置**: 分类管理、项目管理、系统配置

## 快速开始

### 1. 安装依赖
```bash
# 安装服务端依赖
cd server && npm install

# 安装客户端依赖
cd ../client && npm install
```

### 2. 初始化数据库
```bash
cd server && npm run init-db
```

### 3. 启动开发环境
```bash
# 从项目根目录
./start-dev.sh
```

**或者手动启动各个组件**:
```bash
# 终端 1: 启动后端服务
cd server && npm run dev

# 终端 2: 启动前端服务
cd client && npm run dev
```

### 4. 访问应用
- 前端应用: http://localhost:5173
- 后端 API: http://localhost:3000

## 技术栈

### 前端 (Frontend)
- **Vue 3** - 渐进式 JavaScript 框架
- **Vite** - 现代化构建工具
- **Pinia** - 状态管理
- **Vue Router** - 路由管理

### 后端 (Backend)
- **Node.js** - JavaScript 运行环境
- **Express** - Web 应用框架
- **SQLite** - 轻量级数据库
- **Better-SQLite3** - 高性能 SQLite 驱动

## 生产环境部署

1. **构建前端应用**:
```bash
cd client && npm run build
```

2. **启动生产服务器**:
```bash
./start-server.sh
```

## 开发说明

### 数据库结构
- `products` - 产品信息表
- `categories` - 分类表
- `projects` - 项目表
- `transactions` - 交易记录表
- `users` - 用户表

### API 端点
- `/api/products` - 产品管理
- `/api/transactions` - 交易记录
- `/api/categories` - 分类管理
- `/api/projects` - 项目管理
- `/api/reports` - 报告数据
- `/api/ledger` - 账本数据

### 开发规范
- 组件命名：PascalCase
- 文件命名：kebab-case
- 变量命名：camelCase
- 常量命名：UPPER_SNAKE_CASE

## 版本信息

- **版本**: 1.0.0
- **最后更新**: 2025年7月23日
- **维护状态**: 积极维护
   
   # Terminal 2: Start frontend  
   cd client && npm run dev
   ```

4. **Access the application**:
   - **Frontend**: http://localhost:5715 (Fixed port, won't change)
   - **Backend API**: http://localhost:3003

5. **Check system status**:
   ```bash
   ./check-system.sh
   ```

## Development

- **Backend**: Node.js + Express + SQLite
- **Frontend**: Vue.js 3 + Vite + Element Plus
- **Database**: SQLite with automatic initialization

## API Endpoints

- `GET /api/products` - Product management
- `POST /api/transactions` - Transaction operations
- `GET /api/reports` - Report generation
- `GET /api/settings` - System configuration

## 📄 许可证

本项目采用 MIT 许可证 - 详情请查看 [LICENSE](LICENSE) 文件
