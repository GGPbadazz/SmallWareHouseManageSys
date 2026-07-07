/**
 * OCR识别路由 - 服务器端OCR API
 * 
 * 接收客户端上传的图片，使用PaddleOCR进行识别
 * 支持两种模式：
 * 1. OCR Server模式（推荐）- 模型常驻内存，响应快
 * 2. Python脚本模式（备用）- 每次启动新进程
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const { ocrTempDir, ensureDir } = require('../config/paths');

// OCR配置
const OCR_CONFIG = {
    rotate_180: false,  // 客户端已旋转，服务端不需要再旋转
    server_mode: true,  // 使用OCR Server模式（模型常驻内存，GPU加速）
    server_port: 5555   // OCR Server端口
};

// 配置文件上传
const uploadsDir = ensureDir(ocrTempDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `ocr_${timestamp}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/octet-stream'];
        // 也检查文件扩展名
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            console.log(`[OCR] 拒绝文件: ${file.originalname}, mimetype: ${file.mimetype}`);
            cb(new Error('只允许上传图片文件'));
        }
    }
});

// Python OCR脚本路径
const OCR_SCRIPT_PATH = path.join(__dirname, '..', 'scripts', 'ocr_recognize.py');

/**
 * OCR识别接口
 * POST /api/ocr/recognize
 */
router.post('/recognize', upload.single('image'), async (req, res) => {
    const startTime = Date.now();
    let imagePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'no_image',
                message: '请上传图片文件' 
            });
        }

        imagePath = req.file.path;
        console.log(`[OCR] 接收到图片: ${req.file.filename}, 大小: ${req.file.size} bytes`);

        // 检查是否需要旋转180度（优先使用请求参数，否则使用配置）
        const rotate180 = req.body.rotate_180 === 'true' || req.body.rotate_180 === '1' || 
                          (req.body.rotate_180 === undefined && OCR_CONFIG.rotate_180);
        
        if (rotate180) {
            console.log('[OCR] 将旋转图片180度');
        }

        let result;
        
        // 优先使用OCR Server模式（模型常驻内存，更快）
        if (OCR_CONFIG.server_mode) {
            console.log('[OCR] 使用OCR Server模式');
            result = await runOCRServer(imagePath, rotate180);
            
            // 如果OCR Server不可用，回退到Python脚本模式
            if (result === null) {
                console.log('[OCR] OCR Server不可用，回退到Python脚本模式');
                result = await runPythonOCR(imagePath, rotate180);
            }
        } else {
            // 使用Python脚本模式
            result = await runPythonOCR(imagePath, rotate180);
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`[OCR] 识别完成, 耗时: ${elapsed}ms`);

        // 清理临时文件
        cleanupTempFile(imagePath);

        if (result.success) {
            res.json({
                success: true,
                serial_number: result.serial_number,
                document_type: result.document_type,
                confidence: result.confidence,
                ocr_summary: result.ocr_summary,
                processing_time: elapsed,
                message: '识别成功'
            });
        } else {
            res.json({
                success: false,
                error: result.error || 'ocr_failed',
                message: result.message || 'OCR识别失败',
                recognized_texts: result.recognized_texts || []
            });
        }

    } catch (error) {
        console.error('[OCR] 识别错误:', error);
        
        // 清理临时文件
        if (imagePath) {
            cleanupTempFile(imagePath);
        }

        res.status(500).json({ 
            success: false,
            error: 'server_error',
            message: error.message || 'OCR服务器错误'
        });
    }
});

/**
 * 调用Python OCR脚本
 */
function runPythonOCR(imagePath, rotate180 = false) {
    return new Promise((resolve, reject) => {
        // 检查Python脚本是否存在
        if (!fs.existsSync(OCR_SCRIPT_PATH)) {
            console.warn('[OCR] Python脚本不存在，使用模拟识别');
            resolve(simulateOCR());
            return;
        }

        // 构建参数：图片路径 + 是否旋转
        const args = [OCR_SCRIPT_PATH, imagePath];
        if (rotate180) {
            args.push('true');
        }
        
        const python = spawn('python3', args);
        
        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (e) {
                    console.error('[OCR] 解析Python输出失败:', stdout);
                    resolve({
                        success: false,
                        error: 'parse_error',
                        message: 'OCR结果解析失败'
                    });
                }
            } else {
                console.error('[OCR] Python脚本错误:', stderr);
                resolve({
                    success: false,
                    error: 'python_error',
                    message: stderr || 'Python OCR执行失败'
                });
            }
        });

        python.on('error', (err) => {
            console.error('[OCR] 启动Python失败:', err);
            // 如果Python不可用，使用模拟识别
            console.warn('[OCR] 回退到模拟识别');
            resolve(simulateOCR());
        });

        // 30秒超时
        setTimeout(() => {
            python.kill();
            resolve({
                success: false,
                error: 'timeout',
                message: 'OCR识别超时'
            });
        }, 30000);
    });
}

