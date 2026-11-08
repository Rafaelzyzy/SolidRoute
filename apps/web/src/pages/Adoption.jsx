import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { generateMikrotikScript } from '../utils/mikrotikScript';
import { Copy, Terminal, CheckCircle2, TerminalSquare, AlertTriangle } from 'lucide-react';

export default function Adoption() {
    const { apiFetch } = useContext(AuthContext);
    const [routerName, setRouterName] = useState('');
    const [configureWebfigService, setConfigureWebfigService] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [scriptParams, setScriptParams] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!routerName.trim()) return;

        setLoading(true);
        setError('');
        setScriptParams(null);
        setCopied(false);

        try {
            const response = await apiFetch('/api/routers/adopt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: routerName.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao comunicar com o servidor');
            }

            setScriptParams({
                name: data.router.name,
                wgIp: data.wgConfig.address,
                privateKey: data.wgConfig.privateKey,
                presharedKey: data.wgConfig.presharedKey,
                publicKey: data.wgConfig.publicKey,
                endpoint: data.wgConfig.endpoint
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const generatedCode = scriptParams
        ? generateMikrotikScript({ ...scriptParams, configureWebfigService })
        : '';

    const isLocalhostEndpoint = scriptParams?.endpoint && scriptParams.endpoint.startsWith('127.0.0.1');

    const handleCopy = () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(generatedCode);
        } else {
            // Fallback para HTTP (contexto não-seguro)
            const textArea = document.createElement('textarea');
            textArea.value = generatedCode;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Falha ao copiar', err);
            }
            document.body.removeChild(textArea);
        }

        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col p-2">
            <div className="mb-6 flex items-center gap-3 border-b border-mkborder pb-4">
                <TerminalSquare size={28} className="text-primary" />
                <div>
                    <h1 className="text-xl font-bold text-white mb-0.5 tracking-wide">Adoção de Mikrotik</h1>
                    <p className="text-sm text-gray-400">Automatize a integração criando o peer diretamente via API e gerando o script.</p>
                </div>
            </div>

            {isLocalhostEndpoint && (
                <div className="mb-4 bg-yellow-900/20 border border-yellow-700/50 text-yellow-300 px-4 py-3 rounded flex items-center gap-3 text-xs">
                    <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
                    <div>
                        <span className="font-bold">Atenção:</span> O endpoint gerado está apontando para <code className="font-mono text-white">127.0.0.1</code>. Configure a variável <code className="font-mono text-white">WG_HOST</code> no arquivo <code className="font-mono text-white">.env</code> do servidor com o seu IP público ou DDNS para que o Mikrotik consiga conectar externamente.
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Formulário Esquerdo */}
                <div className="w-full lg:w-[350px] flex-shrink-0">
                    <div className="bg-darkBox border border-mkborder shadow-lg rounded">
                        <div className="bg-[#3E3E42] px-4 py-2 border-b border-mkborder">
                            <h2 className="text-sm font-bold text-white">Parâmetros de Adoção</h2>
                        </div>

                        <div className="p-4">
                            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Nome do Equipamento (Cliente)</label>
                                    <input
                                        type="text"
                                        required
                                        value={routerName}
                                        onChange={e => setRouterName(e.target.value)}
                                        className="w-full bg-darkerBox border border-mkborder rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="Ex: RB-Cliente-Filial"
                                        disabled={loading}
                                    />
                                </div>

                                <label className="flex items-start gap-2.5 text-xs text-gray-300 cursor-pointer select-none bg-darkerBox p-2.5 rounded border border-mkborder">
                                    <input
                                        type="checkbox"
                                        checked={configureWebfigService}
                                        onChange={e => setConfigureWebfigService(e.target.checked)}
                                        className="mt-0.5 accent-primary"
                                    />
                                    <span>
                                        Definir porta do serviço HTTP (<code className="font-mono text-primary">www</code>) para <code className="font-mono text-primary">8123</code> no script
                                    </span>
                                </label>

                                <div className="bg-darkerBox border-l-2 border-primary/50 p-3 text-xs text-gray-400">
                                    Ao clicar em gerar, o portal comunicará com o WG-Easy em background para criar as chaves e definir o IP IPv4 de VPN automaticamente.
                                </div>

                                {error && (
                                    <div className="text-xs text-red-400 bg-red-900/20 p-2 border border-red-900/50 rounded">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !routerName.trim()}
                                    className="w-full bg-primary hover:bg-primaryHover text-darkerBox font-bold py-2 rounded text-sm transition-colors mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Processando com WG-Easy...' : 'Gerar Chaves e Script'}
                                </button>
                            </form>

                            {scriptParams && (
                                <div className="mt-6 border-t border-mkborder pt-4 flex flex-col gap-2">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Resumo da VPN Criada</h3>
                                    <div className="text-sm flex justify-between">
                                        <span className="text-gray-500">IP Designado:</span>
                                        <span className="font-mono text-primary font-bold">{scriptParams.wgIp}</span>
                                    </div>
                                    <div className="text-sm flex justify-between">
                                        <span className="text-gray-500">Endpoint:</span>
                                        <span className="font-mono text-white">{scriptParams.endpoint}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Script Direito */}
                <div className="flex-1 bg-darkBox border border-mkborder shadow-lg rounded flex flex-col overflow-hidden relative">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-mkborder bg-[#3E3E42]">
                        <div className="flex items-center gap-2 text-gray-300 font-mono text-xs">
                            <Terminal size={14} />
                            <span>terminal-command.rsc</span>
                        </div>

                        <button
                            onClick={handleCopy}
                            disabled={!generatedCode}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-colors ${
                                copied
                                    ? 'bg-primary text-darkerBox'
                                    : 'bg-[#2D2D30] hover:bg-[#4E4E52] border border-mkborder text-gray-300'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto bg-[#0C0C0C]">
                        {generatedCode ? (
                            <pre className="text-gray-300 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                                {generatedCode}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600">
                                <Terminal size={32} className="mb-2 opacity-50" />
                                <p className="text-sm">Preencha o nome do equipamento para visualizar o código.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
