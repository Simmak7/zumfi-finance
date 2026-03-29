import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ListChecks, Receipt, CheckCircle, Circle, X } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import './WelcomeCard.css';

const DISMISS_KEY = 'onboarding_dismissed';

export function WelcomeCard({ summary }) {
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(DISMISS_KEY) === 'true'
    );
    const navigate = useNavigate();
    const { t } = useTranslation();

    const STEPS = [
        {
            label: t('welcome.step1'),
            icon: Upload,
            path: '/import',
            checkKey: 'has_transactions',
        },
        {
            label: t('welcome.step2'),
            icon: ListChecks,
            path: '/transactions',
            checkKey: 'has_classified',
        },
        {
            label: t('welcome.step3'),
            icon: Receipt,
            path: '/bills',
            checkKey: 'has_bills',
        },
    ];

    if (dismissed) return null;

    const checks = {
        has_transactions: summary && (summary.total_income > 0 || summary.total_expenses > 0),
        has_classified: false,
        has_bills: false,
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISS_KEY, 'true');
        setDismissed(true);
    };

    return (
        <div className="welcome-card">
            <button className="welcome-dismiss" onClick={handleDismiss}>
                <X size={16} />
            </button>
            <h2 className="welcome-title">{t('welcome.title')}</h2>
            <p className="welcome-desc">{t('welcome.subtitle')}</p>
            <div className="welcome-steps">
                {STEPS.map((step, i) => {
                    const done = checks[step.checkKey];
                    const StepIcon = step.icon;
                    return (
                        <button
                            key={i}
                            className={`welcome-step ${done ? 'done' : ''}`}
                            onClick={() => navigate(step.path)}
                        >
                            <div className="welcome-step-check">
                                {done ? <CheckCircle size={18} /> : <Circle size={18} />}
                            </div>
                            <StepIcon size={18} />
                            <span>{step.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
