import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Check, Loader2 } from 'lucide-react';
import { getSmartBudgetSuggestions, createOrUpdateBudget } from '../../../services/api';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';
import './BudgetSuggestModal.css';

const TREND_CONFIG = {
    increasing: { icon: TrendingUp, color: '#f43f5e', label: 'Rising' },
    decreasing: { icon: TrendingDown, color: '#10b981', label: 'Falling' },
    stable: { icon: Minus, color: '#71717a', label: 'Stable' },
};

export function BudgetSuggestModal({ month, onClose, onApplied }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [amounts, setAmounts] = useState({});
    const [selected, setSelected] = useState(new Set());
    const [applying, setApplying] = useState(false);
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';

    useEffect(() => {
        (async () => {
            try {
                const result = await getSmartBudgetSuggestions(6);
                setData(result);
                const initAmounts = {};
                const initSelected = new Set();
                for (const s of result.suggestions) {
                    initAmounts[s.category_id] = String(Math.round(Number(s.suggested_amount)));
                    initSelected.add(s.category_id);
                }
                setAmounts(initAmounts);
                setSelected(initSelected);
            } catch (err) {
                setError(t('budgetSuggest.failedToLoadSuggestions'));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggleSelect = (catId) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    const handleApply = async () => {
        setApplying(true);
        try {
            for (const catId of selected) {
                const amt = Number(amounts[catId]);
                if (!amt || amt <= 0) continue;
                await createOrUpdateBudget({
                    category_id: catId,
                    month,
                    planned_amount: amt,
                });
            }
            window.dispatchEvent(new Event('budget-updated'));
            onApplied();
        } catch (err) {
            setError(t('budgetSuggest.failedToApply'));
        } finally {
            setApplying(false);
        }
    };

    const selectedTotal = Array.from(selected).reduce((sum, id) => {
        return sum + (Number(amounts[id]) || 0);
    }, 0);

    return (
        <div className="bsm-overlay" onClick={onClose}>
            <div className="bsm-modal" onClick={e => e.stopPropagation()}>
                <div className="bsm-header">
                    <div>
                        <h2 className="bsm-title">{t('budgetSuggest.title')}</h2>
                        <p className="bsm-subtitle">{t('budgetSuggest.subtitle')}</p>
                    </div>
                    <button className="bsm-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="bsm-body">
                    {loading && (
                        <div className="bsm-loading">
                            <Loader2 className="spin" size={24} />
                            <p>{t('budgetSuggest.analyzing')}</p>
                        </div>
                    )}

                    {error && <div className="bsm-error">{error}</div>}

                    {data && !loading && (
                        <>
                            <div className="bsm-overview">
                                <div className="bsm-overview-title">
                                    {t('budgetSuggest.ruleBreakdown')}
                                </div>
                                <p className="bsm-overview-income">
                                    {t('budgetSuggest.avgMonthlyIncome')} <strong>{formatCurrency(data.total_income, currency)}</strong>
                                </p>
                                <div className="bsm-rule-pills">
                                    <div className="bsm-pill needs">
                                        <span className="bsm-pill-label">{t('budgetSuggest.needs')}</span>
                                        <span className="bsm-pill-value">
                                            {formatCurrency(data.needs_budget, currency)}
                                        </span>
                                    </div>
                                    <div className="bsm-pill wants">
                                        <span className="bsm-pill-label">{t('budgetSuggest.wants')}</span>
                                        <span className="bsm-pill-value">
                                            {formatCurrency(data.wants_budget, currency)}
                                        </span>
                                    </div>
                                    <div className="bsm-pill savings">
                                        <span className="bsm-pill-label">{t('budgetSuggest.savings')}</span>
                                        <span className="bsm-pill-value">
                                            {formatCurrency(data.savings_budget, currency)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bsm-categories-header">
                                <span>{t('budgetSuggest.categorySuggestions', { count: data.suggestions.length })}</span>
                                <span className="bsm-selected-total">
                                    {t('budgetSuggest.selectedTotal', { amount: formatCurrency(selectedTotal, currency) })}
                                </span>
                            </div>

                            <div className="bsm-category-list">
                                {data.suggestions.map(s => {
                                    const trend = TREND_CONFIG[s.trend.direction];
                                    const TrendIcon = trend.icon;
                                    const isSelected = selected.has(s.category_id);
                                    const ruleColors = {
                                        needs: '#6366f1',
                                        wants: '#a855f7',
                                        savings: '#10b981',
                                    };

                                    return (
                                        <div
                                            key={s.category_id}
                                            className={`bsm-category-card ${isSelected ? 'selected' : ''}`}
                                        >
                                            <div className="bsm-card-top">
                                                <label className="bsm-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(s.category_id)}
                                                    />
                                                    <span className="bsm-cat-name">{s.category_name}</span>
                                                </label>
                                                <div className="bsm-card-badges">
                                                    <span
                                                        className="bsm-rule-badge"
                                                        style={{ borderColor: ruleColors[s.rule_category] }}
                                                    >
                                                        {s.rule_category}
                                                    </span>
                                                    <span className="bsm-trend-badge" style={{ color: trend.color }}>
                                                        <TrendIcon size={12} />
                                                        {trend.label}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bsm-card-amounts">
                                                {s.current_budget != null && (
                                                    <div className="bsm-amount-row">
                                                        <span className="bsm-amount-label">{t('budgetSuggest.currentLabel')}</span>
                                                        <span className="bsm-amount-value muted">
                                                            {formatCurrency(s.current_budget, currency)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="bsm-amount-row">
                                                    <span className="bsm-amount-label">{t('budgetSuggest.suggestedLabel')}</span>
                                                    <div className="bsm-amount-input-group">
                                                        <input
                                                            type="number"
                                                            className="bsm-amount-input"
                                                            value={amounts[s.category_id] || ''}
                                                            onChange={e => setAmounts(prev => ({
                                                                ...prev,
                                                                [s.category_id]: e.target.value,
                                                            }))}
                                                        />
                                                        <span className="bsm-currency">{currency}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="bsm-reasoning">{s.reasoning}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {data.suggestions.length === 0 && (
                                <div className="bsm-empty">
                                    {t('budgetSuggest.noSpendingData')}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="bsm-footer">
                    <button className="bsm-cancel-btn" onClick={onClose}>
                        {t('budgetSuggest.cancel')}
                    </button>
                    <button
                        className="bsm-apply-btn"
                        onClick={handleApply}
                        disabled={applying || selected.size === 0}
                    >
                        {applying ? (
                            <><Loader2 className="spin" size={14} /> {t('budgetSuggest.applying')}</>
                        ) : (
                            <><Check size={14} /> {t('budgetSuggest.applySuggestions', { count: selected.size })}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
