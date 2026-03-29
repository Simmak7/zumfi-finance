import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Pencil } from 'lucide-react';
import { useInspector } from '../../../context/InspectorContext';
import { StockDetailModal } from './StockDetailModal';
import { formatMoney } from '../../../utils/currencies';

const TYPE_LABELS = {
    stock: 'Stock',
    etf: 'ETF',
};

export function StockHoldingList({ stocks = [], onRefresh, fullWidth, readOnly }) {
    const { openInspector } = useInspector();
    const [selectedStock, setSelectedStock] = useState(null);

    return (
        <div className={`portfolio-section ${fullWidth ? 'portfolio-section-full' : ''}`}>
            <h2 className="section-title">
                <BarChart3 size={20} />
                Stock Portfolio
                <span className="section-count">{stocks.length}</span>
            </h2>

            {stocks.length === 0 ? (
                <div className="portfolio-empty">
                    <BarChart3 size={32} />
                    <p>No stock holdings yet.</p>
                    <p className="empty-hint">Click "Add Stock" to start tracking your stocks & ETFs.</p>
                </div>
            ) : (
                <div className="portfolio-cards">
                    {stocks.map(stock => {
                        const hasPrice = stock.current_price != null;
                        const isPositive = stock.gain_loss != null && stock.gain_loss >= 0;

                        return (
                            <div
                                key={stock.id}
                                className="portfolio-card stock-card"
                                onClick={() => setSelectedStock(stock)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="card-top-row">
                                    <div
                                        className="card-color-dot"
                                        style={{ background: stock.color || '#0ea5e9' }}
                                    />
                                    <span className="card-name">{stock.name}</span>
                                    {!readOnly && (
                                        <button
                                            className="goal-edit-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openInspector('portfolio-stock-form', { stock });
                                            }}
                                            title="Edit stock"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                    <span className="type-badge">{TYPE_LABELS[stock.holding_type] || stock.holding_type}</span>
                                </div>
                                {stock.ticker && (
                                    <div className="card-ticker">{stock.ticker}</div>
                                )}
                                <div className="card-units">
                                    {Number(stock.shares).toFixed(2)} shares @ {formatMoney(stock.avg_cost_per_share)} {stock.currency}
                                </div>
                                <div className="card-balance">
                                    {hasPrice
                                        ? `${formatMoney(stock.market_value)} ${stock.currency}`
                                        : `${formatMoney(stock.total_cost)} ${stock.currency} (cost)`
                                    }
                                </div>
                                {hasPrice ? (
                                    <div className={`card-gain ${isPositive ? 'positive' : 'negative'}`}>
                                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        <span>
                                            {isPositive ? '+' : ''}{formatMoney(stock.gain_loss)} ({isPositive ? '+' : ''}{stock.gain_loss_pct}%)
                                        </span>
                                    </div>
                                ) : (
                                    <div className="card-gain neutral">
                                        <Minus size={14} />
                                        <span>No price set</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedStock && (
                <StockDetailModal
                    stock={selectedStock}
                    onClose={() => setSelectedStock(null)}
                />
            )}
        </div>
    );
}
