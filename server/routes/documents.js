/**
 * 单据管理路由 - Documents API
 * 
 * 提供单据的创建、查询、更新、提交、取消等功能
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { documentUploadsDir, ensureDir, resolveUploadPath, toStoredUploadPath } = require('../config/paths');

// 财务精度计算工具类（复用自 transactions.js）
class PrecisionCalculator {
    static STORAGE_DECIMALS = 2;    // 总金额、库存价值：2位小数
    static PRICE_DECIMALS = 4;      // 单价：4位小数
    static CALCULATION_DECIMALS = 6;

    static round(number, decimals = this.CALCULATION_DECIMALS) {
        if (isNaN(number) || number === null || number === undefined) return 0;
        const factor = Math.pow(10, decimals);
        return Math.round((number + Number.EPSILON) * factor) / factor;
    }

    static add(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a * factor + b * factor)) / factor;
    }

    static subtract(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a * factor - b * factor)) / factor;
    }

    static multiply(a, b) {
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round(a * b * factor) / factor;
    }

    static divide(a, b) {
        if (b === 0 || isNaN(b)) return 0;
        const factor = Math.pow(10, this.CALCULATION_DECIMALS);
        return Math.round((a / b) * factor) / factor;
    }

    static formatStorage(number) {
        if (isNaN(number) || number === null || number === undefined) return 0;
        return this.round(number, this.STORAGE_DECIMALS);
    }

    static formatPrice(number) {
        if (isNaN(number) || number === null || number === undefined) return 0;
        return this.round(number, this.PRICE_DECIMALS);
    }

    static formatTransactionPrice(number) {
        if (isNaN(number) || number === null || number === undefined) return 0;
        return this.round(number, 2);
    }
}

// 配置文件上传
const uploadsDir = ensureDir(documentUploadsDir);

/**
 * 从相机客户端下载图片并保存到服务端
 * @param {string} imageUrl - 图片URL (如 http://localhost:8766/preview/xxx)
 * @param {number} documentId - 单据ID
 * @param {string} categoryName - 商品类别名称（用于分类存放）
 * @returns {Promise<{path: string, filename: string} | null>}
 */
