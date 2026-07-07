function tableExists(db, tableName) {
    const row = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = ?
    `).get(tableName);
    return !!row;
}

function columnExists(db, tableName, columnName) {
    if (!tableExists(db, tableName)) {
        return false;
    }
    return db.prepare(`PRAGMA table_info(${tableName})`)
        .all()
        .some(column => column.name === columnName);
}

function ensureColumn(db, tableName, columnName, alterSql) {
    if (tableExists(db, tableName) && !columnExists(db, tableName, columnName)) {
        db.exec(alterSql);
    }
}

function createIndexIfTableExists(db, tableName, indexSql) {
    if (tableExists(db, tableName)) {
        db.exec(indexSql);
    }
}

const migrations = [
    {
        id: '20260702_001_compatibility_columns',
        run(db) {
            ensureColumn(
                db,
                'deleted_transactions_log',
                'document_id',
                'ALTER TABLE deleted_transactions_log ADD COLUMN document_id INTEGER'
            );
            ensureColumn(
                db,
                'transactions',
                'document_id',
                'ALTER TABLE transactions ADD COLUMN document_id INTEGER REFERENCES documents(id)'
            );
            ensureColumn(
                db,
                'transactions',
                'document_number',
                'ALTER TABLE transactions ADD COLUMN document_number TEXT'
            );
            ensureColumn(
                db,
                'documents',
                'supplier',
                'ALTER TABLE documents ADD COLUMN supplier TEXT'
            );
            ensureColumn(
                db,
                'documents',
                'notes',
                'ALTER TABLE documents ADD COLUMN notes TEXT'
            );
        }
    },
    {
        id: '20260702_002_core_query_indexes',
        run(db) {
            createIndexIfTableExists(db, 'transactions', 'CREATE INDEX IF NOT EXISTS idx_transactions_product_created ON transactions(product_id, created_at)');
            createIndexIfTableExists(db, 'transactions', 'CREATE INDEX IF NOT EXISTS idx_transactions_document ON transactions(document_id)');
            createIndexIfTableExists(db, 'transactions', 'CREATE INDEX IF NOT EXISTS idx_transactions_type_created ON transactions(type, created_at)');
            createIndexIfTableExists(db, 'transactions', 'CREATE INDEX IF NOT EXISTS idx_transactions_project_created ON transactions(project_id, created_at)');
            createIndexIfTableExists(db, 'documents', 'CREATE INDEX IF NOT EXISTS idx_documents_status_created ON documents(status, created_at)');
            createIndexIfTableExists(db, 'documents', 'CREATE INDEX IF NOT EXISTS idx_documents_type_created ON documents(document_type, created_at)');
            createIndexIfTableExists(db, 'documents', 'CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at)');
            createIndexIfTableExists(db, 'products', 'CREATE INDEX IF NOT EXISTS idx_products_category_name ON products(category_id, name)');
            createIndexIfTableExists(db, 'products', 'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
        }
    }
];

function runMigrations(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const applied = new Set(
        db.prepare('SELECT id FROM schema_migrations').all().map(row => row.id)
    );
    const insertMigration = db.prepare('INSERT INTO schema_migrations (id) VALUES (?)');

    for (const migration of migrations) {
        if (applied.has(migration.id)) {
            continue;
        }

        const transaction = db.transaction(() => {
            migration.run(db);
            insertMigration.run(migration.id);
        });
        transaction();
        console.log(`Database migration applied: ${migration.id}`);
    }
}

module.exports = {
    runMigrations
};
