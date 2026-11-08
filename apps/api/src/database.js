const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data/solidroute');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'solidroute.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'operator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS routers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    wg_ip TEXT NOT NULL,
    wg_pubkey TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migração segura caso a tabela users já exista sem as colunas role ou created_at
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userColumns.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'operator'");
    db.exec("UPDATE users SET role = 'admin' WHERE id = 1");
}
if (!userColumns.includes('created_at')) {
    db.exec("ALTER TABLE users ADD COLUMN created_at DATETIME");
}

// Garantir que o ID 1 (se existir) seja sempre admin
db.prepare("UPDATE users SET role = 'admin' WHERE id = 1").run();

// Criar usuário admin padrão caso não exista nenhum usuário
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

if (userCount === 0) {
    const defaultEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@solidroute.com';
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(defaultPassword, salt);

    db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(defaultEmail, hash, 'admin');
    console.log(`[INIT] Administrador padrão criado: ${defaultEmail}`);
}

module.exports = db;
