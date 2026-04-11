import React, { useMemo, useState, useCallback } from 'react';
import { Pencil, BarChart3, Filter, X, AlertCircle } from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatMoney, formatCurrency } from '../../../utils/currencies';
import { useTranslation } from '../../../i18n';
import { CategoryEditor } from '../../categories/components/CategoryEditor';
import { CategoryTransactionsModal } from './CategoryTransactionsModal';
import { CategoryTrendModal } from './CategoryTrendModal';

class CategoryEditorErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(err) { console.error('CategoryEditor error:', err); }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                    <AlertCircle size={32} style={{ marginBottom: '0.5rem', color: '#ef4444' }} />
                    <p>Something went wrong loading categories.</p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', background: '#6366f1', border: 'none', borderRadius: '0.5rem', color: 'white', cursor: 'pointer' }}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const FALLBACK_COLORS = [
    '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
};

export function CategoryDonutChart({ expenseBreakdown, selectedMonth, hiddenCategories, onHiddenChange, currency = 'CZK' }) {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showTrends, setShowTrends] = useState(false);
    const [filterMode, setFilterMode] = useState(false);
    const [showCategoryEditor, setShowCategoryEditor] = useState(false);

    const allData = useMemo(() => {
        if (!expenseBreakdown || expenseBreakdown.length === 0) return [];
        return [...expenseBreakdown].sort((a, b) => b.amount - a.amount);
    }, [expenseBreakdown]);

    const chartData = useMemo(
        () => allData.filter(c => !hiddenCategories.has(c.category)),
        [allData, hiddenCategories]
    );

    const total = useMemo(
        () => chartData.reduce((sum, c) => sum + c.amount, 0),
        [chartData]
    );

    const toggleCategory = useCallback((categoryName) => {
        onHiddenChange(prev => {
            const next = new Set(prev);
            if (next.has(categoryName)) next.delete(categoryName);
            else next.add(categoryName);
            return next;
        });
    }, [onHiddenChange]);

    if (chartData.length === 0) {
        return (
            <div className="chart-card">
                <div className="chart-header">
                    <h3>{t('charts.categoryBreakdown')}</h3>
                    <div className="chart-header-actions">
                        {allData.length > 0 && (
                            <button
                                className={`edit-icon-btn${filterMode ? ' active' : ''}`}
                                onClick={() => setFilterMode(!filterMode)}
                                title="Filter categories"
                            >
                                <Filter size={16} />
                            </button>
                        )}
                        <button
                            className="edit-icon-btn"
                            onClick={() => setShowTrends(true)}
                            title="Category spending trends"
                        >
                            <BarChart3 size={16} />
                        </button>
                        <button
                            className="edit-icon-btn"
                            onClick={() => setShowCategoryEditor(true)}
                            title="Manage categories"
                        >
                            <Pencil size={16} />
                        </button>
                    </div>
                </div>
                {filterMode && hiddenCategories.size > 0 && (
                    <div className="category-filter-bar">
                        {allData.map((cat, i) => {
                            const hidden = hiddenCategories.has(cat.category);
                            return (
                                <button
                                    key={cat.category}
                                    className={`category-filter-chip${hidden ? ' hidden' : ''}`}
                                    onClick={() => toggleCategory(cat.category)}
                                >
                                    <span
                                        className="filter-chip-dot"
                                        style={{ background: hidden ? 'rgba(255,255,255,0.2)' : (cat.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]) }}
                                    />
                                    {cat.category}
                                </button>
                            );
                        })}
                        <button
                            className="category-filter-chip reset"
                            onClick={() => onHiddenChange(new Set())}
                        >
                            Show all
                        </button>
                    </div>
                )}
                <div className="chart-empty">
                    {hiddenCategories.size > 0 ? 'All categories are filtered out.' : 'No expense data for this month.'}
                </div>
                {showTrends && (
                    <CategoryTrendModal
                        month={selectedMonth}
                        onClose={() => setShowTrends(false)}
                    />
                )}
                {showCategoryEditor && (
                    <div className="cem-overlay" onClick={() => setShowCategoryEditor(false)}>
                        <div className="cem-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="cem-header">
                                <h2>Manage Categories</h2>
                                <button className="mcw-close" onClick={() => setShowCategoryEditor(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="cem-body">
                                <CategoryEditorErrorBoundary>
                                    <CategoryEditor onSuccess={() => window.dispatchEvent(new Event('categories-updated'))} />
                                </CategoryEditorErrorBoundary>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="chart-card" data-zumfi-zone="category-donut">
            <div className="chart-header">
                <h3>{t('charts.categoryBreakdown')}</h3>
                <div className="chart-header-actions">
                    <button
                        className={`edit-icon-btn${filterMode ? ' active' : ''}`}
                        onClick={() => setFilterMode(!filterMode)}
                        title="Filter categories"
                    >
                        <Filter size={16} />
                    </button>
                    <button
                        className="edit-icon-btn"
                        onClick={() => setShowTrends(true)}
                        title="Category spending trends"
                    >
                        <BarChart3 size={16} />
                    </button>
                    <button
                        className="edit-icon-btn"
                        onClick={() => setShowCategoryEditor(true)}
                        title="Manage categories"
                    >
                        <Pencil size={16} />
                    </button>
                </div>
            </div>

            {filterMode && (
                <div className="category-filter-bar">
                    {allData.map((cat, i) => {
                        const hidden = hiddenCategories.has(cat.category);
                        return (
                            <button
                                key={cat.category}
                                className={`category-filter-chip${hidden ? ' hidden' : ''}`}
                                onClick={() => toggleCategory(cat.category)}
                            >
                                <span
                                    className="filter-chip-dot"
                                    style={{ background: hidden ? 'rgba(255,255,255,0.2)' : (cat.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]) }}
                                />
                                {cat.category}
                            </button>
                        );
                    })}
                    {hiddenCategories.size > 0 && (
                        <button
                            className="category-filter-chip reset"
                            onClick={() => onHiddenChange(new Set())}
                        >
                            Show all
                        </button>
                    )}
                </div>
            )}

            <div className="donut-chart-container">
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="amount"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            strokeWidth={0}
                            onClick={(_, index) => setSelectedCategory(chartData[index])}
                            style={{ cursor: 'pointer' }}
                        >
                            {chartData.map((entry, i) => (
                                <Cell key={i} fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                            formatter={(value) => formatCurrency(value, currency)}
                        />
                        <text
                            x="50%"
                            y="48%"
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.4)"
                            fontSize={12}
                        >
                            Total
                        </text>
                        <text
                            x="50%"
                            y="55%"
                            textAnchor="middle"
                            fill="white"
                            fontSize={16}
                            fontWeight={700}
                        >
                            {formatMoney(total)}
                        </text>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="donut-legend">
                {chartData.map((cat, i) => (
                    <div
                        key={cat.category}
                        className="donut-legend-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        <span
                            className="legend-dot"
                            style={{ background: cat.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                        />
                        <span className="legend-name">{cat.category}</span>
                        <span className="legend-value">
                            {formatCurrency(cat.amount, currency)}
                        </span>
                    </div>
                ))}
            </div>

            {selectedCategory && (
                <CategoryTransactionsModal
                    category={selectedCategory}
                    month={selectedMonth}
                    onClose={() => setSelectedCategory(null)}
                />
            )}

            {showTrends && (
                <CategoryTrendModal
                    month={selectedMonth}
                    onClose={() => setShowTrends(false)}
                />
            )}

            {showCategoryEditor && (
                <div className="cem-overlay" onClick={() => setShowCategoryEditor(false)}>
                    <div className="cem-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cem-header">
                            <h2>Manage Categories</h2>
                            <button className="mcw-close" onClick={() => setShowCategoryEditor(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="cem-body">
                            <CategoryEditorErrorBoundary>
                                <CategoryEditor onSuccess={() => window.dispatchEvent(new Event('categories-updated'))} />
                            </CategoryEditorErrorBoundary>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
