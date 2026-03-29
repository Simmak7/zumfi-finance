import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Shield } from 'lucide-react';

export function TwoFactorInput({ onSubmit, loading, error }) {
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [useRecovery, setUseRecovery] = useState(false);
    const [recoveryCode, setRecoveryCode] = useState('');
    const inputRefs = useRef([]);

    useEffect(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
    }, []);

    const handleDigitChange = (index, value) => {
        if (!/^\d?$/.test(value)) return;
        const newDigits = [...digits];
        newDigits[index] = value;
        setDigits(newDigits);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (value && index === 5 && newDigits.every((d) => d)) {
            onSubmit(newDigits.join(''));
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            const newDigits = pasted.split('');
            setDigits(newDigits);
            onSubmit(pasted);
            e.preventDefault();
        }
    };

    if (useRecovery) {
        return (
            <div className="two-factor-form">
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'center' }}>
                    Enter one of your recovery codes
                </p>
                <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    placeholder="Recovery code"
                    style={{ textAlign: 'center', letterSpacing: '0.1em' }}
                />
                {error && <div className="error-message">{error}</div>}
                <button
                    className="submit-btn"
                    onClick={() => onSubmit(recoveryCode)}
                    disabled={loading || !recoveryCode}
                >
                    {loading ? <Loader2 className="spin" size={18} /> : <Shield size={18} />}
                    <span>Verify Recovery Code</span>
                </button>
                <button className="recovery-link" onClick={() => setUseRecovery(false)}>
                    Use authenticator app instead
                </button>
            </div>
        );
    }

    return (
        <div className="two-factor-form">
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'center' }}>
                Enter the 6-digit code from your authenticator app
            </p>
            <div className="totp-input" onPaste={handlePaste}>
                {digits.map((digit, i) => (
                    <input
                        key={i}
                        ref={(el) => (inputRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                    />
                ))}
            </div>
            {error && <div className="error-message">{error}</div>}
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Loader2 className="spin" size={20} style={{ color: '#6366f1' }} />
                </div>
            )}
            <button className="recovery-link" onClick={() => setUseRecovery(true)}>
                Use a recovery code instead
            </button>
        </div>
    );
}
