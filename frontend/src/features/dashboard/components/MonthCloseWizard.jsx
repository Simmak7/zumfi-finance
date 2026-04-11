import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    X, ArrowRight, Check, AlertCircle, CheckCircle,
    TrendingUp, TrendingDown, FileText, PiggyBank, BarChart3, Clock,
} from 'lucide-react';
import { getMonthCloseData, allocateToGoals, getPortfolioSummary, getStockBreakdown, getStockPnl } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { formatMonthLabel } from '../../../utils/dates';
import { useSettings } from '../../../context/SettingsContext';
import { CURRENCY_SYMBOLS } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';
import './MonthCloseWizard.css';

const STEP_KEYS = ['step1', 'step2', 'step4', 'savingsOverview', 'stockPortfolio', 'step5'];

function _closedKey(userId) {
    return userId ? `closed_months_${userId}` : 'closed_months';
}

export function isMonthClosed(month, userId) {
    if (!month) return false;
    const closed = JSON.parse(localStorage.getItem(_closedKey(userId)) || '[]');
    return closed.includes(month);
}

function markMonthClosed(month, userId) {
    const key = _closedKey(userId);
    const closed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!closed.includes(month)) {
        closed.push(month);
        localStorage.setItem(key, JSON.stringify(closed));
    }
}

