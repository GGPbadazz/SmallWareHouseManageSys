# 非 Docker 部署说明

## 目录约定

- 程序目录：`/opt/barcodesys/current`
- 运行数据：`/opt/barcodesys/runtime-data`
- 数据库：`/opt/barcodesys/runtime-data/database/inventory.db`
- 上传图片：`/opt/barcodesys/runtime-data/uploads`
- 备份：`/opt/barcodesys/runtime-data/backups`

## 安装

```bash
sudo useradd --system --create-home --home /opt/barcodesys barcodesys
sudo mkdir -p /opt/barcodesys/current /opt/barcodesys/runtime-data
sudo chown -R barcodesys:barcodesys /opt/barcodesys

cd /opt/barcodesys/current/server
npm ci --omit=dev

cd /opt/barcodesys/current/client
npm ci
npm run build
```

## 环境变量

复制根目录 `.env.example` 到 `server/.env`，至少修改：

- `JWT_SECRET`
- `INIT_ADMIN_PASSWORD`，仅首次创建新数据库时使用，首次登录后应立即修改
- `APP_ORIGIN`
- `RUNTIME_DATA_DIR`
- `DB_PATH`
- `UPLOAD_DIR`
- `BACKUP_DIR`

## systemd

```bash
sudo cp deploy/native/barcodesys-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now barcodesys-backend
sudo systemctl status barcodesys-backend
```

如继续使用服务器端 OCR：

```bash
python3 -m venv /opt/barcodesys/venv
/opt/barcodesys/venv/bin/pip install rapidocr_onnxruntime opencv-python-headless pillow "numpy<2.0"
sudo cp deploy/native/barcodesys-ocr.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now barcodesys-ocr
```

## Nginx

```bash
sudo cp deploy/native/nginx-barcodesys.conf /etc/nginx/conf.d/barcodesys.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 备份和恢复

系统内置备份已改为 SQLite `VACUUM INTO` 一致性快照，不再直接复制 WAL 数据库文件。迁移服务器时请同时备份：

- `runtime-data/database`
- `runtime-data/uploads`
- `runtime-data/backups`

## 验证

```bash
curl http://127.0.0.1:3003/api/health
curl -X POST http://127.0.0.1:3003/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"你的管理员密码"}'
```
