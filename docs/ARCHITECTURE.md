# Arquitetura Técnica do SolidRoute

Documento de referência sobre o funcionamento interno dos serviços que compõem o SolidRoute.

## Visão Geral dos Módulos

```text
SolidRoute/
├── apps/
│   ├── api/                  # Backend Express, integração WireGuard e Proxy WebFig
│   │   ├── src/
│   │   │   ├── middlewares/  # Validação JWT, RBAC e geração automática de chave secreta
│   │   │   ├── routes/       # Endpoints REST (/auth, /routers, /users)
│   │   │   ├── services/     # Cliente HTTP para a API interna do WG-Easy
│   │   │   ├── database.js   # Inicialização e migrações do SQLite (WAL mode)
│   │   │   └── server.js     # Servidor HTTP principal (3000) e Proxy WebFig (58123)
│   │   └── package.json
│   └── web/                  # Interface React + Vite + TailwindCSS
│       ├── src/
│       │   ├── components/   # Navegação lateral e modais de conta
│       │   ├── contexts/     # Estado de sessão e cliente HTTP autenticado
│       │   ├── pages/        # Telas (Dashboard, Adoption, Team, Login)
│       │   └── utils/        # Gerador de script RouterOS (.rsc)
│       └── package.json
├── docs/
│   └── ARCHITECTURE.md
├── docker-compose.yml
└── Dockerfile
```

## 1. Rede Compartilhada (`network_mode: "service:wg-easy"`)

O túnel WireGuard (`wg0`) nasce dentro do container `wg-easy`. Para que o proxy reverso do SolidRoute consiga abrir o WebFig dos roteadores remotos (`10.8.0.x:8123`) sem precisar de rotas extras no host, o container `solidroute-portal` compartilha o mesmo namespace de rede do `wg-easy`:

* A comunicação entre o backend do SolidRoute e a API do WG-Easy ocorre via loopback (`http://127.0.0.1:51821`).
* A porta `51821` do WG-Easy fica vinculada apenas ao `127.0.0.1` do host, nunca exposta para a rede externa.
* O tráfego do proxy na porta `58123` sai diretamente pela interface `wg0` até o MikroTik selecionado.

## 2. Funcionamento do Proxy WebFig (Porta `58123`)

O WebFig do RouterOS carrega recursos estáticos e chamadas internas usando caminhos absolutos a partir da raiz (`/login`, `/s/`, `/webfig/`). Por esse motivo, não é viável servi-lo sob um subcaminho como `/proxy/10.8.0.2`.

Para resolver isso mantendo suporte a vários técnicos simultâneos:
1. Quando o operador clica em **WebFig** no painel, o navegador grava dois cookies de sessão (`proxyTarget` com o IP do equipamento e `proxyAuth` com o JWT do operador) e abre a porta `58123`.
2. O servidor dedicado na porta `58123` lê esses cookies a cada requisição, valida a assinatura do JWT no SQLite e confirma se o IP de destino pertence a um roteador cadastrado na tabela `routers`.
3. Antes de repassar o pacote HTTP para o MikroTik na porta `8123`, o filtro `onProxyReq` remove os cookies `proxyAuth` e `proxyTarget` do cabeçalho, garantindo que o token do painel nunca trafegue até o roteador do cliente.
