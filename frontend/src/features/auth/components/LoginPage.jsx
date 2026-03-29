import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n';
import { getGoogleLoginUrl, forgotPassword, resetPasswordVerify, resetPassword } from '../../../services/api';
import { LogIn, UserPlus, Loader2, Eye, EyeOff, ArrowLeft, KeyRound, ShieldCheck, AlertTriangle } from 'lucide-react';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { TwoFactorInput } from './TwoFactorInput';
import './LoginPage.css';

const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function LoginPage() {
    const { login, register, needs2FA, verify2FA } = useAuth();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // Forgot password state
    const [forgotStep, setForgotStep] = useState(null); // null | 'email' | '2fa' | 'newPassword' | 'noMethod'
    const [resetToken, setResetToken] = useState(null);
    const [passwordResetToken, setPasswordResetToken] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isRegister) {
                await register(email, password, displayName);
                addToast(t('auth.welcome2fa'), 'info', 8000);
            } else {
                await login(email, password);
            }
        } catch (err) {
            setError(err.response?.data?.detail || t('auth.authFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const { data } = await getGoogleLoginUrl();
            window.location.href = data.authorization_url;
        } catch (err) {
            setError(t('auth.googleUnavailable'));
        }
    };

    const handle2FASubmit = async (code) => {
        setLoading(true);
        setError(null);
        try {
            await verify2FA(code);
        } catch (err) {
            setError(err.response?.data?.detail || t('auth.invalidCode'));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotEmail = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { data } = await forgotPassword(email);
            if (data.method === '2fa') {
                setResetToken(data.reset_token);
                setForgotStep('2fa');
            } else {
                setForgotStep('noMethod');
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleForgot2FA = async (code) => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await resetPasswordVerify(resetToken, code);
            setPasswordResetToken(data.password_reset_token);
            setForgotStep('newPassword');
        } catch (err) {
            setError(err.response?.data?.detail || t('auth.invalidCode'));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await resetPassword(passwordResetToken, newPassword);
            setForgotStep(null);
            setResetToken(null);
            setPasswordResetToken(null);
            setNewPassword('');
            setError(null);
            // Show success inline — user needs to log in now
            setEmail('');
            setPassword('');
            setError(t('auth.passwordResetSuccess'));
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const exitForgotPassword = () => {
        setForgotStep(null);
        setResetToken(null);
        setPasswordResetToken(null);
        setNewPassword('');
        setError(null);
    };

    // 2FA verification screen (login flow)
    if (needs2FA) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="login-logo">
                        <h1><span className="logo-zum">ZUM</span><span className="logo-fi">FI</span></h1>
                        <p className="logo-finance">Finance</p>
                        <p>{t('auth.twoFactorAuth')}</p>
                    </div>
                    <TwoFactorInput onSubmit={handle2FASubmit} loading={loading} error={error} />
                </div>
            </div>
        );
    }

    // Forgot password flow
    if (forgotStep) {
        return (
            <div className="login-page">
                <div className="login-card">
                    <div className="login-logo">
                        <h1><span className="logo-zum">ZUM</span><span className="logo-fi">FI</span></h1>
                        <p className="logo-finance">Finance</p>
                        <p>{t('auth.resetPassword')}</p>
                    </div>

                    {forgotStep === 'email' && (
                        <form onSubmit={handleForgotEmail} className="forgot-form">
                            <p className="forgot-info">
                                {t('auth.resetInfo')}
                            </p>
                            <div className="form-group">
                                <label>{t('auth.email')}</label>
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            {error && <div className="error-message">{error}</div>}
                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
                                <span>{t('auth.checkAccount')}</span>
                            </button>
                        </form>
                    )}

                    {forgotStep === '2fa' && (
                        <div className="forgot-form">
                            <p className="forgot-info">
                                {t('auth.verify2fa')}
                            </p>
                            <TwoFactorInput onSubmit={handleForgot2FA} loading={loading} error={error} />
                        </div>
                    )}

                    {forgotStep === 'newPassword' && (
                        <form onSubmit={handleResetPassword} className="forgot-form">
                            <div className="forgot-success">
                                <ShieldCheck size={18} />
                                <span>{t('auth.identityVerified')}</span>
                            </div>
                            <div className="form-group">
                                <label>{t('auth.newPassword')}</label>
                                <div className="password-wrapper">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        placeholder={t('auth.enterNewPassword')}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        tabIndex={-1}
                                    >
                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <PasswordStrengthIndicator password={newPassword} />
                            </div>
                            {error && <div className="error-message">{error}</div>}
                            <button type="submit" className="submit-btn" disabled={loading || !newPassword}>
                                {loading ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
                                <span>{t('auth.resetBtn')}</span>
                            </button>
                        </form>
                    )}

                    {forgotStep === 'noMethod' && (
                        <div className="forgot-form">
                            <div className="forgot-warning">
                                <AlertTriangle size={18} />
                                <div>
                                    <strong>{t('auth.resetUnavailable')}</strong>
                                    <p>
                                        {t('auth.resetRequires2fa')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <button className="back-link" onClick={exitForgotPassword}>
                        <ArrowLeft size={14} /> {t('auth.backToLogin')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-logo">
                    <h1><span className="logo-zum">ZUM</span><span className="logo-fi">FI</span></h1>
                    <p className="logo-finance">Finance</p>
                    <p>{t('auth.personalDashboard')}</p>
                </div>

                <form onSubmit={handleSubmit}>
                    {isRegister && (
                        <div className="form-group">
                            <label>{t('auth.displayName')}</label>
                            <input
                                type="text"
                                placeholder="Maks & Zuzi"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>{t('auth.email')}</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('auth.password')}</label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder={t('auth.enterPassword')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {isRegister && <PasswordStrengthIndicator password={password} />}
                    </div>

                    {!isRegister && (
                        <button
                            type="button"
                            className="forgot-link"
                            onClick={() => { setForgotStep('email'); setError(null); }}
                        >
                            {t('auth.forgotPassword')}
                        </button>
                    )}

                    {isRegister && (
                        <div className="register-2fa-hint">
                            <ShieldCheck size={16} />
                            <span>{t('auth.welcome2fa')}</span>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? (
                            <Loader2 className="spin" size={18} />
                        ) : isRegister ? (
                            <UserPlus size={18} />
                        ) : (
                            <LogIn size={18} />
                        )}
                        <span>{isRegister ? t('auth.createAccount') : t('auth.signIn')}</span>
                    </button>
                </form>

                {GOOGLE_ENABLED && (
                    <>
                        <div className="login-divider">
                            <span>{t('auth.or')}</span>
                        </div>
                        <button className="google-btn" onClick={handleGoogleLogin} type="button">
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>{t('auth.signInGoogle')}</span>
                        </button>
                    </>
                )}

                <div className="toggle-mode">
                    <button onClick={() => { setIsRegister(!isRegister); setError(null); }}>
                        {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
                    </button>
                </div>
            </div>
        </div>
    );
}
