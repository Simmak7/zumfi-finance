import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n';
import { setup2FA, confirm2FA, disable2FA } from '../../../services/api';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Download, X } from 'lucide-react';

export function TwoFactorSection() {
    const { user, refreshUser } = useAuth();
    const { addToast } = useToast();
    const { t } = useTranslation();

    const [step, setStep] = useState('idle'); // idle | setup | confirm | recovery | disable
    const [setupData, setSetupData] = useState(null);
    const [code, setCode] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSetup = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await setup2FA();
            setSetupData(data);
            setStep('setup');
        } catch (err) {
            setError(err.response?.data?.detail || t('twoFactor.setupFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await confirm2FA(code);
            setRecoveryCodes(data.recovery_codes);
            setStep('recovery');
            setCode('');
            await refreshUser();
        } catch (err) {
            setError(err.response?.data?.detail || t('auth.invalidCode'));
        } finally {
            setLoading(false);
        }
    };

    const handleDisable = async () => {
        setLoading(true);
        setError(null);
        try {
            await disable2FA(code);
            addToast(t('twoFactor.disabled'), 'success');
            setStep('idle');
            setCode('');
            await refreshUser();
        } catch (err) {
            setError(err.response?.data?.detail || t('auth.invalidCode'));
        } finally {
            setLoading(false);
        }
    };

    const copyRecoveryCodes = () => {
        navigator.clipboard.writeText(recoveryCodes.join('\n'));
        addToast(t('twoFactor.copied'), 'success');
    };

    const downloadRecoveryCodes = () => {
        const text = `Zumfi Finance - Recovery Codes\n${'='.repeat(35)}\n\nStore these codes safely. Each can only be used once.\n\n${recoveryCodes.join('\n')}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'zumfi-recovery-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Recovery codes modal
    if (step === 'recovery') {
        return (
            <div className="settings-section">
                <h3><ShieldCheck size={16} /> {t('twoFactor.recoveryCodes')}</h3>
                <p style={{ color: '#f59e0b', fontSize: '0.85rem', marginBottom: 12 }}>
                    {t('twoFactor.recoveryCodesDesc')}
                </p>
                <div style={{
                    background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 16,
                    fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.8,
                    marginBottom: 12,
                }}>
                    {recoveryCodes.map((code, i) => (
                        <div key={i} style={{ color: '#e2e8f0' }}>{code}</div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="settings-action-btn" onClick={copyRecoveryCodes}>
                        <Copy size={14} /> {t('common.copy')}
                    </button>
                    <button className="settings-action-btn" onClick={downloadRecoveryCodes}>
                        <Download size={14} /> {t('common.download')}
                    </button>
                    <button
                        className="settings-action-btn"
                        onClick={() => { setStep('idle'); setRecoveryCodes([]); }}
                        style={{ marginLeft: 'auto' }}
                    >
                        {t('allocation.done')}
                    </button>
                </div>
            </div>
        );
    }

    // Setup flow
    if (step === 'setup') {
        return (
            <div className="settings-section">
                <h3><Shield size={16} /> {t('twoFactor.title')}</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 12 }}>
                    {t('twoFactor.scanQR')}
                </p>
                {setupData && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                            <img
                                src={`data:image/png;base64,${setupData.qr_code_base64}`}
                                alt="2FA QR Code"
                                style={{ width: 200, height: 200, borderRadius: 8 }}
                            />
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textAlign: 'center', marginBottom: 12 }}>
                            {t('twoFactor.orEnterManually')} <code style={{ color: '#6366f1' }}>{setupData.secret}</code>
                        </p>
                    </>
                )}
                <div className="settings-form-group">
                    <input
                        type="text"
                        placeholder={t('twoFactor.enterCode')}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.1rem' }}
                    />
                </div>
                {error && <div className="error-message" style={{ marginBottom: 8 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="settings-action-btn"
                        onClick={handleConfirm}
                        disabled={loading || code.length !== 6}
                    >
                        {loading ? <Loader2 className="spin" size={14} /> : <ShieldCheck size={14} />}
                        {t('twoFactor.verify')}
                    </button>
                    <button
                        className="settings-action-btn secondary"
                        onClick={() => { setStep('idle'); setSetupData(null); setCode(''); setError(null); }}
                    >
                        <X size={14} /> {t('common.cancel')}
                    </button>
                </div>
            </div>
        );
    }

    // Disable flow
    if (step === 'disable') {
        return (
            <div className="settings-section">
                <h3><ShieldOff size={16} /> {t('twoFactor.disable')}</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: 12 }}>
                    {t('twoFactor.disableConfirm')}
                </p>
                <div className="settings-form-group">
                    <input
                        type="text"
                        placeholder={t('twoFactor.enterCode')}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.1rem' }}
                    />
                </div>
                {error && <div className="error-message" style={{ marginBottom: 8 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="settings-action-btn danger"
                        onClick={handleDisable}
                        disabled={loading || code.length !== 6}
                    >
                        {loading ? <Loader2 className="spin" size={14} /> : <ShieldOff size={14} />}
                        {t('twoFactor.disableBtn')}
                    </button>
                    <button
                        className="settings-action-btn secondary"
                        onClick={() => { setStep('idle'); setCode(''); setError(null); }}
                    >
                        {t('common.cancel')}
                    </button>
                </div>
            </div>
        );
    }

    // Default idle view
    return (
        <div className="settings-section">
            <h3><Shield size={16} /> {t('twoFactor.title')}</h3>
            <div className="settings-info-row">
                <span className="settings-label">{t('txDetail.status')}</span>
                <span className="settings-value" style={{ color: user?.totp_enabled ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>
                    {user?.totp_enabled ? t('twoFactor.enabled') : t('twoFactor.disabled')}
                </span>
            </div>
            {user?.totp_enabled ? (
                <button className="settings-action-btn danger" onClick={() => { setStep('disable'); setError(null); }}>
                    <ShieldOff size={14} /> {t('twoFactor.disableBtn')}
                </button>
            ) : (
                <>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: 8 }}>
                        {t('twoFactor.securityDescription')}
                    </p>
                    <button className="settings-action-btn" onClick={handleSetup} disabled={loading}>
                        {loading ? <Loader2 className="spin" size={14} /> : <Shield size={14} />}
                        {t('twoFactor.enable')}
                    </button>
                    <p style={{
                        color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: 12,
                        lineHeight: 1.5, fontStyle: 'italic',
                    }}>
                        {t('twoFactor.recoveryHint')}
                    </p>
                </>
            )}
        </div>
    );
}
