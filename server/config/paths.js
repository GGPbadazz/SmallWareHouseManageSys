const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const serverDir = path.resolve(__dirname, '..');

function resolveFromRoot(value, fallback) {
    if (!value) {
        return fallback;
    }
    return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

const runtimeDataDir = resolveFromRoot(process.env.RUNTIME_DATA_DIR, path.join(rootDir, 'runtime-data'));
const databaseDir = resolveFromRoot(process.env.DB_DIR, path.join(runtimeDataDir, 'database'));
const uploadRoot = resolveFromRoot(process.env.UPLOAD_DIR, path.join(runtimeDataDir, 'uploads'));
const backupsDir = resolveFromRoot(process.env.BACKUP_DIR, path.join(runtimeDataDir, 'backups'));
const dbPath = resolveFromRoot(
    process.env.DB_PATH || process.env.DATABASE_PATH,
    path.join(databaseDir, 'inventory.db')
);

const documentUploadsDir = path.join(uploadRoot, 'documents');
const ocrTempDir = path.join(uploadRoot, 'ocr_temp');
const tempUploadDir = path.join(uploadRoot, 'temp');

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function normalizePath(filePath) {
    return String(filePath || '').replace(/\\/g, '/');
}

function getUploadRelativePath(storedPath) {
    const normalized = normalizePath(storedPath);
    if (!normalized) {
        return null;
    }

    const appPrefix = '/app/uploads/';
    if (normalized.startsWith(appPrefix)) {
        return normalized.slice(appPrefix.length);
    }

    const uploadRootPrefix = normalizePath(uploadRoot) + '/';
    if (normalized.startsWith(uploadRootPrefix)) {
        return normalized.slice(uploadRootPrefix.length);
    }

    const legacyServerPrefix = normalizePath(path.join(serverDir, 'uploads')) + '/';
    if (normalized.startsWith(legacyServerPrefix)) {
        return normalized.slice(legacyServerPrefix.length);
    }

    if (normalized.startsWith('uploads/')) {
        return normalized.slice('uploads/'.length);
    }

    if (normalized.startsWith('documents/') || normalized.startsWith('ocr_temp/') || normalized.startsWith('temp/')) {
        return normalized;
    }

    return null;
}

function resolveUploadPath(storedPath) {
    if (!storedPath) {
        return null;
    }

    const relativePath = getUploadRelativePath(storedPath);
    if (relativePath) {
        return path.join(uploadRoot, relativePath);
    }

    return path.isAbsolute(storedPath) ? storedPath : path.join(uploadRoot, storedPath);
}

function toStoredUploadPath(filePath) {
    const relativePath = path.relative(uploadRoot, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return filePath;
    }
    return normalizePath(relativePath);
}

module.exports = {
    rootDir,
    serverDir,
    runtimeDataDir,
    databaseDir,
    uploadRoot,
    backupsDir,
    dbPath,
    documentUploadsDir,
    ocrTempDir,
    tempUploadDir,
    ensureDir,
    resolveUploadPath,
    toStoredUploadPath
};
