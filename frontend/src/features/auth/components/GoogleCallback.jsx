import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { exchangeGoogleCode } from '../../../services/api';
import { Loader2 } from 'lucide-react';

export function GoogleCallback() {
    const { loginWithTokens } = useAuth();
    const [error, setError] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        if (!code) {
            setError('No authorization code received from Google');
            return;
        }

        const exchange = async () => {
            try {
                const { data } = await exchangeGoogleCode(code);

                if (data.requires_2fa) {
                    // Redirect to login page with 2FA state
                    window.location.href = `/?2fa_token=${data.two_factor_token}`;
                    return;
                }

                await loginWithTokens(data.access_token, data.refresh_token);
                window.location.href = '/';
            } catch (err) {
                setError(err.response?.data?.detail || 'Google authentication failed');
            }
        };

        exchange();
    }, []);

    if (error) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: '#0f0f23', color: '#fff',
                flexDirection: 'column', gap: 16,
            }}>
                <p style={{ color: '#ef4444' }}>{error}</p>
                <button
                    onClick={() => window.location.href = '/'}
                    style={{
                        padding: '8px 20px', background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                        color: '#fff', cursor: 'pointer',
                    }}
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: '#0f0f23', color: '#fff',
            flexDirection: 'column', gap: 12,
        }}>
            <Loader2 className="spin" size={32} />
            <p>Signing in with Google...</p>
        </div>
    );
}
