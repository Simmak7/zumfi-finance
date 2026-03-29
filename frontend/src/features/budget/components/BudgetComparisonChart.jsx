import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, X } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { createOrUpdateBudget, deleteBudgetByCategory, createCategory } from '../../../services/api';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n';

function getActualColor(pct) {
    if (pct > 100) return '#f43f5e';
    if (pct >= 80) return '#fbbf24';
    return '#10b981';
}

function CustomTooltip({ active, payload, label, currency = 'CZK' }) {
    const { t } = useTranslation();
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    const { budget, actual } = data;
    const remaining = budget - actual;
    const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;

    return (
        <div style={{
            backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'white',
            fontSize: '0.8rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>{label}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <p style={{ color: 'rgba(99,102,241,0.8)', margin: 0 }}>{t('budget.budgetLabel')}: {formatCurrency(budget, currency)}</p>
                <p style={{ color: getActualColor(pct), margin: 0 }}>{t('budget.spentLabel')}: {formatCurrency(actual, currency)} ({pct}%)</p>
                <p style={{
                    color: remaining >= 0 ? 'rgba(255,255,255,0.5)' : '#f43f5e', margin: 0,
                    borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.3rem', marginTop: '0.2rem',
                }}>
                    {remaining >= 0 ? t('budget.remainingAmount', { amount: formatCurrency(remaining, currency) }) : t('budget.overBudgetAmount', { amount: formatCurrency(Math.abs(remaining), currency) })}
                </p>
            </div>
        </div>
    );
}

function CustomLegend() {
    const { t } = useTranslation();
    return (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(99,102,241,0.4)', display: 'inline-block' }} />
                {t('budget.budgetLabel')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
                {t('budget.actual')}
            </span>
        </div>
    );
}

/* ── Manage popup (add / edit / delete budgets) ── */
function ManagePopup({ budgetSummary, categories, month, expenseBreakdown, onBudgetChange, onClose, currency = 'CZK' }) {
    const { addToast } = useToast();
    const { t } = useTranslation();
    const [amounts, setAmounts] = useState({});
    const [saving, setSaving] = useState(null);
    const [newCatName, setNewCatName] = useState('');
    const [newCatAmount, setNewCatAmount] = useState('');
    const [addingCat, setAddingCat] = useState(false);
    const popupRef = useRef(null);

    useEffect(() => {
        if (!budgetSummary?.categories) return;
        const init = {};
        for (const item of budgetSummary.categories) init[item.category_id] = String(item.planned_amount);
        setAmounts(init);
    }, [budgetSummary]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const handleSave = async (categoryId) => {
        const value = amounts[categoryId];
        if (!value || isNaN(Number(value))) return;
        setSaving(categoryId);
        try {
            await createOrUpdateBudget({ category_id: categoryId, month, planned_amount: Number(value) });
            if (onBudgetChange) onBudgetChange();
        } catch (err) { addToast(t('budget.failedToSave'), 'error'); }
        finally { setSaving(null); }
    };

    const handleDelete = async (categoryId) => {
        setSaving(categoryId);
        try {
            await deleteBudgetByCategory(categoryId, month);
            setAmounts(prev => { const n = { ...prev }; delete n[categoryId]; return n; });
            if (onBudgetChange) onBudgetChange();
        } catch (err) { addToast(t('budget.failedToDelete'), 'error'); }
        finally { setSaving(null); }
    };

    const handleAdd = async () => {
        if (!newCatName.trim()) return;
        setAddingCat(true);
        try {
            const expenseCats = (categories || []).filter(c => c.section !== 'in_and_out');
            const existing = expenseCats.find(c => c.name.toLowerCase() === newCatName.trim().toLowerCase());
            let catId;
            if (existing) { catId = existing.id; }
            else { const nc = await createCategory({ name: newCatName.trim(), section: 'general' }); catId = nc.id; }
            if (newCatAmount && Number(newCatAmount) > 0) {
                await createOrUpdateBudget({ category_id: catId, month, planned_amount: Number(newCatAmount) });
            }
            setNewCatName(''); setNewCatAmount('');
            if (onBudgetChange) onBudgetChange();
        } catch (err) { addToast(t('budget.failedToAdd'), 'error'); }
        finally { setAddingCat(false); }
    };

    const budgetedCatIds = new Set(budgetSummary?.categories?.map(c => c.category_id) || []);
    const expenseCats = (categories || []).filter(c => c.section !== 'in_and_out');
    const spendingNames = new Set((expenseBreakdown || []).map(c => c.category));
    const suggested = expenseCats
        .filter(c => !budgetedCatIds.has(c.id) && spendingNames.has(c.name))
        .sort((a, b) => {
            const aA = expenseBreakdown.find(e => e.category === a.name)?.amount || 0;
            const bA = expenseBreakdown.find(e => e.category === b.name)?.amount || 0;
            return bA - aA;
        });
    const unbudgeted = suggested.length > 0 ? suggested : expenseCats.filter(c => !budgetedCatIds.has(c.id));

    return (
        <div className="bc-popup-overlay">
            <div className="bc-popup" ref={popupRef}>
                <div className="bc-popup-header">
                    <h4>{t('budget.manageBudgets')}</h4>
                    <button className="bc-popup-close" onClick={onClose}><X size={16} /></button>
                </div>

                {/* Existing budgets */}
                <div className="bc-popup-list">
                    {(budgetSummary?.categories || []).map(item => (
                        <div key={item.category_id} className="bc-popup-row">
                            <span className="bc-popup-name">
                                {item.category_name}
                                {item.is_inherited && <span className="budget-inherited-badge"> ({t('budget.inherited')})</span>}
                            </span>
                            <div className="bc-popup-actions">
                                <div className="bc-popup-input-wrap">
                                    <Pencil size={10} className="bc-popup-input-pen" />
                                    <input
                                        type="number"
                                        className={`bc-popup-input ${saving === item.category_id ? 'saving' : ''}`}
                                        value={amounts[item.category_id] || ''}
                                        onChange={e => setAmounts({ ...amounts, [item.category_id]: e.target.value })}
                                        onBlur={() => handleSave(item.category_id)}
                                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                        placeholder="0"
                                    />
                                </div>
                                <span className="bc-popup-suffix">{currency}</span>
                                <button className="bc-popup-delete" onClick={() => handleDelete(item.category_id)} title={t('budget.remove')}>
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {(!budgetSummary?.categories || budgetSummary.categories.length === 0) && (
                        <p className="bc-popup-empty">{t('budget.noBudgetsYet')}</p>
                    )}
                </div>

                {/* Add new */}
                <div className="bc-popup-add">
                    <input
                        type="text" className="bc-popup-add-name" placeholder={t('budget.categoryNamePlaceholder')}
                        value={newCatName} onChange={e => setNewCatName(e.target.value)}
                        list="bc-popup-cats" onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <datalist id="bc-popup-cats">
                        {unbudgeted.map(c => <option key={c.id} value={c.name} />)}
                    </datalist>
                    <input
                        type="number" className="bc-popup-add-amt" placeholder={t('budget.amountPlaceholder')}
                        value={newCatAmount} onChange={e => setNewCatAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    />
                    <span className="bc-popup-suffix">{currency}</span>
                    <button className="bc-popup-add-btn" onClick={handleAdd} disabled={addingCat || !newCatName.trim()}>{t('budget.add')}</button>
                </div>
                {unbudgeted.length > 0 && (
                    <div className="bc-popup-chips">
                        {unbudgeted.slice(0, 6).map(c => (
                            <button key={c.id} className="bc-popup-chip" onClick={() => setNewCatName(c.name)}>{c.name}</button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Main chart component ── */
export function BudgetComparisonChart({
    budgetSummary, categories, month, onBudgetChange, expenseBreakdown = [],
}) {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';
    const [showManage, setShowManage] = useState(false);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const hasBudgets = budgetSummary?.categories?.length > 0;
    const totalPlanned = Number(budgetSummary?.total_planned || 0);
    const totalActual = Number(budgetSummary?.total_actual || 0);
    const totalRemaining = totalPlanned - totalActual;
    const totalPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

    const chartData = (budgetSummary?.categories || []).map(item => {
        const planned = Number(item.planned_amount);
        const actual = Number(item.actual_amount);
        const pct = planned > 0 ? (actual / planned) * 100 : 0;
        return { name: item.category_name, budget: planned, actual, fillActual: getActualColor(pct) };
    });

    return (
        <motion.div
            className="budget-comparison-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="budget-comparison-header">
                <h3 className="budget-comparison-title">{t('budget.budgetVsActual')}</h3>
                <button
                    className="edit-icon-btn"
                    onClick={() => setShowManage(true)}
                    title={t('budget.manageBudgetsTooltip')}
                >
                    <Pencil size={16} />
                </button>
            </div>

            {hasBudgets ? (
                <>
                    <div className="budget-comparison-stats">
                        <div className="budget-stat-item">
                            <span className="budget-stat-label">{t('budget.totalBudget')}</span>
                            <span className="budget-stat-value accent">{formatCurrency(totalPlanned, currency)}</span>
                        </div>
                        <div className="budget-stat-item">
                            <span className="budget-stat-label">{t('budget.totalSpent')}</span>
                            <span className="budget-stat-value" style={{ color: getActualColor(totalPct) }}>
                                {formatCurrency(totalActual, currency)}
                            </span>
                        </div>
                        <div className="budget-stat-item">
                            <span className="budget-stat-label">{totalRemaining >= 0 ? t('budget.remaining') : t('budget.overBudget')}</span>
                            <span className="budget-stat-value" style={{ color: totalRemaining >= 0 ? 'rgba(255,255,255,0.6)' : '#f43f5e' }}>
                                {formatCurrency(Math.abs(totalRemaining), currency)}
                            </span>
                        </div>
                    </div>

                    <div className="budget-comparison-bar">
                        <div className="budget-comparison-bar-bg">
                            <motion.div
                                className="budget-comparison-bar-fill"
                                style={{ backgroundColor: getActualColor(totalPct) }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(totalPct, 100)}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                        <span className="budget-comparison-bar-label">{t('budget.used', { pct: totalPct })}</span>
                    </div>

                    <div className="budget-chart-container">
                        <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 55)}>
                            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }} barCategoryGap={16} barGap={3}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                                <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.2)" width={isMobile ? 80 : 110} tick={{ fontSize: isMobile ? 10 : 12, fill: 'rgba(255,255,255,0.7)' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Bar dataKey="budget" name="Budget" fill="rgba(99,102,241,0.35)" radius={[0, 4, 4, 0]} barSize={13} />
                                <Bar dataKey="actual" name="Actual" barSize={13} radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => <Cell key={index} fill={entry.fillActual} />)}
                                </Bar>
                                <Legend content={<CustomLegend />} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </>
            ) : (
                <div className="budget-comparison-empty">
                    <p>{t('budget.noBudgetsForMonth')}</p>
                    <p>{t('budget.emptyHint')}</p>
                </div>
            )}

            {showManage && (
                <ManagePopup
                    budgetSummary={budgetSummary}
                    categories={categories}
                    month={month}
                    expenseBreakdown={expenseBreakdown}
                    onBudgetChange={onBudgetChange}
                    onClose={() => setShowManage(false)}
                    currency={currency}
                />
            )}
        </motion.div>
    );
}
