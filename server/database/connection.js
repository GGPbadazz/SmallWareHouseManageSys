const Database = require('better-sqlite3');
const path = require('path');

// Ensure the path is relative to the server directory, not the current working directory
const dbPath = process.env.DB_PATH 
    ? (path.isAbsolute(process.env.DB_PATH) 
        ? process.env.DB_PATH 
        : path.join(__dirname, '..', process.env.DB_PATH))
    : path.join(__dirname, 'inventory.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Optimize database performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

module.exports = db;
