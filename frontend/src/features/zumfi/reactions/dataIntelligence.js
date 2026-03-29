/**
 * Data Intelligence Engine for Zumi.
 * Provides reusable analysis functions that insight generators call
 * to produce data-driven, multi-sentence messages.
 */

import { formatMoney } from '../../../utils/currencies.js';

// ─── Trend Analysis ────────────────────────────────────────────────────────

/**
 * Analyse a time-series of numeric values (oldest first).
 * @param {number[]} values  – at least 2 values
 * @returns {{ direction: 'rising'|'falling'|'stable', changePercent: number, strength: 'strong'|'moderate'|'weak', consecutive: number }}
 */
export function analyzeTrend(values) {
    if (!values || values.length < 2) {
        return { direction: 'stable', changePercent: 0, strength: 'weak', consecutive: 0 };
    }

    const recent = values.slice(-6); // use last 6 at most
    const first = recent[0];
    const last = recent[recent.length - 1];
    const changePercent = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

    // Count consecutive same-direction months
    let consecutive = 0;
    const direction = changePercent > 2 ? 'rising' : changePercent < -2 ? 'falling' : 'stable';

    for (let i = recent.length - 1; i > 0; i--) {
        const diff = recent[i] - recent[i - 1];
        if ((direction === 'rising' && diff > 0) || (direction === 'falling' && diff < 0)) {
            consecutive++;
        } else {
            break;
        }
    }

    const absPct = Math.abs(changePercent);
    const strength = absPct > 20 ? 'strong' : absPct > 8 ? 'moderate' : 'weak';

    return { direction, changePercent, strength, consecutive };
}

// ─── Month-over-Month Comparison ───────────────────────────────────────────

/**
 * Compare a current value to the same field in the previous month.
 * @param {number} current
 * @param {object[]} history  – array of month objects (oldest first)
 * @param {string} field      – field name to extract from history items
 * @returns {{ change: number, changePercent: number, direction: 'up'|'down'|'flat', previousValue: number }}
 */
export function compareToPrevMonth(current, history, field) {
    if (!history || history.length < 2) {
        return { change: 0, changePercent: 0, direction: 'flat', previousValue: 0 };
    }

    const prev = history[history.length - 2];
    const previousValue = Number(prev[field] || 0);
    const change = current - previousValue;
    const changePercent = previousValue !== 0 ? (change / Math.abs(previousValue)) * 100 : 0;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

    return { change, changePercent, direction, previousValue };
}

// ─── Simple Prediction ─────────────────────────────────────────────────────

/**
 * Predict next value using simple linear regression on recent data.
 * @param {object[]} history  – array of month objects (oldest first)
 * @param {string} field
 * @param {number} lookback  – how many months to use (default 6)
 * @returns {{ predicted: number, confidence: 'high'|'medium'|'low', direction: 'up'|'down'|'flat' }}
 */
export function predictNextMonth(history, field, lookback = 6) {
    if (!history || history.length < 3) {
        return { predicted: 0, confidence: 'low', direction: 'flat' };
    }

    const data = history.slice(-lookback).map((m, i) => ({
        x: i,
        y: Number(m[field] || 0),
    }));
    const n = data.length;

    // Linear regression: y = mx + b
    const sumX = data.reduce((s, d) => s + d.x, 0);
    const sumY = data.reduce((s, d) => s + d.y, 0);
    const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
    const sumXX = data.reduce((s, d) => s + d.x * d.x, 0);

    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return { predicted: sumY / n, confidence: 'low', direction: 'flat' };

    const m = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - m * sumX) / n;
    const predicted = Math.round(m * n + b); // next month = x=n

    // R² for confidence
    const mean = sumY / n;
    const ssRes = data.reduce((s, d) => s + (d.y - (m * d.x + b)) ** 2, 0);
    const ssTot = data.reduce((s, d) => s + (d.y - mean) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    const confidence = r2 > 0.7 ? 'high' : r2 > 0.4 ? 'medium' : 'low';
    const direction = m > 0 ? 'up' : m < 0 ? 'down' : 'flat';

    return { predicted: Math.max(0, predicted), confidence, direction };
}

// ─── Anomaly Detection ─────────────────────────────────────────────────────

/**
 * Check if a current value is anomalous compared to historical average.
 * @param {number} current
 * @param {object[]} history
 * @param {string} field
 * @returns {{ isAnomaly: boolean, severity: 'mild'|'moderate'|'severe', deviation: number, average: number }}
 */
export function detectAnomaly(current, history, field) {
    if (!history || history.length < 3) {
        return { isAnomaly: false, severity: 'mild', deviation: 0, average: 0 };
    }

    const values = history.slice(-6).map(m => Number(m[field] || 0));
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return { isAnomaly: false, severity: 'mild', deviation: 0, average: mean };

    const zScore = Math.abs(current - mean) / stdDev;
    const deviation = ((current - mean) / mean) * 100;

    const isAnomaly = zScore > 1.5;
    const severity = zScore > 2.5 ? 'severe' : zScore > 2 ? 'moderate' : 'mild';

    return { isAnomaly, severity, deviation, average: Math.round(mean) };
}

