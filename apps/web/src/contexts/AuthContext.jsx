import React, { createContext, useState, useEffect, useCallback } from 'react';

export const AuthContext = createContext();

function decodeJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('solidroute_jwt'));
    const [proxyPort, setProxyPort] = useState(58123);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem('solidroute_jwt');
        document.cookie = 'proxyAuth=; path=/; max-age=0';
        document.cookie = 'proxyTarget=; path=/; max-age=0';
        setToken(null);
        setUser(null);
    }, []);

    useEffect(() => {
        const validateSession = async () => {
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                    if (data.proxyPort) {
                        setProxyPort(data.proxyPort);
                    }
                } else if (response.status === 401 || response.status === 403) {
                    logout();
                }
            } catch (err) {
                console.error('Falha temporária de rede ao validar sessão:', err);
                const payload = decodeJwtPayload(token);
                if (payload && (!payload.exp || payload.exp * 1000 > Date.now())) {
                    setUser({
                        id: payload.id,
                        email: payload.email,
                        role: payload.role || 'operator'
                    });
                } else {
                    logout();
                }
            } finally {
                setLoading(false);
            }
        };

        validateSession();
    }, [token, logout]);

    const login = async (email, password) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('solidroute_jwt', data.token);
                setToken(data.token);
                setUser(data.user);
                if (data.proxyPort) {
                    setProxyPort(data.proxyPort);
                }
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Erro ao autenticar.' };
            }
        } catch (err) {
            return { success: false, error: 'Erro de conexão com o servidor.' };
        }
    };

    const apiFetch = useCallback(async (url, options = {}) => {
        const headers = {
            ...(options.headers || {}),
            'Authorization': `Bearer ${token}`
        };

        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            logout();
        }
        return response;
    }, [token, logout]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-darkerBox text-white">
                Carregando...
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, token, proxyPort, login, logout, apiFetch }}>
            {children}
        </AuthContext.Provider>
    );
};
