import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, ArrowRight, TrendingUp } from 'lucide-react';
import { getSurplus, getAllocationSuggestions, allocateToGoals } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useSettings } from '../../../context/SettingsContext';
import { formatCurrency } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';
import './AllocationWizard.css';

export function AllocationWizard({ month, onClose }) {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const formatAmount = (value) => formatCurrency(value, currency);
    const [step, setStep] = useState(1);
    const [surplus, setSurplus] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [allocations, setAllocations] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        loadData();
    }, [month]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [surplusData, suggestionsData] = await Promise.all([
                getSurplus(month),
                getAllocationSuggestions(month),
            ]);
            setSurplus(surplusData);
            setSuggestions(suggestionsData);
            // Pre-fill with suggestions
            const initial = {};
            suggestionsData.forEach(s => {
                initial[s.goal_id] = Number(s.suggested_amount);
            });
            setAllocations(initial);
        } catch (err) {
            console.error('Failed to load allocation data:', err);
        } finally {
            setLoading(false);
        }
    };

    const totalAllocated = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
    const available = surplus ? Number(surplus.available_surplus) : 0;
    const remaining = available - totalAllocated;

    const updateAllocation = (goalId, value) => {
        const num = Math.max(0, Number(value) || 0);
        setAllocations(prev => ({ ...prev, [goalId]: num }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const items = Object.entries(allocations)
                .filter(([, amount]) => amount > 0)
                .map(([goal_id, amount]) => ({ goal_id: Number(goal_id), amount }));
            await allocateToGoals({ month, allocations: items });
            setSuccess(true);
            window.dispatchEvent(new Event('goals-updated'));
            setTimeout(() => onClose(), 2000);
        } catch (err) {
            console.error('Allocation failed:', err);
            addToast('Allocation failed: ' + (err.response?.data?.detail || err.message), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const fillSuggestions = () => {
        const initial = {};
        suggestions.forEach(s => {
            initial[s.goal_id] = Number(s.suggested_amount);
        });
        setAllocations(initial);
    };

    if (success) {
        return (
            <div className="wizard-overlay" onClick={onClose}>
                <div className="wizard-modal success-modal" onClick={e => e.stopPropagation()}>
                    <div className="success-content">
                        <div className="success-icon"><Check size={40} /></div>
                        <h2>{t('allocation.done')}!</h2>
                        <p>{formatAmount(totalAllocated)} {t('allocation.subtitle')}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="wizard-overlay" onClick={onClose}>
            <div className="wizard-modal wizard-wide" onClick={e => e.stopPropagation()}>
                <div className="wizard-header">
                    <h2><TrendingUp size={22} /> {t('allocation.title')}</h2>
                    <button className="wizard-close" onClick={onClose}><X size={20} /></button>
                </div>

                {loading ? (
                    <div className="wizard-loading">{t('common.loading')}</div>
                ) : available <= 0 ? (
                    <div className="wizard-empty">
                        <p>{t('monthClose.noSurplus')}</p>
                        <p className="wizard-sub">
                            {surplus && Number(surplus.already_allocated) > 0
                                ? t('allocation.fullyAllocatedDesc')
                                : t('allocation.noSurplus') || 'Income minus expenses is zero or negative.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Step indicators */}
                        <div className="wizard-steps">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`step-dot ${step >= s ? 'active' : ''}`}>
                                    {s}
                                </div>
                            ))}
                        </div>

                        {step === 1 && (
                            <div className="wizard-step">
                                <h3>{t('monthClose.surplus')}</h3>
                                <div className="surplus-summary">
                                    <div className="surplus-row">
                                        <span>{t('monthClose.income')}</span>
                                        <span className="surplus-income">
                                            +{formatAmount(surplus.total_income)}
                                        </span>
                                    </div>
                                    <div className="surplus-row">
                                        <span>{t('monthClose.expenses')}</span>
                                        <span className="surplus-expense">
                                            -{formatAmount(surplus.total_expenses)}
                                        </span>
                                    </div>
                                    {Number(surplus.already_allocated) > 0 && (
                                        <div className="surplus-row">
                                            <span>{t('allocation.alreadyAllocated')}</span>
                                            <span className="surplus-alloc">
                                                -{formatAmount(surplus.already_allocated)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="surplus-row surplus-total">
                                        <span>{t('allocation.available')}</span>
                                        <span>{formatAmount(surplus.available_surplus)}</span>
                                    </div>
                                </div>
                                <button className="wizard-next-btn" onClick={() => setStep(2)}>
                                    {t('allocation.allocate')} <ArrowRight size={16} />
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="wizard-step">
                                <div className="distribute-header">
                                    <h3>{t('allocation.subtitle')}</h3>
                                    <button className="suggest-btn" onClick={fillSuggestions}>
                                        <Sparkles size={14} /> {t('budget.autoSuggest')}
                                    </button>
                                </div>

                                <div className="remaining-banner">
                                    <span className="remaining-banner-label">{t('allocation.available')}</span>
                                    <span className={`remaining-banner-amount${remaining < 0 ? ' over' : ''}${Math.round(remaining * 100) === 0 && totalAllocated > 0 ? ' done' : ''}`}>
                                        {formatAmount(Math.round(remaining * 100) === 0 ? 0 : remaining)}
                                    </span>
                                </div>

                                <div className="remaining-bar">
                                    <div
                                        className="remaining-fill"
                                        style={{ width: `${Math.min((totalAllocated / available) * 100, 100)}%` }}
                                    />
                                </div>

                                <div className="goals-allocation-list">
                                    {suggestions.map(s => (
                                        <div key={s.goal_id} className="goal-alloc-row">
                                            <div className="goal-alloc-info">
                                                <span className="goal-alloc-name">{s.goal_name}</span>
                                                <span className="goal-alloc-remaining">
                                                    {formatAmount(s.remaining)} {t('goals.remaining')}
                                                </span>
                                            </div>
                                            <div className="goal-alloc-input-wrap">
                                                <input
                                                    type="number"
                                                    className="goal-alloc-input"
                                                    value={allocations[s.goal_id] || ''}
                                                    onChange={(e) => updateAllocation(s.goal_id, e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                    max={Number(s.remaining)}
                                                />
                                                <span className="goal-alloc-currency">{currency}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="wizard-nav">
                                    <button className="wizard-back-btn" onClick={() => setStep(1)}>
                                        {t('common.back')}
                                    </button>
                                    <button
                                        className="wizard-next-btn"
                                        onClick={() => setStep(3)}
                                        disabled={totalAllocated <= 0 || Math.round(remaining * 100) < 0}
                                    >
                                        {t('monthClose.step2')} <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="wizard-step">
                                <h3>{t('common.confirm')} {t('allocation.title')}</h3>
                                <div className="confirm-list">
                                    {suggestions
                                        .filter(s => (allocations[s.goal_id] || 0) > 0)
                                        .map(s => (
                                            <div key={s.goal_id} className="confirm-row">
                                                <span>{s.goal_name}</span>
                                                <span className="confirm-amount">
                                                    {formatAmount(allocations[s.goal_id])}
                                                </span>
                                            </div>
                                        ))}
                                    <div className="confirm-row confirm-total">
                                        <span>{t('budget.totalPlanned') || 'Total'}</span>
                                        <span>{formatAmount(totalAllocated)}</span>
                                    </div>
                                </div>

                                <div className="wizard-nav">
                                    <button className="wizard-back-btn" onClick={() => setStep(2)}>
                                        {t('common.back')}
                                    </button>
                                    <button
                                        className="wizard-confirm-btn"
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                    >
                                        {submitting ? t('allocation.allocating') : t('allocation.allocate')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

