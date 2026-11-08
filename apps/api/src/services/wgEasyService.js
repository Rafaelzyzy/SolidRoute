const axios = require('axios');

const WG_EASY_API_URL = process.env.WG_EASY_API_URL || 'http://127.0.0.1:51821';
const WG_EASY_PASSWORD = process.env.WG_EASY_PASSWORD || '';

class WgEasyService {
    constructor() {
        this.sessionCookie = null;
    }

    async login() {
        try {
            const response = await axios.post(`${WG_EASY_API_URL}/api/session`, {
                password: WG_EASY_PASSWORD
            }, { timeout: 8000 });

            const cookies = response.headers['set-cookie'];
            if (cookies && cookies.length > 0) {
                this.sessionCookie = cookies[0].split(';')[0];
            }
        } catch (error) {
            console.error('Erro ao fazer login no WG-Easy:', error.message);
            throw new Error('Não foi possível autenticar no servidor WireGuard (WG-Easy).');
        }
    }

    async getClients() {
        try {
            const headers = await this.getHeaders();
            const response = await axios.get(`${WG_EASY_API_URL}/api/wireguard/client`, {
                headers,
                timeout: 8000
            });
            return { clients: response.data || [], wgAvailable: true };
        } catch (error) {
            if (error.response && error.response.status === 401) {
                try {
                    this.sessionCookie = null;
                    const headers = await this.getHeaders();
                    const retryResponse = await axios.get(`${WG_EASY_API_URL}/api/wireguard/client`, {
                        headers,
                        timeout: 8000
                    });
                    return { clients: retryResponse.data || [], wgAvailable: true };
                } catch (retryError) {
                    console.error('Erro após re-login no WG-Easy:', retryError.message);
                }
            }
            console.error('Erro ao listar clientes no WG-Easy:', error.message);
            return { clients: [], wgAvailable: false };
        }
    }

    async getHeaders() {
        if (!this.sessionCookie) {
            await this.login();
        }
        return {
            'Cookie': this.sessionCookie,
            'Content-Type': 'application/json'
        };
    }

    async createClient(name) {
        const createAndFetch = async (headers) => {
            await axios.post(`${WG_EASY_API_URL}/api/wireguard/client`, { name }, { headers, timeout: 8000 });
            const listResponse = await axios.get(`${WG_EASY_API_URL}/api/wireguard/client`, { headers, timeout: 8000 });
            const clients = listResponse.data;
            const matchedClients = clients.filter(c => c.name === name);
            if (matchedClients.length === 0) {
                throw new Error('Cliente não encontrado na lista do WG-Easy após criação.');
            }
            return matchedClients[matchedClients.length - 1];
        };

        try {
            const headers = await this.getHeaders();
            return await createAndFetch(headers);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                this.sessionCookie = null;
                const headers = await this.getHeaders();
                return await createAndFetch(headers);
            }
            console.error('Erro ao criar cliente no WG-Easy:', error.message);
            throw new Error('Não foi possível criar o cliente no WireGuard.');
        }
    }

    async deleteClientById(clientId) {
        try {
            const headers = await this.getHeaders();
            await axios.delete(`${WG_EASY_API_URL}/api/wireguard/client/${clientId}`, { headers, timeout: 8000 });
        } catch (error) {
            console.error(`Erro ao deletar cliente ID ${clientId} no WG-Easy:`, error.message);
        }
    }

    async deleteClientByName(name) {
        try {
            const headers = await this.getHeaders();
            const listResponse = await axios.get(`${WG_EASY_API_URL}/api/wireguard/client`, { headers, timeout: 8000 });
            const clients = listResponse.data;
            const client = clients.find(c => c.name === name);

            if (client) {
                await axios.delete(`${WG_EASY_API_URL}/api/wireguard/client/${client.id}`, { headers, timeout: 8000 });
            }
        } catch (error) {
            console.error(`Erro ao deletar cliente ${name} no WG-Easy:`, error.message);
        }
    }

    async getClientConfig(clientId) {
        try {
            const headers = await this.getHeaders();
            const response = await axios.get(`${WG_EASY_API_URL}/api/wireguard/client/${clientId}/configuration`, {
                headers,
                responseType: 'text',
                timeout: 8000
            });

            const confFileText = response.data;
            return this.parseConfigFile(confFileText);
        } catch (error) {
            console.error(`Erro ao obter configuração do cliente ${clientId}:`, error.message);
            throw new Error('Não foi possível ler as chaves geradas pelo WireGuard.');
        }
    }

    parseConfigFile(confText) {
        const privateKeyMatch = confText.match(/PrivateKey\s*=\s*(.+)/);
        const addressMatch = confText.match(/Address\s*=\s*(.+)/);
        const publicKeyMatch = confText.match(/PublicKey\s*=\s*(.+)/);
        const presharedKeyMatch = confText.match(/PresharedKey\s*=\s*(.+)/);
        const endpointMatch = confText.match(/Endpoint\s*=\s*(.+)/);

        return {
            privateKey: privateKeyMatch ? privateKeyMatch[1].trim() : null,
            address: addressMatch ? addressMatch[1].trim() : null,
            publicKey: publicKeyMatch ? publicKeyMatch[1].trim() : null,
            presharedKey: presharedKeyMatch ? presharedKeyMatch[1].trim() : null,
            endpoint: endpointMatch ? endpointMatch[1].trim() : null
        };
    }
}

module.exports = new WgEasyService();
