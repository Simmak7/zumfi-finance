import React, { useState, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, Receipt } from 'lucide-react';
import { getStockPnl } from '../../../services/api';
import { formatCurrency, formatMoney } from '../../../utils/currencies';
import { formatDate } from '../../../utils/dates';
import { useTranslation } from '../../../i18n';

export function StockPnlSection({ selectedMonth }) {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const result = await getStockPnl(selectedMonth);
                setData(result);
            } catch (err) {
                console.error('Failed to load P&L data:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
        const handleUpdate = () => load();
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [selectedMonth]);

    if (loading) return null;
    if (!data || (data.trades.length === 0 && data.dividends.length === 0)) return null;

    const hasTrades = data.trades.length > 0;
    const isPositive = data.total_realized_pnl_czk >= 0;

    return (
        <div className="portfolio-section full-width">
            <div className="section-header">
                <h2>
                    <Receipt size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {t('stockPnl.title')}
                </h2>
                {hasTrades && (
                    <span className={`pnl-total ${isPositive ? 'text-green' : 'text-red'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(data.total_realized_pnl_czk, 'CZK')}
                    </span>
                )}
            </div>

            {hasTrades && (
                <div className="pnl-trades-list">
                    <div className="pnl-trades-header">
                        <span>{t('stockPnl.stock')}</span>
                        <span>{t('stockPnl.sold')}</span>
                        <span>{t('stockPnl.qty')}</span>
                        <span>{t('stockPnl.cost')}</span>
                        <span>{t('stockPnl.proceeds')}</span>
                        <span className="pnl-col-right">{t('stockPnl.pnl')}</span>
                    </div>
                    {data.trades.map((trade) => {
                        const pnlPositive = Number(trade.gross_pnl) >= 0;
                        return (
                            <div key={trade.id} className="pnl-trade-row">
                                <div className="pnl-trade-name">
                                    <strong>{trade.ticker}</strong>
                                    <span className="pnl-trade-meta">{trade.name}</span>
                                </div>
                                <span className="pnl-trade-date">
                                    {trade.date_sold ? formatDate(trade.date_sold) : '—'}
                                </span>
                                <span className="pnl-trade-qty">
                                    {Number(trade.quantity).toFixed(2)}
                                </span>
                                <span>
                                    {formatCurrency(trade.cost_basis, trade.currency)}
                                </span>
                                <span>
                                    {formatCurrency(trade.gross_proceeds, trade.currency)}
                                </span>
                                <span className={`pnl-col-right ${pnlPositive ? 'text-green' : 'text-red'}`}>
                                    <span className="pnl-icon">
                                        {pnlPositive
                                            ? <ArrowUpRight size={14} />
                                            : <ArrowDownRight size={14} />}
                                    </span>
                                    {formatCurrency(trade.gross_pnl, trade.currency)}
                                    {trade.gross_pnl_czk != null && (
                                        <span className="pnl-czk-hint">
                                            {formatCurrency(trade.gross_pnl_czk, 'CZK')}
                                        </span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {data.dividends.length > 0 && (
                <div className="pnl-dividends">
                    <h3 className="pnl-sub-header">{t('stockPnl.dividends')}</h3>
                    {data.dividends.map((div) => (
                        <div key={div.id} className="pnl-trade-row">
                            <div className="pnl-trade-name">
                                <strong>{div.ticker || t('stockPnl.dividends')}</strong>
                                <span className="pnl-trade-meta">{div.description}</span>
                            </div>
                            <span className="pnl-trade-date">
                                {div.date ? formatDate(div.date) : '—'}
                            </span>
                            <span className="text-green">
                                {formatCurrency(Number(div.net_amount), div.currency)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