async function downloadAndSaveImage(imageUrl, documentId, categoryName = '未分类') {
    return new Promise((resolve) => {
        try {
            if (!imageUrl) {
                resolve(null);
                return;
            }

            // 创建保存目录：按年月和商品类别分类
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            // 清理类别名称中的特殊字符，确保可以作为文件夹名
            const safeCategoryName = (categoryName || '未分类').replace(/[<>:"/\\|?*]/g, '_');
            const subDir = path.join(uploadsDir, String(year), month, safeCategoryName);
            
            if (!fs.existsSync(subDir)) {
                fs.mkdirSync(subDir, { recursive: true });
            }

            // 生成文件名：单据ID_时间戳.jpg
            const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
            const filename = `doc_${documentId}_${timestamp}.jpg`;
            const filePath = path.join(subDir, filename);

            // 下载图片
            http.get(imageUrl, (response) => {
                if (response.statusCode !== 200) {
                    console.warn(`[图片下载] 失败，状态码: ${response.statusCode}`);
                    resolve(null);
                    return;
                }

                const fileStream = fs.createWriteStream(filePath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`[图片存档] 已保存: ${year}/${month}/${safeCategoryName}/${filename}`);
                    resolve({ path: toStoredUploadPath(filePath), filename });
                });

                fileStream.on('error', (err) => {
                    console.error(`[图片下载] 写入失败:`, err.message);
                    fs.unlink(filePath, () => {}); // 删除不完整的文件
                    resolve(null);
                });
            }).on('error', (err) => {
                console.error(`[图片下载] 请求失败:`, err.message);
                resolve(null);
            });

            // 5秒超时
            setTimeout(() => {
                resolve(null);
            }, 5000);
        } catch (err) {
            console.error(`[图片下载] 异常:`, err.message);
            resolve(null);
        }
    });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 按年月创建子目录
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const subDir = path.join(uploadsDir, String(year), month);
        
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir, { recursive: true });
        }
        cb(null, subDir);
    },
    filename: (req, file, cb) => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = `doc_${timestamp}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP)'));
        }
    }
});

// 生成单据编号
const generateDocumentNumber = (type, originalNumber = null) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    if (originalNumber) {
        // 如果有原始单号（来自OCR），直接使用
        // 格式如: C0008383-202512 或 R0008383-202512
        return originalNumber;
    } else {
        // 自动生成序号，格式: C0000001-202512 或 R0000001-202512
        const prefix = type === 'IN' ? 'R' : 'C';
        const yearMonth = `${year}${month}`;
        
        // 查询本月已有的单据数量
        const countResult = db.prepare(`
            SELECT COUNT(*) as count FROM documents 
            WHERE document_number LIKE ?
        `).get(`%-${yearMonth}`);
        
        const seq = String((countResult?.count || 0) + 1).padStart(7, '0');
        return `${prefix}${seq}-${yearMonth}`;
    }
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatPrintNumber(value, digits = 2) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toFixed(digits) : '0.00';
}

function formatPrintDate(value) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }
    return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

function renderDocumentPrintHtml(document, items) {
    const typeText = document.document_type === 'IN' ? '入库单' : '出库单';
    const rows = items.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.product_name)}</td>
            <td>${escapeHtml(item.barcode || '')}</td>
            <td>${escapeHtml(item.category_name || '')}</td>
            <td class="num">${formatPrintNumber(item.quantity, 3)}</td>
            <td class="num">${formatPrintNumber(item.unit_price, 4)}</td>
            <td class="num">${formatPrintNumber(item.total_price, 2)}</td>
            <td>${escapeHtml(item.purpose || '')}</td>
        </tr>
    `).join('');

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(document.document_number)} ${typeText}</title>
  <style>
    @page { size: 241mm 140mm; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; font-family: "SimSun", "NSimSun", serif; font-size: 12px; }
    .sheet { width: 100%; }
    h1 { margin: 0 0 8px; text-align: center; font-size: 22px; letter-spacing: 0; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px; margin-bottom: 8px; }
    .meta div { border-bottom: 1px solid #000; min-height: 22px; padding: 3px 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; padding: 4px 3px; vertical-align: middle; word-break: break-all; }
    th { font-weight: 700; text-align: center; }
    .num { text-align: right; }
    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 18px; }
    .signatures div { border-bottom: 1px solid #000; min-height: 24px; }
    .print-actions { position: fixed; top: 8px; right: 8px; }
    .print-actions button { padding: 6px 12px; border: 1px solid #000; background: #fff; cursor: pointer; }
    @media print { .print-actions { display: none; } }
  </style>
</head>
<body>
  <div class="print-actions"><button onclick="window.print()">打印</button></div>
  <main class="sheet">
    <h1>${typeText}</h1>
    <section class="meta">
      <div>单据号：${escapeHtml(document.document_number)}</div>
      <div>日期：${formatPrintDate(document.submitted_at || document.created_at)}</div>
      <div>状态：${escapeHtml(document.status || '')}</div>
      <div>领用单位/部门：${escapeHtml(document.project_name || '')}</div>
      <div>领料人：${escapeHtml(document.requester_name || '')}</div>
      <div>供应商：${escapeHtml(document.supplier || '')}</div>
      <div>用途：${escapeHtml(document.purpose || '')}</div>
      <div>总数量：${formatPrintNumber(document.total_quantity, 3)}</div>
      <div>总金额：${formatPrintNumber(document.total_value, 2)}</div>
    </section>
    <table>
      <thead>
        <tr>
          <th style="width: 34px;">序号</th>
          <th>产品名称</th>
          <th style="width: 105px;">条码</th>
          <th style="width: 70px;">类别</th>
          <th style="width: 70px;">数量</th>
          <th style="width: 70px;">单价</th>
          <th style="width: 75px;">金额</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="8">无明细</td></tr>'}</tbody>
    </table>
    <section class="signatures">
      <div>制单：</div>
      <div>仓库：</div>
      <div>领料/经办：</div>
      <div>审核：</div>
    </section>
  </main>
</body>
</html>`;
}

// ============== API 路由 ==============

/**
 * 获取单据列表
 * GET /api/documents?page=1&limit=20&status=draft&type=OUT
 */
router.get('/', (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            status, 
            type,
            start_date,
            end_date,
            search
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let query = `
            SELECT d.*, p.name as project_name,
                   (SELECT COUNT(*) FROM transactions t WHERE t.document_id = d.id) as transaction_count
            FROM documents d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND d.status = ?`;
            params.push(status);
        }

        if (type) {
            query += ` AND d.document_type = ?`;
            params.push(type);
        }

        if (start_date) {
            query += ` AND DATE(d.created_at) >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(d.created_at) <= ?`;
            params.push(end_date);
        }

        if (search) {
            query += ` AND (d.document_number LIKE ? OR d.original_number LIKE ? OR d.requester_name LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // 计算总数
        const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) as total FROM');
        const { total } = db.prepare(countQuery.split('LEFT JOIN projects')[0] + ' WHERE 1=1' + 
            (status ? ' AND d.status = ?' : '') +
            (type ? ' AND d.document_type = ?' : '') +
            (start_date ? ' AND DATE(d.created_at) >= ?' : '') +
            (end_date ? ' AND DATE(d.created_at) <= ?' : '') +
            (search ? ' AND (d.document_number LIKE ? OR d.original_number LIKE ? OR d.requester_name LIKE ?)' : '')
        ).get(...params.slice(0, params.length));

        query += ` ORDER BY d.id DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const documents = db.prepare(query).all(...params);

        res.json({
            documents,
            total: total || 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil((total || 0) / parseInt(limit))
        });
    } catch (error) {
        console.error('获取单据列表失败:', error);
        res.status(500).json({ error: '获取单据列表失败' });
    }
});

/**
 * 获取单个单据详情（包含关联的交易记录）
 * GET /api/documents/:id
 */
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const document = db.prepare(`
            SELECT d.*, p.name as project_name
            FROM documents d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.id = ?
        `).get(id);

        if (!document) {
            return res.status(404).json({ error: '单据不存在' });
        }

        // 获取关联的交易记录
        const transactions = db.prepare(`
            SELECT t.*, pr.name as product_name, pr.barcode, pr.stock as current_stock
            FROM transactions t
            LEFT JOIN products pr ON t.product_id = pr.id
            WHERE t.document_id = ?
            ORDER BY t.id ASC
        `).all(id);

        res.json({
            ...document,
            transactions
        });
    } catch (error) {
        console.error('获取单据详情失败:', error);
        res.status(500).json({ error: '获取单据详情失败' });
    }
});

/**
 * 创建新单据
 * POST /api/documents
 */
router.post('/', [
    body('document_type').isIn(['IN', 'OUT']).withMessage('单据类型必须是 IN 或 OUT'),
    body('original_number').optional().isString(),
    body('requester_name').optional().isString(),
    body('project_id').optional().isInt(),
    body('purpose').optional().isString()
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            document_type,
            original_number,
            requester_name,
            project_id,
            purpose,
            ocr_confidence,
            ocr_raw_text
        } = req.body;

        // 生成单据编号
        const document_number = generateDocumentNumber(document_type, original_number);

        // 检查单号是否重复（排除已作废的单据）
        const existing = db.prepare(
            "SELECT id FROM documents WHERE document_number = ? AND status != 'cancelled'"
        ).get(document_number);
        if (existing) {
            return res.status(400).json({ error: '单据编号已存在', document_number });
        }

        // 从请求中获取supplier（仅入库单有效）
        const { supplier } = req.body;

        const result = db.prepare(`
            INSERT INTO documents 
            (document_number, original_number, document_type, status, 
             requester_name, project_id, purpose, ocr_confidence, ocr_raw_text, supplier)
            VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
        `).run(
            document_number,
            original_number || null,
            document_type,
            requester_name || null,
            project_id || null,
            purpose || null,
            ocr_confidence || null,
            ocr_raw_text || null,
            document_type === 'IN' ? (supplier || null) : null
        );

        const newDocument = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);

        console.log('创建单据成功:', document_number);

        res.status(201).json(newDocument);
    } catch (error) {
        console.error('创建单据失败:', error);
        res.status(500).json({ error: '创建单据失败' });
    }
});

/**
 * 更新单据信息
 * PUT /api/documents/:id
 */
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const {
            requester_name,
            project_id,
            purpose
        } = req.body;

        // 检查单据是否存在且状态为草稿
        const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!document) {
            return res.status(404).json({ error: '单据不存在' });
        }
        if (document.status !== 'draft') {
            return res.status(400).json({ error: '只能修改草稿状态的单据' });
        }

        // 从请求中获取supplier（仅入库单有效）
        const { supplier } = req.body;

        db.prepare(`
            UPDATE documents 
            SET requester_name = ?, project_id = ?, purpose = ?, supplier = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            requester_name || document.requester_name,
            project_id || document.project_id,
            purpose || document.purpose,
            document.document_type === 'IN' ? (supplier !== undefined ? supplier : document.supplier) : null,
            id
        );

        const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        res.json(updated);
    } catch (error) {
        console.error('更新单据失败:', error);
        res.status(500).json({ error: '更新单据失败' });
    }
});

