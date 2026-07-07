# SmallWareHouseManageSys - 小型仓库管理系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.18.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue)](https://www.docker.com/)

一个面向小型企业和工厂的仓库管理系统，覆盖备品备件管理、OCR 单据识别、条码扫描、月度账本和库存报表。

## 核心功能

- **库存管理**：商品管理、实时库存、低库存预警
- **出入库操作**：条码扫描、批量操作、详细记录
- **OCR 单据识别**：拍照识别出入库单据，自动提取单号
- **月度账本**：财务报表、成本核算、Excel导出
- **报表中心**：库存报告、交易统计、数据分析

## 系统架构

```
┌─────────────────────┐      ┌─────────────────────┐
│   Windows 相机端    │      │   WSL2/Linux 服务   │
│   Camera Service    │◄────►│ Backend + OCR       │
├─────────────────────┤      ├─────────────────────┤
│ camera_service      │      │ Frontend  :8080     │
│ 端口: 8766          │      │ Backend   :3004     │
│ • 4K相机采集        │      │ • OCR Server        │
│ • 快速拍照模式      │      │ • OCR Server常驻    │
│ • 本地存档          │      │ • Node.js API       │
└─────────────────────┘      └─────────────────────┘
```

## 性能指标

| 操作 | 耗时 | 说明 |
|------|------|------|
| **纯OCR识别** | **~100ms** | 模型常驻服务 |
| Node.js API | ~100ms | OCR Server模式 |
| Windows端处理 | ~4000ms | 拍照+图像处理+传输 |
| **端到端** | **~4.2秒** | 从拍照到识别完成 |

## 快速开始

### Docker 部署（CPU版本）

```bash
# 1. 克隆项目
git clone <repo-url>
cd SmallWareHouseManageSys

# 2. 使用Docker Compose启动
docker-compose up -d

# 3. 访问应用
# 前端: http://localhost:8080
# 后端: http://localhost:3004
```

### 非 Docker 部署（推荐）

当前主线不再推荐 Docker 部署。请使用 Linux `systemd` + Nginx，详见 [NATIVE_DEPLOYMENT.md](./NATIVE_DEPLOYMENT.md)。

如需要 OCR，使用独立 Python venv 服务运行 `server/scripts/ocr_server.py`。

### Windows 相机客户端

```batch
# 进入相机服务目录
cd 仓库领料单OCR相机客户端\windows_client_local_ocr

# 安装为Windows服务（推荐，开机自启）
4_install_service.bat

# 或手动启动
1_start.bat
```

详见 [Windows客户端文档](../仓库领料单OCR相机客户端/windows_client_local_ocr/README.md)。

## 技术栈

| 组件 | 技术 |
|------|------|
| **前端** | Vue.js 3 + Vite + Pinia |
| **后端** | Node.js + Express + SQLite |
| **OCR** | RapidOCR / PaddleOCR |
| **相机** | Python + OpenCV + Flask |
| **部署** | Docker Compose 或 systemd + Nginx |

## 项目结构

```
SmallWareHouseManageSys/
├── client/                     # 前端Vue.js应用
├── server/                     # 后端Node.js应用
│   ├── Dockerfile              # CPU版Dockerfile
│   ├── Dockerfile.gpu          # GPU版Dockerfile
│   └── scripts/
│       ├── ocr_recognize.py    # OCR识别脚本
│       └── ocr_server.py       # OCR Server (常驻内存)
├── 仓库领料单OCR相机客户端/
│   └── windows_client_local_ocr/  # Windows相机客户端
├── docker-compose.yml          # CPU版部署配置
└── README.md
```

## 隐私与配置

仓库只保留示例配置。真实服务器地址、相机地址、数据库、上传文件和备份文件不应提交到 Git。

## 许可证

本项目采用 MIT License。
