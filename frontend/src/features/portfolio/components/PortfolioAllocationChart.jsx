import React from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

import { formatMoney } from '../../../utils/currencies';

const TOOLTIP_STYLE = {
    backgroundColor: '#1e1e2d',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.8rem',
};

const FALLBACK_COLORS = ['#22c55e', '#6366f1', '#3b82f6', '#f59e0b', '#a855f7', '#64748b'];

export function PortfolioAllocationChart({ allocation, totalPortfolio }) {
    if (!allocation || allocation.length === 0) return null;

    return (
        <div className="chart-card">
            <div className="chart-header">
                <h3>Portfolio Allocation</h3>
            </div>
            <div className="donut-chart-container">
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={allocation}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            strokeWidth={0}
                        >
                            {allocation.map((entry, i) => (
                                <Cell
                                    key={i}
                                    fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                            formatter={(value) => formatMoney(value)}
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
                            {formatMoney(totalPortfolio)}
                        </text>
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="donut-legend">
                {allocation.map((item, i) => (
                    <div key={item.name} className="donut-legend-item">
                        <span
                            className="legend-dot"
                            style={{ background: item.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length] }}
                        />
                        <span className="legend-name">{item.name}</span>
                        <span className="legend-value">
                            {item.percentage}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
