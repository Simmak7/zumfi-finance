import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Save, Loader2, Upload, Calculator, PenLine } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import { updateSavingsAccount } from '../../../services/api';
import { formatCurrency, formatMoney } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useMonth } from '../../../context/MonthContext';
import { useTranslation } from '../../../i18n';
import '../../dashboard/components/CategoryTransactionsModal.css';

export function AddSavingsModal({ accounts, onClose, onSuccess }) {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const { settings } = useSettings();
    const { selectedMonth } = useMonth();
    const currency = settings?.preferred_currency || 'CZK';

    const navigate = useNavigate();
    const [balances, setBalances] = useState(() =>
        accounts.reduce((acc, a) => ({ ...acc, [a.id]: String(a.balance) }), {})
    );
    const [loading, setLoading] = useState(false);

    const totalNew = Object.values(balances).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalOld = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const diff = totalNew - totalOld;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const updates = accounts
                .filter(a => String(a.balance) !== balances[a.id])
                .map(a => updateSavingsAccount(a.id, {
                    name: a.name,
                    institution: a.institution || '',
                    balance: Number(balances[a.id]),
                    interest_rate: a.interest_rate ? Number(a.interest_rate) : null,
                    currency: a.currency,
                    notes: a.notes || '',
                    color: a.color,
                }, selectedMonth));
            await Promise.all(updates);
            window.dispatchEvent(new Event('portfolio-updated'));
            if (onSuccess) await onSuccess();
            addToast(t('portfolio.savingsUpdated'), "success");
            onClose();
        } catch (err) {
            console.error("Error updating savings:", err);
            addToast(t('portfolioForm.failedToSave'), "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div
                className="ctm-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '520px' }}
            >
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <h2>{t('portfolio.updateSavingsValues')}</h2>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ctm-subtitle">
                    {t('portfolio.updateSavingsDesc')}
                </div>

                <div className="ctm-body">
                    {/* Method tabs */}
                    <div className="add-savings-methods">
                        <button className="add-savings-method active">
                            <PenLine size={14} />
                            <span>{t('portfolio.manualEntry')}</span>
                        </button>
                        <button
                            className="add-savings-method"
                            onClick={() => { onClose(); navigate('/import'); }}
                        >
                            <Upload size={14} />
                            <span>{t('portfolio.importStatement')}</span>
                        </button>
                        <button
                            className="add-savings-method"
                            onClick={() => { onClose(); navigate('/?allocate=1'); }}
                        >
                            <Calculator size={14} />
                            <span>{t('portfolio.allocateLeftover')}</span>
                        </button>
                    </div>

                    {accounts.length === 0 ? (
                        <div className="ctm-empty">
                            {t('portfolio.noAccountsToUpdate')}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="add-savings-accounts">
                                {accounts.map(account => (
                                    <div key={account.id} className="add-savings-account-row">
                                        <div className="add-savings-account-info">
                                            <div
                                                className="card-color-dot"
                                                style={{ background: account.color || '#22c55e' }}
                                            />
                                            <div>
                                                <span className="add-savings-account-name">{account.name}</span>
                                                <span className="add-savings-account-old">
                                                    {t('portfolio.currentBalance')}: {formatMoney(account.balance)} {account.currency}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="add-savings-account-input">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={balances[account.id]}
                                                onChange={e => setBalances({ ...balances, [account.id]: e.target.value })}
                                            />
                                            <span className="add-savings-currency">{account.currency}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="add-savings-total">
                                <span>{t('portfolio.newTotal')}</span>
                                <span className="add-savings-total-value">
                                    {formatCurrency(totalNew, currency)}
                                    {diff !== 0 && (
                                        <span className={`add-savings-diff ${diff > 0 ? 'positive' : 'negative'}`}>
                                            ({diff > 0 ? '+' : ''}{formatCurrency(diff, currency)})
                                        </span>
                                    )}
                                </span>
                            </div>

                            <div className="form-actions" style={{ marginTop: '1rem' }}>
                                <button type="submit" className="portfolio-form save-btn" disabled={loading}>
                                    {loading ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                                    <span>{t('portfolio.updateBalances')}</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
