# 🏭 SmallWareHouseManageSys - 小型仓库管理系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue)](https://www.docker.com/)

一个专为小型企业和工厂设计的现代化仓库管理系统，支持备品备件管理、条码扫描、月度财务报表等功能。系统采用 Vue.js + Node.js + SQLite 技术栈，提供完整的Docker部署方案。

## ✨ 核心功能

### 📦 库存管理
- **商品管理**：支持分类管理、条码关联、批量导入
- **实时库存**：自动库存更新、低库存预警、库存价值统计
- **多级分类**：灵活的商品分类体系，支持层级管理

### 📋 出入库操作
- **条码扫描**：支持多种条码格式的快速扫描
- **批量操作**：支持批量出库、入库操作
- **详细记录**：记录领用人、部门、用途等完整信息
- **实时更新**：出入库后自动更新库存数量和价值

### 📊 月度账本系统
- **分层展示**：按分类→产品层级组织数据
- **期初期末对比**：清晰显示期初库存、本期变动、期末库存
- **成本核算**：自动计算加权平均成本和库存价值
- **Excel导出**：一键生成完整的月度账本报表

### 💼 财务专用功能
- **出库记录导出**：专门面向财务部门的详细报表
- **成本分析**：提供单价、总价、库存价值等关键财务数据
- **领用追踪**：重点突出领用单位、用途说明等审计要素
- **专业格式**：采用财务友好的颜色方案和布局设计

### 📈 报表中心
- **库存报告**：当前库存状况、库存价值分析
- **交易统计**：出入库频次、金额统计
- **分类汇总**：按分类统计库存和交易数据
- **自定义报表**：支持自定义时间段的数据分析

## 🚀 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/GGPbadazz/SmallWareHouseManageSys.git
cd SmallWareHouseManageSys

# 2. 一键部署
chmod +x deploy.sh
./deploy.sh

# 3. 访问系统
# 前端界面: http://localhost
# 后端API:  http://localhost:3000
```

### 方式二：本地开发环境

```bash
# 1. 安装后端依赖并初始化数据库
cd server
npm run setup

# 2. 安装前端依赖
cd ../client
npm install

# 3. 启动开发服务器
cd ..
./start-dev.sh

# 4. 访问应用
# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

## 🐳 Docker 部署命令

```bash
# 构建并启动所有服务
docker-compose up --build -d

# 查看服务运行状态
docker-compose ps

# 查看服务日志
docker-compose logs -f [service_name]

# 停止所有服务
docker-compose down

# 完全清理（包括数据卷）
docker-compose down -v --rmi all
```

## 🛠 技术架构

### 前端技术栈
- **框架**: Vue.js 3 - 渐进式JavaScript框架
- **构建工具**: Vite - 快速的前端构建工具
- **状态管理**: Pinia - 轻量级状态管理库
- **路由**: Vue Router - 官方路由管理器
- **Excel处理**: ExcelJS - Excel文件生成和处理
- **文件保存**: FileSaver.js - 客户端文件保存

### 后端技术栈
- **运行时**: Node.js - JavaScript服务器运行环境
- **框架**: Express.js - 快速、极简的Web框架
- **数据库**: SQLite - 轻量级关系型数据库
- **数据库驱动**: Better-SQLite3 - 高性能同步SQLite接口
- **安全**: Helmet - 安全中间件，bcryptjs - 密码加密
- **验证**: Express-validator - 请求数据验证

### 部署技术
- **容器化**: Docker & Docker Compose - 应用容器化和编排
- **Web服务器**: Nginx - 高性能Web服务器和反向代理
- **进程管理**: PM2 - Node.js进程管理器（可选）

## 📁 项目结构

```
SmallWareHouseManageSys/
├── 📁 client/                    # 前端Vue.js应用
│   ├── 📁 src/
│   │   ├── 📁 components/        # Vue组件
│   │   │   ├── AdminPanel.vue           # 管理员面板
│   │   │   ├── BarcodeDisplay.vue       # 条码显示组件
│   │   │   ├── BarcodeManagement.vue    # 条码管理
│   │   │   ├── InventoryPage.vue        # 库存管理页面
│   │   │   ├── LedgerPage.vue           # 月度账本页面
│   │   │   ├── ProductLedgerDetail.vue  # 产品账本详情
│   │   │   ├── ReportsPage.vue          # 报表页面
│   │   │   ├── ScannerPage.vue          # 扫描页面
│   │   │   └── SettingsPage.vue         # 设置页面
│   │   ├── 📁 router/            # 路由配置
│   │   ├── 📁 services/          # API服务
│   │   ├── 📁 stores/            # 状态管理
│   │   ├── 📁 utils/             # 工具函数
│   │   │   └── outboundRecordsExporter.js  # 出库记录导出工具
│   │   └── 📁 views/             # 页面视图
│   ├── 📄 Dockerfile             # 前端Docker配置
│   ├── 📄 nginx.conf             # Nginx配置
│   └── 📄 package.json           # 前端依赖配置
├── 📁 server/                    # 后端Node.js应用
│   ├── 📁 database/              # 数据库文件目录
│   ├── 📁 routes/                # API路由
│   │   ├── auth.js              # 认证路由
│   │   ├── categories.js        # 分类管理
│   │   ├── ledger.js            # 账本相关API
│   │   ├── products.js          # 商品管理
│   │   ├── projects.js          # 项目管理
│   │   ├── reports.js           # 报表API
│   │   ├── settings.js          # 系统设置
│   │   └── transactions.js      # 交易记录
│   ├── 📁 services/              # 后端服务
│   ├── 📄 init-database.js       # 数据库初始化脚本
│   ├── 📄 Dockerfile             # 后端Docker配置
│   └── 📄 server.js              # 服务器入口文件
├── 📄 docker-compose.yml         # Docker编排配置
├── 📄 deploy.sh                  # 一键部署脚本
├── 📄 start-dev.sh               # 开发环境启动脚本
└── 📄 README.md                  # 项目说明文档
```

