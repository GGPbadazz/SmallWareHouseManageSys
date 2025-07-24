const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || './database/inventory.db';
const db = new Database(path.resolve(dbPath));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Optimize database performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

module.exports = db;
