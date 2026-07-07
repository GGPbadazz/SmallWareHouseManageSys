const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { runMigrations } = require('./database/migrations');
const { authenticateToken } = require('./middleware/auth');
const { dbPath, uploadRoot, backupsDir, ensureDir } = require('./config/paths');
const { initializeDatabaseIfNeeded } = require('./init-database');

// 设置时区为中国标准时间
process.env.TZ = 'Asia/Shanghai';

initializeDatabaseIfNeeded();
const db = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 3003;
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline styles and scripts for the HTML interface
}));

const allowedOrigins = (process.env.APP_ORIGIN || 'http://localhost:8080,http://localhost:5715')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Rate limiting - 更宽松的配置以支持批量操作
const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes window
    max: 5000, // limit each IP to 5000 requests per windowMs (大幅增加)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req, res) => {
        // 跳过健康检查和静态文件的限制
        return req.url.includes('/health') || req.url.includes('/static');
    }
});

// 为批量操作创建更宽松的限制器
const batchLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window for batch operations
    max: 2000, // 2000 requests per minute for batch operations (大幅增加)
    message: 'Too many batch requests, please slow down your operations.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        // 对特定的批量操作路径跳过限制
        return req.url.includes('/batch') || 
               req.url.includes('/import') ||
               req.url.includes('/sync') ||
               req.url.includes('/stats');
    }
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In native deployment Nginx/Caddy should serve the frontend. This fallback
// only serves the current Vue build when client/dist is present.
app.use(express.static(clientDistPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0' 
    });
});

app.get('/', (req, res) => {
    if (fs.existsSync(clientIndexPath)) {
        return res.sendFile(clientIndexPath);
    }

    res.json({
        name: 'BARCODESYS API',
        status: 'running',
        health: '/api/health'
    });
});

// Routes - 登录和健康检查为公开接口，其余业务API统一鉴权
app.use('/api/auth', require('./routes/auth'));
app.use('/api', authenticateToken);
app.use('/api/products', batchLimiter, require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/transactions', batchLimiter, require('./routes/transactions'));
app.use('/api/documents', batchLimiter, require('./routes/documents')); // 单据管理
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ledger', batchLimiter, require('./routes/ledger'));
app.use('/api/snapshots', require('./routes/snapshots'));
app.use('/api/init', require('./routes/init'));
app.use('/api/ocr', require('./routes/ocr')); // OCR识别服务

// 静态文件服务 - 单据图片
app.use('/uploads', express.static(uploadRoot));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error' 
    });
});

// 404 handler for API routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

app.use((req, res) => {
    if (req.accepts('html') && fs.existsSync(clientIndexPath)) {
        return res.sendFile(clientIndexPath);
    }

    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Database: ${dbPath}`);
    console.log(`Uploads: ${uploadRoot}`);
    console.log(`Backups: ${backupsDir}`);
    console.log(`Web interface available at: http://localhost:${PORT}`);
    
    ensureDir(uploadRoot);
    ensureDir(backupsDir);

    try {
        runMigrations(db);
    } catch (error) {
        console.error('数据库迁移失败:', error.message);
        process.exitCode = 1;
        return;
    }
    
    // 初始化快照表
    try {
        const { createMonthlySnapshotTable } = require('./scripts/create-snapshot-table');
        createMonthlySnapshotTable();
    } catch (error) {
        console.error('初始化快照表失败:', error.message);
    }
    
    // 启动月度快照定时任务
    try {
        const { scheduleMonthlySnapshot } = require('./jobs/monthly-snapshot-job');
        scheduleMonthlySnapshot();
    } catch (error) {
        console.error('启动月度快照定时任务失败:', error.message);
    }
    
    // 启动自动备份调度器
    try {
        const backupService = require('./services/backupService');
        backupService.startAutoBackupScheduler();
    } catch (error) {
        console.error('启动备份调度器失败:', error.message);
    }
});

module.exports = app;
