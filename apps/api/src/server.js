require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./database');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { JWT_SECRET } = require('./middlewares/authMiddleware');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PROXY_PORT = Number(process.env.PROXY_PORT) || 58123;
const WEBFIG_PORT = Number(process.env.WEBFIG_PORT) || 8123;

// Habilita CORS apenas se origens externas forem explicitamente configuradas via CORS_ORIGIN
if (process.env.CORS_ORIGIN) {
    app.use(cors({
        origin: process.env.CORS_ORIGIN.split(',').map(o => o.trim()),
        credentials: true
    }));
}

app.use('/api', express.json());

// Rotas da API
const authRoutes = require('./routes/auth');
const routerRoutes = require('./routes/routers');
const userRoutes = require('./routes/users');

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/routers', routerRoutes);
app.use('/api/users', userRoutes);

// Qualquer rota /api/* não encontrada retorna 404 JSON em vez do index.html
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

// Função utilitária para ler cookies
const parseCookies = (cookieHeader = '') => {
    const list = {};
    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
            try {
                list[key] = decodeURIComponent(parts.join('=').trim());
            } catch (e) {
                list[key] = parts.join('=').trim();
            }
        }
    });
    return list;
};

// Valida se o IP alvo pertence a um roteador cadastrado no banco SQLite
const isAuthorizedRouterIp = (ip) => {
    if (!ip || typeof ip !== 'string') return false;
    const cleanIp = ip.split('/')[0].trim();
    const row = db.prepare(
        'SELECT id FROM routers WHERE wg_ip = ? OR wg_ip LIKE ? LIMIT 1'
    ).get(cleanIp, `${cleanIp}/%`);
    return Boolean(row);
};

// Servidor Proxy Dedicado para o WebFig (Rodando na porta PROXY_PORT, padrão 58123)
// Exige cookie proxyAuth (JWT válido) e proxyTarget (IP registrado no banco de roteadores)
const proxyApp = express();

const dynamicWebfigProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${WEBFIG_PORT}`,
    changeOrigin: true,
    router: (req) => {
        return `http://${req.targetRouterIp}:${WEBFIG_PORT}`;
    },
    onProxyReq: (proxyReq, req) => {
        // Remove os cookies internos do SolidRoute (proxyAuth e proxyTarget) antes de encaminhar ao Mikrotik
        const rawCookie = req.headers.cookie;
        if (rawCookie) {
            const filtered = rawCookie
                .split(';')
                .map(c => c.trim())
                .filter(c => !c.startsWith('proxyAuth=') && !c.startsWith('proxyTarget='));

            if (filtered.length > 0) {
                proxyReq.setHeader('Cookie', filtered.join('; '));
            } else {
                proxyReq.removeHeader('Cookie');
            }
        }
    },
    onError: (err, req, res) => {
        console.error('[Proxy WebFig] Erro ao conectar no Mikrotik:', err.message);
        if (res && !res.headersSent) {
            res.status(502).send(
                '<html><body style="background:#1E1E1E;color:#EDEEF1;font-family:sans-serif;padding:40px;">' +
                '<h2 style="color:#EF4444;">Não foi possível conectar ao WebFig do Mikrotik</h2>' +
                '<p>Verifique se o equipamento está online na VPN e se o serviço HTTP (www) está ativo na porta ' + WEBFIG_PORT + '.</p>' +
                '</body></html>'
            );
        }
    }
});

proxyApp.use('/', (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.proxyAuth;
    const targetIp = cookies.proxyTarget ? cookies.proxyTarget.split('/')[0].trim() : null;

    if (!token) {
        return res.status(401).send(
            '<html><body style="background:#1E1E1E;color:#EDEEF1;font-family:sans-serif;padding:40px;">' +
            '<h2>Acesso não autorizado ao Proxy WebFig</h2>' +
            '<p>Sua sessão não foi identificada. Volte ao painel SolidRoute, faça login e clique no botão <b>WebFig</b> novamente.</p>' +
            '</body></html>'
        );
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.id);
        if (!userExists) {
            return res.status(401).send(
                '<html><body style="background:#1E1E1E;color:#EDEEF1;font-family:sans-serif;padding:40px;">' +
                '<h2>Sessão inválida. Faça login novamente no painel SolidRoute.</h2>' +
                '</body></html>'
            );
        }
    } catch (err) {
        return res.status(401).send(
            '<html><body style="background:#1E1E1E;color:#EDEEF1;font-family:sans-serif;padding:40px;">' +
            '<h2>Sessão expirada</h2>' +
            '<p>Volte ao painel SolidRoute e clique no botão <b>WebFig</b> novamente para renovar o acesso.</p>' +
            '</body></html>'
        );
    }

    if (!targetIp) {
        return res.status(404).send(
            '<html><body style="background:#1E1E1E;color:#EDEEF1;font-family:sans-serif;padding:40px;">' +
            '<h2>Nenhum Mikrotik selecionado</h2>' +
            '<p>Volte ao painel SolidRoute e clique no botão <b>WebFig</b> do equipamento desejado.</p>' +
            '</body></html>'
        );
    }

    if (!isAuthorizedRouterIp(targetIp)) {
        return res.status(403).send(
            '<html><body style="background:#1E1E1E;color:#EDEEF1;font-family:sans-serif;padding:40px;">' +
            '<h2 style="color:#EF4444;">Destino bloqueado pelo Proxy</h2>' +
            '<p>O endereço IP solicitado não pertence a nenhum roteador adotado no painel SolidRoute.</p>' +
            '</body></html>'
        );
    }

    req.targetRouterIp = targetIp;
    return dynamicWebfigProxy(req, res, next);
});

proxyApp.listen(PROXY_PORT, () => {
    console.log(`Servidor Proxy Dedicado (WebFig) rodando na porta ${PROXY_PORT}`);
});

// Servir Frontend (React) - A pasta public será preenchida pelo Docker Build
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`SolidRoute Server principal rodando na porta ${PORT}`);
});
