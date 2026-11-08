const express = require('express');
const router = express.Router();
const db = require('../database');
const wgEasyService = require('../services/wgEasyService');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas as rotas de roteadores exigem que o usuário esteja logado
router.use(authMiddleware);

// Lista todos os roteadores cadastrados no banco local e cruza o status com o WG-Easy
router.get('/', async (req, res) => {
    try {
        const routers = db.prepare('SELECT * FROM routers ORDER BY created_at DESC').all();
        const { clients: wgClients, wgAvailable } = await wgEasyService.getClients();

        const wgClientsMap = {};
        for (const c of wgClients) {
            wgClientsMap[c.name] = c.latestHandshakeAt;
        }

        const now = new Date();
        const routersWithStatus = routers.map(r => {
            const cleanIp = r.wg_ip ? r.wg_ip.split('/')[0].trim() : r.wg_ip;

            if (!wgAvailable) {
                return {
                    ...r,
                    wg_ip: cleanIp,
                    isOnline: false,
                    statusUnknown: true
                };
            }

            const handshake = wgClientsMap[r.name];
            let isOnline = false;

            if (handshake) {
                const handshakeDate = new Date(handshake);
                const diffMs = now - handshakeDate;
                // Considera Online se o handshake ocorreu nos últimos 3 minutos (180000 ms)
                if (diffMs < 180000) {
                    isOnline = true;
                }
            }

            return {
                ...r,
                wg_ip: cleanIp,
                isOnline,
                statusUnknown: false,
                latestHandshakeAt: handshake || null
            };
        });

        res.set('X-WG-Status', wgAvailable ? 'online' : 'unreachable');
        res.json(routersWithStatus);
    } catch (error) {
        console.error('Erro ao buscar roteadores:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados.' });
    }
});

// Lista peers existentes no WG-Easy que ainda não estão cadastrados no banco local (para seleção antes de importar)
router.get('/sync/preview', async (req, res) => {
    try {
        const { clients: wgClients, wgAvailable } = await wgEasyService.getClients();
        if (!wgAvailable) {
            return res.status(503).json({ error: 'Servidor WG-Easy indisponível no momento.' });
        }

        const existingNames = new Set(
            db.prepare('SELECT name FROM routers').all().map(r => r.name)
        );

        const availablePeers = wgClients
            .filter(c => c.name && c.address && !existingNames.has(c.name))
            .map(c => ({
                id: c.id,
                name: c.name,
                address: String(c.address).split('/')[0].trim(),
                publicKey: c.publicKey || ''
            }));

        res.json({ availablePeers });
    } catch (error) {
        console.error('Erro ao buscar prévia de sincronização:', error);
        res.status(500).json({ error: 'Erro ao consultar peers no WireGuard.' });
    }
});

// Importa peers selecionados (ou todos os pendentes) do WG-Easy para o banco SQLite
router.post('/sync', async (req, res) => {
    try {
        const { names } = req.body || {};
        const { clients: wgClients, wgAvailable } = await wgEasyService.getClients();
        if (!wgAvailable) {
            return res.status(503).json({ error: 'Servidor WG-Easy indisponível no momento.' });
        }

        const selectedSet = Array.isArray(names) ? new Set(names) : null;
        let imported = 0;
        const insertStmt = db.prepare('INSERT INTO routers (name, wg_ip, wg_pubkey) VALUES (?, ?, ?)');

        for (const client of wgClients) {
            if (selectedSet && !selectedSet.has(client.name)) {
                continue;
            }
            const exists = db.prepare('SELECT id FROM routers WHERE name = ?').get(client.name);
            if (!exists && client.address) {
                const cleanIp = String(client.address).split('/')[0].trim();
                insertStmt.run(client.name, cleanIp, client.publicKey || '');
                imported++;
            }
        }

        res.json({ success: true, imported });
    } catch (error) {
        console.error('Erro ao sincronizar roteadores:', error);
        res.status(500).json({ error: 'Erro ao sincronizar com o WireGuard.' });
    }
});

// Rota principal de adoção (com rollback completo caso ocorra falha após criar no WG-Easy)
router.post('/adopt', async (req, res) => {
    const rawName = req.body.name;
    const name = rawName ? String(rawName).trim() : '';

    if (!name) {
        return res.status(400).json({ error: 'O nome do roteador é obrigatório.' });
    }

    let createdClientId = null;
    let peerCreationAttempted = false;

    try {
        const existing = db.prepare('SELECT id FROM routers WHERE name = ?').get(name);
        if (existing) {
            return res.status(400).json({
                error: 'Já existe um Mikrotik adotado com este nome. Por favor, remova-o antes de gerar novamente.'
            });
        }

        // 1. Cria o cliente no WireGuard (WG-Easy)
        peerCreationAttempted = true;
        const wgClientData = await wgEasyService.createClient(name);
        createdClientId = wgClientData.id;

        if (!createdClientId) {
            throw new Error('Falha ao capturar o ID do cliente recém-criado no WireGuard.');
        }

        // 2. Obtém a configuração (.conf) e extrai as chaves
        const keys = await wgEasyService.getClientConfig(createdClientId);

        if (!keys.privateKey || !keys.address) {
            throw new Error('Falha ao extrair informações vitais do arquivo de configuração gerado.');
        }

        // Salva o IP normalizado (sem máscara /24) no banco para consistência visual,
        // mantendo o endereço com máscara no wgConfig para geração do script RouterOS
        const cleanIp = keys.address.split('/')[0].trim();
        const addressWithMask = keys.address.includes('/') ? keys.address : `${cleanIp}/24`;
        const wgPubkey = keys.publicKey;

        // 3. Salva no banco de dados SQLite
        const insertStmt = db.prepare('INSERT INTO routers (name, wg_ip, wg_pubkey) VALUES (?, ?, ?)');
        const result = insertStmt.run(name, cleanIp, wgPubkey);

        const savedRouter = {
            id: result.lastInsertRowid,
            name,
            wg_ip: cleanIp,
            wg_pubkey: wgPubkey
        };

        // 4. Devolve tudo para o Frontend compor o Script RouterOS
        res.json({
            router: savedRouter,
            wgConfig: {
                ...keys,
                address: addressWithMask
            }
        });
    } catch (error) {
        // Rollback completo: se o peer foi criado por ID ou tentativa de nome, remove o órfão no WG-Easy
        if (createdClientId) {
            await wgEasyService.deleteClientById(createdClientId);
        } else if (peerCreationAttempted) {
            await wgEasyService.deleteClientByName(name);
        }
        console.error('Erro no fluxo de adoção:', error);
        res.status(500).json({ error: error.message || 'Ocorreu um erro durante a adoção.' });
    }
});

// Remove um roteador adotado
router.delete('/:id', async (req, res) => {
    try {
        const routerId = req.params.id;
        const routerData = db.prepare('SELECT name FROM routers WHERE id = ?').get(routerId);

        if (!routerData) {
            return res.status(404).json({ error: 'Roteador não encontrado.' });
        }

        try {
            await wgEasyService.deleteClientByName(routerData.name);
        } catch (wgErr) {
            console.error('Falha ao remover cliente no WG-Easy:', wgErr);
        }

        db.prepare('DELETE FROM routers WHERE id = ?').run(routerId);

        res.json({ success: true, message: 'Roteador removido com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar roteador:', error);
        res.status(500).json({ error: 'Erro interno ao remover roteador.' });
    }
});

module.exports = router;
