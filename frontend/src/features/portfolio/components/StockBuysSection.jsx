import React, { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { getStockBuys } from '../../../services/api';
import { formatCurrency } from '../../../utils/currencies';
import { formatDate } from '../../../utils/dates';
import { useSettings } from '../../../context/SettingsContext';

export function StockBuysSection({ selectedMonth }) {
    const { settings } = useSettings();
    const preferredCurrency = settings?.preferred_currency || 'CZK';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const result = await getStockBuys(selectedMonth);
                setData(result);
            } catch (err) {
                console.error('Failed to load stock buys:', err);
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
    if (!data || data.buys.length === 0) return null;

    return (
        <div className="portfolio-section full-width">
            <div className="section-header">
                <h2>
                    <ShoppingCart size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Bought Stocks
                </h2>
                <span className="pnl-total" style={{ color: '#60a5fa' }}>
                    {formatCurrency(data.total_invested, preferredCurrency)}
                </span>
            </div>

            <div className="pnl-trades-list">
                <div className="pnl-trades-header">
                    <span>Stock</span>
                    <span>Date</span>
                    <span>Qty</span>
                    <span>Price</span>
                    <span className="pnl-col-right">Invested</span>
                </div>
                {data.buys.map((buy, idx) => (
                    <div key={idx} className="pnl-trade-row">
                        <div className="pnl-trade-name">
                            <strong>{buy.ticker}</strong>
                        </div>
                        <span className="pnl-trade-date">
                            {formatDate(buy.date)}
                        </span>
                        <span className="pnl-trade-qty">
                            {buy.quantity.toFixed(2)}
                        </span>
                        <span>
                            {formatCurrency(buy.price, buy.currency)}
                        </span>
                        <span className="pnl-col-right" style={{ color: '#60a5fa' }}>
                            {formatCurrency(buy.value + buy.fees, buy.currency)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
