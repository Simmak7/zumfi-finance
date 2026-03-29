import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n';
import { authChangePassword, getGoogleLoginUrl } from '../../../services/api';
import { Lock, Loader2, Check, Link2 } from 'lucide-react';
import { PasswordStrengthIndicator } from '../../auth/components/PasswordStrengthIndicator';

const GOOGLE_ENABLED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function AccountSection() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const isGoogleOnly = user?.auth_provider === 'google' && !user?.password_hash;

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await authChangePassword(currentPassword, newPassword);
            addToast(t('account.passwordChanged'), 'success');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err) {
            addToast(err.response?.data?.detail || t('account.changeFailed'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLinkGoogle = async () => {
        try {
            const { data } = await getGoogleLoginUrl();
            window.location.href = data.authorization_url;
        } catch {
            addToast(t('auth.googleUnavailable'), 'error');
        }
    };

    return (
        <div className="settings-section">
            <h3><Lock size={16} /> {t('account.title')}</h3>

            <div className="settings-info-row">
                <span className="settings-label">{t('account.provider')}</span>
                <span className="settings-value">
                    {user?.auth_provider === 'google' ? t('account.authMethodGoogle') : t('account.authMethodEmail')}
                    {user?.google_id && user?.auth_provider !== 'google' && ` + ${t('account.authMethodGoogle')}`}
                </span>
            </div>

            {GOOGLE_ENABLED && !user?.google_id && (
                <button className="settings-action-btn" onClick={handleLinkGoogle} type="button">
                    <Link2 size={14} />
                    {t('account.linkGoogle')}
                </button>
            )}

            {user?.google_id && (
                <div className="settings-info-row" style={{ color: '#22c55e', fontSize: '0.85rem' }}>
                    <Check size={14} /> {t('account.googleLinked')}
                </div>
            )}

            {!isGoogleOnly && (
                <form onSubmit={handleChangePassword} style={{ marginTop: 16 }}>
                    <h4 style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: 8 }}>
                        {t('account.changePassword')}
                    </h4>
                    <div className="settings-form-group">
                        <input
                            type="password"
                            placeholder={t('account.currentPassword')}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="settings-form-group">
                        <input
                            type="password"
                            placeholder={t('account.newPassword')}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                        <PasswordStrengthIndicator password={newPassword} />
                    </div>
                    <button
                        type="submit"
                        className="settings-action-btn"
                        disabled={loading || !currentPassword || !newPassword}
                    >
                        {loading ? <Loader2 className="spin" size={14} /> : <Lock size={14} />}
                        {t('account.changePassword')}
                    </button>
                </form>
            )}
        </div>
    );
}
