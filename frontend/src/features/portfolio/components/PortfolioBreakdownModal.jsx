import React from 'react';
import { X, Wallet, PiggyBank, BarChart3, Building2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/currencies';
import '../../dashboard/components/CategoryTransactionsModal.css';

export function PortfolioBreakdownModal({ summary, onClose }) {
    if (!summary) return null;

    const currency = summary.preferred_currency || 'CZK';
    const items = [
        {
            label: 'Savings',
            value: summary.total_savings,
            icon: <PiggyBank size={16} />,
            color: '#22c55e',
        },
        {
            label: 'Stock Portfolio',
            value: summary.total_stocks_value,
            icon: <BarChart3 size={16} />,
            color: '#0ea5e9',
        },
        {
            label: 'Properties',
            value: summary.total_properties_value,
            icon: <Building2 size={16} />,
            color: '#f97316',
        },
    ];

    // Only show items that have a value > 0
    const visibleItems = items.filter(item => item.value > 0);

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '520px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <Wallet size={18} style={{ color: '#a855f7' }} />
                        <h2>Total Portfolio Value</h2>
                        <span className="ctm-amount">
                            {formatCurrency(summary.total_portfolio, currency)}
                        </span>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-subtitle">
                    Breakdown of all assets in {currency}
                </div>

                <div className="ctm-body">
                    <div className="ctm-list">
                        {visibleItems.map((item) => {
                            const pct = summary.total_portfolio > 0
                                ? Math.round(item.value / summary.total_portfolio * 100)
                                : 0;

                            return (
                                <div key={item.label} className="ctm-tx-row">
                                    <div className="ctm-tx-info">
                                        <span className="ctm-tx-desc" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ color: item.color }}>{item.icon}</span>
                                            {item.label}
                                        </span>
                                        <span className="ctm-tx-meta">
                                            {pct}% of total portfolio
                                        </span>
                                    </div>
                                    <span className="ctm-tx-amount" style={{ color: item.color }}>
                                        {formatCurrency(item.value, currency)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {visibleItems.length} asset {visibleItems.length !== 1 ? 'categories' : 'category'}
                    </span>
                </div>
            </div>
        </div>
    );
}
