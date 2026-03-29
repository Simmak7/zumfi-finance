import { Bell, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './SmartComponents.css';

export function BillAlertCard({ billStatuses }) {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';
    if (!billStatuses || billStatuses.length === 0) {
        return (
            <div className="smart-card insight-card">
                <h3><Bell size={16} /> {t('bills.billAlerts')}</h3>
                <div className="insight-empty">{t('bills.noBillsTracked')}</div>
            </div>
        );
    }

    const paid = billStatuses.filter(b => b.status === 'paid');
    const pending = billStatuses.filter(b => b.status === 'pending');
    const overdue = billStatuses.filter(b => b.status === 'overdue');

    const allPaid = overdue.length === 0 && pending.length === 0;

    return (
        <div className="smart-card insight-card">
            <h3><Bell size={16} /> {t('bills.billAlerts')}</h3>
            <div className="insight-bill-counts">
                <span className="bill-count-badge paid">{paid.length} {t('bills.paid')}</span>
                {pending.length > 0 && (
                    <span className="bill-count-badge pending">{pending.length} {t('bills.pending')}</span>
                )}
                {overdue.length > 0 && (
                    <span className="bill-count-badge overdue">{overdue.length} {t('bills.overdue')}</span>
                )}
            </div>
            {allPaid ? (
                <div className="insight-all-good">
                    <CheckCircle size={16} />
                    <span>{t('bills.allPaid')}</span>
                </div>
            ) : overdue.length > 0 ? (
                <div className="insight-list">
                    {overdue.slice(0, 3).map((b, i) => (
                        <div key={i} className="insight-list-item">
                            <span className="insight-item-name">
                                <AlertTriangle size={12} className="text-red" />
                                {b.name}
                            </span>
                            <span className="text-red">{formatCurrency(b.expected_amount, currency)}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="insight-list">
                    {pending.slice(0, 3).map((b, i) => (
                        <div key={i} className="insight-list-item">
                            <span className="insight-item-name">{b.name}</span>
                            <span className="text-yellow">{formatCurrency(b.expected_amount, currency)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
