import { PiggyBank, TrendingUp, Wallet, ArrowUpDown, BarChart3, Building2 } from 'lucide-react';
import { formatCurrency, formatMoney } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';

function Delta({ current, previous, t }) {
    if (previous == null) return null;
    const diff = current - previous;
    if (diff === 0) return null;
    const isPositive = diff > 0;
    return (
        <span className={`kpi-delta ${isPositive ? 'text-green' : 'text-red'}`}>
            {isPositive ? '+' : ''}{formatMoney(diff)} {t('portfolio.vsPrevMonth')}
        </span>
    );
}

export function PortfolioKpiCards({
    summary, activeTab = 'overview',
    selectedMonth,
    onStockClick, stockConverted,
    stockPnl, onPnlClick,
    onPropertyClick,
    onPortfolioClick,
}) {
    const { t } = useTranslation();
    const {
        total_savings,
        total_investments_value,
        total_stocks_value = 0,
        total_stocks_cost = 0,
        total_properties_value = 0,
        total_properties_cost = 0,
        total_portfolio,
        overall_gain_loss,
        overall_gain_loss_pct,
        stocks_gain_loss = 0,
        stocks_gain_loss_pct = 0,
        previous_total_savings,
        previous_total_investments,
        previous_total_stocks,
        previous_total_properties,
        previous_total_portfolio,
    } = summary;

    const isPositive = overall_gain_loss >= 0;
    const currency = summary.preferred_currency || 'CZK';

    // Realized P&L only (closed trades) — already month-filtered from backend
    const realizedCzk = stockPnl ? stockPnl.total_realized_pnl_czk : 0;
    const hasStockPnlData = stockPnl != null;
    const isStocksPnlPositive = realizedCzk >= 0;
    const preferredCurrency = stockConverted?.preferred_currency || 'CZK';

    // Stock portfolio value from monthly history for the selected month
    const history = stockConverted?.monthly_history || [];
    const selectedEntry = selectedMonth
        ? history.find(h => h.month === selectedMonth)
        : (history.length > 0 ? history[history.length - 1] : null);
    const selectedIdx = selectedEntry
        ? history.indexOf(selectedEntry)
        : history.length - 1;
    const stockPortfolioValue = selectedEntry ? selectedEntry.total_converted : (stockConverted?.total_converted || 0);
    const prevMonthEntry = selectedIdx > 0 ? history[selectedIdx - 1] : null;
    const stockPortfolioDelta = prevMonthEntry != null
        ? stockPortfolioValue - prevMonthEntry.total_converted
        : null;
    const isStockDeltaPositive = (stockPortfolioDelta || 0) >= 0;

    // ── Overview tab: Total Portfolio (hero) + 3 smaller cards ──
    if (activeTab === 'overview') {
        return (
            <>
                <div
                    className="kpi-card kpi-card-hero clickable"
                    data-zumfi-zone="port-kpi-total"
                    onClick={onPortfolioClick || undefined}
                    title={t('portfolio.portfolioBreakdown')}
                >
                    <div className="kpi-icon portfolio-icon">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <span className="kpi-label">{t('portfolio.totalPortfolioValue')}</span>
                        <div className="kpi-value kpi-value-hero">
                            {formatCurrency(total_portfolio, currency)}
                        </div>
                        <Delta current={total_portfolio} previous={previous_total_portfolio} t={t} />
                    </div>
                </div>

                <div className="kpi-grid">
                    <div className="kpi-card" data-zumfi-zone="port-kpi-savings">
                        <div className="kpi-icon savings-icon">
                            <PiggyBank size={20} />
                        </div>
                        <div>
                            <span className="kpi-label">{t('portfolio.totalSavings')}</span>
                            <div className="kpi-value">
                                {formatCurrency(total_savings, currency)}
                            </div>
                            <Delta current={total_savings} previous={previous_total_savings} t={t} />
                        </div>
                    </div>

                    <div className="kpi-card" data-zumfi-zone="port-kpi-stocks">
                        <div className="kpi-icon stock-icon">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <span className="kpi-label">{t('portfolio.stockPortfolio')}</span>
                            <div className="kpi-value">
                                {formatCurrency(total_stocks_value, currency)}
                            </div>
                            <Delta current={total_stocks_value} previous={previous_total_stocks} t={t} />
                        </div>
                    </div>

                    <div className="kpi-card" data-zumfi-zone="port-kpi-properties">
                        <div className="kpi-icon property-icon">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <span className="kpi-label">{t('portfolio.properties')}</span>
                            <div className="kpi-value">
                                {formatCurrency(total_properties_value, currency)}
                            </div>
                            <Delta current={total_properties_value} previous={previous_total_properties} t={t} />
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ── Savings tab ──
    if (activeTab === 'savings') {
        return (
            <div className="kpi-grid">
                <div className="kpi-card" data-zumfi-zone="port-kpi-savings">
                    <div className="kpi-icon savings-icon">
                        <PiggyBank size={20} />
                    </div>
                    <div>
                        <span className="kpi-label">{t('portfolio.totalSavings')}</span>
                        <div className="kpi-value">
                            {formatCurrency(total_savings, currency)}
                        </div>
                        <Delta current={total_savings} previous={previous_total_savings} t={t} />
                    </div>
                </div>
            </div>
        );
    }

    // ── Properties tab ──
    if (activeTab === 'investments') {
        return (
            <div className="kpi-grid">
                <div
                    className={`kpi-card ${onPropertyClick ? 'clickable' : ''}`}
                    data-zumfi-zone="port-kpi-properties"
                    onClick={onPropertyClick || undefined}
                    title={onPropertyClick ? t('portfolio.portfolioBreakdown') : undefined}
                >
                    <div className="kpi-icon property-icon">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <span className="kpi-label">{t('portfolio.propertiesValue')}</span>
                        <div className="kpi-value">
                            {formatCurrency(total_properties_value, currency)}
                        </div>
                        <Delta current={total_properties_value} previous={previous_total_properties} t={t} />
                    </div>
                </div>
            </div>
        );
    }

    // ── Stocks tab ──
    if (activeTab === 'stocks') {
        return (
            <div className="kpi-grid">
                <div
                    className={`kpi-card ${onStockClick ? 'clickable' : ''}`}
                    data-zumfi-zone="port-kpi-stocks"
                    onClick={onStockClick || undefined}
                    title={onStockClick ? t('portfolio.portfolioBreakdown') : undefined}
                >
                    <div className="kpi-icon stock-icon">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <span className="kpi-label">{t('portfolio.stockPortfolioValue')}</span>
                        <div className="kpi-value">
                            {stockConverted
                                ? formatCurrency(stockPortfolioValue, preferredCurrency)
                                : formatMoney(total_stocks_value)}
                        </div>
                        {stockPortfolioDelta != null && (
                            <span className={`kpi-delta ${isStockDeltaPositive ? 'text-green' : 'text-red'}`}>
                                {isStockDeltaPositive ? '+' : ''}{formatCurrency(stockPortfolioDelta, preferredCurrency)} {t('portfolio.vsPrevMonth')}
                            </span>
                        )}
                    </div>
                </div>

                <div
                    className={`kpi-card ${onPnlClick ? 'clickable' : ''}`}
                    data-zumfi-zone="port-kpi-pnl"
                    onClick={onPnlClick || undefined}
                    title={onPnlClick ? t('stockPnl.title') : undefined}
                >
                    <div className={`kpi-icon ${isStocksPnlPositive ? 'gain-icon' : 'loss-icon'}`}>
                        <ArrowUpDown size={20} />
                    </div>
                    <div>
                        <span className="kpi-label">{t('portfolio.profitLossBalance')}</span>
                        <div className={`kpi-value ${isStocksPnlPositive ? 'text-green' : 'text-red'}`}>
                            {hasStockPnlData
                                ? <>
                                    {isStocksPnlPositive ? '+' : ''}{formatCurrency(realizedCzk, currency)}
                                  </>
                                : <>
                                    {stocks_gain_loss >= 0 ? '+' : ''}{formatMoney(stocks_gain_loss)}
                                  </>
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
