const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const authMiddleware = require('../middlewares/authMiddleware');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

const PROXY_PORT = Number(process.env.PROXY_PORT) || 58123;

// Rate limiter em memória contra força bruta no login (chaveado por IP + email para evitar bloqueio global atrás de NAT)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const getAttemptKey = (req) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : 'unknown';
    return `${ip}:${email}`;
};

const checkRateLimit = (req, res, next) => {
    const key = getAttemptKey(req);
    const now = Date.now();
    const record = loginAttempts.get(key);

    if (record) {
        if (now - record.firstAttempt > WINDOW_MS) {
            loginAttempts.delete(key);
        } else if (record.count >= MAX_ATTEMPTS) {
            const waitMin = Math.ceil((WINDOW_MS - (now - record.firstAttempt)) / 60000);
            return res.status(429).json({
                error: `Muitas tentativas inválidas para este usuário. Aguarde ${waitMin} minuto(s) antes de tentar novamente.`
            });
        }
    }
    next();
};

const registerFailedAttempt = (key) => {
    const now = Date.now();
    const record = loginAttempts.get(key);
    if (!record || now - record.firstAttempt > WINDOW_MS) {
        loginAttempts.set(key, { count: 1, firstAttempt: now });
    } else {
        record.count += 1;
    }
};

router.post('/login', checkRateLimit, (req, res) => {
    const { email, password } = req.body;
    const key = getAttemptKey(req);

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim());

        if (!user) {
            registerFailedAttempt(key);
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const passwordMatch = bcrypt.compareSync(password, user.password_hash);

        if (!passwordMatch) {
            registerFailedAttempt(key);
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        loginAttempts.delete(key);

        const role = user.id === 1 ? 'admin' : (user.role || 'operator');
        const token = jwt.sign(
            { id: user.id, email: user.email, role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: { id: user.id, email: user.email, role },
            proxyPort: PROXY_PORT
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// Rota para validar o token na inicialização e retornar dados do usuário logado
router.get('/me', authMiddleware, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.id === 1 ? 'admin' : (req.user.role || 'operator')
        },
        proxyPort: PROXY_PORT
    });
});

// Rota para o próprio usuário alterar sua senha
router.put('/password', authMiddleware, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'A senha atual e a nova senha são obrigatórias.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const passwordMatch = bcrypt.compareSync(currentPassword, user.password_hash);
        if (!passwordMatch) {
            // Retorna 400 (Bad Request) em vez de 401 para não derrubar a sessão ativa do usuário no frontend
            return res.status(400).json({ error: 'A senha atual digitada está incorreta.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(newPassword, salt);

        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
        res.json({ success: true, message: 'Senha atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Erro interno ao alterar a senha.' });
    }
});

module.exports = router;
