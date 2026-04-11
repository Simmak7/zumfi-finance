import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tags, Upload, ListChecks, CheckCircle, Circle, X } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import { useMonth } from '../../../context/MonthContext';
import { CategoryEditor } from '../../categories/components/CategoryEditor';
import './WelcomeCard.css';

function _key(base, userId) {
    return userId ? `${base}_${userId}` : base;
}

export function WelcomeCard({ summary, userId }) {
    const dismissKey = _key('onboarding_dismissed', userId);
    const catKey = _key('onboarding_categories_reviewed', userId);
    const txKey = _key('onboarding_transactions_reviewed', userId);

    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(dismissKey) === 'true'
    );
    const [categoriesReviewed, setCategoriesReviewed] = useState(
        () => localStorage.getItem(catKey) === 'true'
    );
    const [showCategoryEditor, setShowCategoryEditor] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { lastDataMonth } = useMonth();

    if (dismissed) return null;

    // Only show for first-time users with no data in the system.
    // Once any data exists (transactions or portfolio), hide the card.
    if (lastDataMonth) return null;

    const has_transactions = summary && (summary.total_income > 0 || summary.total_expenses > 0);
    const transactionsReviewed = localStorage.getItem(txKey) === 'true';

    // Auto-disappear when all steps are fulfilled
    if (categoriesReviewed && has_transactions && transactionsReviewed) return null;

    const handleCloseCategoryEditor = () => {
        setShowCategoryEditor(false);
        localStorage.setItem(catKey, 'true');
        setCategoriesReviewed(true);
    };

    const handleGoToTransactions = () => {
        localStorage.setItem(txKey, 'true');
        navigate('/transactions');
    };

    const STEPS = [
        {
            label: t('welcome.step1'),
            icon: Tags,
            action: () => setShowCategoryEditor(true),
            done: categoriesReviewed,
        },
        {
            label: t('welcome.step2'),
            icon: Upload,
            action: () => navigate('/import'),
            done: has_transactions,
        },
        {
            label: t('welcome.step3'),
            icon: ListChecks,
            action: handleGoToTransactions,
            done: has_transactions && transactionsReviewed,
        },
    ];

    const handleDismiss = () => {
        localStorage.setItem(dismissKey, 'true');
        setDismissed(true);
    };

    return (
        <>
            <div className="welcome-card">
                <button className="welcome-dismiss" onClick={handleDismiss}>
                    <X size={16} />
                </button>
                <h2 className="welcome-title">{t('welcome.title')}</h2>
                <p className="welcome-desc">{t('welcome.subtitle')}</p>
                <div className="welcome-steps">
                    {STEPS.map((step, i) => {
                        const StepIcon = step.icon;
                        return (
                            <button
                                key={i}
                                className={`welcome-step ${step.done ? 'done' : ''}`}
                                onClick={step.action}
                            >
                                <div className="welcome-step-check">
                                    {step.done ? <CheckCircle size={18} /> : <Circle size={18} />}
                                </div>
                                <StepIcon size={18} />
                                <span>{step.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {showCategoryEditor && (
                <div className="cem-overlay" onClick={handleCloseCategoryEditor}>
                    <div className="cem-modal" onClick={e => e.stopPropagation()}>
                        <div className="cem-header">
                            <h2>{t('welcome.step1')}</h2>
                            <button className="mcw-close" onClick={handleCloseCategoryEditor}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="cem-body">
                            <CategoryEditor onSuccess={() => window.dispatchEvent(new Event('categories-updated'))} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
