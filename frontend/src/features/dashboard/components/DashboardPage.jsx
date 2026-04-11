import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PiggyBank, CalendarCheck } from 'lucide-react';
import {
    getDashboardSummary, getGoals, getAnomalies,
    getForecast, getTopCategories, getMonthlyHistory,
} from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { AllocationWizard } from '../../goals/components/AllocationWizard';
import { AllocationInfoPopup } from '../../goals/components/AllocationInfoPopup';
import { AnomalyCard } from '../../../components/AnomalyCard';
import { SpendForecast } from '../../../components/SpendForecast';
import { KpiCards } from './KpiCards';
import { IncomeExpensesChart } from './IncomeExpensesChart';
import { CategoryDonutChart } from './CategoryDonutChart';
import { TopCategories } from '../../../components/TopCategories';
import { WelcomeCard } from './WelcomeCard';
import { MonthCloseWizard, isMonthClosed } from './MonthCloseWizard';
import { IncomeBreakdownModal } from './IncomeBreakdownModal';
import { formatMonthLabel } from '../../../utils/dates';
import { MonthPicker } from '../../../components/MonthPicker';
import { useMonth } from '../../../context/MonthContext';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { useAuth } from '../../../context/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';
import '../../../pages/Dashboard.css';

export function DashboardPage() {
    const [summary, setSummary] = useState(null);
    const [goals, setGoals] = useState([]);
    const [anomalies, setAnomalies] = useState([]);
    const [forecast, setForecast] = useState(null);
    const [topCategories, setTopCategories] = useState([]);
    const [monthlyHistory, setMonthlyHistory] = useState([]);
    const { selectedMonth, setSelectedMonth, maxMonth } = useMonth();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const [error, setError] = useState(null);
    const [showAllocation, setShowAllocation] = useState(false);
    const [showAllocInfo, setShowAllocInfo] = useState(false);
    const [showMonthClose, setShowMonthClose] = useState(false);
    const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);
    const [hiddenCategories, setHiddenCategories] = useState(new Set());
    const { addToast } = useToast();
    const { setPageData } = useZumfi();
    const { user } = useAuth();
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    // Auto-open allocation wizard when navigated with ?allocate=1
    useEffect(() => {
        if (searchParams.get('allocate') === '1' && summary) {
            setShowAllocation(true);
            searchParams.delete('allocate');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, summary]);

    // Welcome toast — once per login session
    useEffect(() => {
        if (!sessionStorage.getItem('zumi_welcomed') && user) {
            const greetings = [
                'Hi! Welcome back',
                'Hey! Good to see you',
                'Welcome back!',
            ];
            const msg = greetings[Math.floor(Math.random() * greetings.length)];
            addToast(msg, 'success', 4000);
            sessionStorage.setItem('zumi_welcomed', '1');
        }
    }, [user]);

    useEffect(() => {
        fetchAll();
        const handleGoalUpdate = () => fetchGoals();
        const handleCategoryUpdate = () => fetchAll();
        const handleSettingsUpdate = () => fetchAll();
        const handlePullRefresh = () => fetchAll();
        const handleStatementsUpdate = () => fetchAll();
        window.addEventListener('goals-updated', handleGoalUpdate);
        window.addEventListener('categories-updated', handleCategoryUpdate);
        window.addEventListener('settings-updated', handleSettingsUpdate);
        window.addEventListener('pull-to-refresh', handlePullRefresh);
        window.addEventListener('statements-updated', handleStatementsUpdate);
        return () => {
            window.removeEventListener('goals-updated', handleGoalUpdate);
            window.removeEventListener('categories-updated', handleCategoryUpdate);
            window.removeEventListener('settings-updated', handleSettingsUpdate);
            window.removeEventListener('pull-to-refresh', handlePullRefresh);
            window.removeEventListener('statements-updated', handleStatementsUpdate);
        };
    }, [selectedMonth]);

    // Feed dashboard data to Zumfi for proximity interactions
    useEffect(() => {
        if (summary) {
            const filteredBreakdown = hiddenCategories.size > 0
                ? (summary.expense_breakdown || []).filter(c => !hiddenCategories.has(c.category))
                : summary.expense_breakdown;
            const filteredTopCats = hiddenCategories.size > 0
                ? topCategories.filter(c => !hiddenCategories.has(c.category))
                : topCategories;
            const hasData = summary.total_income > 0 || summary.total_expenses > 0;
            const monthClosed = hasData && isMonthClosed(selectedMonth, user?.id);
            setPageData({
                _page: 'dashboard',
                totalIncome: summary.total_income,
                totalExpenses: summary.total_expenses,
                savingsRate: summary.savings_rate,
                remainingBudget: summary.remaining_budget,
                alreadyAllocated: summary.already_allocated || 0,
                expenseBreakdown: filteredBreakdown,
                topCategories: filteredTopCats,
                monthlyHistory,
                forecast,
                anomalies,
                goals,
                hasData,
                monthClosed,
                selectedMonth,
                maxMonth,
            });
        }
        return () => setPageData(null);
    }, [summary, goals, topCategories, monthlyHistory, forecast, anomalies, selectedMonth, maxMonth, hiddenCategories, user?.id, setPageData]);

    const fetchAll = async () => {
        setError(null);
        try {
            const [s, g] = await Promise.all([
                getDashboardSummary(selectedMonth),
                getGoals(),
            ]);
            setSummary(s);
            setGoals(g || []);
        } catch (err) {
            console.error("Critical data failed:", err);
            setError("Failed to load financial data. Is the backend running?");
            return;
        }

        // Smart features + charts (non-critical)
        try {
            const [an, forc, top, history] = await Promise.all([
                getAnomalies(selectedMonth), getForecast(),
                getTopCategories(selectedMonth),
                getMonthlyHistory(12),
            ]);
            setAnomalies(an || []);
            setForecast(forc || null);
            setTopCategories(top || []);
            // Filter out months with no data (both income and expenses are 0)
            const filtered = (history || []).filter(
                d => d.total_income > 0 || d.total_expenses > 0
            );
            setMonthlyHistory(filtered);
        } catch (smartErr) {
            console.warn("Smart features failed:", smartErr);
        }
    };

    const fetchGoals = async () => {
        try { setGoals(await getGoals()); } catch (e) { console.error(e); }
    };


    if (error) return <div className="error-screen">{t('dashboard.failedToLoad')}</div>;
    if (!summary) return (
        <div className="dashboard-page">
            <div className="kpi-grid">
                <SkeletonLoader variant="card" count={4} />
            </div>
            <div className="dashboard-charts-row">
                <SkeletonLoader variant="chart" />
                <SkeletonLoader variant="chart" />
            </div>
        </div>
    );

    const monthLabel = formatMonthLabel(selectedMonth);

    return (
        <div className="dashboard-page">
            <header className="dash-header" data-zumfi-zone="header">
                <div>
                    <h1>{t('dashboard.title')}</h1>
                    <p>{t('dashboard.overviewFor', { month: monthLabel })}</p>
                </div>
                <div className="header-actions">
                    {(() => {
                        const hasData = summary && (summary.total_income > 0 || summary.total_expenses > 0);
                        const closed = hasData && isMonthClosed(selectedMonth, user?.id);
                        return (
                            <button
                                className={`month-close-btn${closed ? ' month-close-btn-dimmed' : ''}`}
                                data-zumfi-zone="close-month-btn"
                                onClick={() => setShowMonthClose(true)}
                                disabled={!hasData}
                                style={!hasData ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                            >
                                <CalendarCheck size={18} />
                                <span>{closed ? t('dashboard.monthOverview') : t('dashboard.closeMonth')}</span>
                            </button>
                        );
                    })()}
                    {summary && summary.remaining_budget > 0 && (() => {
                        const fullyAllocated = (summary.already_allocated || 0) >= summary.remaining_budget;
                        return (
                            <button
                                className={`allocate-btn${fullyAllocated ? ' allocate-btn-dimmed' : ''}`}
                                data-zumfi-zone="allocate-savings-btn"
                                onClick={() => fullyAllocated ? setShowAllocInfo(true) : setShowAllocation(true)}
                            >
                                <PiggyBank size={18} />
                                <span>{t('dashboard.allocateSavings')}</span>
                            </button>
                        );
                    })()}
                    <div data-zumfi-zone="month-picker">
                        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} max={maxMonth} />
                    </div>
                </div>
            </header>

            {summary.total_income === 0 && summary.total_expenses === 0 && (
                <div data-zumfi-zone="welcome-card">
                    <WelcomeCard summary={summary} userId={user?.id} />
                </div>
            )}

            <KpiCards
                totalIncome={summary.total_income}
                totalExpenses={summary.total_expenses}
                savingsRate={summary.savings_rate}
                remainingBudget={summary.remaining_budget}
                onIncomeClick={() => setShowIncomeBreakdown(true)}
                currency={currency}
            />

            {/* Charts Row: Income vs Expenses */}
            <div className="dashboard-charts-row">
                <IncomeExpensesChart data={monthlyHistory} currency={currency} />
            </div>

            {/* Breakdown Row: Category Donut (1/2) + Top Expenses (1/2) */}
            <div className="dashboard-breakdown-row">
                <CategoryDonutChart expenseBreakdown={summary.expense_breakdown} selectedMonth={selectedMonth} hiddenCategories={hiddenCategories} onHiddenChange={setHiddenCategories} currency={currency} />
                <div data-zumfi-zone="top-categories">
                    <TopCategories categories={topCategories} />
                </div>
            </div>

            <div className="dashboard-section-title" data-zumfi-zone="insights-title">{t('dashboard.smartInsights')}</div>

            <div className="insights-grid">
                <div className="insight-column">
                    <SpendForecast
                        current={summary.total_expenses}
                        predicted={forecast ? forecast.predicted_total_expenses : 0}
                        recentParams={forecast?.based_on_months}
                    />
                </div>
                <div className="insight-column" data-zumfi-zone="anomalies">
                    {anomalies.length > 0 ? (
                        <AnomalyCard anomalies={anomalies} />
                    ) : (
                        <div className="empty-state-card">
                            <h3>{t('dashboard.noAnomalies')}</h3>
                            <p>{t('dashboard.spendingNormal')}</p>
                        </div>
                    )}
                </div>
            </div>

            {showAllocation && (
                <AllocationWizard
                    month={selectedMonth}
                    onClose={() => {
                        setShowAllocation(false);
                        fetchAll();
                    }}
                />
            )}

            {showAllocInfo && (
                <AllocationInfoPopup
                    month={selectedMonth}
                    onClose={() => setShowAllocInfo(false)}
                />
            )}

            {showMonthClose && (
                <MonthCloseWizard
                    month={selectedMonth}
                    userId={user?.id}
                    onClose={() => {
                        setShowMonthClose(false);
                        fetchAll();
                    }}
                />
            )}

            {showIncomeBreakdown && (
                <IncomeBreakdownModal
                    items={summary.income_breakdown || []}
                    total={summary.total_income}
                    onClose={() => setShowIncomeBreakdown(false)}
                    currency={currency}
                />
            )}
        </div>
    );
}
