import React from 'react';
import { X, Building2 } from 'lucide-react';
import { formatCurrency, formatMoney } from '../../../utils/currencies';
import '../../dashboard/components/CategoryTransactionsModal.css';

export function PropertyBreakdownModal({ properties, preferredCurrency, totalValue, onClose }) {
    if (!properties || properties.length === 0) return null;

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '620px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <Building2 size={18} style={{ color: '#f97316' }} />
                        <h2>Properties Value</h2>
                        <span className="ctm-amount">
                            {formatCurrency(totalValue, preferredCurrency)}
                        </span>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-subtitle">
                    Values converted to {preferredCurrency}
                </div>

                <div className="ctm-body">
                    <div className="ctm-list">
                        {properties.map((prop) => {
                            const currency = prop.currency || 'CZK';
                            const originalValue = prop.display_value ?? prop.purchase_price;
                            const converted = prop.converted_value ?? originalValue;
                            const isSameCurrency = currency === preferredCurrency;
                            const pct = totalValue > 0
                                ? Math.round(converted / totalValue * 100)
                                : 0;

                            return (
                                <div key={prop.id} className="ctm-tx-row">
                                    <div className="ctm-tx-info">
                                        <span className="ctm-tx-desc">
                                            {prop.name}
                                            <span style={{
                                                marginLeft: '0.5rem',
                                                fontSize: '0.75rem',
                                                color: 'rgba(255,255,255,0.4)',
                                            }}>
                                                {formatMoney(originalValue)} {currency}
                                            </span>
                                        </span>
                                        <span className="ctm-tx-meta">
                                            {isSameCurrency
                                                ? 'Base currency'
                                                : prop.exchange_rate
                                                    ? `1 ${currency} = ${prop.exchange_rate} ${preferredCurrency}`
                                                    : 'Rate unavailable'
                                            }
                                            {' \u2014 '}{pct}% of total
                                        </span>
                                    </div>
                                    <span className="ctm-tx-amount" style={{ color: '#f97316' }}>
                                        {formatCurrency(converted, preferredCurrency)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}
                    </span>
                </div>
            </div>
        </div>
    );
}