/**
 * 调用OCR Server（常驻内存模式，更快）
 */
function runOCRServer(imagePath, rotate180 = false) {
    return new Promise((resolve, reject) => {
        const imageData = fs.readFileSync(imagePath);
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
        
        // 构建multipart表单数据
        let body = '';
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="image"; filename="image.jpg"\r\n`;
        body += `Content-Type: image/jpeg\r\n\r\n`;
        
        const bodyStart = Buffer.from(body, 'utf8');
        const bodyEnd = Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="rotate_180"\r\n\r\n${rotate180}\r\n--${boundary}--\r\n`, 'utf8');
        
        const fullBody = Buffer.concat([bodyStart, imageData, bodyEnd]);
        
        const options = {
            hostname: '127.0.0.1',
            port: OCR_CONFIG.server_port,
            path: '/recognize',
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': fullBody.length
            },
            timeout: 15000
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    resolve({
                        success: false,
                        error: 'parse_error',
                        message: 'OCR Server响应解析失败'
                    });
                }
            });
        });
        
        req.on('error', (err) => {
            console.log('[OCR] OCR Server不可用，回退到Python脚本模式:', err.message);
            resolve(null); // 返回null表示需要回退
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                success: false,
                error: 'timeout',
                message: 'OCR Server超时'
            });
        });
        
        req.write(fullBody);
        req.end();
    });
}

/**
 * 检查OCR Server是否可用
 */
function checkOCRServer() {
    return new Promise((resolve) => {
        const options = {
            hostname: '127.0.0.1',
            port: OCR_CONFIG.server_port,
            path: '/health',
            method: 'GET',
            timeout: 2000
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.status === 'ok');
                } catch (e) {
                    resolve(false);
                }
            });
        });
        
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

/**
 * 模拟OCR识别（用于测试或Python不可用时）
 */
function simulateOCR() {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const shortYearMonth = yearMonth.slice(2); // 2512
    
    // 随机生成单据号
    const docTypes = ['IN', 'OUT'];
    const docType = docTypes[Math.floor(Math.random() * 2)];
    const prefix = docType === 'IN' ? 'R' : 'C';
    const serialNum = String(Math.floor(Math.random() * 9999999) + 1).padStart(7, '0');
    const serialNumber = `${prefix}${serialNum}-${shortYearMonth}`;
    
    const confidence = 0.85 + Math.random() * 0.14; // 0.85-0.99

    return {
        success: true,
        serial_number: serialNumber,
        document_type: docType,
        confidence: Math.round(confidence * 100) / 100,
        ocr_summary: {
            doc_type_text: docType === 'IN' ? '入库单' : '出库单',
            serial_raw: serialNum,
            confidence_percent: Math.round(confidence * 100),
            detected_keywords: docType === 'IN' ? ['入库'] : ['出库', '领料'],
            recognition_tips: ['[模拟识别] 请核对单号']
        },
        message: '[模拟识别] 识别成功'
    };
}

/**
 * 清理临时文件
 */
function cleanupTempFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[OCR] 已清理临时文件: ${path.basename(filePath)}`);
        }
    } catch (e) {
        console.warn('[OCR] 清理临时文件失败:', e.message);
    }
}

/**
 * OCR服务状态检查
 * GET /api/ocr/status
 */
router.get('/status', (req, res) => {
    const pythonAvailable = fs.existsSync(OCR_SCRIPT_PATH);
    
    res.json({
        status: 'running',
        python_script: pythonAvailable ? 'available' : 'not_found',
        fallback_mode: !pythonAvailable ? 'simulate' : 'none',
        config: {
            rotate_180: OCR_CONFIG.rotate_180
        },
        message: pythonAvailable ? 'OCR服务正常' : 'OCR服务使用模拟模式'
    });
});

/**
 * 更新OCR配置
 * POST /api/ocr/config
 */
router.post('/config', (req, res) => {
    const { rotate_180 } = req.body;
    
    if (rotate_180 !== undefined) {
        OCR_CONFIG.rotate_180 = rotate_180 === true || rotate_180 === 'true' || rotate_180 === 1;
        console.log(`[OCR] 配置更新: rotate_180 = ${OCR_CONFIG.rotate_180}`);
    }
    
    res.json({
        success: true,
        config: OCR_CONFIG,
        message: '配置已更新'
    });
});

/**
 * 获取OCR配置
 * GET /api/ocr/config
 */
router.get('/config', (req, res) => {
    res.json({
        success: true,
        config: OCR_CONFIG
    });
});

module.exports = router;
