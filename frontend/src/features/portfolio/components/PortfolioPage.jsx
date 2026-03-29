import React, { useState, useEffect } from 'react';
import { PiggyBank, TrendingUp, BarChart3, Building2 } from 'lucide-react';
import { getPortfolioSummary, getStockBreakdown, getStockPnl } from '../../../services/api';
import { useInspector } from '../../../context/InspectorContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { PortfolioKpiCards } from './PortfolioKpiCards';
import { SavingsAccountList } from './SavingsAccountList';
import { StockHoldingList } from './StockHoldingList';
import { PortfolioAllocationChart } from './PortfolioAllocationChart';
import { SavingsGoalsList } from './SavingsGoalsList';
import { SavingsTrendChart } from './SavingsTrendChart';
import { StockTrendChart } from './StockTrendChart';
import { StockCurrencyModal } from './StockCurrencyModal';
import { StockPnlModal } from './StockPnlModal';
import { StockPnlSection } from './StockPnlSection';
import { PropertyList } from './PropertyList';
import { PropertyForm } from './PropertyForm';
import { PropertyTrendChart } from './PropertyTrendChart';
import { PropertyBreakdownModal } from './PropertyBreakdownModal';
import { PortfolioBreakdownModal } from './PortfolioBreakdownModal';
import { PortfolioTrendChart } from './PortfolioTrendChart';
import { AddSavingsModal } from './AddSavingsModal';
import { formatMonthLabel } from '../../../utils/dates';
import { MonthPicker } from '../../../components/MonthPicker';
import { useMonth } from '../../../context/MonthContext';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { useTranslation } from '../../../i18n';
import '../../../pages/Portfolio.css';

