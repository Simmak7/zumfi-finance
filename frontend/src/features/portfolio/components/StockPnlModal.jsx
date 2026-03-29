import React from 'react';
import { X, ArrowUpDown, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../../utils/currencies';
import { formatDate, formatMonthLabel } from '../../../utils/dates';
import '../../dashboard/components/CategoryTransactionsModal.css';

export function StockPnlModal({ stockConverted, stockPnl, selectedMonth, onClose }) {
    const preferredCurrency = stockConverted?.preferred_currency || 'CZK';

    const realizedCzk = stockPnl ? stockPnl.total_realized_pnl_czk : 0;
    const isPositive = realizedCzk >= 0;

    const trades = stockPnl?.trades || [];
    const dividends = stockPnl?.dividends || [];
    const totalDividends = stockPnl?.total_dividends || 0;

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '660px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <ArrowUpDown size={18} style={{ color: isPositive ? '#22c55e' : '#f43f5e' }} />
                        <h2>Realized P&L</h2>
                        <span className="ctm-amount" style={{ color: isPositive ? '#22c55e' : '#f43f5e' }}>
                            {isPositive ? '+' : ''}{formatCurrency(realizedCzk, preferredCurrency)}
                        </span>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-subtitle">
                    Realized gains from closed trades in {preferredCurrency}
                    {selectedMonth && ` — ${formatMonthLabel(selectedMonth)}`}
                </div>

                <div className="ctm-body">
                    {trades.length > 0 && (
                        <div>
                            <div style={{
                                fontSize: '0.8rem',
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.5rem',
                                paddingBottom: '0.25rem',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                Closed Trades
                            </div>
                            <div className="ctm-list">
                                {trades.map((trade) => {
                                    const pnl = Number(trade.gross_pnl);
                                    const pnlCzk = trade.gross_pnl_czk != null ? Number(trade.gross_pnl_czk) : null;
                                    const tradePositive = pnl >= 0;
                                    const Icon = tradePositive ? TrendingUp : TrendingDown;
                                    return (
                                        <div key={trade.id} className="ctm-tx-row">
                                            <div className="ctm-tx-info" style={{ gap: '0.2rem' }}>
                                                <span className="ctm-tx-desc" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Icon size={14} style={{ color: tradePositive ? '#22c55e' : '#f43f5e', flexShrink: 0 }} />
                                                    {trade.ticker || trade.name}
                                                    {trade.ticker && trade.name && trade.ticker !== trade.name && (
                                                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                                            {trade.name}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="ctm-tx-meta">
                                                    {trade.date_sold ? formatDate(trade.date_sold) : 'N/A'}
                                                    {trade.date_acquired && ` (bought ${formatDate(trade.date_acquired)})`}
                                                    {' \u2014 '}{Number(trade.quantity)} shares
                                                </span>
                                                <span className="ctm-tx-meta">
                                                    Cost {formatCurrency(trade.cost_basis, trade.currency)}
                                                    {' \u2192 '}
                                                    Proceeds {formatCurrency(trade.gross_proceeds, trade.currency)}
                                                </span>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div
                                                    className="ctm-tx-amount"
                                                    style={{ color: tradePositive ? '#22c55e' : '#f43f5e' }}
                                                >
                                                    {tradePositive ? '+' : ''}{formatCurrency(pnl, trade.currency)}
                                                </div>
                                                {pnlCzk != null && trade.currency !== preferredCurrency && (
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'rgba(255,255,255,0.35)',
                                                        fontFamily: "'Monaco', monospace",
                                                    }}>
                                                        {pnlCzk >= 0 ? '+' : ''}{formatCurrency(pnlCzk, preferredCurrency)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Dividends */}
                    {dividends.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{
                                fontSize: '0.8rem',
                                color: 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.5rem',
                                paddingBottom: '0.25rem',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}>
                                Dividends ({formatCurrency(totalDividends, preferredCurrency)})
                            </div>
                            <div className="ctm-list">
                                {dividends.map((div) => (
                                    <div key={div.id} className="ctm-tx-row">
                                        <div className="ctm-tx-info">
                                            <span className="ctm-tx-desc">
                                                {div.ticker || div.name || div.description || 'Dividend'}
                                            </span>
                                            <span className="ctm-tx-meta">
                                                {div.date ? formatDate(div.date) : 'N/A'}
                                                {div.withholding_tax > 0 && ` \u2014 Tax: ${formatCurrency(Number(div.withholding_tax), div.currency)}`}
                                            </span>
                                        </div>
                                        <span className="ctm-tx-amount" style={{ color: '#22c55e' }}>
                                            +{formatCurrency(div.net_amount, div.currency)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {trades.length === 0 && dividends.length === 0 && (
                        <div className="ctm-empty" style={{ marginTop: '1rem' }}>
                            No realized trades or dividends recorded yet.
                        </div>
                    )}
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {trades.length} trade{trades.length !== 1 ? 's' : ''}
                        {dividends.length > 0 && ` \u00B7 ${dividends.length} dividend${dividends.length !== 1 ? 's' : ''}`}
                    </span>
                </div>
            </div>
        </div>
    );
}
