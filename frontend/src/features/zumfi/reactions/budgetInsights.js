// Budget Zone Insight Generator for Zumfi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';
import { tr } from './lang';

// ── Budget Header ───────────────────────────────────────────────────────────
function headerInsight(data) {
    const { categories, totalPlanned, totalActual, remaining, usagePct } = data;

    if (!categories || categories.length === 0) {
        return {
            text: pick([
                tr(
                    "No budgets set yet! Use Auto-suggest to get smart budget recommendations based on your spending history.",
                    "Zatím žádné rozpočty! Použij Auto-návrh — navrhnu ti chytré limity podle tvé historie útrat.",
                ),
                tr(
                    "Start planning your budget — set spending limits for each category and I'll track your progress.",
                    "Začni plánovat rozpočet — nastav limity pro každou kategorii a já budu sledovat tvůj postup.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'rain-cloud',
        };
    }

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
                tr(
                    `Under budget for ${streakMonths} months in a row! That consistency is building real financial resilience. Currently at ${pct.toFixed(0)}% usage this month.`,
                    `${streakMonths} měsíců v řadě pod rozpočtem! Taková disciplína buduje skutečnou finanční odolnost. Aktuálně ${pct.toFixed(0)}% využití tento měsíc.`,
                ),
                tr(
                    `${streakMonths}-month adherence streak and counting! You've spent ${formatMoney(totalActual)} of ${formatMoney(totalPlanned)} planned — discipline pays off.`,
                    `${streakMonths}měsíční série dodržování a roste dál! Utratil/a jsi ${formatMoney(totalActual)} z plánovaných ${formatMoney(totalPlanned)} — disciplína se vyplácí.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'trophy',
        };
    }

    if (pct > 100) {
        const overAmt = totalActual - totalPlanned;
        return {
            text: pick([
                tr(
                    `Overall budget exceeded by ${(pct - 100).toFixed(0)}%, that's ${formatMoney(overAmt)} over. Let's review which categories drove the overspend and find places to pull back.`,
                    `Celkový rozpočet překročen o ${(pct - 100).toFixed(0)}%, to je ${formatMoney(overAmt)} přes. Pojďme zjistit, které kategorie za to mohou, a najít, kde přibrzdit.`,
                ),
                tr(
                    `You've gone ${formatMoney(overAmt)} over budget this month. The streak resets, but one month doesn't define your finances — let's course-correct.`,
                    `Tento měsíc jsi přeš rozpočet o ${formatMoney(overAmt)}. Série se resetuje, ale jeden měsíc tvé finance nedefinuje — pojďme to napravit.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'rain-cloud',
        };
    }

    if (pct > 85) {
        return {
            text: pick([
                tr(
                    `${pct.toFixed(0)}% of your total budget used with ${formatMoney(remaining)} remaining. You're approaching the limit — consider slowing discretionary spending for the rest of the month.`,
                    `${pct.toFixed(0)}% rozpočtu vyčerpáno, zbývá ${formatMoney(remaining)}. Blížíš se limitu — zvaž zpomalit volné útraty na zbytek měsíce.`,
                ),
                tr(
                    `Getting close at ${pct.toFixed(0)}%! Only ${formatMoney(remaining)} left across all categories. A little restraint now can protect your streak.`,
                    `Blížíš se — ${pct.toFixed(0)}%! Ve všech kategoriích zbývá jen ${formatMoney(remaining)}. Trochu zdrženlivosti teď ochrání tvou sérii.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'rain-cloud',
        };
    }

    if (streakMonths === 1) {
        return {
            text: pick([
                tr(
                    `Last month was under budget — let's make it two in a row! Currently at ${pct.toFixed(0)}% with ${formatMoney(remaining)} remaining.`,
                    `Minulý měsíc jsi byl/a pod rozpočtem — pojďme udělat druhý v řadě! Aktuálně ${pct.toFixed(0)}%, zbývá ${formatMoney(remaining)}.`,
                ),
                tr(
                    `One month under budget, building momentum! ${formatMoney(remaining)} still available across ${categories.length} categories.`,
                    `Jeden měsíc pod rozpočtem, nabíráš setrvačnost! Ve ${categories.length} kategoriích stále k dispozici ${formatMoney(remaining)}.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'trophy',
        };
    }

    return {
        text: pick([
            tr(
                `Budget health looks good! ${pct.toFixed(0)}% used across ${categories.length} categories with ${formatMoney(remaining)} to spare.`,
                `Stav rozpočtu je dobrý! ${pct.toFixed(0)}% využito ve ${categories.length} kategoriích, zbývá ${formatMoney(remaining)}.`,
            ),
            tr(
                `${formatMoney(remaining)} of budget remaining this month. Tracking ${categories.length} categories — well managed so far!`,
                `Tento měsíc zbývá z rozpočtu ${formatMoney(remaining)}. Sleduji ${categories.length} kategorií — zatím skvěle řízené!`,
            ),
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'trophy',
    };
}

// ── Budget Editor ───────────────────────────────────────────────────────────
function editorInsight(data) {
    const { categories, expenseBreakdown } = data;
    const budgeted = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);
    const totalCats = categories?.length || 0;

    if (budgeted.length === 0) {
        return {
            text: pick([
                tr(
                    "No budgets configured yet. Set limits here or use Auto-suggest to generate recommendations from your past spending patterns!",
                    "Zatím nejsou nastaveny žádné rozpočty. Nastav limity tady nebo použij Auto-návrh — vytvoří doporučení z tvé historie útrat!",
                ),
                tr(
                    "This is where you plan your spending. Start with your biggest expense categories for maximum impact, or let Auto-suggest do the work.",
                    "Tady plánuješ své útraty. Začni největšími kategoriemi — maximální dopad. Nebo nech práci na Auto-návrhu.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'microphone',
        };
    }

    const budgetedNames = new Set(budgeted.map(c => (c.category || c.name || '').toLowerCase()));
    const unbudgetedHighSpend = (expenseBreakdown || [])
        .filter(e => !budgetedNames.has((e.category || e.name || '').toLowerCase()) && (e.amount || e.spent || 0) > 0)
        .sort((a, b) => (b.amount || b.spent || 0) - (a.amount || a.spent || 0));

    if (unbudgetedHighSpend.length > 0) {
        const top = unbudgetedHighSpend[0];
        const topName = top.category || top.name;
        const topAmt = top.amount || top.spent || 0;
        const additionalCount = unbudgetedHighSpend.length - 1;
        const suffixEn = additionalCount > 0
            ? ` Plus ${additionalCount} other spending categor${additionalCount === 1 ? 'y has' : 'ies have'} no limits set.`
            : '';
        const suffixCs = additionalCount > 0
            ? ` A ještě ${additionalCount} ${additionalCount === 1 ? 'kategorie nemá' : additionalCount < 5 ? 'kategorie nemají' : 'kategorií nemá'} nastavené limity.`
            : '';
        return {
            text: pick([
                tr(
                    `"${topName}" has ${formatMoney(topAmt)} in spending but no budget limit. That's a blind spot in your plan.${suffixEn}`,
                    `„${topName}“ má útraty ${formatMoney(topAmt)}, ale žádný rozpočtový limit. To je slepé místo v tvém plánu.${suffixCs}`,
                ),
                tr(
                    `Coverage gap: you're spending ${formatMoney(topAmt)} on "${topName}" without a budget. Consider adding a limit to keep it in check.${suffixEn}`,
                    `Mezera v pokrytí: utrácíš ${formatMoney(topAmt)} za „${topName}“ bez rozpočtu. Zvaž přidání limitu, ať to máš pod kontrolou.${suffixCs}`,
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const unbudgetedCount = totalCats - budgeted.length;

    if (unbudgetedCount === 0) {
        return {
            text: pick([
                tr(
                    "Every category has a budget! Full coverage means no spending goes untracked. That's the gold standard of financial planning.",
                    "Každá kategorie má rozpočet! Plné pokrytí znamená, že žádná útrata nezůstane nesledovaná. To je zlatý standard finančního plánování.",
                ),
                tr(
                    "100% budget coverage across all categories. You're controlling every dollar — that's rare and impressive!",
                    "100% pokrytí rozpočtem napříč všemi kategoriemi. Kontroluješ každou korunu — to je vzácné a působivé!",
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'stars-medals',
        };
    }

    if (unbudgetedCount > 3) {
        return {
            text: pick([
                tr(
                    `${unbudgetedCount} categories still without a budget. More coverage means fewer surprises — consider adding limits to your most-used categories first.`,
                    `${unbudgetedCount} kategorií stále bez rozpočtu. Větší pokrytí znamená méně překvapení — zvaž přidat limity nejdřív k nejpoužívanějším kategoriím.`,
                ),
                tr(
                    `Only ${budgeted.length} of ${totalCats} categories budgeted. Start with the categories where you spend the most to maximize control.`,
                    `Pouze ${budgeted.length} z ${totalCats} kategorií má rozpočet. Začni kategoriemi, kde utrácíš nejvíc — pro maximální kontrolu.`,
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                `${budgeted.length} categories budgeted out of ${totalCats}. Just ${unbudgetedCount} more to go for complete coverage!`,
                `${budgeted.length} kategorií s rozpočtem z ${totalCats}. Už jen ${unbudgetedCount} zbývá do úplného pokrytí!`,
            ),
            tr(
                `Solid setup with ${budgeted.length} budget limits. Close the remaining ${unbudgetedCount} gap${unbudgetedCount !== 1 ? 's' : ''} for full control.`,
                `Pevné nastavení s ${budgeted.length} rozpočtovými limity. Doplň zbývajících ${unbudgetedCount} a budeš mít vše pod kontrolou.`,
            ),
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'stars-medals',
    };
}

// ── Budget Progress Bars ────────────────────────────────────────────────────
function progressInsight(data) {
    const { categories } = data;
    const cats = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);

    if (cats.length === 0) {
        return {
            text: tr(
                "No progress to show yet. Set some category budgets first and I'll track every penny against your limits!",
                "Zatím není co zobrazit. Nastav nejdřív rozpočty kategorií a já pohlídám každou korunu proti tvým limitům!",
            ),
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
                tr(
                    `All categories under budget — green across the board! "${closestName}" is closest to its limit at ${closestPct}%, so keep an eye on it.`,
                    `Všechny kategorie pod rozpočtem — zelená všude! Nejblíž limitu je „${closestName}“ na ${closestPct}%, tak ji sleduj.`,
                ),
                tr(
                    `No overspending anywhere this month. "${closestName}" at ${closestPct}% is your tightest margin, but you're still in the clear.`,
                    `Tento měsíc nikde nepřečerpáno. „${closestName}“ na ${closestPct}% má nejmenší rezervu, ale pořád jsi v pohodě.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'floating-bubbles',
        };
    }

    const worst = overBudget[0];
    const worstName = worst.category || worst.name;
    const overAmt = (worst.spent || worst.actual || 0) - (worst.planned || worst.budget || 0);
    const worstPct = ((worst.spent || worst.actual || 0) / (worst.planned || worst.budget || 1) * 100).toFixed(0);
    const dailySave = Math.ceil(overAmt / 14);

    if (overBudget.length === 1) {
        return {
            text: pick([
                tr(
                    `"${worstName}" is over budget by ${formatMoney(overAmt)} (${worstPct}% of limit). Cutting just ${formatMoney(dailySave)} per day for two weeks would close that gap. Only one category in the red!`,
                    `„${worstName}“ přes rozpočet o ${formatMoney(overAmt)} (${worstPct}% limitu). Stačilo by ubrat ${formatMoney(dailySave)} denně po dva týdny a mezera zmizí. Jen jedna kategorie v červených číslech!`,
                ),
                tr(
                    `Just one slip: "${worstName}" exceeded its limit by ${formatMoney(overAmt)}. Try reducing daily spend in this area by about ${formatMoney(dailySave)} to recover.`,
                    `Jedno zakolísání: „${worstName}“ překročilo limit o ${formatMoney(overAmt)}. Zkus v této oblasti snížit denní útraty asi o ${formatMoney(dailySave)} a zachráníš to.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    const totalOver = overBudget.reduce((s, c) => s + ((c.spent || c.actual || 0) - (c.planned || c.budget || 0)), 0);
    return {
        text: pick([
            tr(
                `${overBudget.length} categories over budget, totaling ${formatMoney(totalOver)} in overspend. "${worstName}" is the worst at ${formatMoney(overAmt)} over — saving ${formatMoney(dailySave)}/day there would help the most.`,
                `${overBudget.length} kategorií přes rozpočet, celkem ${formatMoney(totalOver)} nad plán. Nejhorší je „${worstName}“ o ${formatMoney(overAmt)} přes — úspora ${formatMoney(dailySave)}/den by pomohla nejvíc.`,
            ),
            tr(
                `"${worstName}" leads the overspend at ${formatMoney(overAmt)} over. Across ${overBudget.length} categories you're ${formatMoney(totalOver)} past your limits. Focus cuts on the biggest offender first.`,
                `„${worstName}“ vede v přečerpání o ${formatMoney(overAmt)}. Napříč ${overBudget.length} kategoriemi jsi ${formatMoney(totalOver)} nad limity. Zaměř se nejdřív na největšího viníka.`,
            ),
        ]),
        type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        envEffect: 'exclamation-marks',
    };
}

// ── Budget Chart ────────────────────────────────────────────────────────────
function chartInsight(data) {
    const { categories } = data;
    const cats = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);

    if (cats.length === 0) {
        return {
            text: tr(
                "The chart needs budget data to visualize. Set up some category budgets first and I'll give you a clear planned-vs-actual comparison!",
                "Graf potřebuje data rozpočtu. Nastav nejdřív rozpočty kategorií a já ti ukážu jasné srovnání plán vs. skutečnost!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    const withGap = cats.map(c => {
        const planned = c.planned || c.budget || 0;
        const spent = c.spent || c.actual || 0;
        return { name: c.category || c.name, planned, spent, gap: planned - spent };
    }).sort((a, b) => b.gap - a.gap);

    const biggestSurplus = withGap[0];
    const biggestDeficit = withGap[withGap.length - 1];

    if (biggestSurplus.gap > 0 && biggestDeficit.gap < 0) {
        const reallocateAmt = Math.min(biggestSurplus.gap, Math.abs(biggestDeficit.gap));
        return {
            text: pick([
                tr(
                    `Reallocation idea: "${biggestSurplus.name}" has ${formatMoney(biggestSurplus.gap)} to spare, while "${biggestDeficit.name}" is ${formatMoney(Math.abs(biggestDeficit.gap))} over. Moving ${formatMoney(reallocateAmt)} between them would balance things out.`,
                    `Nápad na přesun: „${biggestSurplus.name}“ má ${formatMoney(biggestSurplus.gap)} rezervu, zatímco „${biggestDeficit.name}“ je o ${formatMoney(Math.abs(biggestDeficit.gap))} přes. Přesun ${formatMoney(reallocateAmt)} mezi nimi by to vyrovnal.`,
                ),
                tr(
                    `The chart reveals an opportunity: shift ${formatMoney(reallocateAmt)} from "${biggestSurplus.name}" (${formatMoney(biggestSurplus.gap)} under) to "${biggestDeficit.name}" (${formatMoney(Math.abs(biggestDeficit.gap))} over). Your total budget stays the same but fits reality better.`,
                    `Graf odhaluje příležitost: přesuň ${formatMoney(reallocateAmt)} z „${biggestSurplus.name}“ (${formatMoney(biggestSurplus.gap)} pod) na „${biggestDeficit.name}“ (${formatMoney(Math.abs(biggestDeficit.gap))} přes). Celkový rozpočet zůstane stejný, ale bude víc odpovídat realitě.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'movie-clap',
        };
    }

    if (biggestSurplus.gap > 0) {
        return {
            text: pick([
                tr(
                    `"${biggestSurplus.name}" has the most headroom at ${formatMoney(biggestSurplus.gap)} under budget. If this is consistent, you could lower that limit and redirect the funds elsewhere.`,
                    `„${biggestSurplus.name}“ má největší rezervu — ${formatMoney(biggestSurplus.gap)} pod rozpočtem. Pokud je to stabilní, můžeš limit snížit a peníze přesunout jinam.`,
                ),
                tr(
                    `Biggest buffer is in "${biggestSurplus.name}" — ${formatMoney(biggestSurplus.gap)} unused. Consider whether that budget is set too high, or if this is just a light month.`,
                    `Největší rezerva je v „${biggestSurplus.name}“ — ${formatMoney(biggestSurplus.gap)} nevyužito. Zvaž, jestli rozpočet není nastavený moc vysoko, nebo je to jen slabší měsíc.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    const totalOver = cats.reduce((s, c) => s + Math.max(0, (c.spent || c.actual || 0) - (c.planned || c.budget || 0)), 0);
    return {
        text: pick([
            tr(
                `Every category is at or over its limit — ${formatMoney(totalOver)} total overspend. The chart makes it clear: either spending needs to come down or budgets need a realistic increase.`,
                `Každá kategorie je na limitu nebo přes — celkové přečerpání ${formatMoney(totalOver)}. Graf to ukazuje jasně: buď útraty dolů, nebo rozpočty realisticky navýšit.`,
            ),
            tr(
                `The chart shows red across the board with ${formatMoney(totalOver)} in total overruns. Time for an honest budget revision that matches your actual spending patterns.`,
                `Graf je červený všude, celkem ${formatMoney(totalOver)} přečerpáno. Čas na upřímnou revizi rozpočtu, která bude odpovídat skutečným útratám.`,
            ),
        ]),
        type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Budget Stats ────────────────────────────────────────────────────────────
function statsInsight(data) {
    const { totalPlanned, totalActual, remaining, selectedMonth } = data;

    if (!totalPlanned || totalPlanned === 0) {
        return {
            text: tr(
                "No budget data to calculate daily allowances. Set up your budget and I'll tell you exactly how much you can spend each day!",
                "Chybí data pro výpočet denních limitů. Nastav rozpočet a já ti řeknu přesně, kolik můžeš denně utratit!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

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
                tr(
                    `Month complete! You used ${finalPct}% of your ${formatMoney(totalPlanned)} budget. Your average daily spend was ${formatMoney(dailyBurn)}.`,
                    `Měsíc uzavřen! Využil/a jsi ${finalPct}% rozpočtu ${formatMoney(totalPlanned)}. Průměrná denní útrata byla ${formatMoney(dailyBurn)}.`,
                ),
                tr(
                    `Final tally: ${formatMoney(totalActual)} spent against ${formatMoney(totalPlanned)} planned. That's ${formatMoney(dailyBurn)} per day on average.`,
                    `Konečná bilance: utraceno ${formatMoney(totalActual)} z plánovaných ${formatMoney(totalPlanned)}. To je průměrně ${formatMoney(dailyBurn)} denně.`,
                ),
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
                tr(
                    `Budget is already fully spent with ${daysLeft} days remaining. You've been burning ${formatMoney(dailyBurn)}/day — any further spending this month will push you deeper into the red.`,
                    `Rozpočet je plně vyčerpán a zbývá ${daysLeft} dní. Utrácíš ${formatMoney(dailyBurn)}/den — každá další koruna tě posune hlouběji do červených čísel.`,
                ),
                tr(
                    `No daily allowance left — you've used the entire ${formatMoney(totalPlanned)} budget with ${daysLeft} days to go. Time to go into lockdown mode on discretionary spending.`,
                    `Nezbývá žádný denní limit — celý rozpočet ${formatMoney(totalPlanned)} je pryč a zbývá ${daysLeft} dní. Čas přejít na krizový režim u volných útrat.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    const onTrack = projectedTotal <= totalPlanned * 1.05;

    if (onTrack) {
        return {
            text: pick([
                tr(
                    `You can spend ${formatMoney(dailyAllowance)} per day for the next ${daysLeft} days and stay on budget. Your current pace of ${formatMoney(dailyBurn)}/day is right on track!`,
                    `Můžeš utrácet ${formatMoney(dailyAllowance)} denně po dalších ${daysLeft} dní a zůstaneš v rozpočtu. Tvé aktuální tempo ${formatMoney(dailyBurn)}/den je přesně v kurzu!`,
                ),
                tr(
                    `Daily allowance: ${formatMoney(dailyAllowance)} across ${daysLeft} remaining days. At your current burn rate of ${formatMoney(dailyBurn)}/day, you're projected to finish under budget.`,
                    `Denní limit: ${formatMoney(dailyAllowance)} na zbývajících ${daysLeft} dní. Při současném tempu ${formatMoney(dailyBurn)}/den skončíš pod rozpočtem.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'piggy-filling',
        };
    }

    return {
        text: pick([
            tr(
                `Heads up: at ${formatMoney(dailyBurn)}/day, you'll hit ${formatMoney(projectedTotal)} by month end — that's over the ${formatMoney(totalPlanned)} budget. Dial back to ${formatMoney(dailyAllowance)}/day to stay within limits.`,
                `Pozor: při tempu ${formatMoney(dailyBurn)}/den se do konce měsíce dostaneš na ${formatMoney(projectedTotal)} — to je přes rozpočet ${formatMoney(totalPlanned)}. Zpomal na ${formatMoney(dailyAllowance)}/den, abys zůstal/a v limitu.`,
            ),
            tr(
                `Your daily burn is ${formatMoney(dailyBurn)} but you need to average ${formatMoney(dailyAllowance)}/day over the next ${daysLeft} days to stay on budget. Time to tighten up!`,
                `Utrácíš ${formatMoney(dailyBurn)} denně, ale na zbývajících ${daysLeft} dní potřebuješ průměrně ${formatMoney(dailyAllowance)}/den, aby ses vešel/a do rozpočtu. Čas přitlačit!`,
            ),
        ]),
        type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Budget Suggest ──────────────────────────────────────────────────────────
function suggestInsight(data) {
    const { categories, expenseBreakdown } = data;
    const hasBudgets = (categories || []).some(c => (c.planned || c.budget || 0) > 0);
    const breakdownItems = expenseBreakdown || [];

    if (!hasBudgets && breakdownItems.length === 0) {
        return {
            text: pick([
                tr(
                    "Auto-suggest analyzes your past spending to generate realistic budget limits. Import some transactions first and I'll have recommendations ready for you!",
                    "Auto-návrh analyzuje tvé minulé útraty a vygeneruje realistické rozpočtové limity. Nejdřív naimportuj transakce a doporučení už budou připravená!",
                ),
                tr(
                    "I need spending history to make smart suggestions. Once you've imported a few months of transactions, Auto-suggest will create a budget tailored to your habits.",
                    "Potřebuju historii útrat, abych dělal chytré návrhy. Jakmile naimportuješ pár měsíců transakcí, Auto-návrh vytvoří rozpočet šitý na míru tvým zvykům.",
                ),
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
                tr(
                    `I can see you spend the most on "${topName}" at ${formatMoney(topAmt)}. Hit Auto-suggest and I'll create limits for all ${breakdownItems.length} categories based on your actual patterns — with a small buffer built in.`,
                    `Vidím, že nejvíc utrácíš za „${topName}“ — ${formatMoney(topAmt)}. Zmáčkni Auto-návrh a já vytvořím limity pro všech ${breakdownItems.length} kategorií podle tvých skutečných vzorců — s malou rezervou.`,
                ),
                tr(
                    `With ${breakdownItems.length} spending categories and no budgets yet, Auto-suggest is your fastest path to a complete plan. I'll base it on real data, not guesses.`,
                    `S ${breakdownItems.length} kategoriemi útrat a bez rozpočtů je Auto-návrh nejrychlejší cesta k plnému plánu. Založím ho na skutečných datech, ne na odhadech.`,
                ),
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }

    const budgetedCats = (categories || []).filter(c => (c.planned || c.budget || 0) > 0);
    const overBudgetCount = budgetedCats.filter(c => (c.spent || c.actual || 0) > (c.planned || c.budget || 0)).length;
    const totalCats = categories?.length || 0;
    const coveragePct = totalCats > 0 ? Math.round(budgetedCats.length / totalCats * 100) : 0;

    if (overBudgetCount > 2) {
        return {
            text: pick([
                tr(
                    `${overBudgetCount} categories are over budget — that suggests the limits might be too aggressive. Run Auto-suggest to recalibrate based on your actual spending patterns. It'll propose realistic numbers you can actually stick to.`,
                    `${overBudgetCount} kategorií je přes rozpočet — možná jsou limity moc přísné. Spusť Auto-návrh a nechej ho přepočítat podle skutečných útrat. Navrhne reálná čísla, která opravdu dodržíš.`,
                ),
                tr(
                    `Multiple overruns hint that your budget needs adjusting. Auto-suggest recalculates from real data and builds in a comfort margin so your plan matches reality.`,
                    `Opakované překročení naznačuje, že rozpočet potřebuje úpravu. Auto-návrh přepočítá ze skutečných dat a přidá komfortní rezervu, aby plán odpovídal realitě.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'crystal-ball',
        };
    }

    if (coveragePct < 80) {
        return {
            text: pick([
                tr(
                    `You've budgeted ${coveragePct}% of your categories. Auto-suggest can fill in the remaining gaps using your spending history so nothing slips through the cracks.`,
                    `Máš rozpočet pro ${coveragePct}% kategorií. Auto-návrh doplní zbývající mezery podle historie útrat, ať ti nic neproklouzne.`,
                ),
                tr(
                    `${budgetedCats.length} of ${totalCats} categories have limits. Use Auto-suggest to complete your budget plan — it only takes a click.`,
                    `${budgetedCats.length} z ${totalCats} kategorií má limity. Použij Auto-návrh a dokonči plán — stačí jedno kliknutí.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'crystal-ball',
        };
    }

    return {
        text: pick([
            tr(
                "Your budget is already solid! Run Auto-suggest periodically to check if your limits still match evolving spending habits. Patterns change over time.",
                "Tvůj rozpočet je už pevný! Spouštěj Auto-návrh pravidelně a kontroluj, jestli limity pořád odpovídají měnícím se zvykům. Vzorce se v čase mění.",
            ),
            tr(
                "Even with good coverage, Auto-suggest can spot drift. It compares your current limits to recent trends and flags where adjustments might help.",
                "I při dobrém pokrytí dokáže Auto-návrh zachytit posuny. Porovná tvé aktuální limity s nedávnými trendy a označí, kde by mohly pomoct úpravy.",
            ),
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'crystal-ball',
    };
}

// ── Budget Month Picker ─────────────────────────────────────────────────────
function budgetMonthPickerInsight(data) {
    const { totalPlanned, usagePct } = data;

    if (!totalPlanned) {
        return {
            text: tr(
                "No budget set for this month yet. Pick any month to plan ahead or review — budgets forward-fill automatically!",
                "Pro tento měsíc zatím není rozpočet. Vyber jakýkoli měsíc pro plánování nebo kontrolu — rozpočty se automaticky přenášejí dopředu!",
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    if ((usagePct || 0) >= 100) {
        return {
            text: tr(
                `Budget 100%+ used this month. Hop back to compare with prior months — was this a one-off or a pattern?`,
                `Rozpočet tento měsíc vyčerpán na 100% a víc. Skoč zpět a porovnej s minulými měsíci — byla to výjimka nebo vzorec?`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'rain-cloud',
        };
    }

    return {
        text: tr(
            `${usagePct}% of the budget used. Compare across months by picking a different date!`,
            `${usagePct}% rozpočtu využito. Vyber jiný měsíc a porovnej!`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'telescope',
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
    'budget-month-picker': budgetMonthPickerInsight,
};

export function generateBudgetInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

export function budgetPageSummary(data) {
    const { categories, totalPlanned, totalActual, remaining, usagePct } = data;

    if (!categories?.length || !totalPlanned) {
        return {
            text: pick([
                tr(
                    "No budgets set yet — try Auto-suggest to create them from your spending history!",
                    "Zatím žádné rozpočty — vyzkoušej Auto-návrh a vytvoř je z historie útrat!",
                ),
                tr(
                    "Set up a budget and I'll track every category for you.",
                    "Nastav rozpočet a já pohlídám každou kategorii za tebe.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
        };
    }

    const pct = usagePct > 1 ? Math.round(usagePct) : Math.round((usagePct || (totalActual / totalPlanned)) * 100);
    const overBudget = (categories || []).filter(c => (c.actual || c.spent || 0) > (c.planned || c.budget || 0));
    const worstCat = overBudget.sort((a, b) => ((b.actual || b.spent || 0) - (b.planned || b.budget || 0)) - ((a.actual || a.spent || 0) - (a.planned || a.budget || 0)))[0];

    if (pct > 100) {
        return {
            text: pick([
                tr(
                    `Budget is ${pct}% used — over by ${formatMoney(Math.abs(remaining || totalActual - totalPlanned))}! ${worstCat ? `"${worstCat.name || worstCat.category}" is the biggest offender.` : 'Time to tighten up.'}`,
                    `Rozpočet využit na ${pct}% — přes o ${formatMoney(Math.abs(remaining || totalActual - totalPlanned))}! ${worstCat ? `Největší viník je „${worstCat.name || worstCat.category}“.` : 'Čas přitlačit.'}`,
                ),
                tr(
                    `Overspent by ${formatMoney(Math.abs(remaining || totalActual - totalPlanned))} (${pct}% of budget). ${overBudget.length} categor${overBudget.length === 1 ? 'y is' : 'ies are'} over limit.`,
                    `Přečerpáno o ${formatMoney(Math.abs(remaining || totalActual - totalPlanned))} (${pct}% rozpočtu). ${overBudget.length} ${overBudget.length === 1 ? 'kategorie je' : 'kategorií je'} přes limit.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        };
    }

    if (pct <= 60) {
        return {
            text: pick([
                tr(
                    `Only ${pct}% of budget used with ${formatMoney(remaining || totalPlanned - totalActual)} remaining. You're well ahead — great discipline!`,
                    `Využito jen ${pct}% rozpočtu, zbývá ${formatMoney(remaining || totalPlanned - totalActual)}. Jsi v pohodě — skvělá disciplína!`,
                ),
                tr(
                    `Budget looking healthy at ${pct}% usage. Plenty of room with ${formatMoney(remaining || totalPlanned - totalActual)} left.`,
                    `Rozpočet vypadá zdravě — ${pct}% využito. Spousta prostoru, zbývá ${formatMoney(remaining || totalPlanned - totalActual)}.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
        };
    }

    return {
        text: pick([
            tr(
                `Budget is ${pct}% used — ${formatMoney(remaining || totalPlanned - totalActual)} remaining. ${overBudget.length > 0 ? `${overBudget.length} categor${overBudget.length === 1 ? 'y' : 'ies'} over limit.` : 'All categories within bounds!'}`,
                `Rozpočet využit na ${pct}% — zbývá ${formatMoney(remaining || totalPlanned - totalActual)}. ${overBudget.length > 0 ? `${overBudget.length} ${overBudget.length === 1 ? 'kategorie' : 'kategorií'} přes limit.` : 'Všechny kategorie v mezích!'}`,
            ),
            tr(
                `${formatMoney(totalActual)} spent of ${formatMoney(totalPlanned)} budgeted (${pct}%). ${overBudget.length === 0 ? 'Everything under control!' : `Watch "${(overBudget[0]?.name || overBudget[0]?.category) || 'top spender'}".`}`,
                `Utraceno ${formatMoney(totalActual)} z rozpočtu ${formatMoney(totalPlanned)} (${pct}%). ${overBudget.length === 0 ? 'Vše pod kontrolou!' : `Hlídej si „${(overBudget[0]?.name || overBudget[0]?.category) || 'největší utrácečku'}“.`}`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
    };
}
