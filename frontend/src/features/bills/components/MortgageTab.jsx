import React, { useState, useEffect } from 'react';
import { Plus, Home, Bell, Clock, Check, CheckCircle, Search, X, Loader2 } from 'lucide-react';
import { getMortgageStatus, confirmMortgagePayment, searchTransactions } from '../../../services/api';
import { useMonth } from '../../../context/MonthContext';
import { useToast } from '../../../context/ToastContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { EmptyState } from '../../../components/EmptyState';
import { formatMoney, formatCurrency } from '../../../utils/currencies';
import { MortgageDetailModal } from './MortgageDetail';
import { AddMortgageModal } from './AddMortgageModal';
import { useTranslation } from '../../../i18n';

export function MortgageTab() {
    const { selectedMonth } = useMonth();
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailMortgageId, setDetailMortgageId] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [confirmingId, setConfirmingId] = useState(null); // mortgage id being confirmed
    const [txPicker, setTxPicker] = useState(null); // { mortgageId, transactions, loading }

    const fetchMortgages = async () => {
        setLoading(true);
        try {
            const data = await getMortgageStatus(selectedMonth);
            setStatuses(data);
        } catch (err) {
            console.error('Error fetching mortgages:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMortgages();
        const handler = () => fetchMortgages();
        window.addEventListener('mortgages-updated', handler);
        return () => window.removeEventListener('mortgages-updated', handler);
    }, [selectedMonth]);

    // Quick confirm: persist an auto-matched payment
    const handleQuickConfirm = async (mortgageId, transactionId, amount) => {
        setConfirmingId(mortgageId);
        try {
            await confirmMortgagePayment(mortgageId, {
                month: selectedMonth,
                transaction_id: transactionId,
                paid_amount: amount,
            });
            await fetchMortgages();
        } catch (err) {
            console.error('Error confirming payment:', err);
            addToast(t('mortgageTab.confirmFailed'), 'error');
        } finally {
            setConfirmingId(null);
        }
    };

    // Open transaction picker for manual confirmation
    const handleOpenTxPicker = async (e, mortgageId) => {
        e.stopPropagation();
        setTxPicker({ mortgageId, transactions: [], loading: true });
        try {
            const [y, m] = selectedMonth.split('-');
            const startDate = `${y}-${m}-01`;
            const endDate = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
            const result = await searchTransactions({
                start_date: startDate,
                end_date: endDate,
                type: 'expense',
                limit: 50,
            });
            setTxPicker({ mortgageId, transactions: result.transactions || result, loading: false });
        } catch (err) {
            console.error('Error loading transactions:', err);
            setTxPicker(null);
        }
    };

    // Confirm with a picked transaction
    const handlePickTransaction = async (mortgageId, tx) => {
        setConfirmingId(mortgageId);
        try {
            await confirmMortgagePayment(mortgageId, {
                month: selectedMonth,
                transaction_id: tx.id,
                paid_amount: Math.abs(Number(tx.amount)),
            });
            setTxPicker(null);
            await fetchMortgages();
        } catch (err) {
            console.error('Error confirming payment:', err);
            addToast(t('mortgageTab.confirmFailed'), 'error');
        } finally {
            setConfirmingId(null);
        }
    };

    const totalOutstanding = statuses.reduce(
        (sum, s) => sum + Number(s.mortgage.remaining_balance || 0), 0,
    );
    const totalMonthly = statuses.reduce(
        (sum, s) => sum + Number(s.mortgage.monthly_payment || 0), 0,
    );

    if (loading) {
        return <SkeletonLoader variant="list-item" count={3} />;
    }

    if (statuses.length === 0) {
        return (
            <EmptyState
                icon={Home}
                title={t('mortgageTab.noMortgages')}
                description={t('mortgageTab.noMortgagesDesc')}
                actionLabel={t('mortgageTab.addMortgage')}
                onAction={() => setShowAddModal(true)}
            />
        );
    }

    // Collect all active reminders across mortgages
    const allReminders = statuses.flatMap(({ mortgage }) =>
        (mortgage.fix_expiry_reminders || [])
            .filter(r => r.is_active)
            .map(r => ({ ...r, mortgageName: mortgage.name }))
    );

    return (
        <div className="mortgage-content">
            <div className="mortgage-summary-card" data-zumfi-zone="mortgage-summary">
                <span className="bills-total-label">{t('mortgageTab.outstandingBalance')}</span>
                <span className="bills-total-amount">
                    {statuses.length === 1
                        ? formatCurrency(totalOutstanding, statuses[0].mortgage.currency)
                        : `${formatMoney(totalOutstanding)}`
                    }
                </span>
                <span className="bills-total-count">
                    {t('mortgageTab.mortgageCount', { count: statuses.length })}
                    {' · '}
                    {statuses.length === 1
                        ? formatCurrency(totalMonthly, statuses[0].mortgage.currency)
                        : `${formatMoney(totalMonthly)}`
                    }{t('mortgageTab.perMonth')}
                </span>
            </div>

            {/* Fix rate expiry reminders banner */}
            {allReminders.length > 0 && (
                <div className="mortgage-reminders-banner">
                    {allReminders.map((r, i) => (
                        <div key={i} className="mortgage-reminder-item">
                            <Bell size={14} />
                            <span>
                                <strong>{r.mortgageName}</strong>: {r.label}
                                {' '}({r.fix_end_date})
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mortgage-actions-row">
                <button
                    className="add-bill-btn"
                    data-zumfi-zone="mortgage-add-btn"
                    onClick={() => setShowAddModal(true)}
                >
                    <Plus size={18} />
                    <span>{t('mortgageTab.addMortgage')}</span>
                </button>
            </div>

            <div className="mortgage-list" data-zumfi-zone="mortgage-progress">
                {statuses.map(({ mortgage, status, paid_amount, confirmed, matched_transaction_id }) => {
                    const curr = mortgage.currency || 'CZK';
                    const isConfirming = confirmingId === mortgage.id;
                    return (
                        <div
                            key={mortgage.id}
                            className="mortgage-card"
                            onClick={() => setDetailMortgageId(mortgage.id)}
                        >
                            <div className="mortgage-header">
                                <span className="mortgage-name">
                                    <Home size={16} style={{ marginRight: 6, opacity: 0.5 }} />
                                    {mortgage.name}
                                    <span className="mortgage-currency-badge">{curr}</span>
                                </span>
                                <div className="mortgage-status-row">
                                    <span className={`mortgage-status ${status}${confirmed ? ' confirmed' : ''}`}>
                                        {status === 'paid' && confirmed
                                            ? t('mortgageTab.confirmed', { amount: formatCurrency(paid_amount, curr) })
                                            : status === 'paid'
                                            ? t('mortgageTab.paid', { amount: formatCurrency(paid_amount, curr) })
                                            : status === 'overdue'
                                            ? t('mortgageTab.overdue')
                                            : t('mortgageTab.pending')}
                                    </span>
                                    {/* Confirmed tick */}
                                    {status === 'paid' && confirmed && (
                                        <span className="mortgage-confirmed-tick" title={t('mortgageTab.paymentConfirmed')}>
                                            <Check size={14} />
                                        </span>
                                    )}
                                    {/* Confirm button for auto-matched (not yet confirmed) */}
                                    {status === 'paid' && !confirmed && (
                                        <button
                                            className="mortgage-confirm-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickConfirm(mortgage.id, matched_transaction_id, paid_amount);
                                            }}
                                            disabled={isConfirming}
                                            title={t('mortgageTab.confirmPayment')}
                                        >
                                            {isConfirming ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                        </button>
                                    )}
                                    {/* Manual confirm for pending/overdue */}
                                    {(status === 'pending' || status === 'overdue') && (
                                        <button
                                            className="mortgage-confirm-btn mortgage-confirm-manual"
                                            onClick={(e) => handleOpenTxPicker(e, mortgage.id)}
                                            disabled={isConfirming}
                                            title={t('mortgageTab.manualConfirm')}
                                        >
                                            {isConfirming ? <Loader2 size={16} className="spin" /> : <Check size={16} strokeWidth={2.5} />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mortgage-progress">
                                <div
                                    className="mortgage-progress-fill"
                                    style={{ width: `${mortgage.progress_pct || 0}%` }}
                                />
                            </div>
                            <div className="mortgage-progress-label">
                                <span>{t('mortgageTab.paidOff', { pct: mortgage.progress_pct || 0 })}</span>
                                <span>{formatCurrency(mortgage.principal_paid, curr)} / {formatCurrency(mortgage.original_amount, curr)}</span>
                            </div>

                            <div className="mortgage-stats">
                                <div className="mortgage-stat">
                                    <span className="mortgage-stat-label">{t('mortgageTab.remaining')}</span>
                                    <span className="mortgage-stat-value">
                                        {formatCurrency(mortgage.remaining_balance, curr)}
                                    </span>
                                </div>
                                <div className="mortgage-stat">
                                    <span className="mortgage-stat-label">{t('mortgageTab.monthly')}</span>
                                    <span className="mortgage-stat-value">
                                        {formatCurrency(mortgage.monthly_payment, curr)}
                                    </span>
                                </div>
                                <div className="mortgage-stat" data-zumfi-zone="mortgage-rate">
                                    <span className="mortgage-stat-label">{t('mortgageTab.rate')}</span>
                                    <span className="mortgage-stat-value">
                                        {Number(mortgage.interest_rate).toFixed(2)}%
                                    </span>
                                </div>
                                <div className="mortgage-stat">
                                    <span className="mortgage-stat-label">{t('mortgageTab.timeLeft')}</span>
                                    <span className="mortgage-stat-value">
                                        {Math.floor((mortgage.months_remaining || 0) / 12)}y {(mortgage.months_remaining || 0) % 12}m
                                    </span>
                                </div>
                            </div>

                            {mortgage.fix_end_date && (
                                <div className="mortgage-fix-badge">
                                    <Clock size={12} />
                                    <span>{t('mortgageTab.fixedUntil', { date: mortgage.fix_end_date })}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Transaction picker overlay */}
            {txPicker && (
                <div className="mortgage-tx-picker-overlay" onClick={() => setTxPicker(null)}>
                    <div className="mortgage-tx-picker" onClick={(e) => e.stopPropagation()}>
                        <div className="mortgage-tx-picker-header">
                            <h4>{t('mortgageTab.selectTransaction')}</h4>
                            <button onClick={() => setTxPicker(null)}><X size={16} /></button>
                        </div>
                        {txPicker.loading ? (
                            <div className="mortgage-tx-picker-loading"><Loader2 size={20} className="spin" /></div>
                        ) : txPicker.transactions.length === 0 ? (
                            <p className="mortgage-tx-picker-empty">{t('mortgageTab.noExpenseTransactions', { month: selectedMonth })}</p>
                        ) : (
                            <div className="mortgage-tx-picker-list">
                                {txPicker.transactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="mortgage-tx-picker-item"
                                        onClick={() => handlePickTransaction(txPicker.mortgageId, tx)}
                                    >
                                        <div className="mortgage-tx-picker-desc">
                                            <span>{tx.description || t('mortgageTab.noDescription')}</span>
                                            <span className="mortgage-tx-picker-date">{tx.date}</span>
                                        </div>
                                        <span className="mortgage-tx-picker-amount">
                                            {formatMoney(Math.abs(Number(tx.amount)))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Pop-out modal */}
            {detailMortgageId && (
                <MortgageDetailModal
                    mortgageId={detailMortgageId}
                    onClose={() => setDetailMortgageId(null)}
                />
            )}

            {showAddModal && (
                <AddMortgageModal onClose={() => setShowAddModal(false)} />
            )}
        </div>
    );
}
