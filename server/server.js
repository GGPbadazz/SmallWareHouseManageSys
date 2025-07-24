const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// 设置时区为中国标准时间
process.env.TZ = 'Asia/Shanghai';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline styles and scripts for the HTML interface
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5715',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the HTML interface at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ledger', require('./routes/ledger'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0' 
    });
});

// Add route for statistics endpoint that matches the frontend call
app.get('/api/products/stats', async (req, res) => {
    try {
        const db = require('./database/connection');
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockItems = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock').get().count;
        
        // Get today's transactions
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM transactions 
            WHERE DATE(created_at) = ?
        `).get(today).count;
        
        // Calculate total inventory value
        const totalValue = db.prepare('SELECT SUM(stock * price) as total FROM products WHERE price IS NOT NULL').get().total || 0;
        
        res.json({
            totalProducts: totalProducts,
            lowStockItems: lowStockItems,
            todayTransactions: todayTransactions,
            totalValue: Math.round(totalValue * 100) / 100
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error' 
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// Catch all handler - redirect to main app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Database: ${process.env.DB_PATH}`);
    console.log(`Web interface available at: http://localhost:${PORT}`);
    
    // Initialize database if needed
    try {
        require('./scripts/init-db');
    } catch (error) {
        console.log('Database already initialized or error:', error.message);
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
