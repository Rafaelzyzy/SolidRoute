import React, { useEffect, useState, useContext, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Users, Trash2, Plus, Mail, Lock, Shield } from 'lucide-react';

export default function Team() {
    const { user: currentUser, apiFetch } = useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estados do Modal de Criação
    const [showModal, setShowModal] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('operator');
    const [modalLoading, setModalLoading] = useState(false);
    const [error, setError] = useState('');

    // Estados do Modal de Redefinição de Senha por Admin
    const [resetTarget, setResetTarget] = useState(null);
    const [resetPassword, setResetPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState('');

    const isAdmin = currentUser?.role === 'admin' || currentUser?.id === 1;

    const fetchUsers = useCallback(async () => {
        try {
            const response = await apiFetch('/api/users');
            if (response.ok) {
                setUsers(await response.json());
            }
        } catch (err) {
            console.error('Erro ao buscar equipe', err);
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleDelete = async (id, userEmail) => {
        if (Number(id) === 1) {
            alert('O administrador principal não pode ser removido.');
            return;
        }
        if (Number(id) === Number(currentUser?.id)) {
            alert('Você não pode remover a sua própria conta.');
            return;
        }
        if (!window.confirm(`Tem certeza que deseja remover o acesso do usuário ${userEmail}?`)) {
            return;
        }
        try {
            const response = await apiFetch(`/api/users/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setUsers(users.filter(u => u.id !== id));
            } else {
                const data = await response.json();
                alert(data.error || 'Erro ao remover.');
            }
        } catch (err) {
            alert('Erro de rede.');
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setModalLoading(true);
        setError('');

        try {
            const response = await apiFetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, role })
            });

            const data = await response.json();

            if (response.ok) {
                setUsers([...users, { id: data.id, email: data.email, role: data.role }]);
                setShowModal(false);
                setEmail('');
                setPassword('');
                setRole('operator');
            } else {
                setError(data.error || 'Erro ao criar usuário.');
            }
        } catch (err) {
            setError('Erro de rede.');
        } finally {
            setModalLoading(false);
        }
    };

    const handleAdminResetPassword = async (e) => {
        e.preventDefault();
        if (!resetTarget) return;
        setResetLoading(true);
        setResetError('');

        try {
            const response = await apiFetch(`/api/users/${resetTarget.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: resetPassword })
            });
            const data = await response.json();
            if (response.ok) {
                setResetTarget(null);
                setResetPassword('');
                alert(`Senha de ${resetTarget.email} atualizada com sucesso!`);
            } else {
                setResetError(data.error || 'Erro ao redefinir senha.');
            }
        } catch (err) {
            setResetError('Erro de rede.');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-2">
            <div className="flex items-end justify-between mb-8 border-b border-mkborder pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1 tracking-wide">Gestão de Equipe</h1>
                    <p className="text-sm text-gray-400">Controle quem tem acesso ao painel SolidRoute e defina perfis de permissão.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => {
                            setError('');
                            setShowModal(true);
                        }}
                        className="bg-primary hover:bg-primaryHover text-darkerBox font-bold px-4 py-2 rounded flex items-center gap-2 text-sm transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Novo Usuário
                    </button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500 text-sm">Carregando equipe...</div>
            ) : (
                <div className="bg-darkBox border border-mkborder shadow-lg rounded overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-[#3E3E42] border-b border-mkborder">
                                <th className="py-2.5 px-4 font-bold text-gray-200">ID</th>
                                <th className="py-2.5 px-4 font-bold text-gray-200">Email (Login)</th>
                                <th className="py-2.5 px-4 font-bold text-gray-200">Nível de Acesso</th>
                                <th className="py-2.5 px-4 font-bold text-gray-200 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => {
                                const isSuperAdmin = Number(u.id) === 1;
                                const isSelf = Number(u.id) === Number(currentUser?.id);
                                const isUserAdmin = isSuperAdmin || u.role === 'admin';

                                return (
                                    <tr key={u.id} className="border-b border-mkborder last:border-0 hover:bg-[#4E4E52]/40 transition-colors">
                                        <td className="py-3 px-4 text-gray-400 font-mono">#{u.id}</td>
                                        <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                                            <div className="w-8 h-8 rounded bg-darkerBox border border-mkborder flex items-center justify-center">
                                                <Users size={14} className="text-primary" />
                                            </div>
                                            <span>{u.email}</span>
                                            {isSelf && (
                                                <span className="text-[10px] bg-[#3E3E42] text-gray-300 px-1.5 py-0.5 rounded border border-mkborder">
                                                    Você
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                isSuperAdmin
                                                    ? 'bg-primary/20 text-primary border border-primary/50'
                                                    : isUserAdmin
                                                        ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                                                        : 'bg-gray-700 text-gray-300'
                                            }`}>
                                                {isSuperAdmin ? 'Super Admin' : isUserAdmin ? 'Administrador' : 'Operador'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right flex items-center justify-end gap-2">
                                            {isAdmin && !isSelf && (
                                                <button
                                                    onClick={() => {
                                                        setResetError('');
                                                        setResetPassword('');
                                                        setResetTarget(u);
                                                    }}
                                                    className="inline-flex items-center justify-center bg-transparent border border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white p-1.5 rounded transition-all"
                                                    title="Redefinir Senha"
                                                >
                                                    <Lock size={14} />
                                                </button>
                                            )}
                                            {isAdmin && !isSuperAdmin && !isSelf && (
                                                <button
                                                    onClick={() => handleDelete(u.id, u.email)}
                                                    className="inline-flex items-center justify-center bg-transparent border border-red-500 text-red-500 hover:bg-red-500 hover:text-white p-1.5 rounded transition-all"
                                                    title="Remover Acesso"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Criação */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-darkBox border border-mkborder rounded shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-[#3E3E42] px-6 py-4 border-b border-mkborder flex justify-between items-center">
                            <h2 className="text-lg font-bold text-white">Novo Acesso</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6">
                            {error && (
                                <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-400 mb-1">E-mail do Usuário</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-darkerBox border border-mkborder rounded pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="ex: suporte@empresa.com"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-400 mb-1">Senha de Acesso (mín. 6 caracteres)</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-darkerBox border border-mkborder rounded pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-400 mb-1">Nível de Acesso</label>
                                <div className="relative">
                                    <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="w-full bg-darkerBox border border-mkborder rounded pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                    >
                                        <option value="operator">Operador (Adotar e gerenciar roteadores)</option>
                                        <option value="admin">Administrador (Controle total + Equipe)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 py-2.5 rounded font-bold text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalLoading}
                                    className="flex-1 bg-primary text-darkerBox hover:bg-primaryHover py-2.5 rounded font-bold text-sm transition-colors disabled:opacity-50"
                                >
                                    {modalLoading ? 'Criando...' : 'Criar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Redefinição de Senha por Admin */}
            {resetTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-darkBox border border-mkborder rounded shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-[#3E3E42] px-6 py-4 border-b border-mkborder flex justify-between items-center">
                            <h2 className="text-base font-bold text-white">Redefinir Senha</h2>
                            <button onClick={() => setResetTarget(null)} className="text-gray-400 hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleAdminResetPassword} className="p-6">
                            {resetError && (
                                <div className="mb-4 bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded text-xs text-center">
                                    {resetError}
                                </div>
                            )}

                            <p className="text-xs text-gray-300 mb-4">
                                Definindo nova senha para <span className="font-bold text-white">{resetTarget.email}</span>:
                            </p>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-400 mb-1">Nova Senha (mín. 6 caracteres)</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={resetPassword}
                                    onChange={(e) => setResetPassword(e.target.value)}
                                    className="w-full bg-darkerBox border border-mkborder rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setResetTarget(null)}
                                    className="flex-1 bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 py-2 rounded font-bold text-xs transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="flex-1 bg-primary text-darkerBox hover:bg-primaryHover py-2 rounded font-bold text-xs transition-colors disabled:opacity-50"
                                >
                                    {resetLoading ? 'Salvando...' : 'Salvar Nova Senha'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
