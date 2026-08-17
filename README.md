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