// ─── Days Remaining & Daily Allowance ──────────────────────────────────────

/**
 * Calculate spending pace info for the current month.
 * @param {number} totalSpent
 * @param {number} budget       – total budget or income
 * @param {string} selectedMonth – "YYYY-MM"
 * @returns {{ daysLeft: number, dailyAllowance: number, dailyBurnRate: number, onTrack: boolean }}
 */
export function spendingPace(totalSpent, budget, selectedMonth) {
    const [year, month] = (selectedMonth || '').split('-').map(Number);
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(year || now.getFullYear(), month || (now.getMonth() + 1), 0).getDate();
    const daysLeft = Math.max(0, daysInMonth - currentDay);
    const daysElapsed = Math.max(1, currentDay);

    const dailyBurnRate = totalSpent / daysElapsed;
    const remaining = budget - totalSpent;
    const dailyAllowance = daysLeft > 0 ? remaining / daysLeft : 0;
    const projectedTotal = dailyBurnRate * daysInMonth;
    const onTrack = projectedTotal <= budget * 1.05;

    return {
        daysLeft,
        dailyAllowance: Math.round(dailyAllowance),
        dailyBurnRate: Math.round(dailyBurnRate),
        projectedTotal: Math.round(projectedTotal),
        onTrack,
    };
}

// ─── Category Analysis ─────────────────────────────────────────────────────

/**
 * Find the biggest mover category between current and previous month.
 * @param {Array<{category: string, amount: number}>} current
 * @param {Array<{category: string, amount: number}>} previous
 * @returns {{ category: string, change: number, changePercent: number, direction: 'up'|'down' } | null}
 */
export function biggestCategoryMover(current, previous) {
    if (!current || !previous || current.length === 0) return null;

    const prevMap = {};
    for (const c of previous) prevMap[c.category] = c.amount || 0;

    let biggest = null;
    let maxAbsChange = 0;

    for (const c of current) {
        const prev = prevMap[c.category] || 0;
        const change = (c.amount || 0) - prev;
        const absChange = Math.abs(change);
        if (absChange > maxAbsChange) {
            maxAbsChange = absChange;
            const changePercent = prev > 0 ? (change / prev) * 100 : 100;
            biggest = {
                category: c.category,
                change,
                changePercent,
                direction: change > 0 ? 'up' : 'down',
            };
        }
    }
    return biggest;
}

// ─── Year-End Projection ───────────────────────────────────────────────────

/**
 * Project a value to year-end based on current trajectory.
 * @param {number} currentMonthly – this month's value
 * @param {string} selectedMonth  – "YYYY-MM"
 * @returns {{ yearEndTotal: number, monthsRemaining: number }}
 */
export function projectToYearEnd(currentMonthly, selectedMonth) {
    const [, month] = (selectedMonth || '').split('-').map(Number);
    const currentMonth = month || new Date().getMonth() + 1;
    const monthsRemaining = 12 - currentMonth;
    return {
        yearEndTotal: Math.round(currentMonthly * monthsRemaining),
        monthsRemaining,
    };
}

// ─── Savings Rate Context ──────────────────────────────────────────────────

/**
 * Compute a 3-month moving average of savings rate.
 * @param {object[]} history – items with total_income and total_expenses
 * @returns {number} average savings rate (0-100)
 */
export function avgSavingsRate(history) {
    if (!history || history.length < 2) return 0;
    const recent = history.slice(-3);
    const rates = recent.map(m => {
        const inc = m.total_income || 0;
        return inc > 0 ? ((inc - (m.total_expenses || 0)) / inc) * 100 : 0;
    });
    return rates.reduce((s, r) => s + r, 0) / rates.length;
}

// ─── Portfolio helpers ─────────────────────────────────────────────────────

/**
 * Find the best and worst performer from an array of holdings.
 * @param {Array<{ticker?: string, name?: string, unrealized_gain_pct?: number}>} holdings
 * @returns {{ best: object|null, worst: object|null }}
 */
export function bestWorstPerformer(holdings) {
    if (!holdings || holdings.length === 0) return { best: null, worst: null };
    const sorted = [...holdings].sort((a, b) =>
        (a.unrealized_gain_pct || 0) - (b.unrealized_gain_pct || 0)
    );
    return {
        worst: sorted[0],
        best: sorted[sorted.length - 1],
    };
}

// ─── Convenience: pick random from array ───────────────────────────────────

export function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Format money (re-export for convenience) ─────────────────────────────

export { formatMoney };
