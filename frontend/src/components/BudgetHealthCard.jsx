import { PieChart } from 'lucide-react';
import { formatMoney } from '../utils/currencies';
import { useTranslation } from '../i18n';
import './SmartComponents.css';

export function BudgetHealthCard({ budgetSummary }) {
    const { t } = useTranslation();
    if (!budgetSummary || budgetSummary.length === 0) {
        return (
            <div className="smart-card insight-card">
                <h3><PieChart size={16} /> {t('budget.budgetHealth')}</h3>
                <div className="insight-empty">{t('budget.noBudgetConfigured')}</div>
            </div>
        );
    }

    const withBudget = budgetSummary.filter(b => b.planned_amount > 0);
    if (withBudget.length === 0) {
        return (
            <div className="smart-card insight-card">
                <h3><PieChart size={16} /> {t('budget.budgetHealth')}</h3>
                <div className="insight-empty">{t('budget.noBudgetConfigured')}</div>
            </div>
        );
    }

    const overBudget = withBudget.filter(b => b.actual_amount > b.planned_amount);
    const totalPlanned = withBudget.reduce((s, b) => s + b.planned_amount, 0);
    const totalActual = withBudget.reduce((s, b) => s + b.actual_amount, 0);
    const usagePct = totalPlanned > 0 ? Math.min(Math.round(totalActual / totalPlanned * 100), 150) : 0;
    const barClass = usagePct > 100 ? 'danger' : usagePct > 85 ? 'warning' : 'good';

    const topOver = [...overBudget]
        .sort((a, b) => (b.actual_amount - b.planned_amount) - (a.actual_amount - a.planned_amount))
        .slice(0, 3);

    return (
        <div className="smart-card insight-card">
            <h3><PieChart size={16} /> {t('budget.budgetHealth')}</h3>
            <div className="insight-summary-line">
                {overBudget.length === 0
                    ? <span className="text-green">{t('budget.allWithinBudget')}</span>
                    : <span className="text-red">{t('budget.overBudgetCount', { over: overBudget.length, total: withBudget.length })}</span>
                }
            </div>
            <div className="insight-bar-wrap">
                <div className="insight-bar-bg">
                    <div
                        className={`insight-bar-fill ${barClass}`}
                        style={{ width: `${Math.min(usagePct, 100)}%` }}
                    />
                </div>
                <span className="insight-bar-label">{t('budget.used', { pct: usagePct })}</span>
            </div>
            {topOver.length > 0 && (
                <div className="insight-list">
                    {topOver.map((b, i) => (
                        <div key={i} className="insight-list-item">
                            <span className="insight-item-name">{b.category_name}</span>
                            <span className="text-red">+{formatMoney(b.actual_amount - b.planned_amount)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
