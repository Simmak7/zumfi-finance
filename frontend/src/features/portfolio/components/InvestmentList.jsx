import { TrendingUp, TrendingDown, ArrowUpRight, Minus } from 'lucide-react';
import { useInspector } from '../../../context/InspectorContext';
import { formatMoney } from '../../../utils/currencies';

const TYPE_LABELS = {
    etf: 'ETF',
    stock: 'Stock',
    bond: 'Bond',
    crypto: 'Crypto',
    other: 'Other',
};

export function InvestmentList({ investments, onRefresh, fullWidth, readOnly }) {
    const { openInspector } = useInspector();

    return (
        <div className={`portfolio-section ${fullWidth ? 'portfolio-section-full' : ''}`}>
            <h2 className="section-title">
                <TrendingUp size={20} />
                Investments
                <span className="section-count">{investments.length}</span>
            </h2>

            {investments.length === 0 ? (
                <div className="portfolio-empty">
                    <TrendingUp size={32} />
                    <p>No investments yet.</p>
                    <p className="empty-hint">Click "Add Investment" to start tracking your portfolio.</p>
                </div>
            ) : (
                <div className="portfolio-cards">
                    {investments.map(inv => {
                        const hasPrice = inv.current_price != null;
                        const isPositive = inv.gain_loss != null && inv.gain_loss >= 0;

                        return (
                            <div
                                key={inv.id}
                                className="portfolio-card investment-card"
                                onClick={readOnly ? undefined : () => openInspector('portfolio-investment-form', { investment: inv })}
                            >
                                <div className="card-top-row">
                                    <div
                                        className="card-color-dot"
                                        style={{ background: inv.color || '#6366f1' }}
                                    />
                                    <span className="card-name">{inv.name}</span>
                                    <span className="type-badge">{TYPE_LABELS[inv.investment_type] || inv.investment_type}</span>
                                </div>
                                {inv.ticker && (
                                    <div className="card-ticker">{inv.ticker}</div>
                                )}
                                <div className="card-units">
                                    {Number(inv.units)} units @ {Number(inv.avg_purchase_price)} {inv.currency}
                                </div>
                                <div className="card-balance">
                                    {hasPrice
                                        ? `${formatMoney(inv.current_value)} ${inv.currency}`
                                        : `${formatMoney(inv.total_invested)} ${inv.currency} (cost)`
                                    }
                                </div>
                                {hasPrice ? (
                                    <div className={`card-gain ${isPositive ? 'positive' : 'negative'}`}>
                                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        <span>
                                            {isPositive ? '+' : ''}{formatMoney(inv.gain_loss)} ({isPositive ? '+' : ''}{inv.gain_loss_pct}%)
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
        </div>
    );
}
