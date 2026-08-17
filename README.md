# SolidRoute Portal

O **SolidRoute** é um sistema web Open Source de página única (SPA) criado para automatizar a gestão e a adoção de roteadores **Mikrotik** distribuídos em clientes via túneis **WireGuard**. 

O portal reúne três funções: cadastro/registro dos roteadores já adotados, um gerador de script de adoção automatizado (para colar no Mikrotik) e gestão de usuários com acesso ao painel.

---

## 🏗️ Arquitetura

A infraestrutura ideal do projeto é desacoplada. O gerador de scripts (SolidRoute) não precisa rodar na mesma máquina que o servidor VPN, garantindo total flexibilidade.

```mermaid
graph TD
    subgraph ServidorVPN["Servidor WireGuard (Linux/Docker)"]
        WGSRV["WG-Easy<br/>servidor WireGuard + UI de gestão de peers/chaves"]
    end

    subgraph ServidorPortal["Servidor SolidRoute (Windows/Linux com Node.js)"]
        FE["Frontend React (SPA, single-file)<br/>public/index.html — React 18 + Babel"]
        BE["Backend Node.js/Express<br/>server.js — API REST (/api/*)"]
        DB[("better-sqlite3")]

        FE -->|"fetch /api/login, /api/routers, /api/users<br/>(Bearer JWT)"| BE
        BE -->|consulta / grava| DB
    end

    OP["Operador (navegador)"] --> FE
    OP -->|gera script de adoção<br/>100% no client-side| SCRIPT["Script RouterOS (.rsc)<br/>WireGuard + rota + firewall + scheduler"]
    SCRIPT -->|colado manualmente no Winbox/terminal| MK["Roteador Mikrotik do cliente"]
    MK -->|túnel WireGuard| WGSRV
    WGSRV -->|roteamento da VPN para a rede| RT["Router físico<br/>(regras de roteamento configuradas)"]
