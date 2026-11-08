const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../database');

const INSECURE_SECRETS = new Set([
    'super-secret-key',
    'minha-chave-secreta-muito-segura',
    'altere-esta-chave-secreta-para-producao-12345',
    'sua-chave-jwt-segura',
    'changeme'
]);

function resolveJwtSecret() {
    const envSecret = process.env.JWT_SECRET ? process.env.JWT_SECRET.trim() : '';

    if (envSecret) {
        if (INSECURE_SECRETS.has(envSecret) || envSecret.length < 16) {
            console.error(
                '[FATAL] A variável JWT_SECRET definida no .env é insegura ou possui menos de 16 caracteres. ' +
                'Defina uma chave forte ou deixe JWT_SECRET em branco para geração automática segura.'
            );
            process.exit(1);
        }
        return envSecret;
    }

    // Se JWT_SECRET estiver em branco, gera e persiste uma chave criptográfica exclusiva no volume de dados
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../../data/solidroute');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const secretFile = path.join(dataDir, '.jwt_secret');

    try {
        if (fs.existsSync(secretFile)) {
            const saved = fs.readFileSync(secretFile, 'utf8').trim();
            if (saved.length >= 32) {
                return saved;
            }
        }
        const generated = crypto.randomBytes(48).toString('hex');
        fs.writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
        console.log('[INIT] JWT_SECRET exclusivo gerado automaticamente e persistido no volume de dados.');
        return generated;
    } catch (err) {
        console.error('[FATAL] Não foi possível ler ou persistir o JWT_SECRET:', err.message);
        process.exit(1);
    }
}

const JWT_SECRET = resolveJwtSecret();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(decoded.id);
        if (!currentUser) {
            return res.status(401).json({ error: 'Usuário não encontrado ou acesso revogado.' });
        }
        req.user = {
            id: currentUser.id,
            email: currentUser.email,
            role: currentUser.id === 1 ? 'admin' : (currentUser.role || 'operator')
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.id !== 1)) {
        return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requireAdmin = requireAdmin;
module.exports.JWT_SECRET = JWT_SECRET;
