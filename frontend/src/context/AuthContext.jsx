import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { setupAuthInterceptor, authLogin, authGetMe, authLogout, authRegister } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needs2FA, setNeeds2FA] = useState(false);
    const [twoFactorToken, setTwoFactorToken] = useState(null);

    // Store access token in memory (not localStorage) for XSS protection
    const accessTokenRef = useRef(null);
    // Refresh token in localStorage (only sent to /auth/refresh)
    const getRefreshToken = useCallback(() => localStorage.getItem('finance_refresh_token'), []);

    const setTokens = useCallback((accessToken, refreshToken) => {
        accessTokenRef.current = accessToken;
        if (accessToken) {
            api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        }
        if (refreshToken) {
            localStorage.setItem('finance_refresh_token', refreshToken);
        }
    }, []);

    const clearAuth = useCallback(() => {
        accessTokenRef.current = null;
        localStorage.removeItem('finance_refresh_token');
        // Clean up legacy token if present
        localStorage.removeItem('finance_token');
        sessionStorage.removeItem('zumi_welcomed');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
        setNeeds2FA(false);
        setTwoFactorToken(null);
    }, []);

    // Set up the 401 interceptor once
    useEffect(() => {
        setupAuthInterceptor(
            getRefreshToken,
            (newAccess, newRefresh) => setTokens(newAccess, newRefresh),
            () => clearAuth(),
        );
    }, [getRefreshToken, setTokens, clearAuth]);

    // On mount: try to restore session from refresh token
    useEffect(() => {
        const restoreSession = async () => {
            const refreshToken = getRefreshToken();
            // Also check for legacy token migration
            const legacyToken = localStorage.getItem('finance_token');

            if (legacyToken && !refreshToken) {
                // Legacy token exists — try to use it to fetch user, then clear it
                api.defaults.headers.common['Authorization'] = `Bearer ${legacyToken}`;
                accessTokenRef.current = legacyToken;
                try {
                    const { data } = await authGetMe();
                    setUser(data);
                } catch {
                    clearAuth();
                }
                setLoading(false);
                return;
            }

            if (!refreshToken) {
                setLoading(false);
                return;
            }

            try {
                // Refresh to get a new access token
                const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
                setTokens(data.access_token, data.refresh_token);
                const { data: userData } = await authGetMe();
                setUser(userData);
            } catch {
                clearAuth();
            }
            setLoading(false);
        };
        restoreSession();
    }, []);

    const login = async (email, password) => {
        const { data } = await authLogin(email, password);

        if (data.requires_2fa) {
            setNeeds2FA(true);
            setTwoFactorToken(data.two_factor_token);
            return { requires_2fa: true };
        }

        setTokens(data.access_token, data.refresh_token);
        const { data: userData } = await authGetMe();
        setUser(userData);
        return { requires_2fa: false };
    };

    const verify2FA = async (code) => {
        const { data } = await api.post('/auth/verify-2fa', {
            two_factor_token: twoFactorToken,
            totp_code: code,
        });
        setNeeds2FA(false);
        setTwoFactorToken(null);
        setTokens(data.access_token, data.refresh_token);
        const { data: userData } = await authGetMe();
        setUser(userData);
    };

    const register = async (email, password, displayName) => {
        await authRegister(email, password, displayName);
        await login(email, password);
    };

    const loginWithTokens = async (accessToken, refreshToken) => {
        setTokens(accessToken, refreshToken);
        const { data } = await authGetMe();
        setUser(data);
    };

    const logout = async () => {
        const refreshToken = getRefreshToken();
        try {
            if (refreshToken) {
                await authLogout(refreshToken);
            }
        } catch {
            // Best effort — clear locally regardless
        }
        clearAuth();
    };

    const refreshUser = async () => {
        try {
            const { data } = await authGetMe();
            setUser(data);
        } catch {
            // ignore
        }
    };

    return (
        <AuthContext.Provider value={{
            user, loading, needs2FA, twoFactorToken,
            login, register, logout, verify2FA, loginWithTokens, refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
