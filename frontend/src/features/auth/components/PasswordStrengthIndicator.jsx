import React from 'react';
import { Check, X } from 'lucide-react';

const RULES = [
    { test: (p) => p.length >= 8, label: 'At least 8 characters' },
    { test: (p) => /[A-Z]/.test(p), label: 'Uppercase letter' },
    { test: (p) => /[a-z]/.test(p), label: 'Lowercase letter' },
    { test: (p) => /\d/.test(p), label: 'A digit' },
    { test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(p), label: 'Special character' },
];

export function PasswordStrengthIndicator({ password }) {
    if (!password) return null;

    const passed = RULES.filter((r) => r.test(password)).length;
    const strength = passed / RULES.length;

    const barColor = strength < 0.4 ? '#ef4444' : strength < 0.8 ? '#f59e0b' : '#22c55e';

    return (
        <div className="password-strength" style={{ marginTop: 6 }}>
            <div style={{
                height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden', marginBottom: 6,
            }}>
                <div style={{
                    height: '100%', width: `${strength * 100}%`,
                    background: barColor, borderRadius: 2,
                    transition: 'width 0.2s, background 0.2s',
                }} />
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
                {RULES.map((rule) => {
                    const ok = rule.test(password);
                    return (
                        <li key={rule.label} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            color: ok ? '#22c55e' : 'rgba(255,255,255,0.4)',
                            marginBottom: 2,
                        }}>
                            {ok ? <Check size={12} /> : <X size={12} />}
                            {rule.label}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
