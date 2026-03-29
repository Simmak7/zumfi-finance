// Dashboard Zone Insight Generator for Zumi Proximity Interactions
// Enhanced with data intelligence: trends, predictions, anomaly detection, and environmental effects.

import {
    analyzeTrend, compareToPrevMonth, predictNextMonth, detectAnomaly,
    spendingPace, biggestCategoryMover, projectToYearEnd, avgSavingsRate,
    pick, formatMoney,
} from './dataIntelligence';

// ── Dashboard Header ─────────────────────────────────────────────────────────
function headerInsight(data) {
    const { totalIncome, totalExpenses, monthlyHistory, selectedMonth } = data;

    if (!totalIncome && !totalExpenses) {
        return {
            text: pick([
                "Welcome to your dashboard! Upload a bank statement to get started.",
                "This is your financial command center. Let's fill it with data!",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const net = totalIncome - totalExpenses;
    const history = monthlyHistory || [];

    // 3-month net surplus trend
    if (history.length >= 3) {
        const netValues = history.slice(-3).map(m => (m.total_income || 0) - (m.total_expenses || 0));
        const trend = analyzeTrend(netValues);

        if (trend.direction === 'rising' && trend.consecutive >= 2) {
            return {
                text: `Net surplus has been rising for ${trend.consecutive} months! Currently ${formatMoney(net)} Kč in the green. Your trajectory is excellent.`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
                envEffect: 'golden-sparkles',
            };
        }
        if (trend.direction === 'falling' && trend.consecutive >= 2) {
            return {
                text: `Your monthly surplus has been shrinking for ${trend.consecutive} months. This month: ${formatMoney(net)} Kč. Let's look at what's driving it.`,
                type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
                envEffect: 'rain-cloud',
            };
        }
    }

    if (net > 0) {
        const pace = spendingPace(totalExpenses, totalIncome, selectedMonth);
        return {
            text: `${formatMoney(net)} Kč net positive this month! ${pace.daysLeft > 0 ? `With ${pace.daysLeft} days left, you can spend ~${formatMoney(pace.dailyAllowance)} Kč/day.` : 'Month is closing strong!'}`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'floating-bubbles',
        };
    }

    return {
        text: `${formatMoney(Math.abs(net))} Kč in the red this month. Drag me to the category chart to find where the money is going.`,
        type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        envEffect: 'rain-cloud',
    };
}

// ── KPI: Total Income ────────────────────────────────────────────────────────
function kpiIncomeInsight(data) {
    const { totalIncome, monthlyHistory } = data;
    const history = monthlyHistory || [];

    if (totalIncome === 0) {
        return {
            text: "No income recorded yet this month. Import a statement to see it!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    // Multi-month trend analysis
    if (history.length >= 3) {
        const incomeValues = history.map(m => m.total_income || 0);
        const trend = analyzeTrend(incomeValues);
        const comp = compareToPrevMonth(totalIncome, history, 'total_income');

        if (trend.direction === 'rising' && trend.consecutive >= 3) {
            return {
                text: `Income has been rising for ${trend.consecutive} months straight! ${formatMoney(totalIncome)} Kč this month — up ${comp.changePercent.toFixed(0)}% from last month. If this keeps up, you're in a strong position.`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'floating-bills',
            };
        }

        if (comp.direction === 'up' && comp.changePercent > 10) {
            return {
                text: `Income up ${comp.changePercent.toFixed(0)}% to ${formatMoney(totalIncome)} Kč! That's ${formatMoney(comp.change)} Kč more than last month.`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'floating-bills',
            };
        }
        if (comp.direction === 'down' && comp.changePercent < -10) {
            return {
                text: `Income dropped ${Math.abs(comp.changePercent).toFixed(0)}% to ${formatMoney(totalIncome)} Kč. Your 3-month average is ${formatMoney(Math.round(incomeValues.slice(-3).reduce((s, v) => s + v, 0) / 3))} Kč — this month is below average.`,
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'thought-clouds',
            };
        }
    }

    return {
        text: pick([
            `${formatMoney(totalIncome)} Kč earned this month. Every koruna counts!`,
            `Total income: ${formatMoney(totalIncome)} Kč. Let's make it work hard for you.`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── KPI: Total Expenses ──────────────────────────────────────────────────────
function kpiExpensesInsight(data) {
    const { totalIncome, totalExpenses, monthlyHistory, expenseBreakdown } = data;
    const history = monthlyHistory || [];

    if (totalExpenses === 0) {
        return {
            text: "No expenses recorded yet. Import your statement to start tracking!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    // Find the biggest category mover
    if (history.length >= 2 && expenseBreakdown) {
        const comp = compareToPrevMonth(totalExpenses, history, 'total_expenses');

        if (comp.direction === 'up' && comp.changePercent > 15) {
            // Try to identify which category drove the increase
            const breakdown = expenseBreakdown || [];
            const sorted = [...breakdown].sort((a, b) => (b.amount || 0) - (a.amount || 0));
            const topCat = sorted[0];

            return {
                text: `Spending up ${comp.changePercent.toFixed(0)}% to ${formatMoney(totalExpenses)} Kč! ${topCat ? `${topCat.category} leads at ${formatMoney(topCat.amount)} Kč.` : ''} Consider reviewing your top categories.`,
                type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
                envEffect: 'coins-to-drain',
            };
        }

        if (comp.direction === 'down' && comp.changePercent < -10) {
            return {
                text: `Great discipline! Spending down ${Math.abs(comp.changePercent).toFixed(0)}% to ${formatMoney(totalExpenses)} Kč. You saved ${formatMoney(Math.abs(comp.change))} Kč compared to last month.`,
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
                envEffect: 'raining-coins',
            };
        }
    }

    if (totalIncome > 0 && totalExpenses > totalIncome) {
        return {
            text: `Spending (${formatMoney(totalExpenses)} Kč) exceeds income by ${formatMoney(totalExpenses - totalIncome)} Kč. Let's find where to cut.`,
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'coins-to-drain',
        };
    }

    return {
        text: pick([
            `${formatMoney(totalExpenses)} Kč spent this month. Drag me to categories for the breakdown!`,
            `Total spending: ${formatMoney(totalExpenses)} Kč. Every purchase tells a story.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── KPI: Savings Rate ────────────────────────────────────────────────────────
function kpiSavingsInsight(data) {
    const { savingsRate, totalIncome, totalExpenses, monthlyHistory, selectedMonth } = data;
    const history = monthlyHistory || [];

    if (totalIncome === 0) {
        return {
            text: "No income data yet — savings rate can't be calculated. Import statements!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    // Year-end projection
    const monthlySavings = totalIncome - totalExpenses;
    const yearEnd = projectToYearEnd(monthlySavings, selectedMonth);
    const avg3m = avgSavingsRate(history);

    if (savingsRate >= 30) {
        return {
            text: `${savingsRate.toFixed(0)}% savings rate — incredible! At this pace, you'll save ~${formatMoney(yearEnd.yearEndTotal)} Kč by year-end. Your 3-month average is ${avg3m.toFixed(0)}%.`,
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'hearts',
        };
    }
    if (savingsRate >= 20) {
        return {
            text: `${savingsRate.toFixed(0)}% savings rate — textbook excellent! The golden rule is 20% and you're right there. 3-month average: ${avg3m.toFixed(0)}%.`,
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'piggy-filling',
        };
    }
    if (savingsRate >= 10) {
        return {
            text: `${savingsRate.toFixed(0)}% saved — solid foundation. Pushing to 20% would mean saving an extra ${formatMoney(Math.round(totalIncome * 0.2 - monthlySavings))} Kč/month.`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'piggy-filling',
        };
    }
    if (savingsRate >= 0) {
        return {
            text: `${savingsRate.toFixed(0)}% savings rate — barely breaking even. Can we find easy wins? Even 5% more would be ${formatMoney(Math.round(totalIncome * 0.05))} Kč/month.`,
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const deficit = totalExpenses - totalIncome;
    return {
        text: `Negative savings — spending exceeds income by ${formatMoney(deficit)} Kč. This can't continue long-term. Let's find areas to trim!`,
        type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        envEffect: 'wilting-plant',
    };
}

// ── KPI: Remaining Budget ────────────────────────────────────────────────────
function kpiBudgetInsight(data) {
    const { remainingBudget, totalIncome, totalExpenses, selectedMonth } = data;

    if (remainingBudget < 0) {
        return {
            text: `Budget exceeded by ${formatMoney(Math.abs(remainingBudget))} Kč! Careful with remaining purchases.`,
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    const pace = spendingPace(totalExpenses, totalIncome, selectedMonth);

    if (totalIncome > 0 && remainingBudget > totalIncome * 0.4) {
        return {
            text: `${formatMoney(remainingBudget)} Kč left — huge buffer! With ${pace.daysLeft} days remaining, that's ${formatMoney(pace.dailyAllowance)} Kč/day. Consider allocating surplus to goals!`,
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'stars-medals',
        };
    }

    if (remainingBudget > 0 && pace.daysLeft > 0) {
        return {
            text: `${formatMoney(remainingBudget)} Kč remaining with ${pace.daysLeft} days to go. That's about ${formatMoney(pace.dailyAllowance)} Kč per day.`,
            type: pace.dailyAllowance > 0 ? 'positive' : 'warning',
            expression: pace.dailyAllowance > 0 ? 'happy' : 'concerned',
            mouth: pace.dailyAllowance > 0 ? 'smile' : 'neutral',
            animation: 'idle',
            envEffect: pace.dailyAllowance > 500 ? 'stars-medals' : 'thought-clouds',
        };
    }

    return {
        text: `Budget is exactly zero. Every koruna from here is over budget!`,
        type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        envEffect: 'exclamation-marks',
    };
}

// ── Income vs Expenses Chart ─────────────────────────────────────────────────
function incomeChartInsight(data) {
    const history = data.monthlyHistory || [];

    if (history.length < 2) {
        return {
            text: "Need more months of data to spot trends. Keep importing!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const incomeValues = history.map(m => m.total_income || 0);
    const expenseValues = history.map(m => m.total_expenses || 0);
    const incomeTrend = analyzeTrend(incomeValues);
    const expenseTrend = analyzeTrend(expenseValues);

    // Expenses trending down
    if (expenseTrend.direction === 'falling' && expenseTrend.consecutive >= 2) {
        return {
            text: `Spending has been falling for ${expenseTrend.consecutive} consecutive months (down ${Math.abs(expenseTrend.changePercent).toFixed(0)}% overall). Great trajectory! ${incomeTrend.direction === 'rising' ? 'Income is also rising — your gap is widening beautifully.' : ''}`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'rising-arrow',
        };
    }

    // Expenses trending up
    if (expenseTrend.direction === 'rising' && expenseTrend.consecutive >= 2) {
        return {
            text: `Expenses have climbed for ${expenseTrend.consecutive} months (up ${expenseTrend.changePercent.toFixed(0)}%). ${incomeTrend.direction === 'rising' ? 'Income is rising too, but spending is growing faster.' : 'With income flat, this narrows your margin.'} Watch the trend!`,
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    // Always in the green
    const allPositive = history.every(m => (m.total_income || 0) >= (m.total_expenses || 0));
    if (allPositive && history.length >= 3) {
        return {
            text: `Income above expenses for all ${history.length} months of data. Consistently in the green — beautiful chart!`,
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'diamond-sparkles',
        };
    }

    // Income stability
    if (incomeTrend.strength === 'weak' && history.length >= 4) {
        return {
            text: `Your income has been remarkably stable over ${history.length} months (only ${Math.abs(incomeTrend.changePercent).toFixed(0)}% variation). Predictable income makes budgeting easier!`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    return {
        text: pick([
            `Tracking ${history.length} months of income vs expenses. This chart tells your financial story!`,
            "Every month of data makes my trend analysis more accurate.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Category Donut Chart ─────────────────────────────────────────────────────
function categoryDonutInsight(data) {
    const breakdown = data.expenseBreakdown || [];
    if (breakdown.length === 0) {
        return {
            text: "No expense categories yet. Import a statement to see your breakdown!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const total = breakdown.reduce((s, c) => s + (c.amount || 0), 0);
    const sorted = [...breakdown].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const topPct = total > 0 ? ((sorted[0].amount || 0) / total * 100) : 0;

    // Concentration check
    if (topPct > 50) {
        return {
            text: `${sorted[0].category} dominates at ${topPct.toFixed(0)}% of all spending (${formatMoney(sorted[0].amount)} Kč). That's your biggest lever for savings — even a 10% reduction saves ${formatMoney(Math.round(sorted[0].amount * 0.1))} Kč.`,
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    // Good diversity
    if (breakdown.length >= 6 && topPct < 35) {
        return {
            text: `Nicely diversified across ${breakdown.length} categories — no single one exceeds ${topPct.toFixed(0)}%. Well-balanced spending pattern!`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'swirl-burst',
        };
    }

    // Top 2 domination
    if (sorted.length >= 2) {
        const top2Pct = ((sorted[0].amount || 0) + (sorted[1].amount || 0)) / total * 100;
        if (top2Pct > 70) {
            return {
                text: `${sorted[0].category} and ${sorted[1].category} together make up ${top2Pct.toFixed(0)}% of spending. Small changes in these two categories have the biggest impact.`,
                type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
                envEffect: 'magnifying-glass',
            };
        }
    }

    return {
        text: `Top expense: ${sorted[0].category} at ${formatMoney(sorted[0].amount)} Kč (${topPct.toFixed(0)}%). ${sorted.length > 3 ? `Followed by ${sorted[1].category} and ${sorted[2].category}.` : ''}`,
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Top Categories Bar Chart ─────────────────────────────────────────────────
function topCategoriesInsight(data) {
    const cats = data.topCategories || [];
    if (cats.length === 0) {
        return {
            text: "No categories yet. Import statements and I'll analyze your spending!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const sorted = [...cats].sort((a, b) => (b.amount || 0) - (a.amount || 0));

    // One category dwarfs others
    if (sorted.length >= 2 && sorted[0].amount > sorted[1].amount * 2) {
        const saveable = Math.round(sorted[0].amount * 0.15);
        return {
            text: `${sorted[0].category} at ${formatMoney(sorted[0].amount)} Kč is more than double the next category. Reducing it by just 15% would save ${formatMoney(saveable)} Kč.`,
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'movie-clap',
        };
    }

    // Tight race between top 3
    if (sorted.length >= 3) {
        const ratio = sorted[2].amount / sorted[0].amount;
        if (ratio > 0.8) {
            return {
                text: `Top 3 categories are neck and neck: ${sorted[0].category}, ${sorted[1].category}, ${sorted[2].category}. Balanced spending — no single outlier!`,
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
                envEffect: 'light-bulb',
            };
        }
    }

    return {
        text: `#1 expense: ${sorted[0].category} at ${formatMoney(sorted[0].amount)} Kč. Small changes in your top categories have the biggest impact on savings.`,
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'crystal-ball',
    };
}

// ── Spend Forecast ───────────────────────────────────────────────────────────
function forecastInsight(data) {
    const current = data.totalExpenses || 0;
    const predicted = data.forecast?.predicted_total_expenses;
    const { selectedMonth } = data;

    if (!predicted || predicted <= 0) {
        return {
            text: "Not enough history to forecast spending yet. Keep tracking!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const pct = (current / predicted * 100);
    const pace = spendingPace(current, predicted, selectedMonth);

    if (current > predicted) {
        return {
            text: `Already past the ${formatMoney(predicted)} Kč forecast at ${formatMoney(current)} Kč (${pct.toFixed(0)}%)! With ${pace.daysLeft} days left, every purchase adds to the overshoot.`,
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'umbrella-open',
        };
    }

    if (pct > 85) {
        return {
            text: `At ${pct.toFixed(0)}% of the ${formatMoney(predicted)} Kč forecast with ${pace.daysLeft} days left. Current burn rate: ${formatMoney(pace.dailyBurnRate)} Kč/day. Projected total: ${formatMoney(pace.projectedTotal)} Kč.`,
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    if (pct < 50) {
        return {
            text: `Only ${pct.toFixed(0)}% of the forecast used. ${formatMoney(predicted - current)} Kč of breathing room! At this pace, you'll finish well under forecast.`,
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'telescope',
        };
    }

    return {
        text: `${pct.toFixed(0)}% of the ${formatMoney(predicted)} Kč forecast used. Daily burn rate: ${formatMoney(pace.dailyBurnRate)} Kč. ${pace.onTrack ? 'On track!' : 'Slightly above pace — watch the spending.'}`,
        type: pace.onTrack ? 'positive' : 'neutral',
        expression: pace.onTrack ? 'happy' : 'neutral',
        mouth: pace.onTrack ? 'smile' : 'neutral',
        animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Anomaly Card ─────────────────────────────────────────────────────────────
function anomaliesInsight(data) {
    const anomalies = data.anomalies || [];
    const history = data.monthlyHistory || [];

    if (anomalies.length === 0) {
        return {
            text: pick([
                "Clean month! No unusual spending detected. Your spending is consistent and predictable.",
                "All clear — no anomalies. Smooth sailing!",
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'checkmarks-float',
        };
    }

    const severe = anomalies.find(a => a.severity >= 60);
    if (severe) {
        // Add context from historical data
        const avgCheck = history.length >= 3
            ? ` Your 3-month average for this area suggests this is ${severe.severity > 70 ? 'highly' : 'moderately'} unusual.`
            : '';

        return {
            text: `Severe anomaly detected: ${severe.description}.${avgCheck} Worth investigating!`,
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    if (anomalies.length >= 3) {
        return {
            text: `${anomalies.length} unusual patterns this month — more than typical. Most are mild, but collectively they may signal a shift in your spending habits.`,
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: `${anomalies.length} mild anomal${anomalies.length === 1 ? 'y' : 'ies'}: ${anomalies[0].description}. Probably nothing serious, but good to be aware.`,
        type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Smart AI Insights Section Title ──────────────────────────────────────────
function insightsTitleInsight(data) {
    const { anomalies, forecast, monthlyHistory } = data;
    const hasAnomalies = (anomalies || []).length > 0;
    const hasForecast = forecast?.predicted_total_expenses > 0;
    const hasHistory = (monthlyHistory || []).length >= 3;

    if (hasAnomalies && hasForecast) {
        return {
            text: "My AI brain detected patterns, anomalies, and built predictions. Drag me to each section for deep analysis!",
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }
    if (hasForecast) {
        return {
            text: `My forecast engine is running with ${(monthlyHistory || []).length} months of history. ${hasHistory ? 'The more data I have, the more accurate my predictions.' : 'Import more months for better accuracy!'}`,
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'crystal-ball',
        };
    }
    if (hasAnomalies) {
        return {
            text: "I found unusual patterns below. Drag me there for details!",
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }
    return {
        text: "Smart insights need more data. Import a few months of statements and I'll spot patterns, predict spending, and flag anomalies!",
        type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
        envEffect: 'question-marks',
    };
}

// ── Main Entry Point ─────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'header': headerInsight,
    'kpi-income': kpiIncomeInsight,
    'kpi-expenses': kpiExpensesInsight,
    'kpi-savings': kpiSavingsInsight,
    'kpi-budget': kpiBudgetInsight,
    'income-chart': incomeChartInsight,
    'category-donut': categoryDonutInsight,
    'top-categories': topCategoriesInsight,
    'forecast': forecastInsight,
    'anomalies': anomaliesInsight,
    'insights-title': insightsTitleInsight,
};

/**
 * Generate a contextual insight for a dashboard zone.
 * @param {string} zoneId
 * @param {object} data
 * @returns {{ text, type, expression, mouth, animation, envEffect } | null}
 */
export function generateDashboardInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}
