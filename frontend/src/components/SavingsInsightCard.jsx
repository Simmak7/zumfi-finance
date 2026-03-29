import { Wallet, ArrowUp, ArrowDown, Minus, Target } from 'lucide-react';
import { formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './SmartComponents.css';

export function SavingsInsightCard({ savingsRate, goals, monthlyHistory }) {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';
    const prevMonth = monthlyHistory && monthlyHistory.length >= 2
        ? monthlyHistory[monthlyHistory.length - 2]
        : null;
    const currMonth = monthlyHistory && monthlyHistory.length >= 1
        ? monthlyHistory[monthlyHistory.length - 1]
        : null;

    const prevSaved = prevMonth ? prevMonth.total_income - prevMonth.total_expenses : null;
    const currSaved = currMonth ? currMonth.total_income - currMonth.total_expenses : null;
    const savedDiff = prevSaved != null && currSaved != null ? currSaved - prevSaved : null;

    const prevRate = prevMonth && prevMonth.total_income > 0
        ? ((prevMonth.total_income - prevMonth.total_expenses) / prevMonth.total_income * 100)
        : null;

    const rateDiff = prevRate != null ? savingsRate - prevRate : null;

    const activeGoals = (goals || []).filter(g => g.status === 'active' && g.target_amount > 0);
    const bestGoal = activeGoals.length > 0
        ? activeGoals.reduce((best, g) => {
            const pct = (g.current_amount || 0) / g.target_amount;
            const bestPct = (best.current_amount || 0) / best.target_amount;
            return pct > bestPct ? g : best;
        })
        : null;
    const bestGoalPct = bestGoal ? Math.round((bestGoal.current_amount || 0) / bestGoal.target_amount * 100) : 0;

    return (
        <div className="smart-card insight-card">
            <h3><Wallet size={16} /> {t('goals.savingsPulse')}</h3>
            <div className="insight-rate-row">
                <span className="insight-rate-value">{savingsRate.toFixed(1)}%</span>
                {rateDiff != null && rateDiff !== 0 && (
                    <span className={`insight-rate-delta ${rateDiff > 0 ? 'text-green' : 'text-red'}`}>
                        {rateDiff > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        {Math.abs(rateDiff).toFixed(1)}pp
                    </span>
                )}
                {rateDiff != null && rateDiff === 0 && (
                    <span className="insight-rate-delta text-muted"><Minus size={14} /> {t('goals.same')}</span>
                )}
            </div>
            {savedDiff != null && (
                <div className="insight-narrative">
                    {savedDiff >= 0
                        ? <span className="text-green">+{formatCurrency(savedDiff, currency)} {t('goals.moreSavedVsLastMonth')}</span>
                        : <span className="text-red">{formatCurrency(savedDiff, currency)} {t('goals.lessSavedVsLastMonth')}</span>
                    }
                </div>
            )}
            {bestGoal && (
                <div className="insight-goal-row">
                    <Target size={14} />
                    <span className="insight-goal-name">{bestGoal.name}</span>
                    <span className="insight-goal-pct">{bestGoalPct}%</span>
                </div>
            )}
        </div>
    );
}
