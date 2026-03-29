import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Tags, Upload, ListChecks, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import './FirstTimeModal.css';

const DISMISS_KEY = 'first_time_intro_shown';

export function FirstTimeModal({ onClose }) {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const steps = [
        {
            icon: Tags,
            title: t('firstTime.step1Title'),
            desc: t('firstTime.step1Desc'),
            path: '/settings',
        },
        {
            icon: Upload,
            title: t('firstTime.step2Title'),
            desc: t('firstTime.step2Desc'),
            path: '/import',
        },
        {
            icon: ListChecks,
            title: t('firstTime.step3Title'),
            desc: t('firstTime.step3Desc'),
            path: '/transactions',
        },
    ];

    const handleStep = (path) => {
        localStorage.setItem(DISMISS_KEY, 'true');
        onClose();
        navigate(path);
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISS_KEY, 'true');
        onClose();
    };

    return (
        <div className="ftm-overlay" onClick={handleDismiss}>
            <div className="ftm-modal" onClick={e => e.stopPropagation()}>
                <button className="ftm-close" onClick={handleDismiss}>
                    <X size={18} />
                </button>

                <div className="ftm-hero">
                    <div className="ftm-icon-circle">
                        <Sparkles size={28} />
                    </div>
                    <h2>{t('firstTime.title')}</h2>
                    <p>{t('firstTime.subtitle')}</p>
                </div>

                <div className="ftm-steps">
                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        return (
                            <button
                                key={i}
                                className="ftm-step"
                                onClick={() => handleStep(step.path)}
                            >
                                <div className="ftm-step-number">{i + 1}</div>
                                <Icon size={20} className="ftm-step-icon" />
                                <div className="ftm-step-text">
                                    <span className="ftm-step-title">{step.title}</span>
                                    <span className="ftm-step-desc">{step.desc}</span>
                                </div>
                                <ArrowRight size={16} className="ftm-step-arrow" />
                            </button>
                        );
                    })}
                </div>

                <button className="ftm-dismiss-btn" onClick={handleDismiss}>
                    {t('firstTime.gotIt')}
                </button>
            </div>
        </div>
    );
}

export function shouldShowFirstTimeModal() {
    return localStorage.getItem(DISMISS_KEY) !== 'true';
}