export function MonthCloseWizard({ month, onClose, userId }) {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const currSymbol = CURRENCY_SYMBOLS[currency] || currency;
    const fmtc = (value) => fmt(value, currSymbol);
    const [step, setStep] = useState(0);
    const [data, setData] = useState(null);
    const [portfolio, setPortfolio] = useState(null);
    const [stockBreakdown, setStockBreakdown] = useState(null);
    const [stockPnl, setStockPnl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [allocations, setAllocations] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [actionsLog, setActionsLog] = useState([]);
    const { addToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => { loadData(); }, [month]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [result, portfolioData, breakdownData, pnlData] = await Promise.all([
                getMonthCloseData(month),
                getPortfolioSummary(month).catch(() => null),
                getStockBreakdown(12, month).catch(() => null),
                getStockPnl(month).catch(() => null),
            ]);
            setData(result);
            setPortfolio(portfolioData);
            setStockBreakdown(breakdownData);
            setStockPnl(pnlData);
            const initial = {};
            (result.allocation_suggestions || []).forEach(s => {
                initial[s.goal_id] = Number(s.suggested_amount) || 0;
            });
            setAllocations(initial);
        } catch {
            addToast(t('monthClose.failedToLoad'), 'error');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const monthLabel = formatMonthLabel(month);
    const totalAllocated = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0);
    const available = data ? Number(data.surplus?.available_surplus || 0) : 0;
    const alreadyAllocated = data ? Number(data.surplus?.already_allocated || 0) : 0;
    const totalIncome = data ? Number(data.surplus?.total_income || 0) : 0;
    const totalExpenses = data ? Number(data.surplus?.total_expenses || 0) : 0;

    // Single source of truth: localStorage only, but only if month has data
    const hasData = totalIncome > 0 || totalExpenses > 0;
    const isClosed = hasData && isMonthClosed(month, userId);

    const savingsChange = portfolio && portfolio.previous_total_savings != null
        ? portfolio.total_savings - portfolio.previous_total_savings : null;

    // Stock values from breakdown history (same source as Portfolio page)
    const history = stockBreakdown?.monthly_history || [];
    const selectedEntry = history.find(h => h.month === month);
    const selectedIdx = selectedEntry ? history.indexOf(selectedEntry) : -1;
    const stockValue = selectedEntry ? selectedEntry.total_converted : 0;
    const prevEntry = selectedIdx > 0 ? history[selectedIdx - 1] : null;
    const stockDelta = prevEntry != null ? stockValue - prevEntry.total_converted : null;
    const realizedPnl = stockPnl ? stockPnl.total_realized_pnl_czk : 0;
    const hasStockData = selectedEntry != null && stockValue > 0;

    const STEPS = STEP_KEYS.map(k => t(`monthClose.${k}`));
    const lastStep = STEPS.length - 1;
    const goNext = () => setStep(s => Math.min(s + 1, lastStep));
    const goBack = () => setStep(s => Math.max(s - 1, 0));

    const handleAllocate = async () => {
        const items = Object.entries(allocations)
            .filter(([, amount]) => amount > 0)
            .map(([goal_id, amount]) => ({ goal_id: Number(goal_id), amount }));
        if (items.length === 0) {
            setActionsLog(prev => [...prev, t('monthClose.noAllocations')]);
            goNext();
            return;
        }
        setSubmitting(true);
        try {
            await allocateToGoals({ month, allocations: items });
            setActionsLog(prev => [...prev, t('monthClose.allocatedToGoals', { amount: fmtc(totalAllocated), count: items.length })]);
            window.dispatchEvent(new Event('goals-updated'));
            goNext();
        } catch {
            addToast(t('monthClose.allocationFailed'), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const skipAllocate = () => {
        setActionsLog(prev => [...prev, t('monthClose.skippedAllocation')]);
        goNext();
    };

    const handleDone = () => {
        markMonthClosed(month, userId);
        onClose();
    };

    return (
        <div className="mcw-overlay" onClick={onClose}>
            <div className={`mcw-modal ${isClosed ? 'mcw-closed' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="mcw-header">
                    <h2>
                        <FileText size={20} />
                        {isClosed ? t('monthClose.overview', { month: monthLabel }) : t('monthClose.closeMonth', { month: monthLabel })}
                    </h2>
                    <button className="mcw-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="mcw-steps">
                    {STEPS.map((label, i) => (
                        <div
                            key={i}
                            className={`mcw-step-dot ${step >= i ? 'active' : ''} ${step === i ? 'current' : ''} ${isClosed ? 'clickable' : ''}`}
                            onClick={() => isClosed && setStep(i)}
                            title={label}
                        >
                            {(step > i || (isClosed && step !== i)) ? <Check size={12} /> : i + 1}
                        </div>
                    ))}
                </div>

                {loading ? (
                    <div className="mcw-body"><SkeletonLoader variant="card" count={3} /></div>
                ) : (
                    <div className="mcw-body">
                        {step === 0 && <StepSummary data={data} goNext={goNext} />}
                        {step === 1 && <StepReview data={data} onClose={onClose} navigate={navigate} goNext={goNext} goBack={goBack} />}
                        {step === 2 && (
                            <StepAllocate
                                data={data} available={available} alreadyAllocated={alreadyAllocated}
                                totalIncome={totalIncome} totalExpenses={totalExpenses}
                                isClosed={isClosed} allocations={allocations} setAllocations={setAllocations}
                                totalAllocated={totalAllocated} submitting={submitting}
                                handleAllocate={handleAllocate} skipAllocate={skipAllocate}
                                goNext={goNext} goBack={goBack}
                            />
                        )}
                        {step === 3 && <StepSavings portfolio={portfolio} savingsChange={savingsChange} goNext={goNext} goBack={goBack} />}
                        {step === 4 && <StepPortfolio stockValue={stockValue} stockDelta={stockDelta} realizedPnl={realizedPnl} hasStockData={hasStockData} goNext={isClosed ? onClose : goNext} goBack={goBack} isClosed={isClosed} />}
                        {step === 5 && <StepDone monthLabel={monthLabel} actionsLog={actionsLog} onClose={isClosed ? onClose : handleDone} isClosed={isClosed} />}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Step Components ── */

function StepSummary({ data, goNext }) {
    const { t } = useTranslation();
    const fmtc = useFmtc();
    return (
        <div className="mcw-step-content">
            <h3><TrendingUp size={18} /> {t('monthClose.monthSummary')}</h3>
            <div className="mcw-kpi-grid">
                <div className="mcw-kpi">
                    <span className="mcw-kpi-label">{t('monthClose.income')}</span>
                    <span className="mcw-kpi-value income">+{fmtc(data.summary.total_income)}</span>
                </div>
                <div className="mcw-kpi">
                    <span className="mcw-kpi-label">{t('monthClose.expenses')}</span>
                    <span className="mcw-kpi-value expense">-{fmtc(data.summary.total_expenses)}</span>
                </div>
                <div className="mcw-kpi">
                    <span className="mcw-kpi-label">{t('monthClose.savingsRate')}</span>
                    <span className="mcw-kpi-value">{data.summary.savings_rate}%</span>
                </div>
                <div className="mcw-kpi">
                    <span className="mcw-kpi-label">{t('monthClose.remaining')}</span>
                    <span className="mcw-kpi-value">{fmtc(data.summary.remaining_budget)}</span>
                </div>
            </div>
            <div className="mcw-nav">
                <div />
                <button className="mcw-next-btn" onClick={goNext}>{t('monthClose.next')} <ArrowRight size={16} /></button>
            </div>
        </div>
    );
}

function StepReview({ data, onClose, navigate, goNext, goBack }) {
    const { t } = useTranslation();
    return (
        <div className="mcw-step-content">
            <h3><AlertCircle size={18} /> {t('monthClose.uncategorizedTransactions')}</h3>
            {data.review_count > 0 ? (
                <>
                    <p className="mcw-info-text">
                        {t('monthClose.transactionsNeedReview', { count: data.review_count })}
                    </p>
                    <button className="mcw-action-btn" onClick={() => { onClose(); navigate('/transactions?status=review'); }}>
                        {t('monthClose.reviewNow')}
                    </button>
                </>
            ) : (
                <p className="mcw-success-text"><CheckCircle size={16} /> {t('monthClose.allCategorized')}</p>
            )}
            <div className="mcw-nav">
                <button className="mcw-back-btn" onClick={goBack}>{t('monthClose.back')}</button>
                <button className="mcw-next-btn" onClick={goNext}>
                    {data.review_count > 0 ? t('monthClose.skip') : t('monthClose.next')} <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}

function StepAllocate({
    data, available, alreadyAllocated, totalIncome, totalExpenses,
    isClosed, allocations, setAllocations, totalAllocated, submitting,
    handleAllocate, skipAllocate, goNext, goBack,
}) {
    const { t } = useTranslation();
    const fmtc = useFmtc();
    const { settings } = useSettings();
    const currSymbol = CURRENCY_SYMBOLS[settings?.preferred_currency || 'CZK'] || settings?.preferred_currency || 'CZK';

    // Overview mode: show what was allocated (read-only)
    if (isClosed) {
        return (
            <div className="mcw-step-content">
                <h3><PiggyBank size={18} /> {t('monthClose.allocateSurplus')}</h3>
                {alreadyAllocated > 0 ? (
                    <>
                        <p className="mcw-success-text">
                            <CheckCircle size={16} /> {t('monthClose.savingsAllocated')}
                        </p>
                        <div className="mcw-alloc-summary">
                            <span>{t('monthClose.totalAllocated')}</span>
                            <strong>{fmtc(alreadyAllocated)}</strong>
                        </div>
                    </>
                ) : (
                    <p className="mcw-info-text">{t('monthClose.noRemainingSurplus')}</p>
                )}
                <div className="mcw-nav">
                    <button className="mcw-back-btn" onClick={goBack}>{t('monthClose.back')}</button>
                    <button className="mcw-next-btn" onClick={goNext}>{t('monthClose.next')} <ArrowRight size={16} /></button>
                </div>
            </div>
        );
    }

    // Close mode: already allocated everything this month (before clicking Done)
    if (alreadyAllocated > 0 && available === 0) {
        return (
            <div className="mcw-step-content">
                <h3><PiggyBank size={18} /> {t('monthClose.allocateSurplus')}</h3>
                <p className="mcw-success-text">
                    <CheckCircle size={16} /> {t('monthClose.savingsAllocated')}
                </p>
                <div className="mcw-alloc-summary">
                    <span>{t('monthClose.totalAllocated')}</span>
                    <strong>{fmtc(alreadyAllocated)}</strong>
                </div>
                <div className="mcw-nav">
                    <button className="mcw-back-btn" onClick={goBack}>{t('monthClose.back')}</button>
                    <button className="mcw-next-btn" onClick={goNext}>{t('monthClose.next')} <ArrowRight size={16} /></button>
                </div>
            </div>
        );
    }

    // Surplus available — show allocation form
    if (available > 0) {
        return (
            <div className="mcw-step-content">
                <h3><PiggyBank size={18} /> {t('monthClose.allocateSurplus')}</h3>
                <p className="mcw-info-text">
                    {t('monthClose.availableToAllocate', { amount: fmtc(available) })}
                </p>
                <div className="mcw-alloc-list">
                    {(data.allocation_suggestions || []).map(s => (
                        <div key={s.goal_id} className="mcw-alloc-row">
                            <span className="mcw-alloc-name">{s.goal_name}</span>
                            <div className="mcw-alloc-input-wrap">
                                <input
                                    type="number" className="mcw-alloc-input"
                                    value={allocations[s.goal_id] || ''}
                                    onChange={e => setAllocations(prev => ({
                                        ...prev, [s.goal_id]: Math.max(0, Number(e.target.value) || 0),
                                    }))}
                                    min="0"
                                />
                                <span className="mcw-alloc-currency">{currSymbol}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mcw-alloc-total">{t('monthClose.total', { allocated: fmtc(totalAllocated), available: fmtc(available) })}</div>
                <div className="mcw-nav">
                    <button className="mcw-back-btn" onClick={goBack}>{t('monthClose.back')}</button>
                    <button className="mcw-next-btn" onClick={handleAllocate} disabled={submitting || totalAllocated > available}>
                        {submitting ? t('monthClose.allocating') : t('monthClose.allocateAndContinue')}
                    </button>
                </div>
            </div>
        );
    }

    // No surplus — expenses met or exceeded income
    return (
        <div className="mcw-step-content">
            <h3><PiggyBank size={18} /> {t('monthClose.allocateSurplus')}</h3>
            <p className="mcw-info-text">
                {totalExpenses >= totalIncome
                    ? t('monthClose.noSurplusExpenses')
                    : t('monthClose.noRemainingSurplus')}
            </p>
            <div className="mcw-nav">
                <button className="mcw-back-btn" onClick={goBack}>{t('monthClose.back')}</button>
                <button className="mcw-next-btn" onClick={skipAllocate}>{t('monthClose.skip')} <ArrowRight size={16} /></button>
            </div>
        </div>
    );
}

function StepSavings({ portfolio, savingsChange, goNext, goBack }) {
    const { t } = useTranslation();
    const fmtc = useFmtc();
    const hasSavings = portfolio && portfolio.total_savings > 0;
    return (
        <div className="mcw-step-content">
            <h3><PiggyBank size={18} /> {t('monthClose.savingsOverview')}</h3>
            {hasSavings ? (
                <>
                    <div className="mcw-kpi-grid">
                        <div className="mcw-kpi">
                            <span className="mcw-kpi-label">{t('monthClose.totalSavings')}</span>
                            <span className="mcw-kpi-value">{fmtc(portfolio.total_savings)}</span>
                        </div>
                        {savingsChange !== null && (
                            <div className="mcw-kpi">
                                <span className="mcw-kpi-label">{t('monthClose.monthlyChange')}</span>
                                <span className={`mcw-kpi-value ${savingsChange >= 0 ? 'income' : 'expense'}`}>
                                    {savingsChange >= 0 ? '+' : ''}{fmtc(savingsChange)}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="mcw-status-badge">
                        {savingsChange !== null ? (
                            savingsChange >= 0
                                ? <><TrendingUp size={16} /> {t('monthClose.savingsGrew')}</>
                                : <><TrendingDown size={16} /> {t('monthClose.savingsDropped')}</>
                        ) : (
                            <><Clock size={16} /> {t('monthClose.noPreviousData')}</>
                        )}
                    </div>
                </>
            ) : (
                <p className="mcw-info-text">{t('monthClose.noSavingsAccounts')}</p>
            )}
            <div className="mcw-nav">
                <button className="mcw-back-btn" onClick={goBack}>{t('monthClose.back')}</button>
                <button className="mcw-next-btn" onClick={goNext}>{t('monthClose.next')} <ArrowRight size={16} /></button>
            </div>
        </div>
    );
}

function StepPortfolio({ stockValue, stockDelta, realizedPnl, hasStockData, goNext, goBack, isClosed }) {
    const { t } = useTranslation();
    const fmtc = useFmtc();
    return (
        <div className="mcw-step-content">
            <h3><BarChart3 size={18} /> {t('monthClose.stockPortfolio')}</h3>
            {hasStockData ? (
                <>
                    <div className="mcw-kpi-grid">
                        <div className="mcw-kpi">
                            <span className="mcw-kpi-label">{t('monthClose.portfolioValue')}</span>
                            <span className="mcw-kpi-value">{fmtc(stockValue)}</span>
                        </div>
                        {stockDelta !== null && (
                            <div className="mcw-kpi">
                                <span className="mcw-kpi-label">{t('monthClose.vsPreviousMonth')}</span>
                                <span className={`mcw-kpi-value ${stockDelta >= 0 ? 'income' : 'expense'}`}>
                                    {stockDelta >= 0 ? '+' : ''}{fmtc(stockDelta)}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="mcw-kpi" style={{ marginBottom: '1rem' }}>
                        <span className="mcw-kpi-label">{t('monthClose.realizedPnl')}</span>
                        <span className={`mcw-kpi-value ${realizedPnl >= 0 ? 'income' : 'expense'}`}>
                            {realizedPnl >= 0 ? '+' : ''}{fmtc(realizedPnl)}
                        </span>
                    </div>
                    {stockDelta !== null && (
                        <div className="mcw-status-badge">
                            {stockDelta >= 0
                                ? <><TrendingUp size={16} /> {t('monthClose.portfolioGrew', { amount: fmtc(stockDelta) })}</>
                                : <><TrendingDown size={16} /> {t('monthClose.portfolioDropped', { amount: fmtc(Math.abs(stockDelta)) })}</>}
                        </div>
                    )}
                </>
            ) : (
                <p className="mcw-info-text">{t('monthClose.noStockHoldings')}</p>
            )}
            <div className="mcw-nav">
                <button className="mcw-back-btn" onClick={goBack}>{t('monthClose.back')}</button>
                <button className="mcw-next-btn" onClick={goNext}>
                    {isClosed ? t('monthClose.close') : t('monthClose.next')} <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}

function StepDone({ monthLabel, actionsLog, onClose, isClosed }) {
    return (
        <div className="mcw-step-content mcw-done">
            <div className="mcw-done-icon"><Check size={36} /></div>
            <h3>{isClosed ? 'Month Reviewed' : 'Month Closed!'}</h3>
            <p className="mcw-info-text">{monthLabel} has been reviewed.</p>
            {actionsLog.length > 0 && (
                <ul className="mcw-actions-log">
                    {actionsLog.map((log, i) => <li key={i}><Check size={14} /> {log}</li>)}
                </ul>
            )}
            <button className="mcw-done-btn" onClick={onClose}>{isClosed ? 'Close' : 'Done'}</button>
        </div>
    );
}

function fmt(value, sym = "Kč") {
    return Number(value || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' ' + sym;
}

function useFmtc() {
    const { settings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';
    const sym = CURRENCY_SYMBOLS[currency] || currency;
    return (value) => fmt(value, sym);
}
