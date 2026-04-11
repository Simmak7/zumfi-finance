// Dashboard Zone Insight Generator for Zumi Proximity Interactions
// Enhanced with data intelligence: trends, predictions, anomaly detection, and environmental effects.

import {
    analyzeTrend, compareToPrevMonth, predictNextMonth, detectAnomaly,
    spendingPace, biggestCategoryMover, projectToYearEnd, avgSavingsRate,
    pick, formatMoney,
} from './dataIntelligence';
import { tr } from './lang';

// ── Dashboard Header ─────────────────────────────────────────────────────────
function headerInsight(data) {
    const { totalIncome, totalExpenses, monthlyHistory, selectedMonth } = data;

    if (!totalIncome && !totalExpenses) {
        return {
            text: pick([
                tr(
                    "Welcome to your dashboard! Upload a bank statement to get started.",
                    "Vítej v přehledu! Nahraj bankovní výpis a můžeme začít.",
                ),
                tr(
                    "This is your financial command center. Let's fill it with data!",
                    "Tohle je tvé finanční velitelství. Pojďme ho naplnit daty!",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const net = totalIncome - totalExpenses;
    const history = monthlyHistory || [];

    if (history.length >= 3) {
        const netValues = history.slice(-3).map(m => (m.total_income || 0) - (m.total_expenses || 0));
        const trend = analyzeTrend(netValues);

        if (trend.direction === 'rising' && trend.consecutive >= 2) {
            return {
                text: tr(
                    `Net surplus has been rising for ${trend.consecutive} months! Currently ${formatMoney(net)} Kč in the green. Your trajectory is excellent.`,
                    `Čistý přebytek roste už ${trend.consecutive} ${trend.consecutive === 1 ? 'měsíc' : trend.consecutive < 5 ? 'měsíce' : 'měsíců'}! Aktuálně jsi v plusu o ${formatMoney(net)} Kč. Tvá trajektorie je výborná.`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
                envEffect: 'golden-sparkles',
            };
        }
        if (trend.direction === 'falling' && trend.consecutive >= 2) {
            return {
                text: tr(
                    `Your monthly surplus has been shrinking for ${trend.consecutive} months. This month: ${formatMoney(net)} Kč. Let's look at what's driving it.`,
                    `Tvůj měsíční přebytek klesá už ${trend.consecutive} ${trend.consecutive === 1 ? 'měsíc' : trend.consecutive < 5 ? 'měsíce' : 'měsíců'}. Tento měsíc: ${formatMoney(net)} Kč. Podívejme se, co za tím stojí.`,
                ),
                type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
                envEffect: 'rain-cloud',
            };
        }
    }

    if (net > 0) {
        const pace = spendingPace(totalExpenses, totalIncome, selectedMonth);
        return {
            text: tr(
                `${formatMoney(net)} Kč net positive this month! ${pace.daysLeft > 0 ? `With ${pace.daysLeft} days left, you can spend ~${formatMoney(pace.dailyAllowance)} Kč/day.` : 'Month is closing strong!'}`,
                `Čistý plus ${formatMoney(net)} Kč tento měsíc! ${pace.daysLeft > 0 ? `Zbývá ${pace.daysLeft} ${pace.daysLeft === 1 ? 'den' : pace.daysLeft < 5 ? 'dny' : 'dní'}, můžeš utratit ~${formatMoney(pace.dailyAllowance)} Kč/den.` : 'Měsíc končí silně!'}`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'floating-bubbles',
        };
    }

    return {
        text: tr(
            `${formatMoney(Math.abs(net))} Kč in the red this month. Drag me to the category chart to find where the money is going.`,
            `Tento měsíc jsi v minusu o ${formatMoney(Math.abs(net))} Kč. Přetáhni mě na graf kategorií a zjistíš, kam peníze tečou.`,
        ),
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
            text: tr(
                "No income recorded yet this month. Import a statement to see it!",
                "Tento měsíc zatím žádný příjem. Naimportuj výpis a uvidíš ho!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (history.length >= 3) {
        const incomeValues = history.map(m => m.total_income || 0);
        const trend = analyzeTrend(incomeValues);
        const comp = compareToPrevMonth(totalIncome, history, 'total_income');

        if (trend.direction === 'rising' && trend.consecutive >= 3) {
            return {
                text: tr(
                    `Income has been rising for ${trend.consecutive} months straight! ${formatMoney(totalIncome)} Kč this month — up ${comp.changePercent.toFixed(0)}% from last month. If this keeps up, you're in a strong position.`,
                    `Příjem roste už ${trend.consecutive} ${trend.consecutive === 1 ? 'měsíc' : trend.consecutive < 5 ? 'měsíce' : 'měsíců'} v řadě! Tento měsíc ${formatMoney(totalIncome)} Kč — o ${comp.changePercent.toFixed(0)}% víc než minule. Pokud to takhle půjde dál, máš silnou pozici.`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'floating-bills',
            };
        }

        if (comp.direction === 'up' && comp.changePercent > 10) {
            return {
                text: tr(
                    `Income up ${comp.changePercent.toFixed(0)}% to ${formatMoney(totalIncome)} Kč! That's ${formatMoney(comp.change)} Kč more than last month.`,
                    `Příjem nahoru o ${comp.changePercent.toFixed(0)}% na ${formatMoney(totalIncome)} Kč! To je o ${formatMoney(comp.change)} Kč víc než minule.`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'floating-bills',
            };
        }
        if (comp.direction === 'down' && comp.changePercent < -10) {
            return {
                text: tr(
                    `Income dropped ${Math.abs(comp.changePercent).toFixed(0)}% to ${formatMoney(totalIncome)} Kč. Your 3-month average is ${formatMoney(Math.round(incomeValues.slice(-3).reduce((s, v) => s + v, 0) / 3))} Kč — this month is below average.`,
                    `Příjem klesl o ${Math.abs(comp.changePercent).toFixed(0)}% na ${formatMoney(totalIncome)} Kč. Tříměsíční průměr je ${formatMoney(Math.round(incomeValues.slice(-3).reduce((s, v) => s + v, 0) / 3))} Kč — tento měsíc jsi pod průměrem.`,
                ),
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'thought-clouds',
            };
        }
    }

    return {
        text: pick([
            tr(
                `${formatMoney(totalIncome)} Kč earned this month. Every koruna counts!`,
                `Tento měsíc vyděláno ${formatMoney(totalIncome)} Kč. Každá koruna se počítá!`,
            ),
            tr(
                `Total income: ${formatMoney(totalIncome)} Kč. Let's make it work hard for you.`,
                `Celkový příjem: ${formatMoney(totalIncome)} Kč. Pojďme ho donutit pracovat pro tebe.`,
            ),
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
            text: tr(
                "No expenses recorded yet. Import your statement to start tracking!",
                "Zatím žádné výdaje. Naimportuj výpis a začni sledovat!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (history.length >= 2 && expenseBreakdown) {
        const comp = compareToPrevMonth(totalExpenses, history, 'total_expenses');

        if (comp.direction === 'up' && comp.changePercent > 15) {
            const breakdown = expenseBreakdown || [];
            const sorted = [...breakdown].sort((a, b) => (b.amount || 0) - (a.amount || 0));
            const topCat = sorted[0];

            return {
                text: tr(
                    `Spending up ${comp.changePercent.toFixed(0)}% to ${formatMoney(totalExpenses)} Kč! ${topCat ? `${topCat.category} leads at ${formatMoney(topCat.amount)} Kč.` : ''} Consider reviewing your top categories.`,
                    `Útraty nahoru o ${comp.changePercent.toFixed(0)}% na ${formatMoney(totalExpenses)} Kč! ${topCat ? `Vede ${topCat.category} s ${formatMoney(topCat.amount)} Kč.` : ''} Zvaž projít si největší kategorie.`,
                ),
                type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
                envEffect: 'coins-to-drain',
            };
        }

        if (comp.direction === 'down' && comp.changePercent < -10) {
            return {
                text: tr(
                    `Great discipline! Spending down ${Math.abs(comp.changePercent).toFixed(0)}% to ${formatMoney(totalExpenses)} Kč. You saved ${formatMoney(Math.abs(comp.change))} Kč compared to last month.`,
                    `Skvělá disciplína! Útraty dolů o ${Math.abs(comp.changePercent).toFixed(0)}% na ${formatMoney(totalExpenses)} Kč. Oproti minulému měsíci jsi ušetřil/a ${formatMoney(Math.abs(comp.change))} Kč.`,
                ),
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
                envEffect: 'raining-coins',
            };
        }
    }

    if (totalIncome > 0 && totalExpenses > totalIncome) {
        return {
            text: tr(
                `Spending (${formatMoney(totalExpenses)} Kč) exceeds income by ${formatMoney(totalExpenses - totalIncome)} Kč. Let's find where to cut.`,
                `Útraty (${formatMoney(totalExpenses)} Kč) přesahují příjem o ${formatMoney(totalExpenses - totalIncome)} Kč. Pojďme najít, kde seškrtat.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'coins-to-drain',
        };
    }

    return {
        text: pick([
            tr(
                `${formatMoney(totalExpenses)} Kč spent this month. Drag me to categories for the breakdown!`,
                `Tento měsíc utraceno ${formatMoney(totalExpenses)} Kč. Přetáhni mě na kategorie a uvidíš rozpis!`,
            ),
            tr(
                `Total spending: ${formatMoney(totalExpenses)} Kč. Every purchase tells a story.`,
                `Celkové útraty: ${formatMoney(totalExpenses)} Kč. Každý nákup má svůj příběh.`,
            ),
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
            text: tr(
                "No income data yet — savings rate can't be calculated. Import statements!",
                "Zatím žádná data o příjmu — míru úspor nelze spočítat. Naimportuj výpisy!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const monthlySavings = totalIncome - totalExpenses;
    const yearEnd = projectToYearEnd(monthlySavings, selectedMonth);
    const avg3m = avgSavingsRate(history);

    if (savingsRate >= 30) {
        return {
            text: tr(
                `${savingsRate.toFixed(0)}% savings rate — incredible! At this pace, you'll save ~${formatMoney(yearEnd.yearEndTotal)} Kč by year-end. Your 3-month average is ${avg3m.toFixed(0)}%.`,
                `${savingsRate.toFixed(0)}% míra úspor — neuvěřitelné! V tomto tempu ušetříš do konce roku ~${formatMoney(yearEnd.yearEndTotal)} Kč. Tříměsíční průměr je ${avg3m.toFixed(0)}%.`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'hearts',
        };
    }
    if (savingsRate >= 20) {
        return {
            text: tr(
                `${savingsRate.toFixed(0)}% savings rate — textbook excellent! The golden rule is 20% and you're right there. 3-month average: ${avg3m.toFixed(0)}%.`,
                `${savingsRate.toFixed(0)}% míra úspor — učebnicová výborná! Zlaté pravidlo je 20% a ty jsi přesně tam. Tříměsíční průměr: ${avg3m.toFixed(0)}%.`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'piggy-filling',
        };
    }
    if (savingsRate >= 10) {
        return {
            text: tr(
                `${savingsRate.toFixed(0)}% saved — solid foundation. Pushing to 20% would mean saving an extra ${formatMoney(Math.round(totalIncome * 0.2 - monthlySavings))} Kč/month.`,
                `${savingsRate.toFixed(0)}% ušetřeno — pevný základ. Posunout se na 20% by znamenalo ušetřit navíc ${formatMoney(Math.round(totalIncome * 0.2 - monthlySavings))} Kč/měsíc.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'piggy-filling',
        };
    }
    if (savingsRate >= 0) {
        return {
            text: tr(
                `${savingsRate.toFixed(0)}% savings rate — barely breaking even. Can we find easy wins? Even 5% more would be ${formatMoney(Math.round(totalIncome * 0.05))} Kč/month.`,
                `${savingsRate.toFixed(0)}% míra úspor — tak tak vyrovnané. Nenašli bychom snadné vítězství? I 5% navíc by dělalo ${formatMoney(Math.round(totalIncome * 0.05))} Kč/měsíc.`,
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const deficit = totalExpenses - totalIncome;
    return {
        text: tr(
            `Negative savings — spending exceeds income by ${formatMoney(deficit)} Kč. This can't continue long-term. Let's find areas to trim!`,
            `Záporné úspory — útraty přesahují příjem o ${formatMoney(deficit)} Kč. To dlouhodobě nejde. Pojďme najít, kde seškrtat!`,
        ),
        type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        envEffect: 'wilting-plant',
    };
}

// ── KPI: Remaining Budget ────────────────────────────────────────────────────
function kpiBudgetInsight(data) {
    const { remainingBudget, totalIncome, totalExpenses, selectedMonth } = data;

    if (remainingBudget < 0) {
        return {
            text: tr(
                `Budget exceeded by ${formatMoney(Math.abs(remainingBudget))} Kč! Careful with remaining purchases.`,
                `Rozpočet překročen o ${formatMoney(Math.abs(remainingBudget))} Kč! Buď opatrný/á s dalšími nákupy.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    const pace = spendingPace(totalExpenses, totalIncome, selectedMonth);

    if (totalIncome > 0 && remainingBudget > totalIncome * 0.4) {
        return {
            text: tr(
                `${formatMoney(remainingBudget)} Kč left — huge buffer! With ${pace.daysLeft} days remaining, that's ${formatMoney(pace.dailyAllowance)} Kč/day. Consider allocating surplus to goals!`,
                `Zbývá ${formatMoney(remainingBudget)} Kč — velká rezerva! Při ${pace.daysLeft} ${pace.daysLeft === 1 ? 'zbývajícím dni' : pace.daysLeft < 5 ? 'zbývajících dnech' : 'zbývajících dnech'} to dělá ${formatMoney(pace.dailyAllowance)} Kč/den. Zvaž přesun přebytku do cílů!`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'stars-medals',
        };
    }

    if (remainingBudget > 0 && pace.daysLeft > 0) {
        return {
            text: tr(
                `${formatMoney(remainingBudget)} Kč remaining with ${pace.daysLeft} days to go. That's about ${formatMoney(pace.dailyAllowance)} Kč per day.`,
                `Zbývá ${formatMoney(remainingBudget)} Kč a ${pace.daysLeft} ${pace.daysLeft === 1 ? 'den' : pace.daysLeft < 5 ? 'dny' : 'dní'}. To je zhruba ${formatMoney(pace.dailyAllowance)} Kč na den.`,
            ),
            type: pace.dailyAllowance > 0 ? 'positive' : 'warning',
            expression: pace.dailyAllowance > 0 ? 'happy' : 'concerned',
            mouth: pace.dailyAllowance > 0 ? 'smile' : 'neutral',
            animation: 'idle',
            envEffect: pace.dailyAllowance > 500 ? 'stars-medals' : 'thought-clouds',
        };
    }

    return {
        text: tr(
            `Budget is exactly zero. Every koruna from here is over budget!`,
            `Rozpočet je přesně nula. Každá další koruna je už přes rozpočet!`,
        ),
        type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        envEffect: 'exclamation-marks',
    };
}

// ── Income vs Expenses Chart ─────────────────────────────────────────────────
function incomeChartInsight(data) {
    const history = data.monthlyHistory || [];

    if (history.length < 2) {
        return {
            text: tr(
                "Need more months of data to spot trends. Keep importing!",
                "Potřebuji víc měsíců dat, abych viděl trendy. Pokračuj v importu!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const incomeValues = history.map(m => m.total_income || 0);
    const expenseValues = history.map(m => m.total_expenses || 0);
    const incomeTrend = analyzeTrend(incomeValues);
    const expenseTrend = analyzeTrend(expenseValues);

    if (expenseTrend.direction === 'falling' && expenseTrend.consecutive >= 2) {
        return {
            text: tr(
                `Spending has been falling for ${expenseTrend.consecutive} consecutive months (down ${Math.abs(expenseTrend.changePercent).toFixed(0)}% overall). Great trajectory! ${incomeTrend.direction === 'rising' ? 'Income is also rising — your gap is widening beautifully.' : ''}`,
                `Útraty klesají už ${expenseTrend.consecutive} ${expenseTrend.consecutive === 1 ? 'měsíc' : expenseTrend.consecutive < 5 ? 'měsíce' : 'měsíců'} v řadě (celkem dolů o ${Math.abs(expenseTrend.changePercent).toFixed(0)}%). Skvělá trajektorie! ${incomeTrend.direction === 'rising' ? 'Příjem taky roste — tvá mezera se krásně rozšiřuje.' : ''}`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'rising-arrow',
        };
    }

    if (expenseTrend.direction === 'rising' && expenseTrend.consecutive >= 2) {
        return {
            text: tr(
                `Expenses have climbed for ${expenseTrend.consecutive} months (up ${expenseTrend.changePercent.toFixed(0)}%). ${incomeTrend.direction === 'rising' ? 'Income is rising too, but spending is growing faster.' : 'With income flat, this narrows your margin.'} Watch the trend!`,
                `Výdaje rostou už ${expenseTrend.consecutive} ${expenseTrend.consecutive === 1 ? 'měsíc' : expenseTrend.consecutive < 5 ? 'měsíce' : 'měsíců'} (nahoru o ${expenseTrend.changePercent.toFixed(0)}%). ${incomeTrend.direction === 'rising' ? 'Příjem taky roste, ale útraty rostou rychleji.' : 'Při plochém příjmu to zúžuje tvou rezervu.'} Sleduj trend!`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    const allPositive = history.every(m => (m.total_income || 0) >= (m.total_expenses || 0));
    if (allPositive && history.length >= 3) {
        return {
            text: tr(
                `Income above expenses for all ${history.length} months of data. Consistently in the green — beautiful chart!`,
                `Příjem nad výdaji ve všech ${history.length} měsících dat. Trvale v plusu — nádherný graf!`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'diamond-sparkles',
        };
    }

    if (incomeTrend.strength === 'weak' && history.length >= 4) {
        return {
            text: tr(
                `Your income has been remarkably stable over ${history.length} months (only ${Math.abs(incomeTrend.changePercent).toFixed(0)}% variation). Predictable income makes budgeting easier!`,
                `Tvůj příjem je pozoruhodně stabilní po ${history.length} měsíců (pouze ${Math.abs(incomeTrend.changePercent).toFixed(0)}% rozptyl). Předvídatelný příjem usnadňuje rozpočtování!`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    return {
        text: pick([
            tr(
                `Tracking ${history.length} months of income vs expenses. This chart tells your financial story!`,
                `Sleduji ${history.length} měsíců příjmů vs. výdajů. Tento graf vypráví tvůj finanční příběh!`,
            ),
            tr(
                "Every month of data makes my trend analysis more accurate.",
                "Každý měsíc dat dělá mou analýzu trendů přesnější.",
            ),
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
            text: tr(
                "No expense categories yet. Import a statement to see your breakdown!",
                "Zatím žádné kategorie výdajů. Naimportuj výpis a uvidíš rozpis!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const total = breakdown.reduce((s, c) => s + (c.amount || 0), 0);
    const sorted = [...breakdown].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    const topPct = total > 0 ? ((sorted[0].amount || 0) / total * 100) : 0;

    if (topPct > 50) {
        return {
            text: tr(
                `${sorted[0].category} dominates at ${topPct.toFixed(0)}% of all spending (${formatMoney(sorted[0].amount)} Kč). That's your biggest lever for savings — even a 10% reduction saves ${formatMoney(Math.round(sorted[0].amount * 0.1))} Kč.`,
                `${sorted[0].category} dominuje s ${topPct.toFixed(0)}% všech útrat (${formatMoney(sorted[0].amount)} Kč). To je tvá největší páka na úspory — i 10% snížení ušetří ${formatMoney(Math.round(sorted[0].amount * 0.1))} Kč.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    if (breakdown.length >= 6 && topPct < 35) {
        return {
            text: tr(
                `Nicely diversified across ${breakdown.length} categories — no single one exceeds ${topPct.toFixed(0)}%. Well-balanced spending pattern!`,
                `Hezky diverzifikováno napříč ${breakdown.length} kategoriemi — žádná nepřesahuje ${topPct.toFixed(0)}%. Vyvážený vzorec útrat!`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'swirl-burst',
        };
    }

    if (sorted.length >= 2) {
        const top2Pct = ((sorted[0].amount || 0) + (sorted[1].amount || 0)) / total * 100;
        if (top2Pct > 70) {
            return {
                text: tr(
                    `${sorted[0].category} and ${sorted[1].category} together make up ${top2Pct.toFixed(0)}% of spending. Small changes in these two categories have the biggest impact.`,
                    `${sorted[0].category} a ${sorted[1].category} dohromady tvoří ${top2Pct.toFixed(0)}% útrat. Drobné změny v těchto dvou kategoriích mají největší dopad.`,
                ),
                type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
                envEffect: 'magnifying-glass',
            };
        }
    }

    return {
        text: tr(
            `Top expense: ${sorted[0].category} at ${formatMoney(sorted[0].amount)} Kč (${topPct.toFixed(0)}%). ${sorted.length > 3 ? `Followed by ${sorted[1].category} and ${sorted[2].category}.` : ''}`,
            `Hlavní výdaj: ${sorted[0].category} za ${formatMoney(sorted[0].amount)} Kč (${topPct.toFixed(0)}%). ${sorted.length > 3 ? `Následuje ${sorted[1].category} a ${sorted[2].category}.` : ''}`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Top Categories Bar Chart ─────────────────────────────────────────────────
function topCategoriesInsight(data) {
    const cats = data.topCategories || [];
    if (cats.length === 0) {
        return {
            text: tr(
                "No categories yet. Import statements and I'll analyze your spending!",
                "Zatím žádné kategorie. Naimportuj výpisy a já zanalyzuji tvé útraty!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const sorted = [...cats].sort((a, b) => (b.amount || 0) - (a.amount || 0));

    if (sorted.length >= 2 && sorted[0].amount > sorted[1].amount * 2) {
        const saveable = Math.round(sorted[0].amount * 0.15);
        return {
            text: tr(
                `${sorted[0].category} at ${formatMoney(sorted[0].amount)} Kč is more than double the next category. Reducing it by just 15% would save ${formatMoney(saveable)} Kč.`,
                `${sorted[0].category} za ${formatMoney(sorted[0].amount)} Kč je víc než dvojnásobek další kategorie. Snížení jen o 15% by ušetřilo ${formatMoney(saveable)} Kč.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'movie-clap',
        };
    }

    if (sorted.length >= 3) {
        const ratio = sorted[2].amount / sorted[0].amount;
        if (ratio > 0.8) {
            return {
                text: tr(
                    `Top 3 categories are neck and neck: ${sorted[0].category}, ${sorted[1].category}, ${sorted[2].category}. Balanced spending — no single outlier!`,
                    `Top 3 kategorie jsou nos na nose: ${sorted[0].category}, ${sorted[1].category}, ${sorted[2].category}. Vyvážené útraty — žádný jasný vítěz!`,
                ),
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
                envEffect: 'light-bulb',
            };
        }
    }

    return {
        text: tr(
            `#1 expense: ${sorted[0].category} at ${formatMoney(sorted[0].amount)} Kč. Small changes in your top categories have the biggest impact on savings.`,
            `#1 výdaj: ${sorted[0].category} za ${formatMoney(sorted[0].amount)} Kč. Drobné změny v hlavních kategoriích mají největší dopad na úspory.`,
        ),
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
            text: tr(
                "Not enough history to forecast spending yet. Keep tracking!",
                "Zatím nemám dost historie, abych předpověděl útraty. Pokračuj ve sledování!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const pct = (current / predicted * 100);
    const pace = spendingPace(current, predicted, selectedMonth);

    if (current > predicted) {
        return {
            text: tr(
                `Already past the ${formatMoney(predicted)} Kč forecast at ${formatMoney(current)} Kč (${pct.toFixed(0)}%)! With ${pace.daysLeft} days left, every purchase adds to the overshoot.`,
                `Už jsi přes předpověď ${formatMoney(predicted)} Kč na ${formatMoney(current)} Kč (${pct.toFixed(0)}%)! Zbývá ${pace.daysLeft} ${pace.daysLeft === 1 ? 'den' : pace.daysLeft < 5 ? 'dny' : 'dní'} a každý nákup se přičítá k přestřelu.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'umbrella-open',
        };
    }

    if (pct > 85) {
        return {
            text: tr(
                `At ${pct.toFixed(0)}% of the ${formatMoney(predicted)} Kč forecast with ${pace.daysLeft} days left. Current burn rate: ${formatMoney(pace.dailyBurnRate)} Kč/day. Projected total: ${formatMoney(pace.projectedTotal)} Kč.`,
                `Na ${pct.toFixed(0)}% předpovědi ${formatMoney(predicted)} Kč a zbývá ${pace.daysLeft} ${pace.daysLeft === 1 ? 'den' : pace.daysLeft < 5 ? 'dny' : 'dní'}. Aktuální tempo: ${formatMoney(pace.dailyBurnRate)} Kč/den. Projekce: ${formatMoney(pace.projectedTotal)} Kč.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    if (pct < 50) {
        return {
            text: tr(
                `Only ${pct.toFixed(0)}% of the forecast used. ${formatMoney(predicted - current)} Kč of breathing room! At this pace, you'll finish well under forecast.`,
                `Využito jen ${pct.toFixed(0)}% předpovědi. ${formatMoney(predicted - current)} Kč rezervy! V tomto tempu skončíš hluboko pod předpovědí.`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'telescope',
        };
    }

    return {
        text: tr(
            `${pct.toFixed(0)}% of the ${formatMoney(predicted)} Kč forecast used. Daily burn rate: ${formatMoney(pace.dailyBurnRate)} Kč. ${pace.onTrack ? 'On track!' : 'Slightly above pace — watch the spending.'}`,
            `${pct.toFixed(0)}% předpovědi ${formatMoney(predicted)} Kč využito. Denní tempo: ${formatMoney(pace.dailyBurnRate)} Kč. ${pace.onTrack ? 'V kurzu!' : 'Mírně nad tempem — hlídej útraty.'}`,
        ),
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
                tr(
                    "Clean month! No unusual spending detected. Your spending is consistent and predictable.",
                    "Čistý měsíc! Žádné neobvyklé útraty. Tvé útraty jsou konzistentní a předvídatelné.",
                ),
                tr(
                    "All clear — no anomalies. Smooth sailing!",
                    "Vše v pořádku — žádné anomálie. Klidná plavba!",
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'checkmarks-float',
        };
    }

    const severe = anomalies.find(a => a.severity >= 60);
    if (severe) {
        const avgCheckEn = history.length >= 3
            ? ` Your 3-month average for this area suggests this is ${severe.severity > 70 ? 'highly' : 'moderately'} unusual.`
            : '';
        const avgCheckCs = history.length >= 3
            ? ` Tvůj tříměsíční průměr v této oblasti naznačuje, že jde o ${severe.severity > 70 ? 'velmi' : 'středně'} neobvyklou situaci.`
            : '';

        return {
            text: tr(
                `Severe anomaly detected: ${severe.description}.${avgCheckEn} Worth investigating!`,
                `Zjištěna závažná anomálie: ${severe.description}.${avgCheckCs} Stojí za to prozkoumat!`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    if (anomalies.length >= 3) {
        return {
            text: tr(
                `${anomalies.length} unusual patterns this month — more than typical. Most are mild, but collectively they may signal a shift in your spending habits.`,
                `${anomalies.length} neobvyklých vzorců tento měsíc — víc než obvykle. Většinou jde o drobnosti, ale společně můžou naznačovat posun v tvých návycích.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: tr(
            `${anomalies.length} mild anomal${anomalies.length === 1 ? 'y' : 'ies'}: ${anomalies[0].description}. Probably nothing serious, but good to be aware.`,
            `${anomalies.length} ${anomalies.length === 1 ? 'drobná anomálie' : anomalies.length < 5 ? 'drobné anomálie' : 'drobných anomálií'}: ${anomalies[0].description}. Pravděpodobně nic vážného, ale je dobré o tom vědět.`,
        ),
        type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Close Month Button ───────────────────────────────────────────────────────
function closeMonthInsight(data) {
    const { hasData, monthClosed, totalIncome, totalExpenses, savingsRate, anomalies } = data;

    if (!hasData) {
        return {
            text: tr(
                "Upload a statement first — I'll walk you through closing the month once there's data!",
                "Nejdřív nahraj výpis — jakmile budou data, provedu tě zavřením měsíce!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (monthClosed) {
        return {
            text: tr(
                `Month already closed ✓ — click to review the summary. Savings rate this month was ${(savingsRate || 0).toFixed(0)}%.`,
                `Měsíc už uzavřen ✓ — klikni a projdi souhrn. Míra úspor tento měsíc byla ${(savingsRate || 0).toFixed(0)}%.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'checkmarks-float',
        };
    }

    const net = (totalIncome || 0) - (totalExpenses || 0);
    const anomalyCount = (anomalies || []).length;

    if (anomalyCount > 0) {
        return {
            text: tr(
                `Ready to close the month? I found ${anomalyCount} anomal${anomalyCount === 1 ? 'y' : 'ies'} worth reviewing first — the wizard will walk you through them.`,
                `Připraven/a zavřít měsíc? Našel jsem ${anomalyCount} ${anomalyCount === 1 ? 'anomálii' : anomalyCount < 5 ? 'anomálie' : 'anomálií'}, které stojí za zkontrolování — průvodce tě jimi provede.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'wave',
            envEffect: 'exclamation-marks',
        };
    }

    if (net > 0) {
        return {
            text: tr(
                `Ready to close the month strong! Net surplus of ${formatMoney(net)} Kč. The wizard will help you review and allocate it.`,
                `Připraven/a zavřít měsíc silně! Čistý přebytek ${formatMoney(net)} Kč. Průvodce ti pomůže ho zkontrolovat a rozdělit.`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'checkmarks-float',
        };
    }

    return {
        text: tr(
            "Time to wrap up the month. I'll help you review transactions, bills, and next steps.",
            "Čas zabalit měsíc. Pomůžu ti projít transakce, platby a další kroky.",
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'thought-clouds',
    };
}

// ── Allocate Savings Button ──────────────────────────────────────────────────
function allocateSavingsInsight(data) {
    const { remainingBudget, alreadyAllocated, goals, totalIncome } = data;
    const fullyAllocated = (alreadyAllocated || 0) >= (remainingBudget || 0);
    const goalCount = (goals || []).length;
    const unmetGoals = (goals || []).filter(g =>
        g && g.target_amount > (g.current_amount || 0)
    );

    if ((remainingBudget || 0) <= 0) {
        return {
            text: tr(
                "No surplus to allocate this month — focus on trimming expenses first!",
                "Tento měsíc není přebytek k rozdělení — nejdřív se soustřeď na snížení výdajů!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    if (fullyAllocated) {
        return {
            text: tr(
                `All ${formatMoney(remainingBudget)} Kč already allocated! Click to see where it went.`,
                `Všech ${formatMoney(remainingBudget)} Kč už rozděleno! Klikni a uvidíš, kam to šlo.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'piggy-filling',
        };
    }

    if (goalCount === 0) {
        return {
            text: tr(
                `${formatMoney(remainingBudget)} Kč waiting to be allocated — but you don't have any savings goals yet. Drag me to the savings area to set one up!`,
                `${formatMoney(remainingBudget)} Kč čeká na rozdělení — ale zatím nemáš žádné spořicí cíle. Přetáhni mě na sekci úspor a nastav si jeden!`,
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (unmetGoals.length > 0) {
        const topGoal = unmetGoals[0];
        const remaining = (topGoal.target_amount || 0) - (topGoal.current_amount || 0);
        return {
            text: tr(
                `${formatMoney(remainingBudget)} Kč surplus ready! "${topGoal.name || 'your top goal'}" still needs ${formatMoney(remaining)} Kč. Click to distribute!`,
                `${formatMoney(remainingBudget)} Kč přebytek připraven! „${topGoal.name || 'tvůj hlavní cíl'}“ ještě potřebuje ${formatMoney(remaining)} Kč. Klikni a rozděl!`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'raining-coins',
        };
    }

    const ratio = totalIncome > 0 ? (remainingBudget / totalIncome * 100) : 0;
    return {
        text: tr(
            `${formatMoney(remainingBudget)} Kč (${ratio.toFixed(0)}% of income) to distribute. Let's move it into your goals!`,
            `${formatMoney(remainingBudget)} Kč (${ratio.toFixed(0)}% příjmu) k rozdělení. Pojďme je přesunout do tvých cílů!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
        envEffect: 'piggy-filling',
    };
}

// ── Month Picker ─────────────────────────────────────────────────────────────
function monthPickerInsight(data) {
    const { monthlyHistory, selectedMonth } = data;
    const history = monthlyHistory || [];

    if (history.length === 0) {
        return {
            text: tr(
                "Hop between months to explore your data once you've imported statements!",
                "Přepínej mezi měsíci a prozkoumej svá data — až naimportuješ výpisy!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (history.length >= 2) {
        const last = history[history.length - 1] || {};
        const prev = history[history.length - 2] || {};
        const lastNet = (last.total_income || 0) - (last.total_expenses || 0);
        const prevNet = (prev.total_income || 0) - (prev.total_expenses || 0);
        const trend = lastNet > prevNet ? 'up' : 'down';
        return {
            text: tr(
                `Tracking ${history.length} months of data. Net surplus is trending ${trend === 'up' ? 'upward 📈' : 'downward 📉'}. Pick any month to dig in!`,
                `Sleduji ${history.length} ${history.length === 1 ? 'měsíc' : history.length < 5 ? 'měsíce' : 'měsíců'} dat. Čistý přebytek má trend ${trend === 'up' ? 'nahoru 📈' : 'dolů 📉'}. Vyber libovolný měsíc a prozkoumej ho!`,
            ),
            type: trend === 'up' ? 'positive' : 'neutral',
            expression: trend === 'up' ? 'happy' : 'neutral',
            mouth: trend === 'up' ? 'smile' : 'neutral',
            animation: 'wave',
            envEffect: trend === 'up' ? 'rising-arrow' : 'telescope',
        };
    }

    return {
        text: tr(
            `Currently viewing ${selectedMonth || 'this month'}. Use the picker to hop between months and compare!`,
            `Aktuálně prohlížíš ${selectedMonth || 'tento měsíc'}. Použij výběr a přepínej mezi měsíci pro srovnání!`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'telescope',
    };
}

// ── Welcome Card (onboarding, empty state only) ──────────────────────────────
function welcomeCardInsight(data) {
    return {
        text: pick([
            tr(
                "Welcome to Zumfi! Follow the 3 onboarding steps and I'll help you every hop of the way. Start with uploading a bank statement!",
                "Vítej v Zumfi! Projdi 3 úvodní kroky a já tě provedu každým skokem. Začni nahráním bankovního výpisu!",
            ),
            tr(
                "Your financial journey starts here. Upload a statement, tag your categories, and I'll take care of the insights!",
                "Tvá finanční cesta začíná tady. Nahraj výpis, nastav si kategorie a postřehy nechej na mně!",
            ),
            tr(
                "New here? Let's make it click — upload a PDF bank statement and watch your dashboard come alive!",
                "Jsi tu nový/á? Pojďme to rozjet — nahraj PDF bankovní výpis a sleduj, jak tvůj přehled ožívá!",
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'wave',
        envEffect: 'golden-sparkles',
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
            text: tr(
                "My AI brain detected patterns, anomalies, and built predictions. Drag me to each section for deep analysis!",
                "Můj AI mozek objevil vzorce, anomálie i vytvořil predikce. Přetáhni mě na každou sekci pro hlubší analýzu!",
            ),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }
    if (hasForecast) {
        return {
            text: tr(
                `My forecast engine is running with ${(monthlyHistory || []).length} months of history. ${hasHistory ? 'The more data I have, the more accurate my predictions.' : 'Import more months for better accuracy!'}`,
                `Moje predikce běží s ${(monthlyHistory || []).length} ${(monthlyHistory || []).length === 1 ? 'měsícem' : (monthlyHistory || []).length < 5 ? 'měsíci' : 'měsíci'} historie. ${hasHistory ? 'Čím víc dat mám, tím přesnější jsou mé předpovědi.' : 'Naimportuj víc měsíců pro lepší přesnost!'}`,
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'crystal-ball',
        };
    }
    if (hasAnomalies) {
        return {
            text: tr(
                "I found unusual patterns below. Drag me there for details!",
                "Našel jsem dole neobvyklé vzorce. Přetáhni mě tam pro detaily!",
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }
    return {
        text: tr(
            "Smart insights need more data. Import a few months of statements and I'll spot patterns, predict spending, and flag anomalies!",
            "Chytré postřehy potřebují víc dat. Naimportuj pár měsíců výpisů a já uvidím vzorce, předpovím útraty a označím anomálie!",
        ),
        type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
        envEffect: 'question-marks',
    };
}

// ── Main Entry Point ─────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'header': headerInsight,
    'welcome-card': welcomeCardInsight,
    'close-month-btn': closeMonthInsight,
    'allocate-savings-btn': allocateSavingsInsight,
    'month-picker': monthPickerInsight,
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
 */
export function generateDashboardInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

// ── Page Summary (auto-triggered on navigation) ─────────────────────────────
export function dashboardPageSummary(data) {
    const { totalIncome, totalExpenses, savingsRate, remainingBudget, topCategories, monthlyHistory } = data;

    if (!totalIncome && !totalExpenses) {
        return {
            text: pick([
                tr(
                    "Your dashboard is empty — import a bank statement to see your finances come alive!",
                    "Tvůj přehled je prázdný — naimportuj bankovní výpis a uvidíš, jak tvé finance ožívají!",
                ),
                tr(
                    "No data yet! Upload a statement and I'll crunch the numbers for you.",
                    "Zatím žádná data! Nahraj výpis a já pro tebe čísla zpracuji.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
        };
    }

    const net = totalIncome - totalExpenses;
    const savPct = Math.round((savingsRate || 0) * 100);
    const topCat = topCategories?.[0]?.name || topCategories?.[0]?.category;
    const months = monthlyHistory?.months || monthlyHistory || [];
    const trend = months.length >= 3 ? analyzeTrend(months.map(m => m.total_expenses || m.expenses || 0)) : null;

    if (net < 0) {
        return {
            text: pick([
                tr(
                    `Spending exceeds income by ${formatMoney(Math.abs(net))} this month. ${topCat ? `"${topCat}" is the biggest category.` : ''} Let's find where to cut back!`,
                    `Útraty přesahují příjem o ${formatMoney(Math.abs(net))} tento měsíc. ${topCat ? `Největší kategorie je „${topCat}“.` : ''} Pojďme najít, kde seškrtat!`,
                ),
                tr(
                    `We're ${formatMoney(Math.abs(net))} in the red this month. ${trend?.direction === 'rising' ? 'Expenses have been climbing — time to act.' : 'Let me help find savings.'}`,
                    `Jsme tento měsíc v minusu o ${formatMoney(Math.abs(net))}. ${trend?.direction === 'rising' ? 'Útraty rostou — čas jednat.' : 'Pomůžu ti najít úspory.'}`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        };
    }

    if (savPct >= 30) {
        return {
            text: pick([
                tr(
                    `Amazing — ${savPct}% savings rate! You're keeping ${formatMoney(net)} this month. ${trend?.direction === 'falling' ? 'Expenses are trending down too!' : 'Keep it up!'}`,
                    `Úžasné — ${savPct}% míra úspor! Tento měsíc si necháš ${formatMoney(net)}. ${trend?.direction === 'falling' ? 'Útraty taky klesají!' : 'Pokračuj v tom!'}`,
                ),
                tr(
                    `${savPct}% saved with ${formatMoney(remainingBudget || net)} remaining in budget. ${topCat ? `"${topCat}" leads spending.` : ''} Impressive discipline!`,
                    `${savPct}% ušetřeno, v rozpočtu zbývá ${formatMoney(remainingBudget || net)}. ${topCat ? `Útratám vede „${topCat}“.` : ''} Působivá disciplína!`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
        };
    }

    return {
        text: pick([
            tr(
                `Income: ${formatMoney(totalIncome)}, spending: ${formatMoney(totalExpenses)} — ${savPct}% savings rate. ${topCat ? `Top category: "${topCat}".` : ''} ${remainingBudget > 0 ? `${formatMoney(remainingBudget)} budget left.` : ''}`,
                `Příjem: ${formatMoney(totalIncome)}, útraty: ${formatMoney(totalExpenses)} — ${savPct}% míra úspor. ${topCat ? `Hlavní kategorie: „${topCat}“.` : ''} ${remainingBudget > 0 ? `Zbývá ${formatMoney(remainingBudget)} rozpočtu.` : ''}`,
            ),
            tr(
                `Net surplus of ${formatMoney(net)} this month (${savPct}% saved). ${trend?.direction === 'rising' ? 'Heads up — expenses are trending upward.' : 'Looking stable!'}`,
                `Čistý přebytek ${formatMoney(net)} tento měsíc (${savPct}% ušetřeno). ${trend?.direction === 'rising' ? 'Pozor — útraty mají rostoucí trend.' : 'Vypadá to stabilně!'}`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
    };
}
