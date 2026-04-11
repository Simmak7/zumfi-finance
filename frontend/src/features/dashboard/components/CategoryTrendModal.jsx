import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, GripVertical } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getCategoryTrends } from '../../../services/api';
import { formatCurrency } from '../../../utils/currencies';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { useSettings } from '../../../context/SettingsContext';
import './CategoryTrendModal.css';

const FALLBACK_COLORS = [
    '#6366f1', '#a855f7', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
};

function applySavedOrder(data, order) {
    if (!order || order.length === 0) return data;
    const map = Object.fromEntries(data.map(c => [c.category, c]));
    const ordered = [];
    for (const name of order) {
        if (map[name]) {
            ordered.push(map[name]);
            delete map[name];
        }
    }
    // Append any new categories not in saved order
    for (const cat of data) {
        if (map[cat.category]) ordered.push(cat);
    }
    return ordered;
}

function formatMonthShort(monthStr) {
    const [y, m] = monthStr.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export function CategoryTrendModal({ month, onClose }) {
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dragIdx, setDragIdx] = useState(null);
    const [overIdx, setOverIdx] = useState(null);
    const dragNode = useRef(null);
    const { settings, saveSettings } = useSettings();
    const currency = settings?.preferred_currency || 'CZK';

    useEffect(() => {
        const fetchTrends = async () => {
            setLoading(true);
            try {
                const data = await getCategoryTrends(month, 12);
                const order = settings?.category_trend_order || [];
                setTrends(applySavedOrder(data || [], order));
            } catch (err) {
                console.error('Failed to load category trends:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchTrends();
    }, [month, settings?.category_trend_order]);

    const handleDragStart = useCallback((e, idx) => {
        setDragIdx(idx);
        dragNode.current = e.currentTarget;
        e.dataTransfer.effectAllowed = 'move';
        // Delay so the dragging element gets the style after pickup
        requestAnimationFrame(() => {
            dragNode.current?.classList.add('ctrend-dragging');
        });
    }, []);

    const handleDragOver = useCallback((e, idx) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragIdx === null || idx === dragIdx) return;
        setOverIdx(idx);
    }, [dragIdx]);

    const handleDrop = useCallback((e, idx) => {
        e.preventDefault();
        if (dragIdx === null || idx === dragIdx) return;
        setTrends(prev => {
            const updated = [...prev];
            const [moved] = updated.splice(dragIdx, 1);
            updated.splice(idx, 0, moved);
            saveSettings({ category_trend_order: updated.map(c => c.category) });
            return updated;
        });
        setDragIdx(null);
        setOverIdx(null);
    }, [dragIdx, saveSettings]);

    const handleDragEnd = useCallback(() => {
        dragNode.current?.classList.remove('ctrend-dragging');
        setDragIdx(null);
        setOverIdx(null);
        dragNode.current = null;
    }, []);

    return (
        <div className="ctrend-overlay" onClick={onClose}>
            <div className="ctrend-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ctrend-header">
                    <h2>Category Spending Trends</h2>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <p className="ctrend-subtitle">
                    Monthly expense development over the last 12 months
                </p>

                <div className="ctrend-body">
                    {loading ? (
                        <SkeletonLoader variant="chart" count={3} />
                    ) : trends.length === 0 ? (
                        <div className="ctrend-empty">No expense data available.</div>
                    ) : (
                        trends.map((cat, idx) => {
                            const color = cat.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
                            const total = cat.data.reduce((s, d) => s + d.amount, 0);
                            const avg = total / cat.data.filter(d => d.amount > 0).length || 0;
                            const isOver = overIdx === idx && dragIdx !== idx;
                            return (
                                <div
                                    key={cat.category}
                                    className={`ctrend-category-card${isOver ? ' ctrend-drop-target' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="ctrend-cat-header">
                                        <span className="ctrend-drag-handle">
                                            <GripVertical size={14} />
                                        </span>
                                        <span className="ctrend-cat-dot" style={{ background: color }} />
                                        <span className="ctrend-cat-name">{cat.category}</span>
                                        <span className="ctrend-cat-avg">
                                            avg {formatCurrency(avg, currency)}/mo
                                        </span>
                                    </div>
                                    <ResponsiveContainer width="100%" height={140}>
                                        <BarChart data={cat.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis
                                                dataKey="month"
                                                tickFormatter={formatMonthShort}
                                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                                axisLine={false}
                                                tickLine={false}
                                                width={45}
                                                tickFormatter={(v) => Math.round(v).toLocaleString()}
                                            />
                                            <Tooltip
                                                contentStyle={TOOLTIP_STYLE}
                                                labelFormatter={formatMonthShort}
                                                formatter={(value) => [formatCurrency(value, currency), 'Spent']}
                                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                            />
                                            <Bar
                                                dataKey="amount"
                                                fill={color}
                                                radius={[3, 3, 0, 0]}
                                                maxBarSize={28}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