## 🎯 功能详解

### 1. 库存管理模块
- **商品信息管理**：支持商品名称、条码、分类、单价等信息维护
- **库存实时监控**：显示当前库存数量、库存价值、最后更新时间
- **分类体系管理**：支持多级分类，便于商品组织和查找
- **批量操作**：支持Excel导入商品信息，批量修改商品属性

### 2. 条码扫描系统
- **多格式支持**：兼容EAN-13、Code-128、QR码等主流格式
- **快速识别**：支持摄像头扫描和手动输入两种方式
- **智能关联**：自动关联商品信息，支持新商品快速录入
- **扫描历史**：记录扫描历史，便于追溯和统计

### 3. 出入库管理
- **出库流程**：条码扫描→确认商品→填写领用信息→提交出库
- **入库流程**：条码扫描→确认商品→填写入库数量→更新库存
- **详细记录**：记录操作人、时间、数量、单价、用途、领用部门等
- **实时更新**：操作完成后立即更新库存数量和平均成本

### 4. 月度账本功能
- **分层展示**：按"分类 → 产品"的层级结构展示数据
- **三栏对比**：期初库存、本期变动、期末库存清晰对比
- **成本计算**：采用加权平均法计算库存成本和变动金额
- **Excel导出**：生成专业的月度库存账本Excel文件

### 5. 财务报表导出
- **出库记录专项导出**：面向财务部门的详细出库记录
- **关键信息突出**：重点标注领用单位、用途说明等财务关注点
- **成本数据完整**：包含单价、总价、库存余额等财务核算数据
- **专业格式**：采用财务友好的颜色和布局设计

## 📊 数据库设计

### 核心数据表
- **categories** - 商品分类表
- **products** - 商品信息表
- **transactions** - 交易记录表
- **projects** - 项目/部门表
- **users** - 用户信息表（预留）

### 主要字段说明
```sql
-- 商品表关键字段
products (
  id, name, barcode, category_id, 
  unit_price, current_stock, created_at
)

-- 交易表关键字段
transactions (
  id, product_id, type, quantity, unit_price,
  stock_after, requester_name, project_name,
  purpose, created_at
)
```

## � 系统要求

### Docker 部署（推荐）
- **Docker**: >= 20.10.0
- **Docker Compose**: >= 2.0.0
- **操作系统**: Linux, macOS, Windows (支持Docker)
- **内存**: 最少 2GB RAM
- **磁盘空间**: 最少 5GB 可用空间

### 本地开发环境
- **Node.js**: >= 14.18.0 (推荐 18.x LTS)
- **npm**: >= 6.14.0 (或 yarn >= 1.22.0)
- **操作系统**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **浏览器**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+

## 📖 使用指南

### 初次使用

1. **系统初始化**：首次启动会自动创建示例数据
   - 8个商品分类（PP材质、工具、螺丝、电仪等）
   - 9个示例商品（含条码和库存信息）
   - 基础系统配置

2. **用户界面介绍**：
   - **首页**：系统概览和快速操作入口
   - **库存管理**：商品增删改查、库存查看
   - **扫描页面**：条码扫描和出入库操作
   - **月度账本**：财务报表和数据分析
   - **报表中心**：各类统计报表
   - **系统设置**：分类管理、系统配置

### 常用操作流程

#### 🔍 商品入库流程
1. 进入"扫描页面"或"库存管理"
2. 扫描商品条码或手动输入商品信息
3. 确认商品信息，输入入库数量和单价
4. 填写入库原因（如：采购入库、退货入库等）
5. 提交入库，系统自动更新库存

