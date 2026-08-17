# SolidRoute Portal

O **SolidRoute** é um sistema web Open Source de página única (SPA) criado para automatizar a gestão e a adoção de roteadores **Mikrotik** distribuídos em clientes via túneis **WireGuard**. 

O portal reúne três funções: cadastro/registro dos roteadores já adotados, um gerador de script de adoção automatizado (para colar no Mikrotik) e gestão de usuários com acesso ao painel.

---

## 🏗️ Arquitetura

A infraestrutura ideal do projeto é desacoplada. O gerador de scripts (SolidRoute) não precisa rodar na mesma máquina que o servidor VPN, garantindo total flexibilidade.

```mermaid
flowchart LR
    %% Configuração de Cores baseadas no seu UI
    classDef darkBox fill:#1E222B,stroke:#262B35,stroke-width:2px,color:#EDEEF1,rx:8,ry:8
    classDef dbBox fill:#E23A54,stroke:#C22443,stroke-width:2px,color:#FFFFFF,rx:8,ry:8
    classDef ghostBox fill:none,stroke:#5B6270,stroke-width:1px,stroke-dasharray: 5 5,color:#9199A6

    OP(("👤 Operador")):::darkBox

    subgraph Portal ["💻 Servidor SolidRoute"]
        direction TB
        FE["🖥️ Frontend (React)"]:::darkBox
        BE["⚙️ Backend (Node.js)"]:::darkBox
        DB[("🗃️ SQLite")]:::dbBox

        FE -->|"API REST"| BE
        BE <-->|"Lê/Grava"| DB
    end

    subgraph Infra ["🌐 Infraestrutura VPN"]
        direction TB
        SCRIPT["📄 Script Gerado (.rsc)"]:::ghostBox
        MK["📡 Mikrotik Cliente"]:::darkBox
        WG["🛡️ WG-Easy (Docker)"]:::darkBox
        
        SCRIPT -.->|"Colado no Terminal"| MK
        MK <==>|"Túnel VPN"| WG
    end

    OP -->|"Acessa Painel HTTP"| FE
    OP -.->|"Gera Script (Client-Side)"| SCRIPT
