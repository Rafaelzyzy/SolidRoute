import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Server, TerminalSquare, Users, Activity, LogOut, Lock, Shield } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

export default function Sidebar() {
    const { user, logout, apiFetch } = useContext(AuthContext);

    const [showPassModal, setShowPassModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passLoading, setPassLoading] = useState(false);
    const [passMessage, setPassMessage] = useState({ type: '', text: '' });

    const linkBase = 'flex items-center gap-3 px-6 py-2.5 font-medium transition-all border-l-4';
    const linkActive = 'bg-[#3E3E42] border-primary text-white';
    const linkInactive = 'border-transparent text-gray-400 hover:text-white hover:bg-[#3E3E42]/50';

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPassLoading(true);
        setPassMessage({ type: '', text: '' });

        try {
            const response = await apiFetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            const data = await response.json();

            if (response.ok) {
                setPassMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
                setCurrentPassword('');
                setNewPassword('');
                setTimeout(() => {
                    setShowPassModal(false);
                    setPassMessage({ type: '', text: '' });
                }, 1500);
            } else {
                setPassMessage({ type: 'error', text: data.error || 'Erro ao alterar senha.' });
            }
        } catch (err) {
            setPassMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
        } finally {
            setPassLoading(false);
        }
    };

    return (
        <>
            <aside className="w-64 bg-darkBox h-full flex flex-col py-6 border-r border-mkborder shadow-lg z-10">
                <div className="px-6 mb-8 flex items-center gap-3">
                    <div className="bg-primary p-1.5 rounded text-darkerBox">
                        <Activity size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-wide">SolidRoute</h2>
                </div>

                <div className="px-6 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Menu Principal</div>
                <nav className="flex flex-col gap-0.5 flex-1">
                    <NavLink
                        to="/"
                        className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
                    >
                        <Server size={18} />
                        Roteadores
                    </NavLink>

                    <NavLink
                        to="/adopt"
                        className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
                    >
                        <TerminalSquare size={18} />
                        Gerador de Script
                    </NavLink>

                    <NavLink
                        to="/team"
                        className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
                    >
                        <Users size={18} />
                        Gestão de Equipe
                    </NavLink>
                </nav>

                <div className="px-6 mt-auto pt-4 border-t border-mkborder flex flex-col gap-1">
                    {user && (
                        <div className="px-2 py-2 mb-1">
                            <div className="text-xs text-white font-medium truncate" title={user.email}>
                                {user.email}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-primary font-bold uppercase mt-0.5">
                                <Shield size={12} />
                                {user.role === 'admin' ? 'Administrador' : 'Operador'}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setPassMessage({ type: '', text: '' });
                            setShowPassModal(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-[#3E3E42] rounded transition-colors flex items-center gap-2"
                    >
                        <Lock size={15} />
                        Alterar Minha Senha
                    </button>

                    <button
                        onClick={logout}
                        className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors flex items-center gap-2"
                    >
                        <LogOut size={15} />
                        Sair
                    </button>
                </div>
            </aside>

            {showPassModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-darkBox border border-mkborder rounded shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-[#3E3E42] px-6 py-4 border-b border-mkborder flex justify-between items-center">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Lock size={16} className="text-primary" />
                                Alterar Minha Senha
                            </h2>
                            <button onClick={() => setShowPassModal(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>

                        <form onSubmit={handleChangePassword} className="p-6 flex flex-col gap-4">
                            {passMessage.text && (
                                <div className={`p-3 rounded text-xs text-center border ${
                                    passMessage.type === 'success'
                                        ? 'bg-primary/20 border-primary/50 text-primary'
                                        : 'bg-red-500/20 border-red-500/50 text-red-400'
                                }`}>
                                    {passMessage.text}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Senha Atual</label>
                                <input
                                    type="password"
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-darkerBox border border-mkborder rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Nova Senha (mín. 6 caracteres)</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-darkerBox border border-mkborder rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPassModal(false)}
                                    className="flex-1 bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 py-2 rounded font-bold text-xs transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={passLoading}
                                    className="flex-1 bg-primary text-darkerBox hover:bg-primaryHover py-2 rounded font-bold text-xs transition-colors disabled:opacity-50"
                                >
                                    {passLoading ? 'Salvando...' : 'Atualizar Senha'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
