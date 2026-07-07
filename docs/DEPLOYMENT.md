# 部署说明

旧版 Docker 部署文档已弃用，因为其中包含过明文服务器和镜像仓库凭据。

当前建议使用 Linux 原生服务部署：

- 后端：`systemd` 运行 Node.js
- 前端：Nginx 托管 `client/dist`
- OCR：如需要，单独用 Python venv + `systemd`
- 数据：统一放到 `runtime-data`

请参考 [NATIVE_DEPLOYMENT.md](./NATIVE_DEPLOYMENT.md)。
