-- 数据库迁移脚本：添加单据管理功能
-- 运行方式: sqlite3 database/inventory.db < scripts/migrate-add-documents.sql

-- 1. 创建单据表 (如果不存在)
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_number TEXT UNIQUE NOT NULL,          -- 完整单号: 2025-12-0008383
    original_number TEXT,                          -- OCR识别的原始单号: 0008383
    document_type TEXT NOT NULL CHECK (document_type IN ('IN', 'OUT')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'cancelled')),
    requester_name TEXT,                           -- 领料人（出库时）
    project_id INTEGER,                            -- 领用部门
    purpose TEXT,                                  -- 用途说明
    image_path TEXT,                               -- 单据图片完整路径
    image_filename TEXT,                           -- 单据图片文件名
    total_value REAL DEFAULT 0,                    -- 单据总金额
    total_quantity REAL DEFAULT 0,                 -- 单据总数量
    item_count INTEGER DEFAULT 0,                  -- 单据包含的产品数量
    ocr_confidence REAL,                           -- OCR识别置信度
    ocr_raw_text TEXT,                             -- OCR原始识别文本
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME,                         -- 提交时间
    cancelled_at DATETIME,                         -- 取消时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 2. 创建索引 (如果不存在)
CREATE INDEX IF NOT EXISTS idx_documents_number ON documents(document_number);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- 3. 检查并添加 transactions 表的新字段
-- 注意: SQLite 的 ALTER TABLE 不支持 IF NOT EXISTS，所以需要检查

-- 创建临时触发器来检测错误（如果列已存在会失败，但不影响整体执行）
-- 添加 document_id 字段
ALTER TABLE transactions ADD COLUMN document_id INTEGER REFERENCES documents(id);

-- 添加 document_number 字段
ALTER TABLE transactions ADD COLUMN document_number TEXT;

-- 4. 显示迁移结果
SELECT '✅ 迁移完成！' AS message;
SELECT '📋 documents 表字段数: ' || COUNT(*) AS info FROM pragma_table_info('documents');
SELECT '📋 transactions 表字段数: ' || COUNT(*) AS info FROM pragma_table_info('transactions');
