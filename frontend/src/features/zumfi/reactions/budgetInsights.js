// Budget Zone Insight Generator for Zumfi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';

// ── Budget Header ───────────────────────────────────────────────────────────
// MoM budget adherence streak – "under budget for N months"
function headerInsight(data) {
    const { categories, totalPlanned, totalActual, remaining, usagePct, selectedMonth, expenseBreakdown } = data;

    if (!categories || categories.length === 0) {
        return {
            text: pick([
                "No budgets set yet! Use Auto-suggest to get smart budget recommendations based on your spending history.",
                "Start planning your budget — set spending limits for each category and I'll track your progress.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'rain-cloud',
        };
    }

    // Calculate adherence streak from category history
    const monthlyHistory = categories
        .filter(c => Array.isArray(c.history))
        .map(c => c.history);

    let streakMonths = 0;
    if (monthlyHistory.length > 0 && monthlyHistory[0].length > 1) {
        const histLen = monthlyHistory[0].length;
        for (let i = histLen - 1; i >= 0; i--) {
            const allUnder = monthlyHistory.every(h => {
                const entry = h[i];
                return entry && (entry.spent || entry.actual || 0) <= (entry.planned || entry.budget || 0);
            });
            if (allUnder) {
                streakMonths++;
            } else {
                break;
            }
        }
    }

    const pct = usagePct || (totalPlanned > 0 ? (totalActual / totalPlanned * 100) : 0);

    if (streakMonths >= 3) {
        return {
            text: pick([
                `Under budget for ${streakMonths} months in a row! That consistency is building real financial resilience. Currently at ${pct.toFixed(0)}% usage this month.`,
                `${streakMonths}-month adherence streak and counting! You've spent ${formatMoney(totalActual)} of ${formatMoney(totalPlanned)} planned — discipline pays off.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'trophy',
        };
    }

    if (pct > 100) {
        const overAmt = totalActual - totalPlanned;
        return {
            text: pick([
                `Overall budget exceeded by ${(pct - 100).toFixed(0)}%, that's ${formatMoney(overAmt)} over. Let's review which categories drove the overspend and find places to pull back.`,
                `You've gone ${formatMoney(overAmt)} over budget this month. The streak resets, but one month doesn't define your finances — let's course-correct.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'rain-cloud',
        };
    }

    if (pct > 85) {
        return {
            text: pick([
                `${pct.toFixed(0)}% of your total budget used with ${formatMoney(remaining)} remaining. You're approaching the limit — consider slowing discretionary spending for the rest of the month.`,
                `Getting close at ${pct.toFixed(0)}%! Only ${formatMoney(remaining)} left across all categories. A little restraint now can protect your streak.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'rain-cloud',
        };
    }

    if (streakMonths === 1) {
        return {
            text: pick([
                `Last month was under budget — let's make it two in a row! Currently at ${pct.toFixed(0)}% with ${formatMoney(remaining)} remaining.`,
                `One month under budget, building momentum! ${formatMoney(remaining)} still available across ${categories.length} categories.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'trophy',
        };
    }

    return {
        text: pick([
            `Budget health looks good! ${pct.toFixed(0)}% used across ${categories.length} categories with ${formatMoney(remaining)} to spare.`,
            `${formatMoney(remaining)} of budget remaining this month. Tracking ${categories.length} categories — well managed so far!`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'trophy',
    };
}

// ── Budget Editor ───────────────────────────────────────────────────────────
// Coverage analysis — which high-spend categories have no budget
function editorInsight(data) {
    const { categories, expenseBreakdown, totalPlanned } = data;
    const budgeted = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);
    const totalCats = categories?.length || 0;

    if (budgeted.length === 0) {
        return {
            text: pick([
                "No budgets configured yet. Set limits here or use Auto-suggest to generate recommendations from your past spending patterns!",
                "This is where you plan your spending. Start with your biggest expense categories for maximum impact, or let Auto-suggest do the work.",
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'microphone',
        };
    }

    // Identify high-spend categories with no budget
    const budgetedNames = new Set(budgeted.map(c => (c.category || c.name || '').toLowerCase()));
    const unbudgetedHighSpend = (expenseBreakdown || [])
        .filter(e => !budgetedNames.has((e.category || e.name || '').toLowerCase()) && (e.amount || e.spent || 0) > 0)
        .sort((a, b) => (b.amount || b.spent || 0) - (a.amount || a.spent || 0));

    if (unbudgetedHighSpend.length > 0) {
        const top = unbudgetedHighSpend[0];
        const topName = top.category || top.name;
        const topAmt = top.amount || top.spent || 0;
        const additionalCount = unbudgetedHighSpend.length - 1;
        const suffix = additionalCount > 0
            ? ` Plus ${additionalCount} other spending categor${additionalCount === 1 ? 'y has' : 'ies have'} no limits set.`
            : '';
        return {
            text: pick([
                `"${topName}" has ${formatMoney(topAmt)} in spending but no budget limit. That's a blind spot in your plan.${suffix}`,
                `Coverage gap: you're spending ${formatMoney(topAmt)} on "${topName}" without a budget. Consider adding a limit to keep it in check.${suffix}`,
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const unbudgetedCount = totalCats - budgeted.length;

    if (unbudgetedCount === 0) {
        return {
            text: pick([
                "Every category has a budget! Full coverage means no spending goes untracked. That's the gold standard of financial planning.",
                "100% budget coverage across all categories. You're controlling every dollar — that's rare and impressive!",
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'stars-medals',
        };
    }

    if (unbudgetedCount > 3) {
        return {
            text: pick([
                `${unbudgetedCount} categories still without a budget. More coverage means fewer surprises — consider adding limits to your most-used categories first.`,
                `Only ${budgeted.length} of ${totalCats} categories budgeted. Start with the categories where you spend the most to maximize control.`,
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            `${budgeted.length} categories budgeted out of ${totalCats}. Just ${unbudgetedCount} more to go for complete coverage!`,
            `Solid setup with ${budgeted.length} budget limits. Close the remaining ${unbudgetedCount} gap${unbudgetedCount !== 1 ? 's' : ''} for full control.`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'stars-medals',
    };
}

// ── Budget Progress Bars ────────────────────────────────────────────────────
// Worst offender with specific save suggestion
function progressInsight(data) {
    const { categories, totalPlanned, totalActual } = data;
    const cats = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);

    if (cats.length === 0) {
        return {
            text: "No progress to show yet. Set some category budgets first and I'll track every penny against your limits!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'exclamation-marks',
        };
    }

    const overBudget = cats
        .filter(c => (c.spent || c.actual || 0) > (c.planned || c.budget || 0))
        .sort((a, b) => {
            const overA = (a.spent || a.actual || 0) - (a.planned || a.budget || 0);
            const overB = (b.spent || b.actual || 0) - (b.planned || b.budget || 0);
            return overB - overA;
        });

    if (overBudget.length === 0) {
        const closestToLimit = [...cats].sort((a, b) => {
            const pctA = (a.spent || a.actual || 0) / (a.planned || a.budget || 1);
            const pctB = (b.spent || b.actual || 0) / (b.planned || b.budget || 1);
            return pctB - pctA;
        })[0];
        const closestPct = ((closestToLimit.spent || closestToLimit.actual || 0) / (closestToLimit.planned || closestToLimit.budget || 1) * 100).toFixed(0);
        const closestName = closestToLimit.category || closestToLimit.name;

        return {
            text: pick([
                `All categories under budget — green across the board! "${closestName}" is closest to its limit at ${closestPct}%, so keep an eye on it.`,
                `No overspending anywhere this month. "${closestName}" at ${closestPct}% is your tightest margin, but you're still in the clear.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'floating-bubbles',
        };
    }

    // Worst offender with save suggestion
    const worst = overBudget[0];
    const worstName = worst.category || worst.name;
    const overAmt = (worst.spent || worst.actual || 0) - (worst.planned || worst.budget || 0);
    const worstPct = ((worst.spent || worst.actual || 0) / (worst.planned || worst.budget || 1) * 100).toFixed(0);
    const dailySave = Math.ceil(overAmt / 14); // suggest cutting over 2 weeks

    if (overBudget.length === 1) {
        return {
            text: pick([
                `"${worstName}" is over budget by ${formatMoney(overAmt)} (${worstPct}% of limit). Cutting just ${formatMoney(dailySave)} per day for two weeks would close that gap. Only one category in the red!`,
                `Just one slip: "${worstName}" exceeded its limit by ${formatMoney(overAmt)}. Try reducing daily spend in this area by about ${formatMoney(dailySave)} to recover.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    const totalOver = overBudget.reduce((s, c) => s + ((c.spent || c.actual || 0) - (c.planned || c.budget || 0)), 0);
    return {
        text: pick([
            `${overBudget.length} categories over budget, totaling ${formatMoney(totalOver)} in overspend. "${worstName}" is the worst at ${formatMoney(overAmt)} over — saving ${formatMoney(dailySave)}/day there would help the most.`,
            `"${worstName}" leads the overspend at ${formatMoney(overAmt)} over. Across ${overBudget.length} categories you're ${formatMoney(totalOver)} past your limits. Focus cuts on the biggest offender first.`,
        ]),
        type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        envEffect: 'exclamation-marks',
    };
}

// ── Budget Chart ────────────────────────────────────────────────────────────
// Reallocation recommendation
function chartInsight(data) {
    const { categories, totalPlanned, totalActual } = data;
    const cats = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);

    if (cats.length === 0) {
        return {
            text: "The chart needs budget data to visualize. Set up some category budgets first and I'll give you a clear planned-vs-actual comparison!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    // Find category with biggest surplus and biggest deficit
    const withGap = cats.map(c => {
        const planned = c.planned || c.budget || 0;
        const spent = c.spent || c.actual || 0;
        return { name: c.category || c.name, planned, spent, gap: planned - spent };
    }).sort((a, b) => b.gap - a.gap);

    const biggestSurplus = withGap[0];
    const biggestDeficit = withGap[withGap.length - 1];

    // Reallocation recommendation when there's both surplus and deficit
    if (biggestSurplus.gap > 0 && biggestDeficit.gap < 0) {
        const reallocateAmt = Math.min(biggestSurplus.gap, Math.abs(biggestDeficit.gap));
        return {
            text: pick([
                `Reallocation idea: "${biggestSurplus.name}" has ${formatMoney(biggestSurplus.gap)} to spare, while "${biggestDeficit.name}" is ${formatMoney(Math.abs(biggestDeficit.gap))} over. Moving ${formatMoney(reallocateAmt)} between them would balance things out.`,
                `The chart reveals an opportunity: shift ${formatMoney(reallocateAmt)} from "${biggestSurplus.name}" (${formatMoney(biggestSurplus.gap)} under) to "${biggestDeficit.name}" (${formatMoney(Math.abs(biggestDeficit.gap))} over). Your total budget stays the same but fits reality better.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'movie-clap',
        };
    }

    if (biggestSurplus.gap > 0) {
        return {
            text: pick([
                `"${biggestSurplus.name}" has the most headroom at ${formatMoney(biggestSurplus.gap)} under budget. If this is consistent, you could lower that limit and redirect the funds elsewhere.`,
                `Biggest buffer is in "${biggestSurplus.name}" — ${formatMoney(biggestSurplus.gap)} unused. Consider whether that budget is set too high, or if this is just a light month.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    // All categories over budget
    const totalOver = cats.reduce((s, c) => s + Math.max(0, (c.spent || c.actual || 0) - (c.planned || c.budget || 0)), 0);
    return {
        text: pick([
            `Every category is at or over its limit — ${formatMoney(totalOver)} total overspend. The chart makes it clear: either spending needs to come down or budgets need a realistic increase.`,
            `The chart shows red across the board with ${formatMoney(totalOver)} in total overruns. Time for an honest budget revision that matches your actual spending patterns.`,
        ]),
        type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Budget Stats (NEW) ──────────────────────────────────────────────────────
// Daily spending allowance calculation
function statsInsight(data) {
    const { totalPlanned, totalActual, remaining, selectedMonth, categories } = data;

    if (!totalPlanned || totalPlanned === 0) {
        return {
            text: "No budget data to calculate daily allowances. Set up your budget and I'll tell you exactly how much you can spend each day!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    // Calculate days remaining in the month
    const now = new Date();
    let daysLeft, daysElapsed, daysInMonth;
    if (selectedMonth) {
        const [year, month] = selectedMonth.split('-').map(Number);
        daysInMonth = new Date(year, month, 0).getDate();
        const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);
        if (isCurrentMonth) {
            daysElapsed = now.getDate();
            daysLeft = Math.max(0, daysInMonth - daysElapsed);
        } else {
            daysElapsed = daysInMonth;
            daysLeft = 0;
        }
    } else {
        daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        daysElapsed = now.getDate();
        daysLeft = Math.max(0, daysInMonth - daysElapsed);
    }

    const budgetRemaining = remaining != null ? remaining : (totalPlanned - (totalActual || 0));
    const dailyAllowance = daysLeft > 0 ? Math.round(budgetRemaining / daysLeft) : 0;
    const dailyBurn = daysElapsed > 0 ? Math.round((totalActual || 0) / daysElapsed) : 0;
    const projectedTotal = dailyBurn * daysInMonth;

    if (daysLeft === 0) {
        const finalPct = totalPlanned > 0 ? ((totalActual || 0) / totalPlanned * 100).toFixed(0) : 0;
        return {
            text: pick([
                `Month complete! You used ${finalPct}% of your ${formatMoney(totalPlanned)} budget. Your average daily spend was ${formatMoney(dailyBurn)}.`,
                `Final tally: ${formatMoney(totalActual)} spent against ${formatMoney(totalPlanned)} planned. That's ${formatMoney(dailyBurn)} per day on average.`,
            ]),
            type: (totalActual || 0) <= totalPlanned ? 'positive' : 'warning',
            expression: (totalActual || 0) <= totalPlanned ? 'happy' : 'concerned',
            mouth: (totalActual || 0) <= totalPlanned ? 'smile' : 'neutral',
            animation: 'idle',
            envEffect: (totalActual || 0) <= totalPlanned ? 'piggy-filling' : 'telescope',
        };
    }

    if (dailyAllowance <= 0) {
        return {
            text: pick([
                `Budget is already fully spent with ${daysLeft} days remaining. You've been burning ${formatMoney(dailyBurn)}/day — any further spending this month will push you deeper into the red.`,
                `No daily allowance left — you've used the entire ${formatMoney(totalPlanned)} budget with ${daysLeft} days to go. Time to go into lockdown mode on discretionary spending.`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    const onTrack = projectedTotal <= totalPlanned * 1.05;

    if (onTrack) {
        return {
            text: pick([
                `You can spend ${formatMoney(dailyAllowance)} per day for the next ${daysLeft} days and stay on budget. Your current pace of ${formatMoney(dailyBurn)}/day is right on track!`,
                `Daily allowance: ${formatMoney(dailyAllowance)} across ${daysLeft} remaining days. At your current burn rate of ${formatMoney(dailyBurn)}/day, you're projected to finish under budget.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'piggy-filling',
        };
    }

    return {
        text: pick([
            `Heads up: at ${formatMoney(dailyBurn)}/day, you'll hit ${formatMoney(projectedTotal)} by month end — that's over the ${formatMoney(totalPlanned)} budget. Dial back to ${formatMoney(dailyAllowance)}/day to stay within limits.`,
            `Your daily burn is ${formatMoney(dailyBurn)} but you need to average ${formatMoney(dailyAllowance)}/day over the next ${daysLeft} days to stay on budget. Time to tighten up!`,
        ]),
        type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Budget Suggest (NEW) ────────────────────────────────────────────────────
// AI suggestion explainer
function suggestInsight(data) {
    const { categories, totalPlanned, totalActual, expenseBreakdown } = data;
    const hasBudgets = (categories || []).some(c => (c.planned || c.budget || 0) > 0);
    const breakdownItems = expenseBreakdown || [];

    if (!hasBudgets && breakdownItems.length === 0) {
        return {
            text: pick([
                "Auto-suggest analyzes your past spending to generate realistic budget limits. Import some transactions first and I'll have recommendations ready for you!",
                "I need spending history to make smart suggestions. Once you've imported a few months of transactions, Auto-suggest will create a budget tailored to your habits.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'crystal-ball',
        };
    }

    if (!hasBudgets && breakdownItems.length > 0) {
        const topSpend = [...breakdownItems].sort((a, b) => (b.amount || b.spent || 0) - (a.amount || a.spent || 0));
        const topName = topSpend[0]?.category || topSpend[0]?.name || 'Unknown';
        const topAmt = topSpend[0]?.amount || topSpend[0]?.spent || 0;
        return {
            text: pick([
                `I can see you spend the most on "${topName}" at ${formatMoney(topAmt)}. Hit Auto-suggest and I'll create limits for all ${breakdownItems.length} categories based on your actual patterns — with a small buffer built in.`,
                `With ${breakdownItems.length} spending categories and no budgets yet, Auto-suggest is your fastest path to a complete plan. I'll base it on real data, not guesses.`,
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }

    // Already has budgets — explain how suggestion compares
    const budgetedCats = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);
    const overBudgetCount = budgetedCats.filter(c => (c.spent || c.actual || 0) > (c.planned || c.budget || 0)).length;
    const totalCats = categories?.length || 0;
    const coveragePct = totalCats > 0 ? Math.round(budgetedCats.length / totalCats * 100) : 0;

    if (overBudgetCount > 2) {
        return {
            text: pick([
                `${overBudgetCount} categories are over budget — that suggests the limits might be too aggressive. Run Auto-suggest to recalibrate based on your actual spending patterns. It'll propose realistic numbers you can actually stick to.`,
                `Multiple overruns hint that your budget needs adjusting. Auto-suggest recalculates from real data and builds in a comfort margin so your plan matches reality.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'crystal-ball',
        };
    }

    if (coveragePct < 80) {
        return {
            text: pick([
                `You've budgeted ${coveragePct}% of your categories. Auto-suggest can fill in the remaining gaps using your spending history so nothing slips through the cracks.`,
                `${budgetedCats.length} of ${totalCats} categories have limits. Use Auto-suggest to complete your budget plan — it only takes a click.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'crystal-ball',
        };
    }

    return {
        text: pick([
            "Your budget is already solid! Run Auto-suggest periodically to check if your limits still match evolving spending habits. Patterns change over time.",
            "Even with good coverage, Auto-suggest can spot drift. It compares your current limits to recent trends and flags where adjustments might help.",
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'crystal-ball',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'budget-header': headerInsight,
    'budget-editor': editorInsight,
    'budget-progress': progressInsight,
    'budget-chart': chartInsight,
    'budget-stats': statsInsight,
    'budget-suggest': suggestInsight,
};

export function generateBudgetInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}
