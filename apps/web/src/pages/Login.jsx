import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Activity } from 'lucide-react';

export default function Login() {
    const { login } = useContext(AuthContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(email, password);
        if (!result.success) {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-darkerBox flex items-center justify-center p-4">
            <div className="bg-darkBox border border-mkborder shadow-2xl rounded w-full max-w-sm">
                <div className="bg-[#3E3E42] px-6 py-4 border-b border-mkborder flex items-center gap-3">
                    <div className="bg-primary p-1.5 rounded text-darkerBox">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-wide">SolidRoute</h1>
                        <p className="text-xs text-gray-400">Acesso ao Painel</p>
                    </div>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 px-3 py-2 text-xs rounded mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1">E-mail</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-darkerBox border border-mkborder rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                placeholder="admin@solidroute.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1">Senha</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-darkerBox border border-mkborder rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primaryHover text-darkerBox font-bold py-2 rounded text-sm transition-colors mt-2 disabled:opacity-50"
                        >
                            {loading ? 'Autenticando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
