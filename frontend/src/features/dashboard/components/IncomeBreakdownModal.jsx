import React from 'react';
import { X, ArrowUp } from 'lucide-react';
import { formatCurrency } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';
import './CategoryTransactionsModal.css';

export function IncomeBreakdownModal({ items, total, onClose, currency = 'CZK' }) {
    const { t } = useTranslation();
    const sorted = [...items].sort((a, b) => b.amount - a.amount);

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div className="ctm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <ArrowUp size={18} style={{ color: '#22c55e' }} />
                        <h2>{t('incomeBreakdown.title')}</h2>
                        <span className="ctm-amount">
                            {formatCurrency(total, currency)}
                        </span>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-body">
                    {sorted.length === 0 ? (
                        <div className="ctm-empty">{t('incomeBreakdown.noIncomeData')}</div>
                    ) : (
                        <div className="ctm-list">
                            {sorted.map((item, idx) => {
                                const pct = total > 0 ? Math.round(item.amount / total * 100) : 0;
                                return (
                                    <div key={idx} className="ctm-tx-row">
                                        <div className="ctm-tx-info">
                                            <span className="ctm-tx-desc" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span
                                                    className="ctm-color-dot"
                                                    style={{ background: item.color || '#22c55e' }}
                                                />
                                                {item.category}
                                            </span>
                                            <span className="ctm-tx-meta">{t('incomeBreakdown.ofTotal', { pct })}</span>
                                        </div>
                                        <span className="ctm-tx-amount" style={{ color: '#22c55e' }}>
                                            {formatCurrency(item.amount, currency)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {sorted.length !== 1
                            ? t('incomeBreakdown.categoryCount', { count: sorted.length })
                            : t('incomeBreakdown.categoryCountSingular', { count: sorted.length })}
                    </span>
                </div>
            </div>
        </div>
    );
}
