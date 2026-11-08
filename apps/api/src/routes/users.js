const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/authMiddleware');

// Todas as rotas de usuários exigem autenticação JWT
router.use(authMiddleware);

// Listar todos os usuários
router.get('/', (req, res) => {
    try {
        const users = db.prepare('SELECT id, email, role, created_at FROM users ORDER BY id ASC').all();
        const normalized = users.map(u => ({
            ...u,
            role: u.id === 1 ? 'admin' : (u.role || 'operator')
        }));
        res.json(normalized);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
});

// Criar um novo usuário (Restrito a Administradores)
router.post('/', requireAdmin, (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const userRole = role === 'admin' ? 'admin' : 'operator';

    try {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);

        const stmt = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)');
        const result = stmt.run(email.trim(), hash, userRole);

        res.status(201).json({
            id: result.lastInsertRowid,
            email: email.trim(),
            role: userRole
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Este email já está em uso.' });
        }
        res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
});

// Alterar senha ou nível de acesso de um usuário (Restrito a Administradores)
router.put('/:id', requireAdmin, (req, res) => {
    const targetId = Number(req.params.id);
    const { password, role } = req.body;

    try {
        const targetUser = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(targetId);
        if (!targetUser) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
            }
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(password, salt);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, targetId);
        }

        if (role && targetId !== 1) {
            const newRole = role === 'admin' ? 'admin' : 'operator';
            db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, targetId);
        }

        res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
});

// Deletar um usuário (Restrito a Administradores)
router.delete('/:id', requireAdmin, (req, res) => {
    const userId = Number(req.params.id);

    if (userId === 1) {
        return res.status(403).json({ error: 'Não é possível deletar o administrador principal.' });
    }

    if (userId === req.user.id) {
        return res.status(400).json({ error: 'Você não pode remover a sua própria conta.' });
    }

    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar usuário.' });
    }
});

module.exports = router;
