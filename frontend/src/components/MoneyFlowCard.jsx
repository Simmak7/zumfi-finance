import { ArrowLeftRight } from 'lucide-react';
import { formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './SmartComponents.css';

export function MoneyFlowCard({ totalIncome, totalExpenses, incomeBreakdown, expenseBreakdown }) {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const net = totalIncome - totalExpenses;
    const maxVal = Math.max(totalIncome, totalExpenses, 1);

    const topIncome = incomeBreakdown && incomeBreakdown.length > 0
        ? [...incomeBreakdown].sort((a, b) => b.amount - a.amount)[0]
        : null;
    const topExpense = expenseBreakdown && expenseBreakdown.length > 0
        ? [...expenseBreakdown].sort((a, b) => b.amount - a.amount)[0]
        : null;

    return (
        <div className="smart-card insight-card">
            <h3><ArrowLeftRight size={16} /> {t('moneyFlow.title')}</h3>
            <div className="flow-bars">
                <div className="flow-bar-row">
                    <span className="flow-label">{t('moneyFlow.in')}</span>
                    <div className="flow-bar-bg">
                        <div
                            className="flow-bar-fill income"
                            style={{ width: `${(totalIncome / maxVal) * 100}%` }}
                        />
                    </div>
                    <span className="flow-amount">{formatMoney(totalIncome)}</span>
                </div>
                <div className="flow-bar-row">
                    <span className="flow-label">{t('moneyFlow.out')}</span>
                    <div className="flow-bar-bg">
                        <div
                            className="flow-bar-fill expense"
                            style={{ width: `${(totalExpenses / maxVal) * 100}%` }}
                        />
                    </div>
                    <span className="flow-amount">{formatMoney(totalExpenses)}</span>
                </div>
            </div>
            <div className={`flow-net ${net >= 0 ? 'text-green' : 'text-red'}`}>
                {net >= 0 ? '+' : ''}{formatCurrency(net, currency)} {net >= 0 ? t('moneyFlow.surplus') : t('moneyFlow.deficit')}
            </div>
            <div className="flow-sources">
                {topIncome && (
                    <div className="flow-source-row">
                        <span className="flow-source-label">{t('moneyFlow.topIncome')}</span>
                        <span>{topIncome.category}</span>
                    </div>
                )}
                {topExpense && (
                    <div className="flow-source-row">
                        <span className="flow-source-label">{t('moneyFlow.topExpense')}</span>
                        <span>{topExpense.category}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
