const Database = require('better-sqlite3');
const { dbPath, databaseDir, ensureDir } = require('../config/paths');

ensureDir(databaseDir);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Optimize database performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

module.exports = db;
