import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import {
    getBudgetSummary, getCategories, getDashboardSummary,
} from '../../../services/api';
import { BudgetComparisonChart } from './BudgetComparisonChart';
import { BudgetSuggestModal } from './BudgetSuggestModal';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { formatMonthLabel } from '../../../utils/dates';
import { MonthPicker } from '../../../components/MonthPicker';
import { useMonth } from '../../../context/MonthContext';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n';
import '../../../pages/Budget.css';

export function BudgetPage() {
    const { setPageData } = useZumfi();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [budgetSummary, setBudgetSummary] = useState(null);
    const [categories, setCategories] = useState([]);
    const [expenseBreakdown, setExpenseBreakdown] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSuggestModal, setShowSuggestModal] = useState(false);
    const { selectedMonth, setSelectedMonth, maxMonth } = useMonth();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summary, cats, dashSummary] = await Promise.all([
                getBudgetSummary(selectedMonth),
                getCategories(),
                getDashboardSummary(selectedMonth),
            ]);
            setBudgetSummary(summary);
            setCategories(cats || []);
            setExpenseBreakdown(dashSummary?.expense_breakdown || []);
        } catch (err) {
            addToast(t('budget.failedToLoad'), "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const handleUpdate = () => fetchData();
        window.addEventListener('budget-updated', handleUpdate);
        return () => window.removeEventListener('budget-updated', handleUpdate);
    }, [selectedMonth]);

    useEffect(() => {
        if (budgetSummary) {
            const totalPlanned = budgetSummary.total_planned ?? 0;
            const totalActual = budgetSummary.total_actual ?? 0;
            const remaining = totalPlanned - totalActual;
            const usagePct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
            setPageData({
                _page: 'budget',
                budgetSummary,
                categories,
                selectedMonth,
                totalPlanned,
                totalActual,
                remaining,
                usagePct,
                expenseBreakdown,
            });
        }
        return () => setPageData(null);
    }, [budgetSummary, categories, expenseBreakdown, selectedMonth, setPageData]);

    const monthLabel = formatMonthLabel(selectedMonth);

    if (loading) return (
        <div className="page-container">
            <SkeletonLoader variant="card" count={3} />
            <SkeletonLoader variant="chart" />
        </div>
    );

    return (
        <div className="page-container">
            <header className="page-header" data-zumfi-zone="budget-header">
                <div>
                    <h1 className="page-title">{t('budget.title')}</h1>
                    <p className="page-subtitle">{t('budget.plannedVsReality', { month: monthLabel })}</p>
                </div>
                <div className="budget-header-actions">
                    <button
                        className="budget-action-btn suggest"
                        data-zumfi-zone="budget-suggest"
                        onClick={() => setShowSuggestModal(true)}
                    >
                        <Sparkles size={16} />
                        <span>{t('budget.autoSuggest')}</span>
                    </button>
                    <div data-zumfi-zone="budget-month-picker">
                        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} max={maxMonth} />
                    </div>
                </div>
            </header>

            <div data-zumfi-zone="budget-stats">
                <BudgetComparisonChart
                    budgetSummary={budgetSummary}
                    categories={categories}
                    month={selectedMonth}
                    onBudgetChange={fetchData}
                    expenseBreakdown={expenseBreakdown}
                />
            </div>

            {showSuggestModal && (
                <BudgetSuggestModal
                    month={selectedMonth}
                    onClose={() => setShowSuggestModal(false)}
                    onApplied={() => {
                        setShowSuggestModal(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}