export function PortfolioPage() {
    const { t } = useTranslation();

    const TABS = [
        { key: 'overview', label: t('portfolio.overview') },
        { key: 'savings', label: t('portfolio.savings') },
        { key: 'investments', label: t('portfolio.properties') },
        { key: 'stocks', label: t('portfolio.stockPortfolio') },
    ];
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const { selectedMonth, setSelectedMonth, maxMonth } = useMonth();
    const [showStockModal, setShowStockModal] = useState(false);
    const [showPnlModal, setShowPnlModal] = useState(false);
    const [showPropertyModal, setShowPropertyModal] = useState(false);
    const [showPortfolioModal, setShowPortfolioModal] = useState(false);
    const [showAddSavingsModal, setShowAddSavingsModal] = useState(false);
    const [showPropertyForm, setShowPropertyForm] = useState(false);
    const [stockBreakdown, setStockBreakdown] = useState(null);
    const [stockPnl, setStockPnl] = useState(null);
    const { openInspector } = useInspector();
    const { setPageData } = useZumfi();

    const fetchData = async () => {
        setError(null);
        try {
            const data = await getPortfolioSummary(selectedMonth);
            setSummary(data);
        } catch (err) {
            console.error("Error fetching portfolio:", err);
            setError(t('portfolio.failedToLoad'));
        }
    };

    useEffect(() => {
        getStockBreakdown(12, selectedMonth).then(setStockBreakdown).catch(() => {});
        const handleUpdate = () => {
            getStockBreakdown(12, selectedMonth).then(setStockBreakdown).catch(() => {});
        };
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [selectedMonth]);

    useEffect(() => {
        getStockPnl(selectedMonth).then(setStockPnl).catch(() => {});
        const handleUpdate = () => {
            getStockPnl(selectedMonth).then(setStockPnl).catch(() => {});
        };
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [selectedMonth]);

    useEffect(() => {
        fetchData();
        const handleUpdate = () => fetchData();
        window.addEventListener('portfolio-updated', handleUpdate);
        return () => window.removeEventListener('portfolio-updated', handleUpdate);
    }, [selectedMonth]);

    // Feed portfolio data to Zumfi for proximity interactions
    useEffect(() => {
        if (summary) {
            setPageData({
                _page: 'portfolio',
                summary,
                activeTab,
                stockPnl,
                stockBreakdown,
                selectedMonth,
            });
        }
        return () => setPageData(null);
    }, [summary, activeTab, stockPnl, stockBreakdown, selectedMonth, setPageData]);

    if (error) return <div className="error-screen">{error}</div>;
    if (!summary) return (
        <div className="portfolio-page">
            <div className="kpi-grid">
                <SkeletonLoader variant="card" count={4} />
            </div>
        </div>
    );

    const isHistorical = summary.is_historical;
    const isClosed = summary.is_closed;
    const monthLabel = formatMonthLabel(selectedMonth);

    return (
        <div className="portfolio-page">
            <header className="portfolio-header" data-zumfi-zone="port-header">
                <div>
                    <h1>{t('portfolio.title')}</h1>
                    <p className="portfolio-subtitle">
                        {isHistorical ? t('portfolio.snapshotFor', { month: monthLabel }) : t('portfolio.trackWealth')}
                    </p>
                </div>
                <div className="header-actions">
                    {!isClosed && activeTab === 'savings' && (
                        <button
                            className="portfolio-add-btn savings"
                            onClick={() => setShowAddSavingsModal(true)}
                        >
                            <PiggyBank size={18} />
                            <span>{t('portfolio.addSavingsBtn')}</span>
                        </button>
                    )}
                    {activeTab === 'investments' && (
                        <button
                            className="portfolio-add-btn property"
                            onClick={() => setShowPropertyForm(true)}
                        >
                            <Building2 size={18} />
                            <span>{t('portfolio.addPropertyBtn')}</span>
                        </button>
                    )}
                    {!isClosed && activeTab === 'stocks' && (
                        <button
                            className="portfolio-add-btn stock"
                            onClick={() => openInspector('portfolio-stock-form', {})}
                        >
                            <BarChart3 size={18} />
                            <span>{t('portfolio.addStockBtn')}</span>
                        </button>
                    )}
                    <MonthPicker value={selectedMonth} onChange={setSelectedMonth} max={maxMonth} />
                </div>
            </header>

            <div className="portfolio-tabs" data-zumfi-zone="port-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`portfolio-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <span className="tab-label-full">{tab.label}</span>
                        <span className="tab-label-short">{
                            tab.key === 'stocks' ? (t('portfolio.stocks') || 'Stocks')
                            : tab.key === 'overview' ? (t('portfolio.overviewShort') || 'Overview')
                            : tab.label
                        }</span>
                    </button>
                ))}
            </div>

            <div data-zumfi-zone="port-kpi">
                <PortfolioKpiCards
                    summary={summary}
                    activeTab={activeTab}
                    selectedMonth={selectedMonth}
                    onStockClick={activeTab === 'stocks' ? () => setShowStockModal(true) : undefined}
                    stockConverted={stockBreakdown}
                    stockPnl={stockPnl}
                    onPnlClick={activeTab === 'stocks' ? () => setShowPnlModal(true) : undefined}
                    onPropertyClick={() => setShowPropertyModal(true)}
                    onPortfolioClick={() => setShowPortfolioModal(true)}
                />
            </div>

            {isHistorical && summary.total_portfolio === 0 && (
                <div className="portfolio-empty" style={{ marginBottom: '2rem' }}>
                    <p>{t('portfolio.noSnapshotData', { month: monthLabel })}</p>
                    <p className="empty-hint">{t('portfolio.snapshotHint')}</p>
                </div>
            )}

            {activeTab === 'overview' && (
                <>
                    <div data-zumfi-zone="port-trend">
                        <PortfolioTrendChart />
                    </div>
                    {summary.allocation.length > 0 && (
                        <div data-zumfi-zone="port-allocation">
                            <PortfolioAllocationChart
                                allocation={summary.allocation}
                                totalPortfolio={summary.total_portfolio}
                            />
                        </div>
                    )}
                </>
            )}

            {activeTab === 'savings' && (
                <>
                    <div data-zumfi-zone="port-savings-trend">
                        <SavingsTrendChart />
                    </div>
                    <div data-zumfi-zone="port-savings">
                        <SavingsAccountList
                            accounts={summary.savings_accounts}
                            onRefresh={fetchData}
                            fullWidth
                            readOnly={isClosed}
                        />
                    </div>
                    <div data-zumfi-zone="port-goals">
                        <SavingsGoalsList fullWidth />
                    </div>
                </>
            )}

            {activeTab === 'investments' && (
                <>
                    <div data-zumfi-zone="port-property-trend">
                        <PropertyTrendChart />
                    </div>
                    <div data-zumfi-zone="port-properties">
                        <PropertyList
                            properties={summary.properties || []}
                            onRefresh={fetchData}
                            fullWidth
                            readOnly={isClosed}
                        />
                    </div>
                </>
            )}

            {activeTab === 'stocks' && (
                <>
                    <div data-zumfi-zone="port-stock-trend">
                        <StockTrendChart />
                    </div>
                    <div data-zumfi-zone="port-stocks">
                    <StockHoldingList
                        stocks={summary.stock_holdings || []}
                        onRefresh={fetchData}
                        fullWidth
                        readOnly={isClosed}
                    />
                    </div>
                    {(() => {
                        const holdings = summary.stock_holdings || [];
                        const filtered = summary.is_historical
                            ? holdings.filter(h => !h.snapshot_month || h.snapshot_month === selectedMonth)
                            : holdings;
                        if (filtered.length === 0) return null;
                        const typeColors = { etf: '#6366f1', stock: '#0ea5e9', crypto: '#a855f7', bond: '#f59e0b', other: '#64748b' };
                        const typeTotals = {};
                        for (const h of filtered) {
                            const val = Number(h.converted_value ?? h.market_value ?? h.total_cost ?? 0);
                            const t = h.holding_type || 'other';
                            typeTotals[t] = (typeTotals[t] || 0) + val;
                        }
                        const totalVal = Object.values(typeTotals).reduce((s, v) => s + v, 0);
                        if (totalVal <= 0) return null;
                        const typeAlloc = Object.entries(typeTotals).map(([t, val]) => ({
                            name: t === 'etf' ? 'ETF' : t.charAt(0).toUpperCase() + t.slice(1),
                            value: Math.round(val * 100) / 100,
                            percentage: Math.round(val / totalVal * 1000) / 10,
                            color: typeColors[t] || '#64748b',
                        }));
                        return (
                            <div data-zumfi-zone="port-stock-alloc">
                                <PortfolioAllocationChart
                                    allocation={typeAlloc}
                                    totalPortfolio={totalVal}
                                />
                            </div>
                        );
                    })()}
                    <div data-zumfi-zone="port-stock-pnl">
                        <StockPnlSection selectedMonth={selectedMonth} />
                    </div>
                </>
            )}

            {showStockModal && (
                <StockCurrencyModal onClose={() => setShowStockModal(false)} selectedMonth={selectedMonth} />
            )}
            {showPnlModal && (
                <StockPnlModal
                    stockConverted={stockBreakdown}
                    stockPnl={stockPnl}
                    selectedMonth={selectedMonth}
                    onClose={() => setShowPnlModal(false)}
                />
            )}
            {showPropertyModal && (
                <PropertyBreakdownModal
                    properties={summary.properties || []}
                    preferredCurrency={summary.preferred_currency || 'CZK'}
                    totalValue={summary.total_properties_value}
                    onClose={() => setShowPropertyModal(false)}
                />
            )}
            {showPortfolioModal && (
                <PortfolioBreakdownModal
                    summary={summary}
                    onClose={() => setShowPortfolioModal(false)}
                />
            )}
            {showAddSavingsModal && (
                <AddSavingsModal
                    accounts={summary.savings_accounts || []}
                    onClose={() => setShowAddSavingsModal(false)}
                    onSuccess={fetchData}
                />
            )}
            {showPropertyForm && (
                <PropertyForm
                    onClose={() => setShowPropertyForm(false)}
                />
            )}
        </div>
    );
}
