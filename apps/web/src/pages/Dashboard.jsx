import React, { useEffect, useState, useContext, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { ExternalLink, Router as RouterIcon, Search, Trash2, RefreshCw, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';

export default function Dashboard() {
    const { token, proxyPort, apiFetch } = useContext(AuthContext);
    const [routers, setRouters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [wgUnreachable, setWgUnreachable] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');

    // Estados do Modal de Sincronização Seletiva
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [availablePeers, setAvailablePeers] = useState([]);
    const [selectedPeerNames, setSelectedPeerNames] = useState([]);

    const fetchRouters = useCallback(async () => {
        try {
            const response = await apiFetch('/api/routers');
            if (response.ok) {
                const wgStatus = response.headers.get('X-WG-Status');
                setWgUnreachable(wgStatus === 'unreachable');
                const data = await response.json();
                setRouters(data);
            }
        } catch (err) {
            console.error('Erro ao buscar roteadores', err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchRouters();
        const interval = setInterval(fetchRouters, 30000);
        return () => clearInterval(interval);
    }, [fetchRouters]);

    const handleOpenSyncPreview = async () => {
        setSyncing(true);
        try {
            const response = await apiFetch('/api/routers/sync/preview');
            const data = await response.json();
            if (response.ok) {
                await fetchRouters();
                if (data.availablePeers && data.availablePeers.length > 0) {
                    setAvailablePeers(data.availablePeers);
                    setSelectedPeerNames(data.availablePeers.map(p => p.name));
                    setSyncModalOpen(true);
                } else {
                    alert('Status atualizado! Todos os peers existentes no WireGuard já estão cadastrados no painel.');
                }
            } else {
                alert(data.error || 'Não foi possível consultar o servidor WireGuard.');
            }
        } catch (err) {
            alert('Erro de rede ao consultar o servidor WireGuard.');
        } finally {
            setSyncing(false);
        }
    };

    const handleConfirmSync = async (e) => {
        e.preventDefault();
        if (selectedPeerNames.length === 0) {
            setSyncModalOpen(false);
            return;
        }
        setSyncing(true);
        try {
            const response = await apiFetch('/api/routers/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: selectedPeerNames })
            });
            const data = await response.json();
            if (response.ok) {
                setSyncModalOpen(false);
                await fetchRouters();
            } else {
                alert(data.error || 'Erro ao importar peers.');
            }
        } catch (err) {
            alert('Erro de rede ao importar peers.');
        } finally {
            setSyncing(false);
        }
    };

    const togglePeerSelection = (name) => {
        if (selectedPeerNames.includes(name)) {
            setSelectedPeerNames(selectedPeerNames.filter(n => n !== name));
        } else {
            setSelectedPeerNames([...selectedPeerNames, name]);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Tem certeza que deseja remover o Mikrotik "${name}"? Essa ação não pode ser desfeita e ele perderá o acesso à VPN.`)) {
            return;
        }

        try {
            const response = await apiFetch(`/api/routers/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setRouters(routers.filter(r => r.id !== id));
            } else {
                const data = await response.json();
                alert(data.error || 'Erro ao remover o roteador.');
            }
        } catch (error) {
            console.error('Erro ao deletar:', error);
            alert('Erro de rede ao tentar remover o roteador.');
        }
    };

    const handleOpenWebFig = (wgIp) => {
        const ip = wgIp.split('/')[0].trim();
        const targetPort = proxyPort || 58123;
        const cacheBuster = Date.now();
        document.cookie = `proxyTarget=${encodeURIComponent(ip)}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `proxyAuth=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
        window.open(
            `http://${window.location.hostname}:${targetPort}/__solidroute_open?target=${encodeURIComponent(ip)}&t=${cacheBuster}`,
            '_blank'
        );
    };

    const toggleSortOrder = () => {
        setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    };

    const filteredRouters = routers
        .filter(router =>
            router.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (router.wg_ip && router.wg_ip.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            const comparison = (a.name || '').localeCompare(b.name || '', 'pt-BR', {
                numeric: true,
                sensitivity: 'base'
            });
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    const onlineCount = routers.filter(r => r.isOnline).length;

    return (
        <div className="max-w-7xl mx-auto p-2">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4 border-b border-mkborder pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1 tracking-wide">Roteadores Adotados</h1>
                    <p className="text-sm text-gray-400">Gerencie todos os seus equipamentos Mikrotik conectados à VPN.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar nome ou IP..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-darkBox border border-mkborder rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors shadow-sm"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={toggleSortOrder}
                        title={sortOrder === 'asc' ? 'Ordenado de A a Z (clique para inverter para Z a A)' : 'Ordenado de Z a A (clique para inverter para A a Z)'}
                        className="bg-darkBox hover:bg-[#3E3E42] text-gray-200 border border-mkborder px-3 py-2 rounded flex items-center gap-2 text-xs font-bold transition-colors shadow-sm"
                    >
                        {sortOrder === 'asc' ? (
                            <>
                                <ArrowUp size={15} className="text-primary" />
                                <span>A - Z</span>
                            </>
                        ) : (
                            <>
                                <ArrowDown size={15} className="text-primary" />
                                <span>Z - A</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleOpenSyncPreview}
                        disabled={syncing}
                        title="Verificar peers existentes no WG-Easy e atualizar status"
                        className="bg-darkBox hover:bg-[#3E3E42] text-gray-200 border border-mkborder px-3 py-2 rounded flex items-center gap-2 text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={syncing ? 'animate-spin text-primary' : 'text-primary'} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>

                    <div className={`px-4 py-2 rounded border border-mkborder flex items-center gap-2 shadow-sm whitespace-nowrap ${
                        wgUnreachable
                            ? 'bg-yellow-900/20 text-yellow-400 border-yellow-700/50'
                            : onlineCount === 0
                                ? 'bg-red-900/20 text-red-400'
                                : 'bg-[#3E3E42] text-white'
                    }`}>
                        <RouterIcon size={16} className={
                            wgUnreachable
                                ? 'text-yellow-400'
                                : onlineCount > 0
                                    ? 'text-primary'
                                    : 'text-red-500'
                        } />
                        <span className="font-bold text-sm">
                            {wgUnreachable ? 'Status indisponível' : `${onlineCount} online`}
                        </span>
                    </div>
                </div>
            </div>

            {wgUnreachable && (
                <div className="mb-6 bg-yellow-900/20 border border-yellow-700/50 text-yellow-300 px-4 py-3 rounded flex items-center gap-3 text-xs">
                    <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
                    <div>
                        <span className="font-bold">Aviso:</span> Não foi possível consultar a API do servidor WireGuard (WG-Easy) no momento. A lista de roteadores abaixo vem do banco local, mas o status Online/Offline está temporariamente indisponível.
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-20 text-gray-500 text-sm">Sincronizando rede...</div>
            ) : routers.length === 0 ? (
                <div className="bg-darkBox border border-mkborder rounded shadow-lg p-12 text-center flex flex-col items-center">
                    <RouterIcon size={48} className="text-gray-600 mb-4 opacity-50" />
                    <h3 className="text-lg font-bold text-white mb-2">Rede Vazia</h3>
                    <p className="text-sm text-gray-400 max-w-md">
                        Você ainda não adotou nenhum equipamento. Utilize a ferramenta "Gerador de Script" para conectar o primeiro Mikrotik ou clique em "Sincronizar" caso já possua peers no WireGuard.
                    </p>
                </div>
            ) : (
                <div className="bg-darkBox border border-mkborder shadow-lg rounded overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-[#3E3E42] border-b border-mkborder">
                                <th className="py-2.5 px-4 font-bold text-gray-200">
                                    <button
                                        type="button"
                                        onClick={toggleSortOrder}
                                        title={sortOrder === 'asc' ? 'Ordenar de Z a A' : 'Ordenar de A a Z'}
                                        className="flex items-center gap-2 hover:text-white transition-colors focus:outline-none group"
                                    >
                                        <span>Nome do Equipamento</span>
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-darkBg/60 border border-mkborder text-[11px] text-primary font-bold group-hover:border-primary/50 transition-colors">
                                            {sortOrder === 'asc' ? (
                                                <>
                                                    A-Z <ArrowUp size={12} />
                                                </>
                                            ) : (
                                                <>
                                                    Z-A <ArrowDown size={12} />
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </th>
                                <th className="py-2.5 px-4 font-bold text-gray-200">IP na VPN</th>
                                <th className="py-2.5 px-4 font-bold text-gray-200">Data de Adoção</th>
                                <th className="py-2.5 px-4 font-bold text-gray-200 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRouters.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-gray-500 text-sm border-b border-mkborder">
                                        Nenhum roteador encontrado com o termo "{searchTerm}".
                                    </td>
                                </tr>
                            ) : (
                                filteredRouters.map(router => (
                                    <tr key={router.id} className="border-b border-mkborder last:border-0 hover:bg-[#4E4E52]/40 transition-colors">
                                        <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                                            <div
                                                title={
                                                    router.statusUnknown
                                                        ? 'Status indisponível (WG-Easy inacessível)'
                                                        : router.isOnline
                                                            ? 'Online (Handshake recente)'
                                                            : 'Offline (Sem handshake nos últimos 3 min)'
                                                }
                                                className={`w-2.5 h-2.5 rounded-full ${
                                                    router.statusUnknown
                                                        ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.6)]'
                                                        : router.isOnline
                                                            ? 'bg-primary shadow-[0_0_5px_rgba(0,209,102,0.6)]'
                                                            : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.6)]'
                                                }`}
                                            />
                                            {router.name}
                                        </td>
                                        <td className="py-3 px-4 text-gray-300 font-mono text-xs">{router.wg_ip.split('/')[0]}</td>
                                        <td className="py-3 px-4 text-gray-400 text-xs">
                                            {router.created_at
                                                ? new Date(router.created_at.replace(' ', 'T') + (router.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })
                                                : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-right flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenWebFig(router.wg_ip)}
                                                className="inline-flex items-center gap-1.5 bg-transparent border border-primary text-primary hover:bg-primary hover:text-darkerBox px-3 py-1 rounded text-xs font-bold transition-all"
                                            >
                                                WebFig <ExternalLink size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(router.id, router.name)}
                                                className="inline-flex items-center justify-center bg-transparent border border-red-500 text-red-500 hover:bg-red-500 hover:text-white p-1 rounded transition-all"
                                                title="Remover Roteador"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Seleção de Peers na Sincronização */}
            {syncModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-darkBox border border-mkborder rounded shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-[#3E3E42] px-6 py-4 border-b border-mkborder flex justify-between items-center">
                            <h2 className="text-base font-bold text-white">Importar Peers do WireGuard</h2>
                            <button onClick={() => setSyncModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleConfirmSync} className="p-6">
                            <p className="text-xs text-gray-300 mb-4">
                                Selecione abaixo apenas os peers que correspondem a equipamentos Mikrotik para importá-los ao painel:
                            </p>

                            <div className="max-h-60 overflow-y-auto border border-mkborder rounded bg-darkerBox divide-y divide-mkborder mb-6">
                                {availablePeers.map(peer => (
                                    <label
                                        key={peer.id || peer.name}
                                        className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-[#3E3E42]/40 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedPeerNames.includes(peer.name)}
                                                onChange={() => togglePeerSelection(peer.name)}
                                                className="accent-primary"
                                            />
                                            <span className="font-bold text-white">{peer.name}</span>
                                        </div>
                                        <span className="font-mono text-gray-400">{peer.address}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSyncModalOpen(false)}
                                    className="flex-1 bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 py-2 rounded font-bold text-xs transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={syncing || selectedPeerNames.length === 0}
                                    className="flex-1 bg-primary text-darkerBox hover:bg-primaryHover py-2 rounded font-bold text-xs transition-colors disabled:opacity-50"
                                >
                                    Importar Selecionados ({selectedPeerNames.length})
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
