// Portfolio Zone Insight Generator for Zumi Proximity Interactions
// Enhanced with data intelligence: trends, predictions, best/worst performers, and environmental effects.

import {
    analyzeTrend, compareToPrevMonth, predictNextMonth,
    bestWorstPerformer, pick, formatMoney,
} from './dataIntelligence';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Compute portfolio-wide allocation percentages from summary totals. */
function compositionPcts(summary) {
    const total = summary.total_portfolio || 0;
    if (total <= 0) return { savingsPct: 0, stocksPct: 0, propertiesPct: 0 };
    const savingsPct = (summary.total_savings || 0) / total * 100;
    const stocksPct = (summary.total_stocks_value || 0) / total * 100;
    const propertiesPct = (summary.total_properties_value || 0) / total * 100;
    return { savingsPct, stocksPct, propertiesPct };
}

/** Simple diversification score (0-100) based on how balanced the allocation is. */
function diversificationScore(allocation) {
    if (!allocation || allocation.length === 0) return 0;
    if (allocation.length === 1) return 10;
    const n = allocation.length;
    const ideal = 100 / n;
    const totalDeviation = allocation.reduce((s, a) => s + Math.abs((a.percentage || 0) - ideal), 0);
    const maxDeviation = 2 * (100 - ideal); // worst case: one bucket has everything
    return Math.round(Math.max(0, (1 - totalDeviation / maxDeviation) * 100));
}

/** Find the tab (savings / investments / stocks) with the biggest absolute delta. */
function biggestDeltaTab(summary) {
    const deltas = [
        { tab: 'savings', delta: Math.abs(summary.delta_savings || 0), label: 'Savings' },
        { tab: 'investments', delta: Math.abs(summary.delta_stocks || summary.delta_investments || 0), label: 'Investments' },
        { tab: 'stocks', delta: Math.abs(summary.delta_stocks_value || 0), label: 'Stocks' },
    ];
    return deltas.sort((a, b) => b.delta - a.delta)[0];
}

/** Get risk label from composition. */
function riskLabel(comp) {
    const equity = comp.stocksPct + comp.propertiesPct;
    if (equity > 70) return 'aggressive';
    if (equity > 40) return 'balanced';
    return 'conservative';
}