#### 📤 商品出库流程
1. 进入"扫描页面"
2. 扫描需要出库的商品条码
3. 确认商品信息和当前库存
4. 输入出库数量
5. 填写**领用人**、**领用部门**、**用途说明**（财务重点关注）
6. 提交出库，系统自动扣减库存

#### 📊 月度账本查看
1. 进入"月度账本"页面
2. 选择要查看的年月
3. 系统自动计算并展示：
   - 期初库存（数量和价值）
   - 本期入库和出库明细
   - 期末库存（数量和价值）
4. 可按分类展开查看详细数据
5. 点击"导出Excel"生成完整账本
6. 点击"导出出库记录"生成财务专用报表

### 高级功能

#### 📄 Excel报表导出
- **完整月度账本**：包含所有商品的期初、变动、期末数据
- **出库记录专项**：专门用于财务审核的出库明细表
- **自定义报表**：支持按时间段、分类等条件筛选导出

#### 🏷️ 条码管理
- **条码关联**：为商品关联或生成条码
- **批量导入**：通过Excel批量导入商品和条码信息
- **条码打印**：生成条码标签用于打印

## 🔐 安全特性

- **数据加密**：敏感数据采用bcryptjs加密存储
- **请求验证**：所有API请求进行数据格式验证
- **访问控制**：支持用户权限管理（预留功能）
- **数据备份**：自动生成数据库备份文件
- **CORS保护**：配置跨域资源共享策略

## 🚨 故障排除

### 常见问题

**Q1: Docker启动失败？**
```bash
# 检查Docker服务状态
sudo systemctl status docker

# 重启Docker服务
sudo systemctl restart docker

# 查看详细错误日志
docker-compose logs
```

**Q2: 端口占用问题？**
```bash
# 查看端口占用情况
lsof -i :80
lsof -i :3000

# 修改docker-compose.yml中的端口映射
ports:
  - "8080:80"    # 将80端口改为8080
  - "3001:3000"  # 将3000端口改为3001
```

**Q3: 数据库初始化失败？**
```bash
# 手动初始化数据库
cd server
npm run init-db

# 检查数据库文件权限
ls -la database/
chmod 644 database/inventory.db
```

**Q4: 前端页面无法访问？**
- 检查浏览器是否禁用了JavaScript
- 清除浏览器缓存和Cookie
- 确认防火墙没有阻止相关端口
- 检查nginx配置是否正确

### 性能优化建议

1. **定期清理日志文件**，避免磁盘空间不足
2. **定期备份数据库**，防止数据丢失
3. **监控系统资源使用情况**，适时扩容
4. **优化图片和静态资源**，提升加载速度

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下步骤：

### 参与贡献
1. **Fork 项目**到您的GitHub账户
2. **创建功能分支**: `git checkout -b feature/AmazingFeature`
3. **提交更改**: `git commit -m 'Add some AmazingFeature'`
4. **推送分支**: `git push origin feature/AmazingFeature`
5. **创建Pull Request**

### 开发规范
- **代码风格**：遵循ESLint配置
- **提交信息**：使用[约定式提交](https://www.conventionalcommits.org/)格式
- **测试覆盖**：为新功能添加相应测试
- **文档更新**：及时更新相关文档

### 报告问题
- 使用[Issue模板](.github/ISSUE_TEMPLATE.md)报告Bug
- 提供详细的重现步骤和环境信息
- 优先搜索现有Issue，避免重复报告

## 📋 更新日志

### Version 1.0.0 (2025-07-24)
- ✅ **核心功能完整**：库存管理、出入库、月度账本
- ✅ **Excel导出优化**：完整月度账本 + 财务专用出库记录
- ✅ **Docker支持**：一键部署，开箱即用
- ✅ **条码扫描**：多格式支持，快速识别
- ✅ **财务友好**：突出领用单位、用途等关键信息
- ✅ **界面优化**：现代化UI设计，响应式布局

### 未来规划
- 🔄 **用户权限系统**：多用户、角色权限管理
- 📱 **移动端适配**：PWA支持，离线使用
- 🔔 **消息通知**：低库存预警、操作提醒
- 📈 **高级报表**：图表分析、趋势预测
- 🔌 **API接口**：开放API，支持第三方集成

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。

```
MIT License

Copyright (c) 2025 SmallWareHouseManageSys

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## 📞 支持与联系

- **项目仓库**: [https://github.com/GGPbadazz/SmallWareHouseManageSys](https://github.com/GGPbadazz/SmallWareHouseManageSys)
- **问题报告**: [Issues](https://github.com/GGPbadazz/SmallWareHouseManageSys/issues)
- **功能建议**: [Discussions](https://github.com/GGPbadazz/SmallWareHouseManageSys/discussions)
- **项目文档**: [Wiki](https://github.com/GGPbadazz/SmallWareHouseManageSys/wiki)

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个Star！⭐**

Made with ❤️ by SmallWareHouseManageSys Team

</div>