/**
 * 上传单据图片
 * POST /api/documents/:id/image
 */
router.post('/:id/image', upload.single('image'), (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: '请上传图片文件' });
        }

        const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!document) {
            // 删除已上传的文件
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: '单据不存在' });
        }

        // 如果已有图片，删除旧图片
        const oldImagePath = resolveUploadPath(document.image_path);
        if (oldImagePath && fs.existsSync(oldImagePath)) {
            try {
                fs.unlinkSync(oldImagePath);
            } catch (e) {
                console.warn('删除旧图片失败:', e.message);
            }
        }

        // 更新单据的图片信息
        db.prepare(`
            UPDATE documents 
            SET image_path = ?, image_filename = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(toStoredUploadPath(req.file.path), req.file.filename, id);

        res.json({
            success: true,
            image_path: toStoredUploadPath(req.file.path),
            image_filename: req.file.filename
        });
    } catch (error) {
        console.error('上传图片失败:', error);
        res.status(500).json({ error: '上传图片失败' });
    }
});

/**
 * 获取单据图片
 * GET /api/documents/:id/image
 */
router.get('/:id/image', (req, res) => {
    try {
        const { id } = req.params;
        
        const document = db.prepare('SELECT image_path FROM documents WHERE id = ?').get(id);
        if (!document || !document.image_path) {
            return res.status(404).json({ error: '图片不存在' });
        }

        const imagePath = resolveUploadPath(document.image_path);

        if (!imagePath || !fs.existsSync(imagePath)) {
            console.error(`图片文件不存在: ${imagePath}`);
            return res.status(404).json({ error: '图片文件不存在' });
        }

        res.sendFile(path.resolve(imagePath));
    } catch (error) {
        console.error('获取图片失败:', error);
        res.status(500).json({ error: '获取图片失败' });
    }
});

/**
 * 获取可打印单据页面
 * GET /api/documents/:id/print
 */
router.get('/:id/print', (req, res) => {
    try {
        const { id } = req.params;

        const document = db.prepare(`
            SELECT d.*, p.name as project_name
            FROM documents d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.id = ?
        `).get(id);

        if (!document) {
            return res.status(404).send('单据不存在');
        }

        const items = db.prepare(`
            SELECT t.*, pr.name as product_name, pr.barcode, c.name as category_name
            FROM transactions t
            LEFT JOIN products pr ON t.product_id = pr.id
            LEFT JOIN categories c ON pr.category_id = c.id
            WHERE t.document_id = ?
            ORDER BY t.id ASC
        `).all(id);

        res.type('html').send(renderDocumentPrintHtml(document, items));
    } catch (error) {
        console.error('生成打印页面失败:', error);
        res.status(500).send('生成打印页面失败');
    }
});

/**
 * 向单据添加产品（创建交易记录草稿）
 * POST /api/documents/:id/items
 */
router.post('/:id/items', [
    body('product_id').isInt({ min: 1 }).withMessage('产品ID无效'),
    body('quantity').isFloat({ min: 0.001 }).withMessage('数量必须大于0'),
    body('unit_price').optional().isFloat({ min: 0 }),
    body('total_value').optional().isFloat({ min: 0 })
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { product_id, quantity, unit_price, total_value } = req.body;

        // 检查单据状态
        const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!document) {
            return res.status(404).json({ error: '单据不存在' });
        }
        if (document.status !== 'draft') {
            return res.status(400).json({ error: '只能向草稿状态的单据添加产品' });
        }

        // 检查产品是否存在
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
        if (!product) {
            return res.status(404).json({ error: '产品不存在' });
        }

        // 出库时检查库存
        if (document.document_type === 'OUT' && product.stock < quantity) {
            return res.status(400).json({ 
                error: `库存不足。当前库存: ${product.stock}, 需要: ${quantity}` 
            });
        }

        // 检查是否已经添加过该产品
        const existingItem = db.prepare(`
            SELECT id FROM transactions WHERE document_id = ? AND product_id = ?
        `).get(id, product_id);

        if (existingItem) {
            return res.status(400).json({ error: '该产品已在单据中，请修改数量而不是重复添加' });
        }

        // 计算价格
        let calculatedUnitPrice = unit_price || 0;
        let calculatedTotalPrice = 0;

        if (document.document_type === 'IN') {
            // 入库：使用输入的单价或总价计算
            if (total_value && quantity > 0) {
                calculatedUnitPrice = PrecisionCalculator.divide(total_value, quantity);
                calculatedTotalPrice = total_value;
            } else if (unit_price) {
                calculatedTotalPrice = PrecisionCalculator.multiply(quantity, unit_price);
            }
        } else {
            // 出库：使用产品当前单价
            calculatedUnitPrice = product.current_unit_price || product.price || 0;
            calculatedTotalPrice = PrecisionCalculator.multiply(quantity, calculatedUnitPrice);
        }

        // 创建交易记录（关联到单据）
        const currentTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
        const result = db.prepare(`
            INSERT INTO transactions 
            (product_id, type, quantity, unit_price, total_price, 
             document_id, document_number, 
             requester_name, project_id, purpose, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            product_id,
            document.document_type,
            PrecisionCalculator.formatStorage(quantity),
            PrecisionCalculator.formatPrice(calculatedUnitPrice),      // 单价4位
            PrecisionCalculator.formatStorage(calculatedTotalPrice),   // 总价2位
            id,
            document.document_number,
            document.requester_name,
            document.project_id,
            document.purpose,
            currentTime
        );

        // 更新单据统计信息
        updateDocumentStats(id);

        // 返回添加的项目信息
        const newItem = db.prepare(`
            SELECT t.*, p.name as product_name, p.barcode
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(newItem);
    } catch (error) {
        console.error('添加产品失败:', error);
        res.status(500).json({ error: '添加产品失败' });
    }
});

/**
 * 更新单据中的产品数量
 * PUT /api/documents/:id/items/:itemId
 */
router.put('/:id/items/:itemId', (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { quantity, unit_price, total_value } = req.body;

        // 检查单据和交易记录
        const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!document || document.status !== 'draft') {
            return res.status(400).json({ error: '单据不存在或不是草稿状态' });
        }

        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND document_id = ?').get(itemId, id);
        if (!transaction) {
            return res.status(404).json({ error: '交易记录不存在' });
        }

        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(transaction.product_id);

        // 出库时检查库存
        if (document.document_type === 'OUT' && product.stock < quantity) {
            return res.status(400).json({ 
                error: `库存不足。当前库存: ${product.stock}, 需要: ${quantity}` 
            });
        }

        // 计算价格
        let calculatedUnitPrice = transaction.unit_price;
        let calculatedTotalPrice = 0;

        if (document.document_type === 'IN') {
            if (total_value && quantity > 0) {
                calculatedUnitPrice = PrecisionCalculator.divide(total_value, quantity);
                calculatedTotalPrice = total_value;
            } else if (unit_price) {
                calculatedUnitPrice = unit_price;
                calculatedTotalPrice = PrecisionCalculator.multiply(quantity, unit_price);
            } else {
                calculatedTotalPrice = PrecisionCalculator.multiply(quantity, calculatedUnitPrice);
            }
        } else {
            calculatedTotalPrice = PrecisionCalculator.multiply(quantity, calculatedUnitPrice);
        }

        db.prepare(`
            UPDATE transactions 
            SET quantity = ?, unit_price = ?, total_price = ?
            WHERE id = ?
        `).run(
            PrecisionCalculator.formatStorage(quantity),
            PrecisionCalculator.formatPrice(calculatedUnitPrice),      // 单价4位
            PrecisionCalculator.formatStorage(calculatedTotalPrice),   // 总价2位
            itemId
        );

        // 更新单据统计
        updateDocumentStats(id);

        const updated = db.prepare(`
            SELECT t.*, p.name as product_name, p.barcode
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.id = ?
        `).get(itemId);

        res.json(updated);
    } catch (error) {
        console.error('更新产品失败:', error);
        res.status(500).json({ error: '更新产品失败' });
    }
});

/**
 * 从单据移除产品
 * DELETE /api/documents/:id/items/:itemId
 */
router.delete('/:id/items/:itemId', (req, res) => {
    try {
        const { id, itemId } = req.params;

        const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!document || document.status !== 'draft') {
            return res.status(400).json({ error: '单据不存在或不是草稿状态' });
        }

        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND document_id = ?').get(itemId, id);
        if (!transaction) {
            return res.status(404).json({ error: '交易记录不存在' });
        }

        db.prepare('DELETE FROM transactions WHERE id = ?').run(itemId);

        // 更新单据统计
        updateDocumentStats(id);

        res.json({ success: true, message: '产品已移除' });
    } catch (error) {
        console.error('移除产品失败:', error);
        res.status(500).json({ error: '移除产品失败' });
    }
});

/**
 * 检查单据号是否已存在（完整单号检查）
 * GET /api/documents/check/:documentNumber
 */
router.get('/check/:documentNumber', (req, res) => {
    try {
        const { documentNumber } = req.params;
        
        const existingDoc = db.prepare(`
            SELECT id, status, document_number, created_at 
            FROM documents 
            WHERE document_number = ?
        `).get(documentNumber);
        
        if (existingDoc) {
            res.json({
                exists: true,
                message: `单据号 ${documentNumber} 已存在`,
                status: existingDoc.status,
                created_at: existingDoc.created_at
            });
        } else {
            res.json({
                exists: false,
                message: '单据号可用'
            });
        }
    } catch (error) {
        console.error('检查单据号失败:', error);
        res.status(500).json({ error: '检查单据号失败' });
    }
});

/**
 * 检查当月是否有相同的7位单号
 * GET /api/documents/check-monthly/:middleNumber
 * @param middleNumber - 7位数字单号
 * @query type - 单据类型 IN/OUT
 */
router.get('/check-monthly/:middleNumber', (req, res) => {
    try {
        const { middleNumber } = req.params;
        const { type } = req.query;
        
        // 获取当前年月
        const now = new Date();
        const yearMonth = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // 构建前缀
        const prefix = type === 'IN' ? 'R' : 'C';
        
        // 查找当月是否有相同的7位数单号
        // 单号格式: C0002200-2512 或 R0002200-2512
        const pattern = `${prefix}${middleNumber.padStart(7, '0')}-${yearMonth}`;
        
        const existingDoc = db.prepare(`
            SELECT id, status, document_number, created_at 
            FROM documents 
            WHERE document_number = ?
        `).get(pattern);
        
        if (existingDoc) {
            res.json({
                exists: true,
                message: `当月已存在相同单号 ${existingDoc.document_number}`,
                document_number: existingDoc.document_number,
                status: existingDoc.status,
                created_at: existingDoc.created_at
            });
        } else {
            res.json({
                exists: false,
                message: '单据号可用'
            });
        }
    } catch (error) {
        console.error('检查当月单据号失败:', error);
        res.status(500).json({ error: '检查当月单据号失败' });
    }
});

/**
 * 一键创建并提交单据（新流程，不使用草稿）
 * POST /api/documents/submit
 */
router.post('/submit', (req, res) => {
    try {
        const {
            document_type,
            document_number,
            original_number,
            requester_name,
            project_id,
            purpose,
            notes,
            ocr_confidence,
            items,
            image_url,
            temp_file_id,
            supplier,  // 供应商（仅入库单有效）
            custom_created_at  // 自定义创建时间（延续上月单据）
        } = req.body;

        // 验证必填字段
        if (!document_type || !['IN', 'OUT'].includes(document_type)) {
            return res.status(400).json({ error: '无效的单据类型' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: '请至少添加一个产品' });
        }

        // 出库验证
        if (document_type === 'OUT') {
            if (!requester_name) {
                return res.status(400).json({ error: '出库单必须填写领料人' });
            }
            if (!purpose) {
                return res.status(400).json({ error: '出库单必须填写用途说明' });
            }
        }

        // 验证入库单价格
        if (document_type === 'IN') {
            for (const item of items) {
                if (!item.total_price || item.total_price <= 0) {
                    return res.status(400).json({ error: '入库单所有产品必须有价格' });
                }
            }
        }

        // 使用数据库事务
        const submitTransaction = db.transaction(() => {
            // 生成单据编号
            const finalDocNumber = document_number || generateDocumentNumber(document_type, original_number);
            const currentTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
            
            // 如果提供了自定义创建时间（延续上月单据），使用它；否则使用当前时间
            const createdAt = custom_created_at 
                ? new Date(custom_created_at).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
                : currentTime;

            // 检查单据号是否已存在（排除已作废的单据，允许重用已作废的单据号）
            const existingDoc = db.prepare(`
                SELECT id, status, document_number FROM documents 
                WHERE document_number = ? AND status != 'cancelled'
            `).get(finalDocNumber);
            
            if (existingDoc) {
                console.error(`[单据提交错误] 单据号 ${finalDocNumber} 已存在 (ID: ${existingDoc.id}, 状态: ${existingDoc.status})`);
                throw new Error(`单据号 ${finalDocNumber} 已存在，无法重复提交。`);
            }

            // 创建单据（入库单支持supplier字段）
            const docResult = db.prepare(`
                INSERT INTO documents (
                    document_number, document_type, original_number,
                    requester_name, project_id, purpose, notes,
                    ocr_confidence, status, created_at, submitted_at, supplier
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
            `).run(
                finalDocNumber,
                document_type,
                original_number || finalDocNumber,
                requester_name || null,
                project_id || null,
                purpose || null,
                notes || null,
                ocr_confidence || null,
                createdAt,  // 使用自定义时间或当前时间
                currentTime,
                document_type === 'IN' ? (supplier || null) : null
            );

            const documentId = docResult.lastInsertRowid;
            const results = [];
            let totalQty = 0;
            let totalAmount = 0;

            // 处理每个产品
            for (const item of items) {
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
                if (!product) {
                    throw new Error(`产品ID ${item.product_id} 不存在`);
                }

                const quantity = PrecisionCalculator.formatStorage(item.quantity);
                const unitPrice = PrecisionCalculator.formatPrice(item.unit_price);   // 单价4位
                const totalPrice = PrecisionCalculator.formatStorage(item.total_price); // 总价2位

                // 记录交易前状态
                const stockBefore = product.stock;
                const unitPriceBefore = product.current_unit_price || product.price || 0;
                const stockValueBefore = product.total_cost_value || 0;

                // 验证出库库存
                if (document_type === 'OUT' && product.stock < quantity) {
                    throw new Error(`产品 ${product.name} 库存不足。当前: ${product.stock}, 需要: ${quantity}`);
                }

                // 计算交易后状态
                let stockAfter, unitPriceAfter, stockValueAfter;

                if (document_type === 'IN') {
                    // 入库：加权平均
                    const newTotalValue = PrecisionCalculator.add(stockValueBefore, totalPrice);
                    const newTotalQty = PrecisionCalculator.add(stockBefore, quantity);
                    
                    stockAfter = newTotalQty;
                    unitPriceAfter = PrecisionCalculator.divide(newTotalValue, newTotalQty);
                    stockValueAfter = newTotalValue;
                } else {
                    // 出库
                    if (quantity >= stockBefore) {
                        stockAfter = 0;
                        unitPriceAfter = 0;
                        stockValueAfter = 0;
                    } else {
                        stockAfter = PrecisionCalculator.subtract(stockBefore, quantity);
                        unitPriceAfter = unitPriceBefore;
                        stockValueAfter = PrecisionCalculator.subtract(stockValueBefore, totalPrice);
                    }
                }

                // 创建交易记录
                db.prepare(`
                    INSERT INTO transactions (
                        product_id, document_id, document_number, type, quantity, unit_price, total_price,
                        stock_before, stock_after, stock_unit_price, stock_value,
                        requester_name, project_id, purpose, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    item.product_id,
                    documentId,
                    finalDocNumber,
                    document_type,
                    quantity,
                    unitPrice,
                    totalPrice,
                    PrecisionCalculator.formatStorage(stockBefore),
                    PrecisionCalculator.formatStorage(stockAfter),
                    PrecisionCalculator.formatPrice(unitPriceAfter),      // 单价4位
                    PrecisionCalculator.formatStorage(stockValueAfter),   // 库存价值2位
                    requester_name || null,
                    project_id || null,
                    purpose || null,
                    createdAt  // 使用自定义时间或当前时间
                );

                // 更新产品库存
                db.prepare(`
                    UPDATE products 
                    SET stock = ?, current_unit_price = ?, total_cost_value = ?, 
                        price = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    PrecisionCalculator.formatStorage(stockAfter),
                    PrecisionCalculator.formatPrice(unitPriceAfter),      // 单价4位
                    PrecisionCalculator.formatStorage(stockValueAfter),   // 库存价值2位
                    PrecisionCalculator.formatPrice(unitPriceAfter),      // 单价4位
                    item.product_id
                );

                totalQty = PrecisionCalculator.add(totalQty, quantity);
                totalAmount = PrecisionCalculator.add(totalAmount, totalPrice);

                results.push({
                    product_id: item.product_id,
                    product_name: product.name,
                    quantity: quantity,
                    stock_before: stockBefore,
                    stock_after: stockAfter
                });
            }

            // 更新单据统计
            db.prepare(`
                UPDATE documents 
                SET item_count = ?, total_quantity = ?, total_value = ?
                WHERE id = ?
            `).run(items.length, totalQty, totalAmount, documentId);

            return {
                document_id: documentId,
                document_number: finalDocNumber,
                items_processed: results.length,
                results
            };
        });

        const result = submitTransaction();

        console.log(`单据 ${result.document_number} 创建并提交成功，处理了 ${result.items_processed} 个产品`);

        // 异步下载并保存图片（不阻塞响应）
        if (image_url) {
            // 获取第一个商品的类别名称用于分类存放
            let categoryName = '未分类';
            if (items && items.length > 0) {
                const firstProduct = db.prepare(`
                    SELECT p.*, c.name as category_name 
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE p.id = ?
                `).get(items[0].product_id);
                if (firstProduct && firstProduct.category_name) {
                    categoryName = firstProduct.category_name;
                }
            }
            
            downloadAndSaveImage(image_url, result.document_id, categoryName).then((imageInfo) => {
                if (imageInfo) {
                    // 更新数据库中的图片路径
                    db.prepare(`
                        UPDATE documents 
                        SET image_path = ?, image_filename = ?
                        WHERE id = ?
                    `).run(imageInfo.path, imageInfo.filename, result.document_id);
                    console.log(`[图片存档] 单据 ${result.document_number} 图片已保存到服务端`);
                }
            }).catch(err => {
                console.warn(`[图片存档] 保存失败:`, err.message);
            });
        }

        res.json({
            success: true,
            message: '单据创建并提交成功',
            ...result
        });
    } catch (error) {
        console.error('创建并提交单据失败:', error);
        res.status(500).json({ error: error.message || '创建并提交单据失败' });
    }
});

/**
 * 提交单据（执行所有交易）- 旧接口保留兼容
 * POST /api/documents/:id/submit
 */
router.post('/:id/submit', (req, res) => {
    try {
        const { id } = req.params;

        const document = db.prepare(`
            SELECT d.*, p.name as project_name
            FROM documents d
            LEFT JOIN projects p ON d.project_id = p.id
            WHERE d.id = ?
        `).get(id);

        if (!document) {
            return res.status(404).json({ error: '单据不存在' });
        }

        if (document.status !== 'draft') {
            return res.status(400).json({ error: '只能提交草稿状态的单据' });
        }

        // 获取单据中的所有交易
        const transactions = db.prepare(`
            SELECT t.*, p.stock, p.current_unit_price, p.total_cost_value, p.price, p.name
            FROM transactions t
            LEFT JOIN products p ON t.product_id = p.id
            WHERE t.document_id = ?
        `).all(id);

        if (transactions.length === 0) {
            return res.status(400).json({ error: '单据中没有产品，无法提交' });
        }

        // 出库时验证必填字段
        if (document.document_type === 'OUT') {
            if (!document.requester_name) {
                return res.status(400).json({ error: '出库单必须填写领料人' });
            }
            if (!document.purpose) {
                return res.status(400).json({ error: '出库单必须填写用途说明' });
            }
        }

        // 在事务中执行所有操作
        const submitTransaction = db.transaction(() => {
            const results = [];

            for (const txn of transactions) {
                const product = db.prepare('SELECT * FROM products WHERE id = ?').get(txn.product_id);
                
                // 记录交易前状态
                const stockBefore = product.stock;
                const unitPriceBefore = product.current_unit_price || product.price || 0;
                const stockValueBefore = product.total_cost_value || 0;

                // 再次验证库存（并发安全）
                if (document.document_type === 'OUT' && product.stock < txn.quantity) {
                    throw new Error(`产品 ${product.name} 库存不足。当前: ${product.stock}, 需要: ${txn.quantity}`);
                }

                // 计算交易后状态
                let stockAfter, unitPriceAfter, stockValueAfter;

                if (document.document_type === 'IN') {
                    // 入库：加权平均
                    const inboundValue = txn.total_price;
                    const newTotalValue = PrecisionCalculator.add(stockValueBefore, inboundValue);
                    const newTotalQty = PrecisionCalculator.add(stockBefore, txn.quantity);
                    
                    stockAfter = newTotalQty;
                    unitPriceAfter = PrecisionCalculator.divide(newTotalValue, newTotalQty);
                    stockValueAfter = newTotalValue;
                } else {
                    // 出库
                    if (txn.quantity >= stockBefore) {
                        stockAfter = 0;
                        unitPriceAfter = 0;
                        stockValueAfter = 0;
                    } else {
                        stockAfter = PrecisionCalculator.subtract(stockBefore, txn.quantity);
                        unitPriceAfter = unitPriceBefore;
                        stockValueAfter = PrecisionCalculator.subtract(stockValueBefore, txn.total_price);
                    }
                }

                // 更新交易记录的库存快照
                db.prepare(`
                    UPDATE transactions 
                    SET stock_before = ?, stock_after = ?, 
                        stock_unit_price = ?, stock_value = ?,
                        requester_name = ?, project_id = ?, purpose = ?
                    WHERE id = ?
                `).run(
                    PrecisionCalculator.formatStorage(stockBefore),
                    PrecisionCalculator.formatStorage(stockAfter),
                    PrecisionCalculator.formatPrice(unitPriceAfter),      // 单价4位
                    PrecisionCalculator.formatStorage(stockValueAfter),   // 库存价值2位
                    document.requester_name,
                    document.project_id,
                    document.purpose,
                    txn.id
                );

                // 更新产品库存
                db.prepare(`
                    UPDATE products 
                    SET stock = ?, current_unit_price = ?, total_cost_value = ?, 
                        price = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(
                    PrecisionCalculator.formatStorage(stockAfter),
                    PrecisionCalculator.formatPrice(unitPriceAfter),      // 单价4位
                    PrecisionCalculator.formatStorage(stockValueAfter),   // 库存价值2位
                    PrecisionCalculator.formatPrice(unitPriceAfter),      // 单价4位
                    txn.product_id
                );

                results.push({
                    product_id: txn.product_id,
                    product_name: txn.name,
                    quantity: txn.quantity,
                    stock_before: stockBefore,
                    stock_after: stockAfter
                });
            }

            // 更新单据状态
            const currentTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
            db.prepare(`
                UPDATE documents 
                SET status = 'submitted', submitted_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(currentTime, id);

            return results;
        });

        const results = submitTransaction();

        console.log(`单据 ${document.document_number} 提交成功，处理了 ${results.length} 个产品`);

        res.json({
            success: true,
            message: '单据提交成功',
            document_number: document.document_number,
            items_processed: results.length,
            results
        });
    } catch (error) {
        console.error('提交单据失败:', error);
        res.status(500).json({ error: error.message || '提交单据失败' });
    }
});

/**
 * 取消单据
 * POST /api/documents/:id/cancel
 */
router.post('/:id/cancel', (req, res) => {
    try {
        const { id } = req.params;

        const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!document) {
            return res.status(404).json({ error: '单据不存在' });
        }

        if (document.status === 'cancelled') {
            return res.status(400).json({ error: '单据已经是取消状态' });
        }

        if (document.status === 'submitted') {
            return res.status(400).json({ error: '已提交的单据不能直接取消，请使用作废功能' });
        }

        // 删除关联的未提交交易记录
        db.prepare('DELETE FROM transactions WHERE document_id = ?').run(id);

        // 更新单据状态
        const currentTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
        db.prepare(`
            UPDATE documents 
            SET status = 'cancelled', cancelled_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(currentTime, id);

        res.json({ success: true, message: '单据已取消' });
    } catch (error) {
        console.error('取消单据失败:', error);
        res.status(500).json({ error: '取消单据失败' });
    }
});

/**
 * 删除草稿单据
 * DELETE /api/documents/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!document) {
            return res.status(404).json({ error: '单据不存在' });
        }

        if (document.status !== 'draft' && document.status !== 'cancelled') {
            return res.status(400).json({ error: '只能删除草稿或已取消的单据' });
        }

        // 删除关联的交易记录
        db.prepare('DELETE FROM transactions WHERE document_id = ?').run(id);

        // 删除图片文件
        if (document.image_path && fs.existsSync(document.image_path)) {
            try {
                fs.unlinkSync(document.image_path);
            } catch (e) {
                console.warn('删除图片失败:', e.message);
            }
        }

        // 删除单据
        db.prepare('DELETE FROM documents WHERE id = ?').run(id);

        res.json({ success: true, message: '单据已删除' });
    } catch (error) {
        console.error('删除单据失败:', error);
        res.status(500).json({ error: '删除单据失败' });
    }
});

// 辅助函数：更新单据统计信息
function updateDocumentStats(documentId) {
    const stats = db.prepare(`
        SELECT 
            COUNT(*) as item_count,
            COALESCE(SUM(quantity), 0) as total_quantity,
            COALESCE(SUM(total_price), 0) as total_value
        FROM transactions
        WHERE document_id = ?
    `).get(documentId);

    db.prepare(`
        UPDATE documents 
        SET item_count = ?, total_quantity = ?, total_value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        stats.item_count,
        PrecisionCalculator.formatStorage(stats.total_quantity),
        PrecisionCalculator.formatStorage(stats.total_value),
        documentId
    );
}

module.exports = router;