// ── Portfolio Header ────────────────────────────────────────────────────────
function headerInsight(data) {
    const { summary, activeTab } = data;

    if (!summary || summary.total_portfolio === 0) {
        return {
            text: pick([
                "Your portfolio is empty! Start by adding savings accounts, investments, or properties to build your wealth picture.",
                "Build your wealth portfolio here — track savings, investments, stocks, and properties all in one place.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const total = summary.total_portfolio;
    const allocation = summary.allocation || [];

    // Try trend analysis across allocation history
    if (allocation.length >= 2) {
        const values = allocation.map(a => a.value || a.amount || 0);
        const trend = analyzeTrend(values);

        if (trend.direction === 'rising' && trend.strength !== 'weak') {
            const tabLabels = { overview: 'the full overview', savings: 'your savings', investments: 'your investments', stocks: 'your stock portfolio' };
            return {
                text: `Portfolio has grown ${trend.changePercent.toFixed(1)}% recently — now at ${formatMoney(total)} Kč! You're viewing ${tabLabels[activeTab] || 'the overview'}. ${trend.consecutive >= 2 ? `That's ${trend.consecutive} consecutive periods of growth.` : 'Momentum is building.'}`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'golden-sparkles',
            };
        }
    }

    const tabMessages = {
        overview: `Total portfolio: ${formatMoney(total)} Kč across ${allocation.length} asset ${allocation.length === 1 ? 'class' : 'classes'}. This is your complete wealth snapshot.`,
        savings: `Savings tab active — tracking ${summary.savings_accounts?.length || 0} account${(summary.savings_accounts?.length || 0) !== 1 ? 's' : ''} worth ${formatMoney(summary.total_savings || 0)} Kč within a ${formatMoney(total)} Kč portfolio.`,
        investments: `Investments tab — your non-stock investments are working for you. Total portfolio stands at ${formatMoney(total)} Kč.`,
        stocks: `Stock portfolio view — market values and performance at a glance. Total portfolio: ${formatMoney(total)} Kč.`,
    };

    return {
        text: tabMessages[activeTab] || tabMessages.overview,
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Portfolio KPI Cards ─────────────────────────────────────────────────────
function kpiInsight(data) {
    const { summary, stockPnl } = data;

    if (!summary || summary.total_portfolio === 0) {
        return {
            text: "No portfolio value yet. Add your first savings account, investment, or property to get started!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const total = summary.total_portfolio;
    const comp = compositionPcts(summary);
    const risk = riskLabel(comp);

    // Positive stock gains with composition context
    if (stockPnl && stockPnl.total_pnl > 0) {
        return {
            text: pick([
                `Portfolio: ${formatMoney(total)} Kč with positive stock gains of ${formatMoney(stockPnl.total_pnl)} Kč! Your mix is ${comp.savingsPct.toFixed(0)}% savings, ${comp.stocksPct.toFixed(0)}% stocks, ${comp.propertiesPct.toFixed(0)}% properties — a ${risk} profile.`,
                `${formatMoney(total)} Kč total with stocks in the green (+${formatMoney(stockPnl.total_pnl)} Kč). Composition: ${comp.savingsPct.toFixed(0)}% safe assets, ${(comp.stocksPct + comp.propertiesPct).toFixed(0)}% growth assets.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'treasure-chest',
        };
    }

    // Negative stock P&L
    if (stockPnl && stockPnl.total_pnl < 0) {
        return {
            text: pick([
                `Portfolio: ${formatMoney(total)} Kč. Stocks are down ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč, but savings (${comp.savingsPct.toFixed(0)}%) provide a cushion. Risk profile: ${risk}.`,
                `${formatMoney(total)} Kč portfolio. Markets fluctuate — your ${comp.savingsPct.toFixed(0)}% savings allocation acts as a safety net while stocks recover.`,
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    // Heavy savings concentration
    if (comp.savingsPct > 80) {
        return {
            text: pick([
                `${formatMoney(total)} Kč portfolio is ${comp.savingsPct.toFixed(0)}% savings — very conservative. A small allocation to investments or stocks could boost long-term returns without much risk.`,
                `Heavy on savings at ${comp.savingsPct.toFixed(0)}% of ${formatMoney(total)} Kč. Safe and sound, but diversifying even 10-20% into investments can improve growth.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    // Well-balanced portfolio
    if (risk === 'balanced') {
        return {
            text: `${formatMoney(total)} Kč spread across savings (${comp.savingsPct.toFixed(0)}%), stocks (${comp.stocksPct.toFixed(0)}%), and properties (${comp.propertiesPct.toFixed(0)}%). A nicely balanced portfolio — strong foundation for growth.`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'diamond-sparkles',
        };
    }

    return {
        text: pick([
            `Total portfolio: ${formatMoney(total)} Kč. Risk profile: ${risk}. Savings: ${comp.savingsPct.toFixed(0)}%, Stocks: ${comp.stocksPct.toFixed(0)}%, Properties: ${comp.propertiesPct.toFixed(0)}%.`,
            `${formatMoney(total)} Kč across all assets. Building wealth step by step with a ${risk} allocation strategy!`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'treasure-chest',
    };
}

// ── Tabs Navigation ─────────────────────────────────────────────────────────
function tabsInsight(data) {
    const { activeTab, summary } = data;

    if (!summary || summary.total_portfolio === 0) {
        return {
            text: "Navigate between Overview, Savings, Investments, and Stocks tabs. Add data to unlock insights in each!",
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'microphone',
        };
    }

    const tabs = { overview: 'Overview', savings: 'Savings', investments: 'Investments', stocks: 'Stock Portfolio' };
    const biggest = biggestDeltaTab(summary);

    // Suggest the tab with the most change
    if (biggest && biggest.tab !== activeTab && biggest.delta > 0) {
        return {
            text: pick([
                `Tip: Your ${biggest.label} tab had the biggest recent movement (${formatMoney(biggest.delta)} Kč change). Might be worth a look!`,
                `The ${biggest.label} section saw significant changes recently. Switch there for details — ${formatMoney(biggest.delta)} Kč in movement.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (activeTab === 'overview') {
        return {
            text: pick([
                `Overview shows the big picture of your ${formatMoney(summary.total_portfolio)} Kč portfolio. Dive into specific tabs for detailed analysis!`,
                `You're on Overview — the bird's-eye view. Each other tab offers deeper insights into that asset class.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const current = tabs[activeTab] || 'Overview';
    const others = Object.entries(tabs).filter(([k]) => k !== activeTab).map(([, v]) => v);
    const suggest = pick(others);

    return {
        text: pick([
            `Exploring ${current}. Want a different angle? Check out ${suggest} for a fresh perspective!`,
            `${current} tab active. Each tab reveals unique insights. Try ${suggest} next!`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Allocation Chart ────────────────────────────────────────────────────────
function allocationInsight(data) {
    const { summary } = data;
    const allocation = summary?.allocation || [];

    if (allocation.length === 0) {
        return {
            text: "No allocation data yet. Add savings, investments, or properties to see your wealth distribution!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    const sorted = [...allocation].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    const topPct = sorted[0]?.percentage || 0;
    const divScore = diversificationScore(allocation);

    // Heavy concentration — poor diversification
    if (topPct > 70) {
        return {
            text: pick([
                `${sorted[0].name} dominates at ${topPct.toFixed(0)}% of your portfolio. Diversification score: ${divScore}/100 — quite concentrated. Spreading across more asset classes reduces risk.`,
                `Heavy concentration in ${sorted[0].name} (${topPct.toFixed(0)}%). Your diversification score is only ${divScore}/100. Consider shifting some allocation to reduce single-asset-class risk.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    // Well diversified
    if (allocation.length >= 3 && topPct < 50) {
        return {
            text: pick([
                `Well-diversified across ${allocation.length} asset classes! No single category exceeds ${topPct.toFixed(0)}%. Diversification score: ${divScore}/100. This balance helps weather market swings.`,
                `Nice balance across ${allocation.length} asset types with a ${divScore}/100 diversification score. ${sorted[0].name} leads at ${topPct.toFixed(0)}%, but no category is dominant.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'magnifying-glass',
        };
    }

    // Moderate concentration
    return {
        text: pick([
            `${allocation.length} asset types in your portfolio. ${sorted[0].name} leads at ${topPct.toFixed(0)}%. Diversification score: ${divScore}/100. ${divScore < 50 ? 'Adding another asset class could improve balance.' : 'Reasonable allocation.'}`,
            `Portfolio split across ${allocation.length} categories. Score: ${divScore}/100 for diversification. ${sorted[0].name} at ${topPct.toFixed(0)}% is the largest holding.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Savings Section ─────────────────────────────────────────────────────────
function savingsInsight(data) {
    const { summary } = data;
    const accounts = summary?.savings_accounts || [];

    if (accounts.length === 0) {
        return {
            text: pick([
                "No savings accounts tracked yet. Add your bank accounts to see balances, interest rates, and growth trends!",
                "Start tracking your savings here — every account matters for the full picture of your wealth.",
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'piggy-filling',
        };
    }

    const total = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    const rates = accounts.map(a => Number(a.interest_rate || 0)).filter(r => r > 0);
    const avgRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
    const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
    const minRate = rates.length > 0 ? Math.min(...rates) : 0;

    // Multiple accounts with interest rate comparison
    if (accounts.length >= 3 && rates.length >= 2) {
        const spread = maxRate - minRate;
        return {
            text: pick([
                `${accounts.length} savings accounts totaling ${formatMoney(total)} Kč. Interest rates range from ${minRate.toFixed(1)}% to ${maxRate.toFixed(1)}% (avg ${avgRate.toFixed(1)}%). ${spread > 2 ? 'Consider moving funds from the lowest-rate account to the highest.' : 'Rates are fairly close — good shopping!'}`,
                `${formatMoney(total)} Kč across ${accounts.length} accounts. Average interest: ${avgRate.toFixed(1)}%. Your best rate is ${maxRate.toFixed(1)}% — maximizing funds there could boost returns.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'plant-growing',
        };
    }

    // Growth rate check with delta
    if (summary.delta_savings && summary.delta_savings > 0) {
        const growthPct = total > 0 ? (summary.delta_savings / (total - summary.delta_savings) * 100) : 0;
        return {
            text: pick([
                `Savings grew by ${formatMoney(summary.delta_savings)} Kč${growthPct > 0 ? ` (${growthPct.toFixed(1)}%)` : ''} recently! Total now: ${formatMoney(total)} Kč across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}.`,
                `${formatMoney(total)} Kč in savings — up ${formatMoney(summary.delta_savings)} Kč. Your savings are on the rise!`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'plant-growing',
        };
    }

    return {
        text: pick([
            `${accounts.length} savings account${accounts.length !== 1 ? 's' : ''} with ${formatMoney(total)} Kč total. ${avgRate > 0 ? `Average interest rate: ${avgRate.toFixed(1)}%.` : 'Consider accounts with higher interest rates!'}`,
            `Savings balance: ${formatMoney(total)} Kč. ${accounts.length > 1 ? `Spread across ${accounts.length} accounts for security.` : 'Consider opening additional accounts for better rate shopping.'}`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'piggy-filling',
    };
}

// ── Savings Trend Chart ─────────────────────────────────────────────────────
function savingsTrendInsight(data) {
    const { summary } = data;
    const accounts = summary?.savings_accounts || [];
    const total = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

    if (accounts.length === 0) {
        return {
            text: "This chart shows savings growth over time. Add accounts to see your trajectory and identify growth periods!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    // Attempt trend analysis on savings history
    const savingsHistory = accounts.map(a => Number(a.balance || 0));
    if (savingsHistory.length >= 2) {
        const trend = analyzeTrend(savingsHistory);

        if (trend.direction === 'rising' && trend.consecutive >= 2) {
            return {
                text: `Savings trending upward for ${trend.consecutive} consecutive periods — up ${trend.changePercent.toFixed(1)}% overall! Current total: ${formatMoney(total)} Kč. This upward momentum is a great sign for your financial health.`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'rising-arrow',
            };
        }

        if (trend.direction === 'falling') {
            return {
                text: `Savings showing a decline of ${Math.abs(trend.changePercent).toFixed(1)}% over recent periods. Current total: ${formatMoney(total)} Kč. Identifying where the drawdown started can help reverse the trend.`,
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'telescope',
            };
        }
    }

    if (accounts.length === 1) {
        return {
            text: pick([
                `Tracking ${accounts[0].name || 'your account'} over time. Current balance: ${formatMoney(total)} Kč. Add more accounts for a richer savings story!`,
                `Single account trend for ${accounts[0].name || 'your savings'}. At ${formatMoney(total)} Kč, watch for inflection points where growth accelerates or stalls.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    return {
        text: pick([
            `Savings trend across ${accounts.length} accounts — ${formatMoney(total)} Kč total. Look for the inflection points where growth accelerated or paused!`,
            `12-month savings history with ${formatMoney(total)} Kč across ${accounts.length} accounts. Consistent upward curves mean your habits are working.`,
            `Your savings journey over time. ${accounts.length} accounts building a ${formatMoney(total)} Kč safety net!`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Savings Goals ───────────────────────────────────────────────────────────
function goalsInsight(data) {
    const { summary } = data;
    const accounts = summary?.savings_accounts || [];

    if (accounts.length === 0) {
        return {
            text: pick([
                "Set savings goals to stay motivated! Every target reached is a milestone. Goals give direction to your saving efforts.",
                "Goals give your savings purpose. Create one for emergencies, travel, or a big purchase and watch progress build!",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    // Check for goals with progress
    const goalsWithTargets = accounts.filter(a => a.goal_amount && a.goal_amount > 0);

    if (goalsWithTargets.length > 0) {
        // Find the closest-to-completion goal
        const withProgress = goalsWithTargets.map(a => ({
            name: a.name || 'Unnamed goal',
            balance: Number(a.balance || 0),
            goal: Number(a.goal_amount),
            pct: Number(a.goal_amount) > 0 ? (Number(a.balance || 0) / Number(a.goal_amount)) * 100 : 0,
        })).sort((a, b) => b.pct - a.pct);

        const closest = withProgress[0];

        if (closest.pct >= 90) {
            const remaining = closest.goal - closest.balance;
            return {
                text: `Almost there! "${closest.name}" is ${closest.pct.toFixed(0)}% complete — only ${formatMoney(Math.max(0, remaining))} Kč to go! ${withProgress.length > 1 ? `You have ${withProgress.length} goals in total.` : 'Push through the finish line!'}`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
                envEffect: 'stars-medals',
            };
        }

        if (closest.pct >= 50) {
            // Predict completion timeline
            const monthlyRate = summary.delta_savings && summary.delta_savings > 0 ? summary.delta_savings : 0;
            const remaining = closest.goal - closest.balance;
            const monthsToGo = monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : null;

            return {
                text: `"${closest.name}" leads at ${closest.pct.toFixed(0)}% (${formatMoney(closest.balance)} of ${formatMoney(closest.goal)} Kč). ${monthsToGo ? `At your current savings pace, you could reach it in ~${monthsToGo} month${monthsToGo !== 1 ? 's' : ''}!` : 'Keep up the momentum!'} ${withProgress.length > 1 ? `${withProgress.length} goals being tracked.` : ''}`,
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
                envEffect: 'stars-medals',
            };
        }

        return {
            text: `Tracking ${withProgress.length} savings goal${withProgress.length !== 1 ? 's' : ''}. "${closest.name}" is furthest along at ${closest.pct.toFixed(0)}%. Every deposit brings you closer to your targets!`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            "Your savings goals with progress tracking. Keep pushing toward those targets — every koruna counts!",
            "Goals turn saving into a game. Set target amounts for your accounts and watch the progress bars fill up!",
            "Each goal is a milestone on your financial journey. Track progress and celebrate when you reach them!",
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
        envEffect: 'thought-clouds',
    };
}

// ── Investments Section ─────────────────────────────────────────────────────
function investmentsInsight(data) {
    const { summary } = data;
    const investments = summary?.investments || [];

    if (investments.length === 0) {
        return {
            text: pick([
                "No investments tracked yet. Add mutual funds, bonds, or other assets to see returns analysis and performance!",
                "Start adding your investments to complete the full picture. Track returns, compare performers, and optimize!",
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const total = investments.reduce((s, i) => s + Number(i.current_value || 0), 0);
    const costBasis = investments.reduce((s, i) => s + Number(i.invested_amount || i.cost_basis || 0), 0);
    const totalReturn = total - costBasis;
    const returnPct = costBasis > 0 ? (totalReturn / costBasis * 100) : 0;

    // Use bestWorstPerformer if investments have gain data
    const investmentsWithGain = investments.map(inv => ({
        ...inv,
        unrealized_gain_pct: inv.unrealized_gain_pct || (inv.invested_amount > 0
            ? ((Number(inv.current_value || 0) - Number(inv.invested_amount)) / Number(inv.invested_amount)) * 100
            : 0),
    }));
    const { best, worst } = bestWorstPerformer(investmentsWithGain);

    if (best && worst && investments.length >= 2 && best !== worst) {
        const bestName = best.name || best.ticker || 'Best investment';
        const worstName = worst.name || worst.ticker || 'Weakest investment';
        const bestPct = (best.unrealized_gain_pct || 0).toFixed(1);
        const worstPct = (worst.unrealized_gain_pct || 0).toFixed(1);

        if (totalReturn > 0) {
            return {
                text: `${investments.length} investments worth ${formatMoney(total)} Kč — total return of ${formatMoney(totalReturn)} Kč (${returnPct.toFixed(1)}%). Top performer: ${bestName} at +${bestPct}%. Weakest: ${worstName} at ${worstPct}%.`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'money-tree-growing',
            };
        }

        return {
            text: `${investments.length} investments valued at ${formatMoney(total)} Kč (${returnPct.toFixed(1)}% overall return). ${bestName} leads at ${bestPct}%, while ${worstName} trails at ${worstPct}%. Review the laggards for rebalancing opportunities.`,
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    if (totalReturn > 0) {
        return {
            text: pick([
                `${investments.length} investment${investments.length !== 1 ? 's' : ''} worth ${formatMoney(total)} Kč — up ${formatMoney(totalReturn)} Kč (${returnPct.toFixed(1)}%) from cost basis. Your money is working!`,
                `Investment portfolio: ${formatMoney(total)} Kč with a ${returnPct.toFixed(1)}% return. That's ${formatMoney(totalReturn)} Kč in gains across ${investments.length} position${investments.length !== 1 ? 's' : ''}.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'money-tree-growing',
        };
    }

    return {
        text: pick([
            `${investments.length} investment${investments.length !== 1 ? 's' : ''} worth ${formatMoney(total)} Kč. ${costBasis > 0 ? `Overall return: ${returnPct.toFixed(1)}%.` : ''} Diversification is key to long-term growth!`,
            `Investment portfolio: ${formatMoney(total)} Kč across ${investments.length} position${investments.length !== 1 ? 's' : ''}. Patience and consistency build wealth over time.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Investment Allocation Chart ─────────────────────────────────────────────
function investAllocInsight(data) {
    const { summary } = data;
    const investments = summary?.investments || [];

    if (investments.length === 0) {
        return {
            text: "No investment allocation to show yet. Add investments to see how your funds are distributed!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'movie-clap',
        };
    }

    if (investments.length === 1) {
        return {
            text: pick([
                `All investment funds in one basket — ${investments[0].name || 'a single asset'}. Diversifying across multiple investments could reduce risk and smooth returns.`,
                `Single investment: ${investments[0].name || 'one position'}. Even adding one more position type can meaningfully reduce concentration risk.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const total = investments.reduce((s, i) => s + Number(i.current_value || 0), 0);
    const sorted = [...investments].sort((a, b) => Number(b.current_value || 0) - Number(a.current_value || 0));
    const topPct = total > 0 ? (Number(sorted[0].current_value || 0) / total * 100) : 0;

    // Rebalancing suggestion
    if (topPct > 60) {
        return {
            text: `${sorted[0].name || 'Your largest position'} holds ${topPct.toFixed(0)}% of your investment allocation (${formatMoney(sorted[0].current_value || 0)} Kč of ${formatMoney(total)} Kč). Consider rebalancing — trimming the top holding and spreading across other positions can reduce risk.`,
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (investments.length >= 3 && topPct < 40) {
        return {
            text: `Well-balanced investment allocation across ${investments.length} positions totaling ${formatMoney(total)} Kč. No single position exceeds ${topPct.toFixed(0)}% — this diversification protects against individual asset downturns.`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            `${investments.length} investments totaling ${formatMoney(total)} Kč. ${sorted[0].name || 'Top position'} leads at ${topPct.toFixed(0)}%. Regular rebalancing keeps your allocation aligned with goals.`,
            `Investment allocation across ${investments.length} positions — ${formatMoney(total)} Kč total. Keep an eye on concentration; shift funds if one position grows too dominant.`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Stocks Section ──────────────────────────────────────────────────────────
function stocksInsight(data) {
    const { summary, stockPnl } = data;
    const stocks = summary?.stock_holdings || [];

    if (stocks.length === 0) {
        return {
            text: pick([
                "No stock holdings tracked yet. Add ETFs, individual stocks, or crypto positions to see performance analysis!",
                "Start tracking your stock portfolio here! Add holdings to see best/worst performers and sector breakdowns.",
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'rocket-launch',
        };
    }

    const marketValue = stocks.reduce((s, h) => s + Number(h.market_value ?? h.total_cost ?? 0), 0);
    const { best, worst } = bestWorstPerformer(stocks);

    // Positive P&L with best/worst tickers
    if (stockPnl && stockPnl.total_pnl > 0 && best && worst && stocks.length >= 2) {
        const bestName = best.name || best.ticker || 'Top stock';
        const worstName = worst.name || worst.ticker || 'Weakest stock';
        return {
            text: pick([
                `${stocks.length} holdings worth ${formatMoney(marketValue)} Kč with ${formatMoney(stockPnl.total_pnl)} Kč total P&L! Star performer: ${bestName} at +${(best.unrealized_gain_pct || 0).toFixed(1)}%. Laggard: ${worstName} at ${(worst.unrealized_gain_pct || 0).toFixed(1)}%.`,
                `Portfolio in the green! ${formatMoney(stockPnl.total_pnl)} Kč gains across ${stocks.length} positions. ${bestName} leads the way while ${worstName} needs watching.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'rocket-launch',
        };
    }

    // Negative P&L
    if (stockPnl && stockPnl.total_pnl < 0) {
        const worstName = worst?.name || worst?.ticker || 'Your weakest holding';
        return {
            text: pick([
                `${stocks.length} holdings, ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč in unrealized losses. ${worstName} is the biggest drag at ${(worst?.unrealized_gain_pct || 0).toFixed(1)}%. Markets are cyclical — patience pays.`,
                `Stocks are down ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč overall. ${best ? `${best.name || best.ticker} is holding up best at ${(best.unrealized_gain_pct || 0).toFixed(1)}%.` : ''} Stay the course.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'sinking-anchor',
        };
    }

    // Sector analysis
    const sectors = {};
    for (const h of stocks) {
        const sec = h.sector || h.holding_type || 'other';
        sectors[sec] = (sectors[sec] || 0) + Number(h.market_value ?? h.total_cost ?? 0);
    }
    const sectorEntries = Object.entries(sectors).sort(([, a], [, b]) => b - a);

    if (sectorEntries.length >= 2) {
        return {
            text: `${stocks.length} holdings across ${sectorEntries.length} sectors. Market value: ${formatMoney(marketValue)} Kč. Top sector: ${sectorEntries[0][0]} at ${formatMoney(sectorEntries[0][1])} Kč. ${best ? `Best performer: ${best.name || best.ticker}.` : ''}`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'rocket-launch',
        };
    }

    return {
        text: pick([
            `${stocks.length} stock holding${stocks.length !== 1 ? 's' : ''} with ${formatMoney(marketValue)} Kč market value. Track performance and spot opportunities!`,
            `Stock portfolio: ${formatMoney(marketValue)} Kč across ${stocks.length} position${stocks.length !== 1 ? 's' : ''}. Diversify across sectors for stability.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'rocket-launch',
    };
}

// ── Stock Trend Chart ───────────────────────────────────────────────────────
function stockTrendInsight(data) {
    const { summary, stockBreakdown } = data;
    const stocks = summary?.stock_holdings || [];

    if (stocks.length === 0) {
        return {
            text: "This chart tracks stock values over time. Add holdings to see trends, volatility, and draw-down periods!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const marketValue = stocks.reduce((s, h) => s + Number(h.market_value ?? h.total_cost ?? 0), 0);

    // Try volatility analysis from breakdown data
    if (stockBreakdown && stockBreakdown.length >= 3) {
        const values = stockBreakdown.map(b => Number(b.total_value || b.market_value || 0));
        const trend = analyzeTrend(values);

        if (trend.direction === 'rising' && trend.strength === 'strong') {
            return {
                text: `Strong upward trend in your stock portfolio — up ${trend.changePercent.toFixed(1)}% over the period! ${trend.consecutive >= 2 ? `${trend.consecutive} consecutive growth periods.` : ''} Current value: ${formatMoney(marketValue)} Kč. Momentum is on your side.`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'rising-arrow',
            };
        }

        if (trend.direction === 'falling' && trend.strength !== 'weak') {
            // Identify the draw-down
            const peak = Math.max(...values);
            const drawdown = peak > 0 ? ((peak - marketValue) / peak * 100) : 0;
            return {
                text: `Stock portfolio showing a ${Math.abs(trend.changePercent).toFixed(1)}% decline from recent levels. ${drawdown > 5 ? `Current draw-down from peak: ${drawdown.toFixed(1)}%. ` : ''}Market value: ${formatMoney(marketValue)} Kč. Corrections are normal — watch for a reversal.`,
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'telescope',
            };
        }

        // Stable / low volatility
        if (trend.strength === 'weak') {
            return {
                text: `Stock portfolio has been relatively stable (${Math.abs(trend.changePercent).toFixed(1)}% change). Low volatility at ${formatMoney(marketValue)} Kč. Steady performance can be a sign of defensive holdings.`,
                type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
                envEffect: 'telescope',
            };
        }
    }

    const top = [...stocks].sort((a, b) =>
        Number(b.market_value ?? b.total_cost ?? 0) - Number(a.market_value ?? a.total_cost ?? 0)
    )[0];

    return {
        text: pick([
            `Stock trend chart — ${stocks.length} holdings worth ${formatMoney(marketValue)} Kč. Watch for sustained moves up or down to time rebalancing decisions.`,
            `Tracking ${stocks.length} positions over time. ${top?.ticker || top?.name || 'Your top holding'} leads the chart at ${formatMoney(Number(top?.market_value ?? top?.total_cost ?? 0))} Kč!`,
            `Market value: ${formatMoney(marketValue)} Kč across ${stocks.length} positions. The trend line tells the story — look for draw-downs and rallies!`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Stock Type Allocation Chart ─────────────────────────────────────────────
function stockAllocInsight(data) {
    const { summary } = data;
    const stocks = summary?.stock_holdings || [];

    if (stocks.length === 0) {
        return {
            text: "Stock type allocation will appear once you add holdings. Mix ETFs, individual stocks, and more for better diversification!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'microphone',
        };
    }

    const types = {};
    const typeValues = {};
    for (const h of stocks) {
        const t = h.holding_type || 'other';
        types[t] = (types[t] || 0) + 1;
        typeValues[t] = (typeValues[t] || 0) + Number(h.market_value ?? h.total_cost ?? 0);
    }
    const typeNames = Object.keys(types);
    const totalValue = Object.values(typeValues).reduce((s, v) => s + v, 0);

    if (typeNames.length === 1) {
        const name = typeNames[0] === 'etf' ? 'ETFs' : typeNames[0].charAt(0).toUpperCase() + typeNames[0].slice(1);
        return {
            text: pick([
                `All ${stocks.length} holdings are ${name} (${formatMoney(totalValue)} Kč). Consider mixing in other types — adding individual stocks or bonds can provide different return profiles and reduce correlation risk.`,
                `100% ${name} portfolio at ${formatMoney(totalValue)} Kč. While ${name.toLowerCase()} are great, adding a second asset type creates natural rebalancing opportunities.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    // Multi-type: show composition and rebalancing hint
    const sortedTypes = Object.entries(typeValues).sort(([, a], [, b]) => b - a);
    const topType = sortedTypes[0];
    const topTypePct = totalValue > 0 ? (topType[1] / totalValue * 100) : 0;
    const topLabel = topType[0] === 'etf' ? 'ETF' : topType[0].charAt(0).toUpperCase() + topType[0].slice(1);

    if (topTypePct > 75) {
        return {
            text: `${topLabel} dominates at ${topTypePct.toFixed(0)}% (${formatMoney(topType[1])} Kč). With ${typeNames.length} types total, consider shifting some allocation from ${topLabel} to the other${typeNames.length > 2 ? 's' : ''} for better balance.`,
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            `Holdings spread across ${typeNames.length} types: ${sortedTypes.map(([t, v]) => `${t === 'etf' ? 'ETF' : t} (${(v / totalValue * 100).toFixed(0)}%)`).join(', ')}. Good type diversity reduces correlation risk!`,
            `${typeNames.length} asset types in your stock portfolio — ${formatMoney(totalValue)} Kč total. Diversification across types is a smart strategy.`,
            `Stock allocation: ${sortedTypes.map(([t]) => t === 'etf' ? 'ETF' : t).join(', ')} — ${stocks.length} positions across ${typeNames.length} categories. Well-rounded mix!`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Stock P&L Section ───────────────────────────────────────────────────────
function stockPnlInsight(data) {
    const { stockPnl, selectedMonth, summary } = data;

    if (!stockPnl) {
        return {
            text: "Profit & Loss data loading... Trade stocks to see realized gains, losses, and dividend income here!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    const trades = stockPnl.trades || [];
    const dividends = stockPnl.dividends || [];
    const totalPnl = stockPnl.total_pnl || 0;
    const totalDividends = dividends.reduce((s, d) => s + Number(d.amount || 0), 0);

    // Calculate annualized return if we have cost basis
    const stocks = summary?.stock_holdings || [];
    const costBasis = stocks.reduce((s, h) => s + Number(h.total_cost ?? 0), 0);
    const annualizedNote = costBasis > 0 && totalPnl !== 0
        ? ` Annualized on cost basis: ~${((totalPnl / costBasis) * 12 * 100).toFixed(1)}%/yr.`
        : '';

    if (trades.length === 0 && dividends.length === 0) {
        return {
            text: pick([
                "No realized trades or dividends this month. Holding steady — sometimes patience is the best strategy!",
                "Quiet month for P&L. No trades, no dividends. Sometimes the best move is no move at all.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    // Trades + dividends both positive
    if (totalPnl > 0 && totalDividends > 0) {
        const combined = totalPnl + totalDividends;
        const divCoverage = totalPnl > 0 ? (totalDividends / combined * 100) : 0;
        return {
            text: pick([
                `Great month! ${formatMoney(totalPnl)} Kč in trade gains + ${formatMoney(totalDividends)} Kč in dividends = ${formatMoney(combined)} Kč total income. Dividends cover ${divCoverage.toFixed(0)}% of your realized income.${annualizedNote}`,
                `Profitable month from ${trades.length} trade${trades.length !== 1 ? 's' : ''} and ${dividends.length} dividend${dividends.length !== 1 ? 's' : ''}. Total: ${formatMoney(combined)} Kč. Passive income (dividends) is ${formatMoney(totalDividends)} Kč.${annualizedNote}`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'raining-coins',
        };
    }

    // Pure trade gains
    if (totalPnl > 0) {
        return {
            text: pick([
                `${formatMoney(totalPnl)} Kč realized gains from ${trades.length} trade${trades.length !== 1 ? 's' : ''}. Well-timed exits!${annualizedNote}`,
                `Positive P&L: +${formatMoney(totalPnl)} Kč this month. That's solid execution across ${trades.length} trade${trades.length !== 1 ? 's' : ''}.${annualizedNote}`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'raining-coins',
        };
    }

    // Trade losses
    if (totalPnl < 0) {
        const lossNote = totalDividends > 0
            ? ` On the bright side, ${formatMoney(totalDividends)} Kč in dividends offset some of the loss.`
            : '';
        return {
            text: pick([
                `${formatMoney(Math.abs(totalPnl))} Kč in realized losses from ${trades.length} trade${trades.length !== 1 ? 's' : ''}. Not every trade wins — learn, adapt, and move forward.${lossNote}`,
                `Losses of ${formatMoney(Math.abs(totalPnl))} Kč this month. It's part of the journey — the best investors review and improve.${lossNote}`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    // Pure dividends (no trade gains/losses)
    if (totalDividends > 0) {
        return {
            text: pick([
                `${formatMoney(totalDividends)} Kč in dividends from ${dividends.length} payment${dividends.length !== 1 ? 's' : ''}. Pure passive income! ${costBasis > 0 ? `That's a ${(totalDividends / costBasis * 12 * 100).toFixed(2)}% annualized dividend yield on cost.` : 'Your stocks are paying you back!'}`,
                `Dividend income: ${formatMoney(totalDividends)} Kč from ${dividends.length} source${dividends.length !== 1 ? 's' : ''}. Reinvesting dividends compounds growth over time.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'raining-coins',
        };
    }

    return {
        text: `${trades.length} trade${trades.length !== 1 ? 's' : ''} and ${dividends.length} dividend${dividends.length !== 1 ? 's' : ''} this month. Net P&L: ${formatMoney(totalPnl)} Kč. Review the details for per-trade analysis!`,
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'confetti',
    };
}

// ── Portfolio Trend (NEW) ───────────────────────────────────────────────────
function portfolioTrendInsight(data) {
    const { summary } = data;

    if (!summary || summary.total_portfolio === 0) {
        return {
            text: "Your portfolio composition trend will appear here once you have assets tracked over multiple months. Add savings, investments, or properties to get started!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const total = summary.total_portfolio;
    const comp = compositionPcts(summary);
    const allocation = summary.allocation || [];

    // Try to analyze the overall trend from allocation data
    if (allocation.length >= 2) {
        const values = allocation.map(a => a.value || a.amount || 0);
        const trend = analyzeTrend(values);

        if (trend.direction === 'rising') {
            return {
                text: `Portfolio composition trending upward — ${formatMoney(total)} Kč total, up ${trend.changePercent.toFixed(1)}% over the period. The mix is ${comp.savingsPct.toFixed(0)}% savings, ${comp.stocksPct.toFixed(0)}% stocks, ${comp.propertiesPct.toFixed(0)}% properties. Growth across multiple asset classes is the ideal scenario.`,
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'telescope',
            };
        }

        if (trend.direction === 'falling') {
            return {
                text: `Overall portfolio composition shows a ${Math.abs(trend.changePercent).toFixed(1)}% decline recently. Currently at ${formatMoney(total)} Kč. Check which asset class is driving the pullback — savings (${comp.savingsPct.toFixed(0)}%), stocks (${comp.stocksPct.toFixed(0)}%), or properties (${comp.propertiesPct.toFixed(0)}%).`,
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'telescope',
            };
        }
    }

    // Predict next month if we have history
    if (allocation.length >= 3) {
        const prediction = predictNextMonth(
            allocation.map(a => ({ value: a.value || a.amount || 0 })),
            'value'
        );
        if (prediction.confidence !== 'low' && prediction.predicted > 0) {
            return {
                text: `Portfolio at ${formatMoney(total)} Kč. Based on your trend, next month's projection is ~${formatMoney(prediction.predicted)} Kč (${prediction.confidence} confidence). Current split: savings ${comp.savingsPct.toFixed(0)}%, stocks ${comp.stocksPct.toFixed(0)}%, properties ${comp.propertiesPct.toFixed(0)}%.`,
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
                envEffect: 'telescope',
            };
        }
    }

    return {
        text: pick([
            `Portfolio composition over time — ${formatMoney(total)} Kč across ${allocation.length} asset ${allocation.length === 1 ? 'class' : 'classes'}. Watch how the balance shifts month over month. Savings: ${comp.savingsPct.toFixed(0)}%, Stocks: ${comp.stocksPct.toFixed(0)}%, Properties: ${comp.propertiesPct.toFixed(0)}%.`,
            `Tracking your ${formatMoney(total)} Kč portfolio mix over time. This chart reveals how your wealth allocation evolves. Consistent tracking is the foundation of smart portfolio management.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Property Trend (NEW) ────────────────────────────────────────────────────
function propertyTrendInsight(data) {
    const { summary } = data;
    const properties = summary?.properties || [];

    if (properties.length === 0) {
        return {
            text: "No properties tracked yet. Add real estate holdings to see appreciation rates and value trends over time!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'house-building',
        };
    }

    const totalValue = summary.total_properties_value || properties.reduce((s, p) => s + Number(p.current_value || p.value || 0), 0);
    const totalCost = properties.reduce((s, p) => s + Number(p.purchase_price || p.cost_basis || 0), 0);
    const appreciation = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    // Appreciation analysis
    if (totalCost > 0 && appreciation > 0) {
        const gainAmount = totalValue - totalCost;
        return {
            text: pick([
                `Property portfolio has appreciated ${appreciation.toFixed(1)}% — from ${formatMoney(totalCost)} Kč cost basis to ${formatMoney(totalValue)} Kč current value. That's ${formatMoney(gainAmount)} Kč in equity growth across ${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}.`,
                `Real estate is up ${appreciation.toFixed(1)}% overall! ${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'} worth ${formatMoney(totalValue)} Kč, an increase of ${formatMoney(gainAmount)} Kč from purchase prices. Property tends to be a steady long-term wealth builder.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'house-building',
        };
    }

    if (totalCost > 0 && appreciation < 0) {
        return {
            text: `Properties currently valued at ${formatMoney(totalValue)} Kč — ${Math.abs(appreciation).toFixed(1)}% below purchase prices (${formatMoney(totalCost)} Kč). Real estate markets can be cyclical; long-term holders typically recover and benefit from appreciation.`,
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    // Delta-based trend if available
    if (summary.delta_properties_value && summary.delta_properties_value !== 0) {
        const direction = summary.delta_properties_value > 0 ? 'up' : 'down';
        return {
            text: `Property values ${direction} ${formatMoney(Math.abs(summary.delta_properties_value))} Kč recently. Total: ${formatMoney(totalValue)} Kč across ${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}. Real estate provides both appreciation potential and portfolio stability.`,
            type: direction === 'up' ? 'positive' : 'warning',
            expression: direction === 'up' ? 'happy' : 'concerned',
            mouth: direction === 'up' ? 'smile' : 'neutral',
            animation: direction === 'up' ? 'hop' : 'idle',
            envEffect: 'house-building',
        };
    }

    return {
        text: pick([
            `${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'} tracked, valued at ${formatMoney(totalValue)} Kč. Property appreciation tends to be steady — this chart reveals the trajectory.`,
            `Real estate portfolio: ${formatMoney(totalValue)} Kč. Track appreciation rates here and see how your properties contribute to overall wealth growth.`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'house-building',
    };
}

// ── Properties Details (NEW) ────────────────────────────────────────────────
function propertiesInsight(data) {
    const { summary } = data;
    const properties = summary?.properties || [];

    if (properties.length === 0) {
        return {
            text: "No properties in your portfolio yet. Add real estate — apartments, houses, land — to track values and see how they fit in your wealth picture!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'house-building',
        };
    }

    const totalValue = summary.total_properties_value || properties.reduce((s, p) => s + Number(p.current_value || p.value || 0), 0);

    if (properties.length === 1) {
        const prop = properties[0];
        const propValue = Number(prop.current_value || prop.value || 0);
        const propCost = Number(prop.purchase_price || prop.cost_basis || 0);
        const propGain = propCost > 0 ? ((propValue - propCost) / propCost * 100) : 0;
        const propName = prop.name || prop.address || 'Your property';

        if (propCost > 0 && propGain > 0) {
            return {
                text: `${propName} is valued at ${formatMoney(propValue)} Kč — up ${propGain.toFixed(1)}% from purchase price of ${formatMoney(propCost)} Kč. That's ${formatMoney(propValue - propCost)} Kč in equity growth. Single-property portfolios benefit from adding a second asset for diversification.`,
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
                envEffect: 'house-building',
            };
        }

        return {
            text: `${propName} valued at ${formatMoney(propValue)} Kč. ${propCost > 0 ? `Purchased for ${formatMoney(propCost)} Kč.` : ''} A single property is a great start — it adds stability and real-asset exposure to your portfolio.`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    // Multiple properties: per-property value breakdown
    const sorted = [...properties].sort((a, b) =>
        Number(b.current_value || b.value || 0) - Number(a.current_value || a.value || 0)
    );
    const topProp = sorted[0];
    const topValue = Number(topProp.current_value || topProp.value || 0);
    const topPct = totalValue > 0 ? (topValue / totalValue * 100) : 0;
    const topName = topProp.name || topProp.address || 'Top property';
    const avgValue = Math.round(totalValue / properties.length);

    // Check for property with best appreciation
    const withGains = properties
        .filter(p => Number(p.purchase_price || p.cost_basis || 0) > 0)
        .map(p => {
            const cv = Number(p.current_value || p.value || 0);
            const pp = Number(p.purchase_price || p.cost_basis || 0);
            return { ...p, gainPct: ((cv - pp) / pp) * 100 };
        })
        .sort((a, b) => b.gainPct - a.gainPct);

    if (withGains.length >= 2) {
        const bestProp = withGains[0];
        const bestName = bestProp.name || bestProp.address || 'Best performer';
        return {
            text: `${properties.length} properties totaling ${formatMoney(totalValue)} Kč (avg ${formatMoney(avgValue)} Kč each). ${topName} is the most valuable at ${formatMoney(topValue)} Kč (${topPct.toFixed(0)}% of real estate). Best appreciation: ${bestName} at +${bestProp.gainPct.toFixed(1)}%.`,
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    return {
        text: pick([
            `${properties.length} properties worth ${formatMoney(totalValue)} Kč total. ${topName} leads at ${formatMoney(topValue)} Kč (${topPct.toFixed(0)}%). Average property value: ${formatMoney(avgValue)} Kč.`,
            `Real estate portfolio: ${properties.length} properties, ${formatMoney(totalValue)} Kč combined. Your largest is ${topName} at ${formatMoney(topValue)} Kč. Property is a cornerstone of wealth diversification.`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'house-building',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'port-header': headerInsight,
    'port-kpi': kpiInsight,
    'port-tabs': tabsInsight,
    'port-allocation': allocationInsight,
    'port-savings': savingsInsight,
    'port-savings-trend': savingsTrendInsight,
    'port-goals': goalsInsight,
    'port-investments': investmentsInsight,
    'port-invest-alloc': investAllocInsight,
    'port-stocks': stocksInsight,
    'port-stock-trend': stockTrendInsight,
    'port-stock-alloc': stockAllocInsight,
    'port-stock-pnl': stockPnlInsight,
    'port-trend': portfolioTrendInsight,
    'port-property-trend': propertyTrendInsight,
    'port-properties': propertiesInsight,
};

/**
 * Generate a contextual insight for a portfolio zone.
 * @param {string} zoneId
 * @param {object} data – { _page, summary, activeTab, stockPnl, stockBreakdown, selectedMonth }
 * @returns {{ text, type, expression, mouth, animation, envEffect } | null}
 */
export function generatePortfolioInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}
