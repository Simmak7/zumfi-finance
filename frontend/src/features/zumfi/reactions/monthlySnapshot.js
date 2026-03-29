// Monthly Snapshot Builder
// Transforms raw API responses into structured monthly data for mood evaluation.

/**
 * Build a snapshot of the current month's financial state.
 */
export function buildMonthlySnapshot(dashboard, budget, portfolio, goals, forecast) {
    const income = dashboard?.total_income || 0;
    const expenses = dashboard?.total_expenses || 0;
    const savingsRate = income > 0 ? (income - expenses) / income : 0;

    // Budget — API returns planned_amount / actual_amount / percent_used
    let budgetTotal = 0;
    let budgetUsed = 0;
    if (budget?.categories && Array.isArray(budget.categories)) {
        for (const cat of budget.categories) {
            budgetTotal += cat.planned_amount || 0;
            budgetUsed += cat.actual_amount || 0;
        }
    }
    const budgetPct = budgetTotal > 0 ? budgetUsed / budgetTotal : 0;

    // Budget category detail for per-category mood checks
    const budgetCategories = (budget?.categories || []).map(c => ({
        name: c.category_name || '',
        budget: c.planned_amount || 0,
        spent: c.actual_amount || 0,
        pct: (c.planned_amount || 0) > 0 ? (c.actual_amount || 0) / (c.planned_amount || 0) : 0,
    }));

    // Portfolio — API returns total_portfolio, overall_gain_loss_pct
    const portfolioValue = portfolio?.total_portfolio || 0;
    const portfolioChange = portfolio?.overall_gain_loss_pct || 0;

    // Goals — API returns target_amount / current_amount (no progress field)
    const goalsList = Array.isArray(goals) ? goals : [];
    const goalCount = goalsList.length;
    const getGoalProgress = (g) => {
        if (g.progress != null) return g.progress; // dashboard embeds progress
        const target = g.target_amount || 0;
        return target > 0 ? (g.current_amount || 0) / target * 100 : 0;
    };
    const goalsReachedCount = goalsList.filter(g => getGoalProgress(g) >= 100).length;
    const avgGoalPct = goalCount > 0
        ? goalsList.reduce((sum, g) => sum + getGoalProgress(g), 0) / goalCount
        : 0;

    // Forecast
    const forecastOvershoot = forecast?.predicted_total_expenses > 0
        ? expenses / forecast.predicted_total_expenses
        : 0;

    return {
        income,
        expenses,
        savingsRate,
        budgetTotal,
        budgetUsed,
        budgetPct,
        budgetCategories,
        portfolioValue,
        portfolioChange,
        goalCount,
        goalsReachedCount,
        avgGoalPct,
        forecastOvershoot,
    };
}

/**
 * Build historical context from monthly history (typically 6 months).
 * Computes moving averages, trends, and volatility.
 */
export function buildHistoricalContext(monthlyHistory) {
    const months = Array.isArray(monthlyHistory) ? monthlyHistory : [];

    if (months.length === 0) {
        return {
            months: [],
            avgIncome: 0,
            avgExpenses: 0,
            avgSavingsRate: 0,
            spendingTrend: 'stable',
            incomeTrend: 'stable',
            spendingVolatility: 0,
            consecutiveGrowth: 0,
            consecutiveDecline: 0,
        };
    }

    // Sort oldest first (by month string)
    const sorted = [...months].sort((a, b) => (a.month || '').localeCompare(b.month || ''));

    // Extract values
    const incomes = sorted.map(m => m.total_income || m.income || 0);
    const expenses = sorted.map(m => m.total_expenses || m.expenses || 0);

    // 3-month moving averages (use last 3 months)
    const recent3Inc = incomes.slice(-3);
    const recent3Exp = expenses.slice(-3);
    const avgIncome = avg(recent3Inc);
    const avgExpenses = avg(recent3Exp);
    const avgSavingsRate = avgIncome > 0 ? (avgIncome - avgExpenses) / avgIncome : 0;

    // Spending trend: compare recent 3 avg to prior 3 avg
    const spendingTrend = computeTrend(expenses);
    const incomeTrend = computeTrend(incomes);

    // Spending volatility: stdDev / avg
    const allExpAvg = avg(expenses);
    const spendingVolatility = allExpAvg > 0 ? stdDev(expenses) / allExpAvg : 0;

    // Consecutive income growth/decline (from most recent going back)
    let consecutiveGrowth = 0;
    let consecutiveDecline = 0;
    for (let i = incomes.length - 1; i > 0; i--) {
        if (incomes[i] > incomes[i - 1]) {
            if (consecutiveDecline === 0) consecutiveGrowth++;
            else break;
        } else if (incomes[i] < incomes[i - 1]) {
            if (consecutiveGrowth === 0) consecutiveDecline++;
            else break;
        } else {
            break;
        }
    }

    return {
        months: sorted,
        avgIncome,
        avgExpenses,
        avgSavingsRate,
        spendingTrend,
        incomeTrend,
        spendingVolatility,
        consecutiveGrowth,
        consecutiveDecline,
    };
}

/**
 * Compute Financial Health Score (0-100).
 * Breakdown: Savings Rate (0-30) + Spending Stability (0-25) + Portfolio (0-25) + Goals (0-20)
 */
export function computeHealthScore(snapshot, history) {
    // Savings Rate (0-30): 30% savings rate = max
    const savingsScore = Math.min(30, Math.max(0, snapshot.savingsRate * 100));

    // Spending Stability (0-25): lower volatility = higher score
    const volatility = history?.spendingVolatility || 0;
    const stabilityScore = Math.max(0, 25 - Math.min(25, volatility * 50));

    // Portfolio Stability (0-25)
    let portfolioScore = 15; // default: flat/no portfolio
    const change = snapshot.portfolioChange || 0;
    if (snapshot.portfolioValue > 0) {
        if (change > 0) {
            portfolioScore = Math.min(25, 15 + change * 2); // +5% = 25
        } else if (change < 0) {
            portfolioScore = Math.max(0, 15 + change * 3); // -5% = 0
        }
    }

    // Goal Progress (0-20)
    const goalScore = snapshot.goalCount > 0
        ? Math.min(20, snapshot.avgGoalPct * 20 / 100)
        : 10; // neutral if no goals

    const total = Math.round(
        Math.max(0, Math.min(100, savingsScore + stabilityScore + portfolioScore + goalScore))
    );

    return {
        total,
        breakdown: {
            savings: Math.round(savingsScore),
            stability: Math.round(stabilityScore),
            portfolio: Math.round(portfolioScore),
            goals: Math.round(goalScore),
        },
    };
}

// --- Helpers ---

function avg(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
    if (arr.length < 2) return 0;
    const mean = avg(arr);
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}

function computeTrend(values) {
    if (values.length < 4) return 'stable';
    const recent = avg(values.slice(-3));
    const prior = avg(values.slice(0, -3));
    if (prior === 0) return 'stable';
    const change = (recent - prior) / prior;
    if (change > 0.1) return 'rising';
    if (change < -0.1) return 'declining';
    return 'stable';
}
