import { ArrowUp, ArrowDown, Target, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';

export function KpiCards({ totalIncome, totalExpenses, savingsRate, remainingBudget, onIncomeClick, currency = 'CZK' }) {
    const { t } = useTranslation();
    return (
        <div className="kpi-grid">
            <div
                className="kpi-card interactive"
                data-zumfi-zone="kpi-income"
                onClick={onIncomeClick}
            >
                <div className="kpi-icon income"><ArrowUp size={20} /></div>
                <div>
                    <span className="kpi-label">{t('kpi.totalIncome')}</span>
                    <div className="kpi-value">{formatCurrency(totalIncome, currency)}</div>
                </div>
            </div>

            <div className="kpi-card" data-zumfi-zone="kpi-expenses">
                <div className="kpi-icon expense"><ArrowDown size={20} /></div>
                <div>
                    <span className="kpi-label">{t('kpi.totalSpend')}</span>
                    <div className="kpi-value">{formatCurrency(totalExpenses, currency)}</div>
                </div>
            </div>

            <div className="kpi-card interactive" data-zumfi-zone="kpi-savings">
                <div className="kpi-icon savings"><Target size={20} /></div>
                <div>
                    <span className="kpi-label">{t('kpi.savingsRate')}</span>
                    <div className="kpi-value">{savingsRate.toFixed(1)}%</div>
                </div>
            </div>

            <div className="kpi-card interactive" data-zumfi-zone="kpi-budget">
                <div className="kpi-icon wallet"><Wallet size={20} /></div>
                <div>
                    <span className="kpi-label">{t('kpi.remainingBudget')}</span>
                    <div className="kpi-value">{formatCurrency(remainingBudget, currency)}</div>
                </div>
            </div>
        </div>
    );
}
