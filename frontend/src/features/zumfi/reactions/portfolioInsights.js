// Portfolio Zone Insight Generator for Zumi Proximity Interactions
// Enhanced with data intelligence: trends, predictions, best/worst performers, and environmental effects.

import {
    analyzeTrend, compareToPrevMonth, predictNextMonth,
    bestWorstPerformer, pick, formatMoney,
} from './dataIntelligence';
import { tr } from './lang';

// ── Helpers ─────────────────────────────────────────────────────────────────

function compositionPcts(summary) {
    const total = summary.total_portfolio || 0;
    if (total <= 0) return { savingsPct: 0, stocksPct: 0, propertiesPct: 0 };
    const savingsPct = (summary.total_savings || 0) / total * 100;
    const stocksPct = (summary.total_stocks_value || 0) / total * 100;
    const propertiesPct = (summary.total_properties_value || 0) / total * 100;
    return { savingsPct, stocksPct, propertiesPct };
}

function diversificationScore(allocation) {
    if (!allocation || allocation.length === 0) return 0;
    if (allocation.length === 1) return 10;
    const n = allocation.length;
    const ideal = 100 / n;
    const totalDeviation = allocation.reduce((s, a) => s + Math.abs((a.percentage || 0) - ideal), 0);
    const maxDeviation = 2 * (100 - ideal);
    return Math.round(Math.max(0, (1 - totalDeviation / maxDeviation) * 100));
}

function biggestDeltaTab(summary) {
    const deltas = [
        { tab: 'savings', delta: Math.abs(summary.delta_savings || 0), labelEn: 'Savings', labelCs: 'Úspory' },
        { tab: 'investments', delta: Math.abs(summary.delta_stocks || summary.delta_investments || 0), labelEn: 'Investments', labelCs: 'Investice' },
        { tab: 'stocks', delta: Math.abs(summary.delta_stocks_value || 0), labelEn: 'Stocks', labelCs: 'Akcie' },
    ];
    return deltas.sort((a, b) => b.delta - a.delta)[0];
}

function riskLabelEn(comp) {
    const equity = comp.stocksPct + comp.propertiesPct;
    if (equity > 70) return 'aggressive';
    if (equity > 40) return 'balanced';
    return 'conservative';
}

function riskLabelCs(comp) {
    const equity = comp.stocksPct + comp.propertiesPct;
    if (equity > 70) return 'agresivní';
    if (equity > 40) return 'vyvážený';
    return 'konzervativní';
}

// ── Portfolio Header ────────────────────────────────────────────────────────
function headerInsight(data) {
    const { summary, activeTab } = data;

    if (!summary || summary.total_portfolio === 0) {
        return {
            text: pick([
                tr(
                    "Your portfolio is empty! Start by adding savings accounts, investments, or properties to build your wealth picture.",
                    "Tvé portfolio je prázdné! Začni přidáním spořicích účtů, investic nebo nemovitostí a postav si obraz svého bohatství.",
                ),
                tr(
                    "Build your wealth portfolio here — track savings, investments, stocks, and properties all in one place.",
                    "Vybuduj si tu své bohatství — sleduj úspory, investice, akcie i nemovitosti na jednom místě.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const total = summary.total_portfolio;
    const allocation = summary.allocation || [];

    if (allocation.length >= 2) {
        const values = allocation.map(a => a.value || a.amount || 0);
        const trend = analyzeTrend(values);

        if (trend.direction === 'rising' && trend.strength !== 'weak') {
            const tabLabelsEn = { overview: 'the full overview', savings: 'your savings', investments: 'your investments', stocks: 'your stock portfolio' };
            const tabLabelsCs = { overview: 'celý přehled', savings: 'své úspory', investments: 'své investice', stocks: 'své akciové portfolio' };
            return {
                text: tr(
                    `Portfolio has grown ${trend.changePercent.toFixed(1)}% recently — now at ${formatMoney(total)} Kč! You're viewing ${tabLabelsEn[activeTab] || 'the overview'}. ${trend.consecutive >= 2 ? `That's ${trend.consecutive} consecutive periods of growth.` : 'Momentum is building.'}`,
                    `Portfolio nedávno vyrostlo o ${trend.changePercent.toFixed(1)}% — nyní na ${formatMoney(total)} Kč! Díváš se na ${tabLabelsCs[activeTab] || 'přehled'}. ${trend.consecutive >= 2 ? `To je ${trend.consecutive} po sobě jdoucích období růstu.` : 'Nabírá se moment.'}`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'golden-sparkles',
            };
        }
    }

    const tabMessagesEn = {
        overview: `Total portfolio: ${formatMoney(total)} Kč across ${allocation.length} asset ${allocation.length === 1 ? 'class' : 'classes'}. This is your complete wealth snapshot.`,
        savings: `Savings tab active — tracking ${summary.savings_accounts?.length || 0} account${(summary.savings_accounts?.length || 0) !== 1 ? 's' : ''} worth ${formatMoney(summary.total_savings || 0)} Kč within a ${formatMoney(total)} Kč portfolio.`,
        investments: `Investments tab — your non-stock investments are working for you. Total portfolio stands at ${formatMoney(total)} Kč.`,
        stocks: `Stock portfolio view — market values and performance at a glance. Total portfolio: ${formatMoney(total)} Kč.`,
    };
    const tabMessagesCs = {
        overview: `Celkové portfolio: ${formatMoney(total)} Kč napříč ${allocation.length} ${allocation.length === 1 ? 'třídou aktiv' : allocation.length < 5 ? 'třídami aktiv' : 'třídami aktiv'}. Toto je kompletní snímek tvého bohatství.`,
        savings: `Záložka Úspory aktivní — sleduji ${summary.savings_accounts?.length || 0} ${(summary.savings_accounts?.length || 0) === 1 ? 'účet' : (summary.savings_accounts?.length || 0) < 5 ? 'účty' : 'účtů'} v hodnotě ${formatMoney(summary.total_savings || 0)} Kč v rámci portfolia ${formatMoney(total)} Kč.`,
        investments: `Záložka Investice — tvé nekacciové investice pracují pro tebe. Celkové portfolio je na ${formatMoney(total)} Kč.`,
        stocks: `Pohled na akciové portfolio — tržní hodnoty a výkonnost na první pohled. Celkové portfolio: ${formatMoney(total)} Kč.`,
    };

    return {
        text: tr(
            tabMessagesEn[activeTab] || tabMessagesEn.overview,
            tabMessagesCs[activeTab] || tabMessagesCs.overview,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Portfolio KPI Cards ─────────────────────────────────────────────────────
function kpiInsight(data) {
    const { summary, stockPnl } = data;

    if (!summary || summary.total_portfolio === 0) {
        return {
            text: tr(
                "No portfolio value yet. Add your first savings account, investment, or property to get started!",
                "Zatím žádná hodnota portfolia. Přidej první spořicí účet, investici nebo nemovitost a jdeme na to!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const total = summary.total_portfolio;
    const comp = compositionPcts(summary);
    const riskEn = riskLabelEn(comp);
    const riskCs = riskLabelCs(comp);

    if (stockPnl && stockPnl.total_pnl > 0) {
        return {
            text: pick([
                tr(
                    `Portfolio: ${formatMoney(total)} Kč with positive stock gains of ${formatMoney(stockPnl.total_pnl)} Kč! Your mix is ${comp.savingsPct.toFixed(0)}% savings, ${comp.stocksPct.toFixed(0)}% stocks, ${comp.propertiesPct.toFixed(0)}% properties — a ${riskEn} profile.`,
                    `Portfolio: ${formatMoney(total)} Kč s pozitivními zisky na akciích ${formatMoney(stockPnl.total_pnl)} Kč! Tvůj mix je ${comp.savingsPct.toFixed(0)}% úspory, ${comp.stocksPct.toFixed(0)}% akcie, ${comp.propertiesPct.toFixed(0)}% nemovitosti — ${riskCs} profil.`,
                ),
                tr(
                    `${formatMoney(total)} Kč total with stocks in the green (+${formatMoney(stockPnl.total_pnl)} Kč). Composition: ${comp.savingsPct.toFixed(0)}% safe assets, ${(comp.stocksPct + comp.propertiesPct).toFixed(0)}% growth assets.`,
                    `${formatMoney(total)} Kč celkem, akcie v plusu (+${formatMoney(stockPnl.total_pnl)} Kč). Složení: ${comp.savingsPct.toFixed(0)}% bezpečná aktiva, ${(comp.stocksPct + comp.propertiesPct).toFixed(0)}% růstová aktiva.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'treasure-chest',
        };
    }

    if (stockPnl && stockPnl.total_pnl < 0) {
        return {
            text: pick([
                tr(
                    `Portfolio: ${formatMoney(total)} Kč. Stocks are down ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč, but savings (${comp.savingsPct.toFixed(0)}%) provide a cushion. Risk profile: ${riskEn}.`,
                    `Portfolio: ${formatMoney(total)} Kč. Akcie dolů o ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč, ale úspory (${comp.savingsPct.toFixed(0)}%) poskytují polštář. Rizikový profil: ${riskCs}.`,
                ),
                tr(
                    `${formatMoney(total)} Kč portfolio. Markets fluctuate — your ${comp.savingsPct.toFixed(0)}% savings allocation acts as a safety net while stocks recover.`,
                    `${formatMoney(total)} Kč portfolio. Trhy kolísají — tvých ${comp.savingsPct.toFixed(0)}% v úsporách slouží jako záchranná síť, než se akcie vzpamatují.`,
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    if (comp.savingsPct > 80) {
        return {
            text: pick([
                tr(
                    `${formatMoney(total)} Kč portfolio is ${comp.savingsPct.toFixed(0)}% savings — very conservative. A small allocation to investments or stocks could boost long-term returns without much risk.`,
                    `Portfolio ${formatMoney(total)} Kč je z ${comp.savingsPct.toFixed(0)}% v úsporách — velmi konzervativní. Malá alokace do investic nebo akcií by mohla zvýšit dlouhodobý výnos bez velkého rizika.`,
                ),
                tr(
                    `Heavy on savings at ${comp.savingsPct.toFixed(0)}% of ${formatMoney(total)} Kč. Safe and sound, but diversifying even 10-20% into investments can improve growth.`,
                    `Těžce vsazeno na úspory — ${comp.savingsPct.toFixed(0)}% z ${formatMoney(total)} Kč. Bezpečné, ale diverzifikace i 10-20% do investic může zlepšit růst.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    if (riskEn === 'balanced') {
        return {
            text: tr(
                `${formatMoney(total)} Kč spread across savings (${comp.savingsPct.toFixed(0)}%), stocks (${comp.stocksPct.toFixed(0)}%), and properties (${comp.propertiesPct.toFixed(0)}%). A nicely balanced portfolio — strong foundation for growth.`,
                `${formatMoney(total)} Kč rozloženo mezi úspory (${comp.savingsPct.toFixed(0)}%), akcie (${comp.stocksPct.toFixed(0)}%) a nemovitosti (${comp.propertiesPct.toFixed(0)}%). Pěkně vyvážené portfolio — pevný základ pro růst.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'diamond-sparkles',
        };
    }

    return {
        text: pick([
            tr(
                `Total portfolio: ${formatMoney(total)} Kč. Risk profile: ${riskEn}. Savings: ${comp.savingsPct.toFixed(0)}%, Stocks: ${comp.stocksPct.toFixed(0)}%, Properties: ${comp.propertiesPct.toFixed(0)}%.`,
                `Celkové portfolio: ${formatMoney(total)} Kč. Rizikový profil: ${riskCs}. Úspory: ${comp.savingsPct.toFixed(0)}%, Akcie: ${comp.stocksPct.toFixed(0)}%, Nemovitosti: ${comp.propertiesPct.toFixed(0)}%.`,
            ),
            tr(
                `${formatMoney(total)} Kč across all assets. Building wealth step by step with a ${riskEn} allocation strategy!`,
                `${formatMoney(total)} Kč napříč všemi aktivy. Budeš bohatství krok za krokem s ${riskCs} alokační strategií!`,
            ),
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
            text: tr(
                "Navigate between Overview, Savings, Investments, and Stocks tabs. Add data to unlock insights in each!",
                "Přepínej mezi záložkami Přehled, Úspory, Investice a Akcie. Přidej data a odemkni postřehy v každé!",
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'microphone',
        };
    }

    const tabsEn = { overview: 'Overview', savings: 'Savings', investments: 'Investments', stocks: 'Stock Portfolio' };
    const tabsCs = { overview: 'Přehled', savings: 'Úspory', investments: 'Investice', stocks: 'Akciové portfolio' };
    const biggest = biggestDeltaTab(summary);

    if (biggest && biggest.tab !== activeTab && biggest.delta > 0) {
        return {
            text: pick([
                tr(
                    `Tip: Your ${biggest.labelEn} tab had the biggest recent movement (${formatMoney(biggest.delta)} Kč change). Might be worth a look!`,
                    `Tip: Záložka ${biggest.labelCs} měla nedávno největší pohyb (${formatMoney(biggest.delta)} Kč změna). Stálo by to za podívanou!`,
                ),
                tr(
                    `The ${biggest.labelEn} section saw significant changes recently. Switch there for details — ${formatMoney(biggest.delta)} Kč in movement.`,
                    `Sekce ${biggest.labelCs} nedávno zaznamenala významné změny. Přepni se pro detaily — ${formatMoney(biggest.delta)} Kč v pohybu.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (activeTab === 'overview') {
        return {
            text: pick([
                tr(
                    `Overview shows the big picture of your ${formatMoney(summary.total_portfolio)} Kč portfolio. Dive into specific tabs for detailed analysis!`,
                    `Přehled ukazuje velký obrázek tvého portfolia ${formatMoney(summary.total_portfolio)} Kč. Ponoř se do konkrétních záložek pro detaily!`,
                ),
                tr(
                    `You're on Overview — the bird's-eye view. Each other tab offers deeper insights into that asset class.`,
                    `Jsi v Přehledu — pohled z ptačí perspektivy. Každá další záložka nabízí hlubší postřehy do dané třídy aktiv.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const currentEn = tabsEn[activeTab] || 'Overview';
    const currentCs = tabsCs[activeTab] || 'Přehled';
    const othersEn = Object.entries(tabsEn).filter(([k]) => k !== activeTab).map(([, v]) => v);
    const othersCs = Object.entries(tabsCs).filter(([k]) => k !== activeTab).map(([, v]) => v);
    const idx = Math.floor(Math.random() * othersEn.length);
    const suggestEn = othersEn[idx];
    const suggestCs = othersCs[idx];

    return {
        text: pick([
            tr(
                `Exploring ${currentEn}. Want a different angle? Check out ${suggestEn} for a fresh perspective!`,
                `Zkoumáš ${currentCs}. Chceš jiný úhel pohledu? Mrkni na ${suggestCs}!`,
            ),
            tr(
                `${currentEn} tab active. Each tab reveals unique insights. Try ${suggestEn} next!`,
                `Záložka ${currentCs} aktivní. Každá záložka ukazuje jedinečné postřehy. Zkus další ${suggestCs}!`,
            ),
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
            text: tr(
                "No allocation data yet. Add savings, investments, or properties to see your wealth distribution!",
                "Zatím žádná data o alokaci. Přidej úspory, investice nebo nemovitosti a uvidíš rozložení svého bohatství!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    const sorted = [...allocation].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    const topPct = sorted[0]?.percentage || 0;
    const divScore = diversificationScore(allocation);

    if (topPct > 70) {
        return {
            text: pick([
                tr(
                    `${sorted[0].name} dominates at ${topPct.toFixed(0)}% of your portfolio. Diversification score: ${divScore}/100 — quite concentrated. Spreading across more asset classes reduces risk.`,
                    `${sorted[0].name} dominuje s ${topPct.toFixed(0)}% portfolia. Skóre diverzifikace: ${divScore}/100 — dost koncentrované. Rozložení do víc tříd aktiv snižuje riziko.`,
                ),
                tr(
                    `Heavy concentration in ${sorted[0].name} (${topPct.toFixed(0)}%). Your diversification score is only ${divScore}/100. Consider shifting some allocation to reduce single-asset-class risk.`,
                    `Silná koncentrace v ${sorted[0].name} (${topPct.toFixed(0)}%). Tvé skóre diverzifikace je jen ${divScore}/100. Zvaž přesun části alokace a snížení rizika jedné třídy.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    if (allocation.length >= 3 && topPct < 50) {
        return {
            text: pick([
                tr(
                    `Well-diversified across ${allocation.length} asset classes! No single category exceeds ${topPct.toFixed(0)}%. Diversification score: ${divScore}/100. This balance helps weather market swings.`,
                    `Dobře diverzifikováno napříč ${allocation.length} třídami aktiv! Žádná kategorie nepřesahuje ${topPct.toFixed(0)}%. Skóre: ${divScore}/100. Tato rovnováha pomáhá přečkat výkyvy trhů.`,
                ),
                tr(
                    `Nice balance across ${allocation.length} asset types with a ${divScore}/100 diversification score. ${sorted[0].name} leads at ${topPct.toFixed(0)}%, but no category is dominant.`,
                    `Pěkná rovnováha napříč ${allocation.length} typy aktiv se skóre ${divScore}/100. Vede ${sorted[0].name} s ${topPct.toFixed(0)}%, ale žádná kategorie není dominantní.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            tr(
                `${allocation.length} asset types in your portfolio. ${sorted[0].name} leads at ${topPct.toFixed(0)}%. Diversification score: ${divScore}/100. ${divScore < 50 ? 'Adding another asset class could improve balance.' : 'Reasonable allocation.'}`,
                `${allocation.length} typů aktiv v portfoliu. Vede ${sorted[0].name} s ${topPct.toFixed(0)}%. Skóre diverzifikace: ${divScore}/100. ${divScore < 50 ? 'Přidání další třídy aktiv by mohlo zlepšit rovnováhu.' : 'Rozumná alokace.'}`,
            ),
            tr(
                `Portfolio split across ${allocation.length} categories. Score: ${divScore}/100 for diversification. ${sorted[0].name} at ${topPct.toFixed(0)}% is the largest holding.`,
                `Portfolio rozděleno do ${allocation.length} kategorií. Skóre diverzifikace: ${divScore}/100. Největší pozice je ${sorted[0].name} na ${topPct.toFixed(0)}%.`,
            ),
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
                tr(
                    "No savings accounts tracked yet. Add your bank accounts to see balances, interest rates, and growth trends!",
                    "Zatím žádné spořicí účty. Přidej bankovní účty a uvidíš zůstatky, úrokové sazby i trendy růstu!",
                ),
                tr(
                    "Start tracking your savings here — every account matters for the full picture of your wealth.",
                    "Začni tu sledovat úspory — každý účet je důležitý pro celkový obraz tvého bohatství.",
                ),
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

    if (accounts.length >= 3 && rates.length >= 2) {
        const spread = maxRate - minRate;
        return {
            text: pick([
                tr(
                    `${accounts.length} savings accounts totaling ${formatMoney(total)} Kč. Interest rates range from ${minRate.toFixed(1)}% to ${maxRate.toFixed(1)}% (avg ${avgRate.toFixed(1)}%). ${spread > 2 ? 'Consider moving funds from the lowest-rate account to the highest.' : 'Rates are fairly close — good shopping!'}`,
                    `${accounts.length} spořicích účtů v hodnotě ${formatMoney(total)} Kč. Úrokové sazby od ${minRate.toFixed(1)}% do ${maxRate.toFixed(1)}% (průměr ${avgRate.toFixed(1)}%). ${spread > 2 ? 'Zvaž přesun z nejhůře úročeného účtu na nejlepší.' : 'Sazby jsou si blízké — dobrá volba!'}`,
                ),
                tr(
                    `${formatMoney(total)} Kč across ${accounts.length} accounts. Average interest: ${avgRate.toFixed(1)}%. Your best rate is ${maxRate.toFixed(1)}% — maximizing funds there could boost returns.`,
                    `${formatMoney(total)} Kč napříč ${accounts.length} účty. Průměrný úrok: ${avgRate.toFixed(1)}%. Tvá nejlepší sazba je ${maxRate.toFixed(1)}% — maximalizací peněz tam můžeš zvýšit výnos.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'plant-growing',
        };
    }

    if (summary.delta_savings && summary.delta_savings > 0) {
        const growthPct = total > 0 ? (summary.delta_savings / (total - summary.delta_savings) * 100) : 0;
        return {
            text: pick([
                tr(
                    `Savings grew by ${formatMoney(summary.delta_savings)} Kč${growthPct > 0 ? ` (${growthPct.toFixed(1)}%)` : ''} recently! Total now: ${formatMoney(total)} Kč across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}.`,
                    `Úspory nedávno vzrostly o ${formatMoney(summary.delta_savings)} Kč${growthPct > 0 ? ` (${growthPct.toFixed(1)}%)` : ''}! Celkem teď ${formatMoney(total)} Kč napříč ${accounts.length} ${accounts.length === 1 ? 'účtem' : accounts.length < 5 ? 'účty' : 'účty'}.`,
                ),
                tr(
                    `${formatMoney(total)} Kč in savings — up ${formatMoney(summary.delta_savings)} Kč. Your savings are on the rise!`,
                    `${formatMoney(total)} Kč v úsporách — nahoru o ${formatMoney(summary.delta_savings)} Kč. Tvé úspory rostou!`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'plant-growing',
        };
    }

    return {
        text: pick([
            tr(
                `${accounts.length} savings account${accounts.length !== 1 ? 's' : ''} with ${formatMoney(total)} Kč total. ${avgRate > 0 ? `Average interest rate: ${avgRate.toFixed(1)}%.` : 'Consider accounts with higher interest rates!'}`,
                `${accounts.length} ${accounts.length === 1 ? 'spořicí účet' : accounts.length < 5 ? 'spořicí účty' : 'spořicích účtů'} s celkem ${formatMoney(total)} Kč. ${avgRate > 0 ? `Průměrná úroková sazba: ${avgRate.toFixed(1)}%.` : 'Zvaž účty s vyššími sazbami!'}`,
            ),
            tr(
                `Savings balance: ${formatMoney(total)} Kč. ${accounts.length > 1 ? `Spread across ${accounts.length} accounts for security.` : 'Consider opening additional accounts for better rate shopping.'}`,
                `Zůstatek úspor: ${formatMoney(total)} Kč. ${accounts.length > 1 ? `Rozloženo do ${accounts.length} ${accounts.length < 5 ? 'účtů' : 'účtů'} pro bezpečí.` : 'Zvaž otevření dalších účtů pro lepší srovnání sazeb.'}`,
            ),
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
            text: tr(
                "This chart shows savings growth over time. Add accounts to see your trajectory and identify growth periods!",
                "Tento graf ukazuje růst úspor v čase. Přidej účty a uvidíš svou trajektorii i období růstu!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const savingsHistory = accounts.map(a => Number(a.balance || 0));
    if (savingsHistory.length >= 2) {
        const trend = analyzeTrend(savingsHistory);

        if (trend.direction === 'rising' && trend.consecutive >= 2) {
            return {
                text: tr(
                    `Savings trending upward for ${trend.consecutive} consecutive periods — up ${trend.changePercent.toFixed(1)}% overall! Current total: ${formatMoney(total)} Kč. This upward momentum is a great sign for your financial health.`,
                    `Úspory rostou už ${trend.consecutive} po sobě jdoucích období — celkem nahoru o ${trend.changePercent.toFixed(1)}%! Aktuálně ${formatMoney(total)} Kč. Tento vzestupný moment je skvělým znamením pro tvé finanční zdraví.`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'rising-arrow',
            };
        }

        if (trend.direction === 'falling') {
            return {
                text: tr(
                    `Savings showing a decline of ${Math.abs(trend.changePercent).toFixed(1)}% over recent periods. Current total: ${formatMoney(total)} Kč. Identifying where the drawdown started can help reverse the trend.`,
                    `Úspory klesly o ${Math.abs(trend.changePercent).toFixed(1)}% v posledních obdobích. Aktuálně ${formatMoney(total)} Kč. Identifikace začátku poklesu pomůže obrátit trend.`,
                ),
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'telescope',
            };
        }
    }

    if (accounts.length === 1) {
        return {
            text: pick([
                tr(
                    `Tracking ${accounts[0].name || 'your account'} over time. Current balance: ${formatMoney(total)} Kč. Add more accounts for a richer savings story!`,
                    `Sleduji ${accounts[0].name || 'tvůj účet'} v čase. Aktuální zůstatek: ${formatMoney(total)} Kč. Přidej další účty pro bohatší příběh úspor!`,
                ),
                tr(
                    `Single account trend for ${accounts[0].name || 'your savings'}. At ${formatMoney(total)} Kč, watch for inflection points where growth accelerates or stalls.`,
                    `Trend jednoho účtu ${accounts[0].name || 'tvých úspor'}. Na ${formatMoney(total)} Kč sleduj body zlomu, kde růst zrychluje nebo se zastavuje.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    return {
        text: pick([
            tr(
                `Savings trend across ${accounts.length} accounts — ${formatMoney(total)} Kč total. Look for the inflection points where growth accelerated or paused!`,
                `Trend úspor napříč ${accounts.length} účty — celkem ${formatMoney(total)} Kč. Hledej body zlomu, kde růst zrychlil nebo se zastavil!`,
            ),
            tr(
                `12-month savings history with ${formatMoney(total)} Kč across ${accounts.length} accounts. Consistent upward curves mean your habits are working.`,
                `12měsíční historie úspor s ${formatMoney(total)} Kč napříč ${accounts.length} účty. Stabilně rostoucí křivky znamenají, že tvé návyky fungují.`,
            ),
            tr(
                `Your savings journey over time. ${accounts.length} accounts building a ${formatMoney(total)} Kč safety net!`,
                `Tvá cesta úspor v čase. ${accounts.length} ${accounts.length === 1 ? 'účet staví' : accounts.length < 5 ? 'účty staví' : 'účtů staví'} záchrannou síť ${formatMoney(total)} Kč!`,
            ),
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
                tr(
                    "Set savings goals to stay motivated! Every target reached is a milestone. Goals give direction to your saving efforts.",
                    "Nastav si spořicí cíle a zůstaň motivovaný/á! Každý dosažený cíl je milník. Cíle dávají směr tvému spoření.",
                ),
                tr(
                    "Goals give your savings purpose. Create one for emergencies, travel, or a big purchase and watch progress build!",
                    "Cíle dávají úsporám smysl. Vytvoř jeden pro nouze, cestování nebo velký nákup a sleduj, jak pokrok roste!",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const goalsWithTargets = accounts.filter(a => a.goal_amount && a.goal_amount > 0);

    if (goalsWithTargets.length > 0) {
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
                text: tr(
                    `Almost there! "${closest.name}" is ${closest.pct.toFixed(0)}% complete — only ${formatMoney(Math.max(0, remaining))} Kč to go! ${withProgress.length > 1 ? `You have ${withProgress.length} goals in total.` : 'Push through the finish line!'}`,
                    `Skoro tam! „${closest.name}“ je na ${closest.pct.toFixed(0)}% — zbývá jen ${formatMoney(Math.max(0, remaining))} Kč! ${withProgress.length > 1 ? `Celkem máš ${withProgress.length} ${withProgress.length < 5 ? 'cíle' : 'cílů'}.` : 'Protni cílovou pásku!'}`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
                envEffect: 'stars-medals',
            };
        }

        if (closest.pct >= 50) {
            const monthlyRate = summary.delta_savings && summary.delta_savings > 0 ? summary.delta_savings : 0;
            const remaining = closest.goal - closest.balance;
            const monthsToGo = monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : null;

            return {
                text: tr(
                    `"${closest.name}" leads at ${closest.pct.toFixed(0)}% (${formatMoney(closest.balance)} of ${formatMoney(closest.goal)} Kč). ${monthsToGo ? `At your current savings pace, you could reach it in ~${monthsToGo} month${monthsToGo !== 1 ? 's' : ''}!` : 'Keep up the momentum!'} ${withProgress.length > 1 ? `${withProgress.length} goals being tracked.` : ''}`,
                    `„${closest.name}“ vede na ${closest.pct.toFixed(0)}% (${formatMoney(closest.balance)} z ${formatMoney(closest.goal)} Kč). ${monthsToGo ? `V tvém tempu ho dosáhneš za ~${monthsToGo} ${monthsToGo === 1 ? 'měsíc' : monthsToGo < 5 ? 'měsíce' : 'měsíců'}!` : 'Udrž tempo!'} ${withProgress.length > 1 ? `Sleduji ${withProgress.length} ${withProgress.length < 5 ? 'cíle' : 'cílů'}.` : ''}`,
                ),
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
                envEffect: 'stars-medals',
            };
        }

        return {
            text: tr(
                `Tracking ${withProgress.length} savings goal${withProgress.length !== 1 ? 's' : ''}. "${closest.name}" is furthest along at ${closest.pct.toFixed(0)}%. Every deposit brings you closer to your targets!`,
                `Sleduji ${withProgress.length} ${withProgress.length === 1 ? 'spořicí cíl' : withProgress.length < 5 ? 'spořicí cíle' : 'spořicích cílů'}. „${closest.name}“ je nejdál na ${closest.pct.toFixed(0)}%. Každý vklad tě přibližuje!`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            tr(
                "Your savings goals with progress tracking. Keep pushing toward those targets — every koruna counts!",
                "Tvé spořicí cíle s sledováním pokroku. Pokračuj směrem k cílům — každá koruna se počítá!",
            ),
            tr(
                "Goals turn saving into a game. Set target amounts for your accounts and watch the progress bars fill up!",
                "Cíle dělají ze spoření hru. Nastav cílové částky pro své účty a sleduj, jak se ukazatele plní!",
            ),
            tr(
                "Each goal is a milestone on your financial journey. Track progress and celebrate when you reach them!",
                "Každý cíl je milník na tvé finanční cestě. Sleduj pokrok a oslavuj, když ho dosáhneš!",
            ),
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
                tr(
                    "No investments tracked yet. Add mutual funds, bonds, or other assets to see returns analysis and performance!",
                    "Zatím žádné investice. Přidej podílové fondy, dluhopisy nebo jiná aktiva a uvidíš analýzu výnosů!",
                ),
                tr(
                    "Start adding your investments to complete the full picture. Track returns, compare performers, and optimize!",
                    "Začni přidávat investice a doplň celkový obraz. Sleduj výnosy, srovnávej a optimalizuj!",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const total = investments.reduce((s, i) => s + Number(i.current_value || 0), 0);
    const costBasis = investments.reduce((s, i) => s + Number(i.invested_amount || i.cost_basis || 0), 0);
    const totalReturn = total - costBasis;
    const returnPct = costBasis > 0 ? (totalReturn / costBasis * 100) : 0;

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
                text: tr(
                    `${investments.length} investments worth ${formatMoney(total)} Kč — total return of ${formatMoney(totalReturn)} Kč (${returnPct.toFixed(1)}%). Top performer: ${bestName} at +${bestPct}%. Weakest: ${worstName} at ${worstPct}%.`,
                    `${investments.length} investic v hodnotě ${formatMoney(total)} Kč — celkový výnos ${formatMoney(totalReturn)} Kč (${returnPct.toFixed(1)}%). Vede: ${bestName} na +${bestPct}%. Nejslabší: ${worstName} na ${worstPct}%.`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'money-tree-growing',
            };
        }

        return {
            text: tr(
                `${investments.length} investments valued at ${formatMoney(total)} Kč (${returnPct.toFixed(1)}% overall return). ${bestName} leads at ${bestPct}%, while ${worstName} trails at ${worstPct}%. Review the laggards for rebalancing opportunities.`,
                `${investments.length} investic v hodnotě ${formatMoney(total)} Kč (celkový výnos ${returnPct.toFixed(1)}%). Vede ${bestName} s ${bestPct}%, zatímco ${worstName} zaostává na ${worstPct}%. Projdi zaostávající a zvaž rebalancování.`,
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    if (totalReturn > 0) {
        return {
            text: pick([
                tr(
                    `${investments.length} investment${investments.length !== 1 ? 's' : ''} worth ${formatMoney(total)} Kč — up ${formatMoney(totalReturn)} Kč (${returnPct.toFixed(1)}%) from cost basis. Your money is working!`,
                    `${investments.length} ${investments.length === 1 ? 'investice' : investments.length < 5 ? 'investice' : 'investic'} v hodnotě ${formatMoney(total)} Kč — nahoru o ${formatMoney(totalReturn)} Kč (${returnPct.toFixed(1)}%) od ceny pořízení. Tvé peníze pracují!`,
                ),
                tr(
                    `Investment portfolio: ${formatMoney(total)} Kč with a ${returnPct.toFixed(1)}% return. That's ${formatMoney(totalReturn)} Kč in gains across ${investments.length} position${investments.length !== 1 ? 's' : ''}.`,
                    `Investiční portfolio: ${formatMoney(total)} Kč s ${returnPct.toFixed(1)}% výnosem. To je ${formatMoney(totalReturn)} Kč zisku napříč ${investments.length} ${investments.length === 1 ? 'pozicí' : 'pozicemi'}.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'money-tree-growing',
        };
    }

    return {
        text: pick([
            tr(
                `${investments.length} investment${investments.length !== 1 ? 's' : ''} worth ${formatMoney(total)} Kč. ${costBasis > 0 ? `Overall return: ${returnPct.toFixed(1)}%.` : ''} Diversification is key to long-term growth!`,
                `${investments.length} ${investments.length === 1 ? 'investice' : 'investic'} v hodnotě ${formatMoney(total)} Kč. ${costBasis > 0 ? `Celkový výnos: ${returnPct.toFixed(1)}%.` : ''} Diverzifikace je klíč k dlouhodobému růstu!`,
            ),
            tr(
                `Investment portfolio: ${formatMoney(total)} Kč across ${investments.length} position${investments.length !== 1 ? 's' : ''}. Patience and consistency build wealth over time.`,
                `Investiční portfolio: ${formatMoney(total)} Kč napříč ${investments.length} ${investments.length === 1 ? 'pozicí' : 'pozicemi'}. Trpělivost a důslednost v čase budují bohatství.`,
            ),
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
            text: tr(
                "No investment allocation to show yet. Add investments to see how your funds are distributed!",
                "Zatím není co zobrazit. Přidej investice a uvidíš, jak jsou tvé peníze rozloženy!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'movie-clap',
        };
    }

    if (investments.length === 1) {
        return {
            text: pick([
                tr(
                    `All investment funds in one basket — ${investments[0].name || 'a single asset'}. Diversifying across multiple investments could reduce risk and smooth returns.`,
                    `Všechny investice v jednom koši — ${investments[0].name || 'jediné aktivum'}. Diverzifikace do víc investic by snížila riziko a vyrovnala výnosy.`,
                ),
                tr(
                    `Single investment: ${investments[0].name || 'one position'}. Even adding one more position type can meaningfully reduce concentration risk.`,
                    `Jedna investice: ${investments[0].name || 'jedna pozice'}. I přidání druhého typu významně sníží koncentrační riziko.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const total = investments.reduce((s, i) => s + Number(i.current_value || 0), 0);
    const sorted = [...investments].sort((a, b) => Number(b.current_value || 0) - Number(a.current_value || 0));
    const topPct = total > 0 ? (Number(sorted[0].current_value || 0) / total * 100) : 0;

    if (topPct > 60) {
        return {
            text: tr(
                `${sorted[0].name || 'Your largest position'} holds ${topPct.toFixed(0)}% of your investment allocation (${formatMoney(sorted[0].current_value || 0)} Kč of ${formatMoney(total)} Kč). Consider rebalancing — trimming the top holding and spreading across other positions can reduce risk.`,
                `${sorted[0].name || 'Tvá největší pozice'} drží ${topPct.toFixed(0)}% investiční alokace (${formatMoney(sorted[0].current_value || 0)} Kč z ${formatMoney(total)} Kč). Zvaž rebalanci — snížení top pozice a rozprostření do dalších sníží riziko.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (investments.length >= 3 && topPct < 40) {
        return {
            text: tr(
                `Well-balanced investment allocation across ${investments.length} positions totaling ${formatMoney(total)} Kč. No single position exceeds ${topPct.toFixed(0)}% — this diversification protects against individual asset downturns.`,
                `Dobře vyvážená alokace napříč ${investments.length} pozicemi v celkové hodnotě ${formatMoney(total)} Kč. Žádná pozice nepřesahuje ${topPct.toFixed(0)}% — tato diverzifikace chrání před propady jednotlivých aktiv.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            tr(
                `${investments.length} investments totaling ${formatMoney(total)} Kč. ${sorted[0].name || 'Top position'} leads at ${topPct.toFixed(0)}%. Regular rebalancing keeps your allocation aligned with goals.`,
                `${investments.length} investic v celkové hodnotě ${formatMoney(total)} Kč. Vede ${sorted[0].name || 'top pozice'} s ${topPct.toFixed(0)}%. Pravidelná rebalance drží alokaci v souladu s cíli.`,
            ),
            tr(
                `Investment allocation across ${investments.length} positions — ${formatMoney(total)} Kč total. Keep an eye on concentration; shift funds if one position grows too dominant.`,
                `Alokace investic napříč ${investments.length} pozicemi — celkem ${formatMoney(total)} Kč. Hlídej koncentraci; přesuň peníze, pokud jedna pozice příliš dominuje.`,
            ),
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
                tr(
                    "No stock holdings tracked yet. Add ETFs, individual stocks, or crypto positions to see performance analysis!",
                    "Zatím žádné akciové pozice. Přidej ETF, jednotlivé akcie nebo krypto a uvidíš analýzu výkonnosti!",
                ),
                tr(
                    "Start tracking your stock portfolio here! Add holdings to see best/worst performers and sector breakdowns.",
                    "Začni tu sledovat akciové portfolio! Přidej pozice a uvidíš nejlepší/nejhorší i rozpis dle sektorů.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'rocket-launch',
        };
    }

    const marketValue = stocks.reduce((s, h) => s + Number(h.market_value ?? h.total_cost ?? 0), 0);
    const { best, worst } = bestWorstPerformer(stocks);

    if (stockPnl && stockPnl.total_pnl > 0 && best && worst && stocks.length >= 2) {
        const bestName = best.name || best.ticker || 'Top stock';
        const worstName = worst.name || worst.ticker || 'Weakest stock';
        return {
            text: pick([
                tr(
                    `${stocks.length} holdings worth ${formatMoney(marketValue)} Kč with ${formatMoney(stockPnl.total_pnl)} Kč total P&L! Star performer: ${bestName} at +${(best.unrealized_gain_pct || 0).toFixed(1)}%. Laggard: ${worstName} at ${(worst.unrealized_gain_pct || 0).toFixed(1)}%.`,
                    `${stocks.length} pozic v hodnotě ${formatMoney(marketValue)} Kč s celkovým P&L ${formatMoney(stockPnl.total_pnl)} Kč! Hvězda: ${bestName} na +${(best.unrealized_gain_pct || 0).toFixed(1)}%. Zaostávající: ${worstName} na ${(worst.unrealized_gain_pct || 0).toFixed(1)}%.`,
                ),
                tr(
                    `Portfolio in the green! ${formatMoney(stockPnl.total_pnl)} Kč gains across ${stocks.length} positions. ${bestName} leads the way while ${worstName} needs watching.`,
                    `Portfolio v plusu! ${formatMoney(stockPnl.total_pnl)} Kč zisků napříč ${stocks.length} pozicemi. Cestu razí ${bestName}, ${worstName} potřebuje pozornost.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'rocket-launch',
        };
    }

    if (stockPnl && stockPnl.total_pnl < 0) {
        const worstName = worst?.name || worst?.ticker || 'Your weakest holding';
        return {
            text: pick([
                tr(
                    `${stocks.length} holdings, ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč in unrealized losses. ${worstName} is the biggest drag at ${(worst?.unrealized_gain_pct || 0).toFixed(1)}%. Markets are cyclical — patience pays.`,
                    `${stocks.length} pozic, nerealizované ztráty ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč. Největší zátěž je ${worstName} na ${(worst?.unrealized_gain_pct || 0).toFixed(1)}%. Trhy jsou cyklické — trpělivost se vyplácí.`,
                ),
                tr(
                    `Stocks are down ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč overall. ${best ? `${best.name || best.ticker} is holding up best at ${(best.unrealized_gain_pct || 0).toFixed(1)}%.` : ''} Stay the course.`,
                    `Akcie celkově dolů o ${formatMoney(Math.abs(stockPnl.total_pnl))} Kč. ${best ? `Nejlépe drží ${best.name || best.ticker} na ${(best.unrealized_gain_pct || 0).toFixed(1)}%.` : ''} Drž kurz.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'sinking-anchor',
        };
    }

    const sectors = {};
    for (const h of stocks) {
        const sec = h.sector || h.holding_type || 'other';
        sectors[sec] = (sectors[sec] || 0) + Number(h.market_value ?? h.total_cost ?? 0);
    }
    const sectorEntries = Object.entries(sectors).sort(([, a], [, b]) => b - a);

    if (sectorEntries.length >= 2) {
        return {
            text: tr(
                `${stocks.length} holdings across ${sectorEntries.length} sectors. Market value: ${formatMoney(marketValue)} Kč. Top sector: ${sectorEntries[0][0]} at ${formatMoney(sectorEntries[0][1])} Kč. ${best ? `Best performer: ${best.name || best.ticker}.` : ''}`,
                `${stocks.length} pozic napříč ${sectorEntries.length} sektory. Tržní hodnota: ${formatMoney(marketValue)} Kč. Vedoucí sektor: ${sectorEntries[0][0]} za ${formatMoney(sectorEntries[0][1])} Kč. ${best ? `Nejlépe si vede: ${best.name || best.ticker}.` : ''}`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'rocket-launch',
        };
    }

    return {
        text: pick([
            tr(
                `${stocks.length} stock holding${stocks.length !== 1 ? 's' : ''} with ${formatMoney(marketValue)} Kč market value. Track performance and spot opportunities!`,
                `${stocks.length} ${stocks.length === 1 ? 'akciová pozice' : stocks.length < 5 ? 'akciové pozice' : 'akciových pozic'} s tržní hodnotou ${formatMoney(marketValue)} Kč. Sleduj výkon a hledej příležitosti!`,
            ),
            tr(
                `Stock portfolio: ${formatMoney(marketValue)} Kč across ${stocks.length} position${stocks.length !== 1 ? 's' : ''}. Diversify across sectors for stability.`,
                `Akciové portfolio: ${formatMoney(marketValue)} Kč napříč ${stocks.length} ${stocks.length === 1 ? 'pozicí' : 'pozicemi'}. Diverzifikuj napříč sektory pro stabilitu.`,
            ),
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
            text: tr(
                "This chart tracks stock values over time. Add holdings to see trends, volatility, and draw-down periods!",
                "Tento graf sleduje hodnoty akcií v čase. Přidej pozice a uvidíš trendy, volatilitu i období poklesu!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const marketValue = stocks.reduce((s, h) => s + Number(h.market_value ?? h.total_cost ?? 0), 0);

    if (stockBreakdown && stockBreakdown.length >= 3) {
        const values = stockBreakdown.map(b => Number(b.total_value || b.market_value || 0));
        const trend = analyzeTrend(values);

        if (trend.direction === 'rising' && trend.strength === 'strong') {
            return {
                text: tr(
                    `Strong upward trend in your stock portfolio — up ${trend.changePercent.toFixed(1)}% over the period! ${trend.consecutive >= 2 ? `${trend.consecutive} consecutive growth periods.` : ''} Current value: ${formatMoney(marketValue)} Kč. Momentum is on your side.`,
                    `Silný růstový trend akciového portfolia — nahoru o ${trend.changePercent.toFixed(1)}% za období! ${trend.consecutive >= 2 ? `${trend.consecutive} po sobě jdoucích období růstu.` : ''} Aktuální hodnota: ${formatMoney(marketValue)} Kč. Moment je na tvé straně.`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'rising-arrow',
            };
        }

        if (trend.direction === 'falling' && trend.strength !== 'weak') {
            const peak = Math.max(...values);
            const drawdown = peak > 0 ? ((peak - marketValue) / peak * 100) : 0;
            return {
                text: tr(
                    `Stock portfolio showing a ${Math.abs(trend.changePercent).toFixed(1)}% decline from recent levels. ${drawdown > 5 ? `Current draw-down from peak: ${drawdown.toFixed(1)}%. ` : ''}Market value: ${formatMoney(marketValue)} Kč. Corrections are normal — watch for a reversal.`,
                    `Akciové portfolio klesá o ${Math.abs(trend.changePercent).toFixed(1)}% z nedávných úrovní. ${drawdown > 5 ? `Aktuální pokles z vrcholu: ${drawdown.toFixed(1)}%. ` : ''}Tržní hodnota: ${formatMoney(marketValue)} Kč. Korekce jsou normální — sleduj obrat.`,
                ),
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'telescope',
            };
        }

        if (trend.strength === 'weak') {
            return {
                text: tr(
                    `Stock portfolio has been relatively stable (${Math.abs(trend.changePercent).toFixed(1)}% change). Low volatility at ${formatMoney(marketValue)} Kč. Steady performance can be a sign of defensive holdings.`,
                    `Akciové portfolio je relativně stabilní (${Math.abs(trend.changePercent).toFixed(1)}% změna). Nízká volatilita na ${formatMoney(marketValue)} Kč. Stabilní výkon může znamenat defenzivní pozice.`,
                ),
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
            tr(
                `Stock trend chart — ${stocks.length} holdings worth ${formatMoney(marketValue)} Kč. Watch for sustained moves up or down to time rebalancing decisions.`,
                `Graf trendů akcií — ${stocks.length} pozic v hodnotě ${formatMoney(marketValue)} Kč. Sleduj trvalé pohyby nahoru či dolů pro rozhodnutí o rebalanci.`,
            ),
            tr(
                `Tracking ${stocks.length} positions over time. ${top?.ticker || top?.name || 'Your top holding'} leads the chart at ${formatMoney(Number(top?.market_value ?? top?.total_cost ?? 0))} Kč!`,
                `Sleduji ${stocks.length} pozic v čase. Vede ${top?.ticker || top?.name || 'tvá top pozice'} s ${formatMoney(Number(top?.market_value ?? top?.total_cost ?? 0))} Kč!`,
            ),
            tr(
                `Market value: ${formatMoney(marketValue)} Kč across ${stocks.length} positions. The trend line tells the story — look for draw-downs and rallies!`,
                `Tržní hodnota: ${formatMoney(marketValue)} Kč napříč ${stocks.length} pozicemi. Trendová čára vypráví příběh — hledej poklesy a rally!`,
            ),
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
            text: tr(
                "Stock type allocation will appear once you add holdings. Mix ETFs, individual stocks, and more for better diversification!",
                "Alokace podle typu se zobrazí, jakmile přidáš pozice. Mixuj ETF, jednotlivé akcie a další pro lepší diverzifikaci!",
            ),
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
        const name = typeNames[0] === 'etf' ? 'ETF' : typeNames[0].charAt(0).toUpperCase() + typeNames[0].slice(1);
        return {
            text: pick([
                tr(
                    `All ${stocks.length} holdings are ${name} (${formatMoney(totalValue)} Kč). Consider mixing in other types — adding individual stocks or bonds can provide different return profiles and reduce correlation risk.`,
                    `Všech ${stocks.length} pozic je ${name} (${formatMoney(totalValue)} Kč). Zvaž přidat další typy — jednotlivé akcie nebo dluhopisy nabízejí různé profily výnosů a sníží korelační riziko.`,
                ),
                tr(
                    `100% ${name} portfolio at ${formatMoney(totalValue)} Kč. While ${name} are great, adding a second asset type creates natural rebalancing opportunities.`,
                    `100% ${name} portfolio na ${formatMoney(totalValue)} Kč. Přestože ${name} jsou skvělé, přidání druhého typu aktiv vytvoří přirozené příležitosti k rebalanci.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const sortedTypes = Object.entries(typeValues).sort(([, a], [, b]) => b - a);
    const topType = sortedTypes[0];
    const topTypePct = totalValue > 0 ? (topType[1] / totalValue * 100) : 0;
    const topLabel = topType[0] === 'etf' ? 'ETF' : topType[0].charAt(0).toUpperCase() + topType[0].slice(1);

    if (topTypePct > 75) {
        return {
            text: tr(
                `${topLabel} dominates at ${topTypePct.toFixed(0)}% (${formatMoney(topType[1])} Kč). With ${typeNames.length} types total, consider shifting some allocation from ${topLabel} to the other${typeNames.length > 2 ? 's' : ''} for better balance.`,
                `${topLabel} dominuje na ${topTypePct.toFixed(0)}% (${formatMoney(topType[1])} Kč). Máš ${typeNames.length} typů — zvaž přesunout část alokace z ${topLabel} do ostatních pro lepší rovnováhu.`,
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                `Holdings spread across ${typeNames.length} types: ${sortedTypes.map(([t, v]) => `${t === 'etf' ? 'ETF' : t} (${(v / totalValue * 100).toFixed(0)}%)`).join(', ')}. Good type diversity reduces correlation risk!`,
                `Pozice rozložené do ${typeNames.length} typů: ${sortedTypes.map(([t, v]) => `${t === 'etf' ? 'ETF' : t} (${(v / totalValue * 100).toFixed(0)}%)`).join(', ')}. Dobrá různorodost typů snižuje korelační riziko!`,
            ),
            tr(
                `${typeNames.length} asset types in your stock portfolio — ${formatMoney(totalValue)} Kč total. Diversification across types is a smart strategy.`,
                `${typeNames.length} typů aktiv v akciovém portfoliu — celkem ${formatMoney(totalValue)} Kč. Diverzifikace napříč typy je chytrá strategie.`,
            ),
            tr(
                `Stock allocation: ${sortedTypes.map(([t]) => t === 'etf' ? 'ETF' : t).join(', ')} — ${stocks.length} positions across ${typeNames.length} categories. Well-rounded mix!`,
                `Alokace akcií: ${sortedTypes.map(([t]) => t === 'etf' ? 'ETF' : t).join(', ')} — ${stocks.length} pozic napříč ${typeNames.length} kategoriemi. Vyvážený mix!`,
            ),
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Stock P&L Section ───────────────────────────────────────────────────────
function stockPnlInsight(data) {
    const { stockPnl, summary } = data;

    if (!stockPnl) {
        return {
            text: tr(
                "Profit & Loss data loading... Trade stocks to see realized gains, losses, and dividend income here!",
                "Načítám data P&L... Obchoduj s akciemi a uvidíš tu realizované zisky, ztráty i dividendy!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    const trades = stockPnl.trades || [];
    const dividends = stockPnl.dividends || [];
    const totalPnl = stockPnl.total_pnl || 0;
    const totalDividends = dividends.reduce((s, d) => s + Number(d.amount || 0), 0);

    const stocks = summary?.stock_holdings || [];
    const costBasis = stocks.reduce((s, h) => s + Number(h.total_cost ?? 0), 0);
    const annualizedNoteEn = costBasis > 0 && totalPnl !== 0
        ? ` Annualized on cost basis: ~${((totalPnl / costBasis) * 12 * 100).toFixed(1)}%/yr.`
        : '';
    const annualizedNoteCs = costBasis > 0 && totalPnl !== 0
        ? ` Anualizováno k ceně pořízení: ~${((totalPnl / costBasis) * 12 * 100).toFixed(1)}%/rok.`
        : '';

    if (trades.length === 0 && dividends.length === 0) {
        return {
            text: pick([
                tr(
                    "No realized trades or dividends this month. Holding steady — sometimes patience is the best strategy!",
                    "Tento měsíc žádné realizované obchody ani dividendy. Drží se stabilně — někdy je trpělivost nejlepší strategie!",
                ),
                tr(
                    "Quiet month for P&L. No trades, no dividends. Sometimes the best move is no move at all.",
                    "Tichý měsíc pro P&L. Žádné obchody, žádné dividendy. Někdy je nejlepší tah žádný tah.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    if (totalPnl > 0 && totalDividends > 0) {
        const combined = totalPnl + totalDividends;
        const divCoverage = totalPnl > 0 ? (totalDividends / combined * 100) : 0;
        return {
            text: pick([
                tr(
                    `Great month! ${formatMoney(totalPnl)} Kč in trade gains + ${formatMoney(totalDividends)} Kč in dividends = ${formatMoney(combined)} Kč total income. Dividends cover ${divCoverage.toFixed(0)}% of your realized income.${annualizedNoteEn}`,
                    `Skvělý měsíc! ${formatMoney(totalPnl)} Kč zisků z obchodů + ${formatMoney(totalDividends)} Kč dividend = ${formatMoney(combined)} Kč celkového příjmu. Dividendy tvoří ${divCoverage.toFixed(0)}% tvého realizovaného příjmu.${annualizedNoteCs}`,
                ),
                tr(
                    `Profitable month from ${trades.length} trade${trades.length !== 1 ? 's' : ''} and ${dividends.length} dividend${dividends.length !== 1 ? 's' : ''}. Total: ${formatMoney(combined)} Kč. Passive income (dividends) is ${formatMoney(totalDividends)} Kč.${annualizedNoteEn}`,
                    `Ziskový měsíc z ${trades.length} ${trades.length === 1 ? 'obchodu' : trades.length < 5 ? 'obchodů' : 'obchodů'} a ${dividends.length} ${dividends.length === 1 ? 'dividendy' : dividends.length < 5 ? 'dividend' : 'dividend'}. Celkem: ${formatMoney(combined)} Kč. Pasivní příjem (dividendy) ${formatMoney(totalDividends)} Kč.${annualizedNoteCs}`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'raining-coins',
        };
    }

    if (totalPnl > 0) {
        return {
            text: pick([
                tr(
                    `${formatMoney(totalPnl)} Kč realized gains from ${trades.length} trade${trades.length !== 1 ? 's' : ''}. Well-timed exits!${annualizedNoteEn}`,
                    `${formatMoney(totalPnl)} Kč realizovaných zisků z ${trades.length} ${trades.length === 1 ? 'obchodu' : 'obchodů'}. Dobře načasované výstupy!${annualizedNoteCs}`,
                ),
                tr(
                    `Positive P&L: +${formatMoney(totalPnl)} Kč this month. That's solid execution across ${trades.length} trade${trades.length !== 1 ? 's' : ''}.${annualizedNoteEn}`,
                    `Pozitivní P&L: +${formatMoney(totalPnl)} Kč tento měsíc. To je solidní provedení napříč ${trades.length} ${trades.length === 1 ? 'obchodem' : 'obchody'}.${annualizedNoteCs}`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'raining-coins',
        };
    }

    if (totalPnl < 0) {
        const lossNoteEn = totalDividends > 0
            ? ` On the bright side, ${formatMoney(totalDividends)} Kč in dividends offset some of the loss.`
            : '';
        const lossNoteCs = totalDividends > 0
            ? ` Na světlé straně ${formatMoney(totalDividends)} Kč dividend vyrovnalo část ztráty.`
            : '';
        return {
            text: pick([
                tr(
                    `${formatMoney(Math.abs(totalPnl))} Kč in realized losses from ${trades.length} trade${trades.length !== 1 ? 's' : ''}. Not every trade wins — learn, adapt, and move forward.${lossNoteEn}`,
                    `${formatMoney(Math.abs(totalPnl))} Kč realizovaných ztrát z ${trades.length} ${trades.length === 1 ? 'obchodu' : 'obchodů'}. Ne každý obchod vyhraje — uč se, přizpůsob a jdi dál.${lossNoteCs}`,
                ),
                tr(
                    `Losses of ${formatMoney(Math.abs(totalPnl))} Kč this month. It's part of the journey — the best investors review and improve.${lossNoteEn}`,
                    `Ztráty ${formatMoney(Math.abs(totalPnl))} Kč tento měsíc. Je to součást cesty — nejlepší investoři se učí a zlepšují.${lossNoteCs}`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    if (totalDividends > 0) {
        return {
            text: pick([
                tr(
                    `${formatMoney(totalDividends)} Kč in dividends from ${dividends.length} payment${dividends.length !== 1 ? 's' : ''}. Pure passive income! ${costBasis > 0 ? `That's a ${(totalDividends / costBasis * 12 * 100).toFixed(2)}% annualized dividend yield on cost.` : 'Your stocks are paying you back!'}`,
                    `${formatMoney(totalDividends)} Kč dividend z ${dividends.length} ${dividends.length === 1 ? 'platby' : 'plateb'}. Čistý pasivní příjem! ${costBasis > 0 ? `To je anualizovaný dividendový výnos ${(totalDividends / costBasis * 12 * 100).toFixed(2)}% na cenu pořízení.` : 'Tvé akcie ti vrací peníze!'}`,
                ),
                tr(
                    `Dividend income: ${formatMoney(totalDividends)} Kč from ${dividends.length} source${dividends.length !== 1 ? 's' : ''}. Reinvesting dividends compounds growth over time.`,
                    `Dividendový příjem: ${formatMoney(totalDividends)} Kč z ${dividends.length} ${dividends.length === 1 ? 'zdroje' : 'zdrojů'}. Reinvestice dividend zvyšuje růst v čase.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'raining-coins',
        };
    }

    return {
        text: tr(
            `${trades.length} trade${trades.length !== 1 ? 's' : ''} and ${dividends.length} dividend${dividends.length !== 1 ? 's' : ''} this month. Net P&L: ${formatMoney(totalPnl)} Kč. Review the details for per-trade analysis!`,
            `${trades.length} ${trades.length === 1 ? 'obchod' : 'obchodů'} a ${dividends.length} ${dividends.length === 1 ? 'dividenda' : 'dividend'} tento měsíc. Čisté P&L: ${formatMoney(totalPnl)} Kč. Projdi detaily pro analýzu každého obchodu!`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'confetti',
    };
}

// ── Portfolio Trend ─────────────────────────────────────────────────────────
function portfolioTrendInsight(data) {
    const { summary } = data;

    if (!summary || summary.total_portfolio === 0) {
        return {
            text: tr(
                "Your portfolio composition trend will appear here once you have assets tracked over multiple months. Add savings, investments, or properties to get started!",
                "Trend složení portfolia se zobrazí, jakmile budeš mít sledovaná aktiva po víc měsíců. Přidej úspory, investice nebo nemovitosti a začni!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const total = summary.total_portfolio;
    const comp = compositionPcts(summary);
    const allocation = summary.allocation || [];

    if (allocation.length >= 2) {
        const values = allocation.map(a => a.value || a.amount || 0);
        const trend = analyzeTrend(values);

        if (trend.direction === 'rising') {
            return {
                text: tr(
                    `Portfolio composition trending upward — ${formatMoney(total)} Kč total, up ${trend.changePercent.toFixed(1)}% over the period. The mix is ${comp.savingsPct.toFixed(0)}% savings, ${comp.stocksPct.toFixed(0)}% stocks, ${comp.propertiesPct.toFixed(0)}% properties. Growth across multiple asset classes is the ideal scenario.`,
                    `Složení portfolia roste — celkem ${formatMoney(total)} Kč, nahoru o ${trend.changePercent.toFixed(1)}% za období. Mix je ${comp.savingsPct.toFixed(0)}% úspory, ${comp.stocksPct.toFixed(0)}% akcie, ${comp.propertiesPct.toFixed(0)}% nemovitosti. Růst napříč více třídami aktiv je ideální.`,
                ),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'telescope',
            };
        }

        if (trend.direction === 'falling') {
            return {
                text: tr(
                    `Overall portfolio composition shows a ${Math.abs(trend.changePercent).toFixed(1)}% decline recently. Currently at ${formatMoney(total)} Kč. Check which asset class is driving the pullback — savings (${comp.savingsPct.toFixed(0)}%), stocks (${comp.stocksPct.toFixed(0)}%), or properties (${comp.propertiesPct.toFixed(0)}%).`,
                    `Celkové složení portfolia kleslo o ${Math.abs(trend.changePercent).toFixed(1)}% nedávno. Aktuálně ${formatMoney(total)} Kč. Zkontroluj, která třída aktiv za poklesem stojí — úspory (${comp.savingsPct.toFixed(0)}%), akcie (${comp.stocksPct.toFixed(0)}%), nebo nemovitosti (${comp.propertiesPct.toFixed(0)}%).`,
                ),
                type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'telescope',
            };
        }
    }

    if (allocation.length >= 3) {
        const prediction = predictNextMonth(
            allocation.map(a => ({ value: a.value || a.amount || 0 })),
            'value'
        );
        if (prediction.confidence !== 'low' && prediction.predicted > 0) {
            return {
                text: tr(
                    `Portfolio at ${formatMoney(total)} Kč. Based on your trend, next month's projection is ~${formatMoney(prediction.predicted)} Kč (${prediction.confidence} confidence). Current split: savings ${comp.savingsPct.toFixed(0)}%, stocks ${comp.stocksPct.toFixed(0)}%, properties ${comp.propertiesPct.toFixed(0)}%.`,
                    `Portfolio na ${formatMoney(total)} Kč. Podle trendu je projekce příštího měsíce ~${formatMoney(prediction.predicted)} Kč (${prediction.confidence} jistota). Aktuální rozdělení: úspory ${comp.savingsPct.toFixed(0)}%, akcie ${comp.stocksPct.toFixed(0)}%, nemovitosti ${comp.propertiesPct.toFixed(0)}%.`,
                ),
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
                envEffect: 'telescope',
            };
        }
    }

    return {
        text: pick([
            tr(
                `Portfolio composition over time — ${formatMoney(total)} Kč across ${allocation.length} asset ${allocation.length === 1 ? 'class' : 'classes'}. Watch how the balance shifts month over month. Savings: ${comp.savingsPct.toFixed(0)}%, Stocks: ${comp.stocksPct.toFixed(0)}%, Properties: ${comp.propertiesPct.toFixed(0)}%.`,
                `Složení portfolia v čase — ${formatMoney(total)} Kč napříč ${allocation.length} ${allocation.length === 1 ? 'třídou aktiv' : 'třídami aktiv'}. Sleduj, jak se rovnováha mění měsíc od měsíce. Úspory: ${comp.savingsPct.toFixed(0)}%, Akcie: ${comp.stocksPct.toFixed(0)}%, Nemovitosti: ${comp.propertiesPct.toFixed(0)}%.`,
            ),
            tr(
                `Tracking your ${formatMoney(total)} Kč portfolio mix over time. This chart reveals how your wealth allocation evolves. Consistent tracking is the foundation of smart portfolio management.`,
                `Sleduji mix tvého portfolia ${formatMoney(total)} Kč v čase. Tento graf ukazuje, jak se vyvíjí tvá alokace. Důsledné sledování je základ chytré správy portfolia.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Property Trend ──────────────────────────────────────────────────────────
function propertyTrendInsight(data) {
    const { summary } = data;
    const properties = summary?.properties || [];

    if (properties.length === 0) {
        return {
            text: tr(
                "No properties tracked yet. Add real estate holdings to see appreciation rates and value trends over time!",
                "Zatím žádné nemovitosti. Přidej realitní majetek a uvidíš míry zhodnocení i trendy hodnot v čase!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'house-building',
        };
    }

    const totalValue = summary.total_properties_value || properties.reduce((s, p) => s + Number(p.current_value || p.value || 0), 0);
    const totalCost = properties.reduce((s, p) => s + Number(p.purchase_price || p.cost_basis || 0), 0);
    const appreciation = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    if (totalCost > 0 && appreciation > 0) {
        const gainAmount = totalValue - totalCost;
        return {
            text: pick([
                tr(
                    `Property portfolio has appreciated ${appreciation.toFixed(1)}% — from ${formatMoney(totalCost)} Kč cost basis to ${formatMoney(totalValue)} Kč current value. That's ${formatMoney(gainAmount)} Kč in equity growth across ${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}.`,
                    `Nemovitostní portfolio zhodnotilo o ${appreciation.toFixed(1)}% — z ceny pořízení ${formatMoney(totalCost)} Kč na aktuální hodnotu ${formatMoney(totalValue)} Kč. To je ${formatMoney(gainAmount)} Kč růstu vlastního kapitálu napříč ${properties.length} ${properties.length === 1 ? 'nemovitostí' : properties.length < 5 ? 'nemovitostmi' : 'nemovitostmi'}.`,
                ),
                tr(
                    `Real estate is up ${appreciation.toFixed(1)}% overall! ${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'} worth ${formatMoney(totalValue)} Kč, an increase of ${formatMoney(gainAmount)} Kč from purchase prices. Property tends to be a steady long-term wealth builder.`,
                    `Nemovitosti celkem nahoru o ${appreciation.toFixed(1)}%! ${properties.length} ${properties.length === 1 ? 'nemovitost' : properties.length < 5 ? 'nemovitosti' : 'nemovitostí'} v hodnotě ${formatMoney(totalValue)} Kč, růst o ${formatMoney(gainAmount)} Kč od pořízení. Nemovitosti bývají stabilní dlouhodobý nástroj budování bohatství.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'house-building',
        };
    }

    if (totalCost > 0 && appreciation < 0) {
        return {
            text: tr(
                `Properties currently valued at ${formatMoney(totalValue)} Kč — ${Math.abs(appreciation).toFixed(1)}% below purchase prices (${formatMoney(totalCost)} Kč). Real estate markets can be cyclical; long-term holders typically recover and benefit from appreciation.`,
                `Nemovitosti aktuálně oceněny na ${formatMoney(totalValue)} Kč — o ${Math.abs(appreciation).toFixed(1)}% pod cenami pořízení (${formatMoney(totalCost)} Kč). Realitní trhy jsou cyklické; dlouhodobí držitelé obvykle vyzískají zpět a budou těžit z následného zhodnocení.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    if (summary.delta_properties_value && summary.delta_properties_value !== 0) {
        const direction = summary.delta_properties_value > 0 ? 'up' : 'down';
        const directionCs = summary.delta_properties_value > 0 ? 'nahoru' : 'dolů';
        return {
            text: tr(
                `Property values ${direction} ${formatMoney(Math.abs(summary.delta_properties_value))} Kč recently. Total: ${formatMoney(totalValue)} Kč across ${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}. Real estate provides both appreciation potential and portfolio stability.`,
                `Hodnoty nemovitostí ${directionCs} o ${formatMoney(Math.abs(summary.delta_properties_value))} Kč nedávno. Celkem: ${formatMoney(totalValue)} Kč napříč ${properties.length} ${properties.length === 1 ? 'nemovitostí' : 'nemovitostmi'}. Nemovitosti nabízejí zhodnocení i stabilitu portfolia.`,
            ),
            type: direction === 'up' ? 'positive' : 'warning',
            expression: direction === 'up' ? 'happy' : 'concerned',
            mouth: direction === 'up' ? 'smile' : 'neutral',
            animation: direction === 'up' ? 'hop' : 'idle',
            envEffect: 'house-building',
        };
    }

    return {
        text: pick([
            tr(
                `${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'} tracked, valued at ${formatMoney(totalValue)} Kč. Property appreciation tends to be steady — this chart reveals the trajectory.`,
                `Sleduji ${properties.length} ${properties.length === 1 ? 'nemovitost' : properties.length < 5 ? 'nemovitosti' : 'nemovitostí'} v hodnotě ${formatMoney(totalValue)} Kč. Zhodnocení nemovitostí bývá stabilní — tento graf ukazuje trajektorii.`,
            ),
            tr(
                `Real estate portfolio: ${formatMoney(totalValue)} Kč. Track appreciation rates here and see how your properties contribute to overall wealth growth.`,
                `Nemovitostní portfolio: ${formatMoney(totalValue)} Kč. Sleduj tu míry zhodnocení a uvidíš, jak tvé nemovitosti přispívají k celkovému růstu bohatství.`,
            ),
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'house-building',
    };
}

// ── Properties Details ──────────────────────────────────────────────────────
function propertiesInsight(data) {
    const { summary } = data;
    const properties = summary?.properties || [];

    if (properties.length === 0) {
        return {
            text: tr(
                "No properties in your portfolio yet. Add real estate — apartments, houses, land — to track values and see how they fit in your wealth picture!",
                "Zatím žádné nemovitosti v portfoliu. Přidej reality — byty, domy, pozemky — a sleduj jejich hodnotu i to, jak zapadají do celkového obrazu bohatství!",
            ),
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
                text: tr(
                    `${propName} is valued at ${formatMoney(propValue)} Kč — up ${propGain.toFixed(1)}% from purchase price of ${formatMoney(propCost)} Kč. That's ${formatMoney(propValue - propCost)} Kč in equity growth. Single-property portfolios benefit from adding a second asset for diversification.`,
                    `${propName} je oceněna na ${formatMoney(propValue)} Kč — nahoru o ${propGain.toFixed(1)}% z pořizovací ceny ${formatMoney(propCost)} Kč. To je růst vlastního kapitálu o ${formatMoney(propValue - propCost)} Kč. Jednoprvkové portfolio by prospělo přidáním druhého aktiva pro diverzifikaci.`,
                ),
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
                envEffect: 'house-building',
            };
        }

        return {
            text: tr(
                `${propName} valued at ${formatMoney(propValue)} Kč. ${propCost > 0 ? `Purchased for ${formatMoney(propCost)} Kč.` : ''} A single property is a great start — it adds stability and real-asset exposure to your portfolio.`,
                `${propName} oceněna na ${formatMoney(propValue)} Kč. ${propCost > 0 ? `Koupeno za ${formatMoney(propCost)} Kč.` : ''} Jedna nemovitost je skvělý začátek — dodá portfoliu stabilitu a expozici v reálných aktivech.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    const sorted = [...properties].sort((a, b) =>
        Number(b.current_value || b.value || 0) - Number(a.current_value || a.value || 0)
    );
    const topProp = sorted[0];
    const topValue = Number(topProp.current_value || topProp.value || 0);
    const topPct = totalValue > 0 ? (topValue / totalValue * 100) : 0;
    const topName = topProp.name || topProp.address || 'Top property';
    const avgValue = Math.round(totalValue / properties.length);

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
            text: tr(
                `${properties.length} properties totaling ${formatMoney(totalValue)} Kč (avg ${formatMoney(avgValue)} Kč each). ${topName} is the most valuable at ${formatMoney(topValue)} Kč (${topPct.toFixed(0)}% of real estate). Best appreciation: ${bestName} at +${bestProp.gainPct.toFixed(1)}%.`,
                `${properties.length} nemovitostí v hodnotě ${formatMoney(totalValue)} Kč (průměr ${formatMoney(avgValue)} Kč každá). Nejcennější je ${topName} na ${formatMoney(topValue)} Kč (${topPct.toFixed(0)}% nemovitostí). Nejlepší zhodnocení: ${bestName} na +${bestProp.gainPct.toFixed(1)}%.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    return {
        text: pick([
            tr(
                `${properties.length} properties worth ${formatMoney(totalValue)} Kč total. ${topName} leads at ${formatMoney(topValue)} Kč (${topPct.toFixed(0)}%). Average property value: ${formatMoney(avgValue)} Kč.`,
                `${properties.length} nemovitostí v celkové hodnotě ${formatMoney(totalValue)} Kč. Vede ${topName} s ${formatMoney(topValue)} Kč (${topPct.toFixed(0)}%). Průměrná hodnota nemovitosti: ${formatMoney(avgValue)} Kč.`,
            ),
            tr(
                `Real estate portfolio: ${properties.length} properties, ${formatMoney(totalValue)} Kč combined. Your largest is ${topName} at ${formatMoney(topValue)} Kč. Property is a cornerstone of wealth diversification.`,
                `Nemovitostní portfolio: ${properties.length} nemovitostí, dohromady ${formatMoney(totalValue)} Kč. Největší je ${topName} za ${formatMoney(topValue)} Kč. Nemovitosti jsou kamenem diverzifikace bohatství.`,
            ),
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'house-building',
    };
}

// ── Action Buttons (tab-specific) ───────────────────────────────────────────
function addSavingsBtnInsight(data) {
    const { summary } = data;
    const accounts = summary?.savings_accounts || [];
    const total = summary?.total_savings || 0;

    if (accounts.length === 0) {
        return {
            text: tr(
                "Add your first savings account! Bank account, term deposit, emergency fund — Zumi tracks them all.",
                "Přidej svůj první spořicí účet! Bankovní účet, termínovaný vklad, rezerva — Zumi sleduje všechny.",
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'piggy-filling',
        };
    }

    return {
        text: tr(
            `${accounts.length} savings account${accounts.length === 1 ? '' : 's'} totaling ${formatMoney(total)} Kč. Click to add another — diversification across banks is smart!`,
            `${accounts.length} ${accounts.length === 1 ? 'spořicí účet' : accounts.length < 5 ? 'spořicí účty' : 'spořicích účtů'} za celkem ${formatMoney(total)} Kč. Klikni a přidej další — diverzifikace mezi bankami je chytrá!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
        envEffect: 'piggy-filling',
    };
}

function addPropertyBtnInsight(data) {
    const { summary } = data;
    const properties = summary?.properties || [];

    if (properties.length === 0) {
        return {
            text: tr(
                "Track a property investment! Apartments, houses, land — Zumi estimates value and tracks appreciation over time.",
                "Sleduj investiční nemovitost! Byty, domy, pozemky — Zumi odhadne hodnotu a sleduje zhodnocení v čase.",
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'house-building',
        };
    }

    return {
        text: tr(
            `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} in your portfolio. Add another to build long-term wealth!`,
            `${properties.length} ${properties.length === 1 ? 'nemovitost' : properties.length < 5 ? 'nemovitosti' : 'nemovitostí'} v portfoliu. Přidej další a buduj dlouhodobé bohatství!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
        envEffect: 'house-building',
    };
}

function addStockBtnInsight(data) {
    const { summary } = data;
    const holdings = summary?.stock_holdings || [];

    if (holdings.length === 0) {
        return {
            text: tr(
                "Add your first stock holding! Track tickers, shares, average cost — or import a Revolut statement for auto-sync.",
                "Přidej svou první akciovou pozici! Sleduj tickery, počet akcií, průměrnou cenu — nebo naimportuj Revolut výpis pro automatickou synchronizaci.",
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'rising-arrow',
        };
    }

    return {
        text: tr(
            `${holdings.length} position${holdings.length === 1 ? '' : 's'} tracked. Click to add a new stock, ETF, bond, or crypto holding!`,
            `Sleduji ${holdings.length} ${holdings.length === 1 ? 'pozici' : 'pozic'}. Klikni a přidej novou akcii, ETF, dluhopis nebo krypto!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
        envEffect: 'rising-arrow',
    };
}

function portMonthPickerInsight(data) {
    const { selectedMonth, summary } = data;
    const isHistorical = summary?.is_historical;

    if (isHistorical) {
        return {
            text: tr(
                `Viewing historical snapshot for ${selectedMonth}. Your portfolio was ${formatMoney(summary.total_portfolio || 0)} Kč at that time. Hop back to the current month to make changes!`,
                `Prohlížíš historický snímek pro ${selectedMonth}. Tvé portfolio tehdy bylo ${formatMoney(summary.total_portfolio || 0)} Kč. Skoč zpět na aktuální měsíc pro úpravy!`,
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    return {
        text: tr(
            "Time travel through your portfolio! Pick any month to see how your wealth looked back then.",
            "Cestuj časem svým portfoliem! Vyber jakýkoli měsíc a uvidíš, jak tehdy tvé bohatství vypadalo.",
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'telescope',
    };
}

// ── Individual KPI Cards (sub-zones) ────────────────────────────────────────
function kpiTotalInsight(data) {
    const { summary } = data;
    if (!summary) return null;
    const total = summary.total_portfolio || 0;
    const previous = summary.previous_total_portfolio;
    const delta = previous != null ? total - previous : null;

    if (total === 0) {
        return {
            text: tr(
                "Your net worth starts here. Add a savings account, a stock, or a property to build the picture.",
                "Tvé čisté jmění začíná tady. Přidej spořicí účet, akcii nebo nemovitost a postav obraz.",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (delta != null && delta > 0) {
        const pct = previous > 0 ? (delta / previous * 100) : 0;
        return {
            text: tr(
                `${formatMoney(total)} Kč net worth — up ${formatMoney(delta)} Kč (${pct.toFixed(1)}%) this month! Click for the full breakdown.`,
                `${formatMoney(total)} Kč čisté jmění — nahoru o ${formatMoney(delta)} Kč (${pct.toFixed(1)}%) tento měsíc! Klikni pro kompletní rozpis.`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'treasure-chest',
        };
    }
    if (delta != null && delta < 0) {
        return {
            text: tr(
                `${formatMoney(total)} Kč total, down ${formatMoney(Math.abs(delta))} Kč from last month. Click for details — markets move, stay the course.`,
                `${formatMoney(total)} Kč celkem, dolů o ${formatMoney(Math.abs(delta))} Kč oproti minulému měsíci. Klikni pro detaily — trhy se hýbou, drž kurz.`,
            ),
            type: 'neutral', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    return {
        text: tr(
            `${formatMoney(total)} Kč net worth — click to see the breakdown across savings, stocks, and properties!`,
            `${formatMoney(total)} Kč čisté jmění — klikni a uvidíš rozpis napříč úsporami, akciemi a nemovitostmi!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
        envEffect: 'golden-sparkles',
    };
}

function kpiSavingsCardInsight(data) {
    const { summary } = data;
    if (!summary) return null;
    const total = summary.total_savings || 0;
    const previous = summary.previous_total_savings;
    const delta = previous != null ? total - previous : null;
    const accounts = summary.savings_accounts || [];

    if (total === 0) {
        return {
            text: tr(
                "No savings tracked yet. Upload a savings statement or add an account manually — every koruna counts!",
                "Zatím žádné úspory. Nahraj spořicí výpis nebo přidej účet ručně — každá koruna se počítá!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (delta != null && delta > 0) {
        return {
            text: tr(
                `${formatMoney(total)} Kč across ${accounts.length} account${accounts.length === 1 ? '' : 's'} — up ${formatMoney(delta)} Kč this month! Savings are growing. 🐇`,
                `${formatMoney(total)} Kč napříč ${accounts.length} ${accounts.length === 1 ? 'účtem' : 'účty'} — nahoru o ${formatMoney(delta)} Kč tento měsíc! Úspory rostou. 🐇`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'piggy-filling',
        };
    }
    if (delta != null && delta < 0) {
        return {
            text: tr(
                `${formatMoney(total)} Kč in savings — down ${formatMoney(Math.abs(delta))} Kč from last month. Was this a planned withdrawal?`,
                `${formatMoney(total)} Kč v úsporách — dolů o ${formatMoney(Math.abs(delta))} Kč oproti minulému měsíci. Byl to plánovaný výběr?`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: tr(
            `${formatMoney(total)} Kč in savings across ${accounts.length} account${accounts.length === 1 ? '' : 's'}. Safe, liquid, ready for anything!`,
            `${formatMoney(total)} Kč v úsporách napříč ${accounts.length} ${accounts.length === 1 ? 'účtem' : 'účty'}. Bezpečné, likvidní, připravené na cokoli!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'piggy-filling',
    };
}

function kpiStocksCardInsight(data) {
    const { summary } = data;
    if (!summary) return null;
    const total = summary.total_stocks_value || 0;
    const gain = summary.stocks_gain_loss || 0;
    const gainPct = summary.stocks_gain_loss_pct || 0;
    const holdings = summary.stock_holdings || [];

    if (total === 0 && holdings.length === 0) {
        return {
            text: tr(
                "No stocks yet. Import a Revolut statement or add holdings manually to start tracking.",
                "Zatím žádné akcie. Naimportuj Revolut výpis nebo přidej pozice ručně a začni sledovat.",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (gain > 0 && gainPct > 10) {
        return {
            text: tr(
                `${formatMoney(total)} Kč in ${holdings.length} position${holdings.length === 1 ? '' : 's'} — ${gainPct.toFixed(1)}% up on cost basis (+${formatMoney(gain)} Kč). Nicely in the green!`,
                `${formatMoney(total)} Kč v ${holdings.length} ${holdings.length === 1 ? 'pozici' : 'pozicích'} — ${gainPct.toFixed(1)}% nahoru od ceny pořízení (+${formatMoney(gain)} Kč). Pěkně v plusu!`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'rising-arrow',
        };
    }
    if (gain < 0 && gainPct < -10) {
        return {
            text: tr(
                `${formatMoney(total)} Kč in stocks — ${Math.abs(gainPct).toFixed(1)}% below cost basis. Unrealized losses of ${formatMoney(Math.abs(gain))} Kč. Long-term holders ride these out.`,
                `${formatMoney(total)} Kč v akciích — ${Math.abs(gainPct).toFixed(1)}% pod cenou pořízení. Nerealizované ztráty ${formatMoney(Math.abs(gain))} Kč. Dlouhodobí držitelé to přečkají.`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'umbrella-open',
        };
    }

    return {
        text: tr(
            `${formatMoney(total)} Kč across ${holdings.length} stock position${holdings.length === 1 ? '' : 's'}. Click for currency breakdown!`,
            `${formatMoney(total)} Kč napříč ${holdings.length} ${holdings.length === 1 ? 'akciovou pozicí' : 'akciovými pozicemi'}. Klikni pro měnový rozpis!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

function kpiPropertiesCardInsight(data) {
    const { summary } = data;
    if (!summary) return null;
    const total = summary.total_properties_value || 0;
    const cost = summary.total_properties_cost || 0;
    const properties = summary.properties || [];

    if (total === 0 && properties.length === 0) {
        return {
            text: tr(
                "No properties tracked. Add an apartment, house, or land investment to see appreciation over time.",
                "Žádné sledované nemovitosti. Přidej byt, dům nebo pozemek a uvidíš zhodnocení v čase.",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const gain = total - cost;
    if (cost > 0 && gain > 0) {
        const gainPct = (gain / cost) * 100;
        return {
            text: tr(
                `${formatMoney(total)} Kč in ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} — ${gainPct.toFixed(1)}% appreciation (+${formatMoney(gain)} Kč). Real estate is working for you!`,
                `${formatMoney(total)} Kč v ${properties.length} ${properties.length === 1 ? 'nemovitosti' : 'nemovitostech'} — zhodnocení ${gainPct.toFixed(1)}% (+${formatMoney(gain)} Kč). Nemovitosti pracují pro tebe!`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'house-building',
        };
    }

    return {
        text: tr(
            `${formatMoney(total)} Kč across ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'}. Click for the full breakdown!`,
            `${formatMoney(total)} Kč napříč ${properties.length} ${properties.length === 1 ? 'nemovitostí' : 'nemovitostmi'}. Klikni pro kompletní rozpis!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'house-building',
    };
}

function kpiPnlCardInsight(data) {
    const { stockPnl } = data;

    if (!stockPnl || stockPnl.total_realized_pnl_czk == null) {
        return {
            text: tr(
                "No realized P&L yet for this period. Upload a Revolut P&L statement to see closed trades and dividends!",
                "Pro toto období zatím žádné realizované P&L. Nahraj Revolut P&L výpis a uvidíš uzavřené obchody a dividendy!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    const realized = stockPnl.total_realized_pnl_czk;
    const trades = stockPnl.trades?.length || 0;
    const dividends = stockPnl.dividends?.length || 0;

    if (realized > 0) {
        return {
            text: tr(
                `+${formatMoney(realized)} Kč realized gains from ${trades} closed trade${trades === 1 ? '' : 's'}${dividends > 0 ? ` and ${dividends} dividend${dividends === 1 ? '' : 's'}` : ''}! Click for full P&L.`,
                `+${formatMoney(realized)} Kč realizovaných zisků z ${trades} ${trades === 1 ? 'uzavřeného obchodu' : 'uzavřených obchodů'}${dividends > 0 ? ` a ${dividends} ${dividends === 1 ? 'dividendy' : 'dividend'}` : ''}! Klikni pro úplné P&L.`,
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'raining-coins',
        };
    }

    if (realized < 0) {
        return {
            text: tr(
                `${formatMoney(realized)} Kč realized — closed trades in the red this period. Click for the full P&L breakdown — tax-loss harvesting opportunity?`,
                `${formatMoney(realized)} Kč realizováno — uzavřené obchody v minusu tohle období. Klikni pro úplný rozpis P&L — šance na daňovou optimalizaci ztrát?`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'rain-cloud',
        };
    }

    return {
        text: tr(
            `${formatMoney(realized)} Kč realized P&L — break-even this period. Click for trade details.`,
            `${formatMoney(realized)} Kč realizované P&L — vyrovnané období. Klikni pro detaily obchodů.`,
        ),
        type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Stock Buys Section ──────────────────────────────────────────────────────
function stockBuysInsight(data) {
    const { summary, selectedMonth } = data;
    const holdings = summary?.stock_holdings || [];

    if (holdings.length === 0) {
        return {
            text: tr(
                "No stock purchases yet this month. Recent buys will show up here once you import a statement.",
                "Tento měsíc zatím žádné akciové nákupy. Nedávné nákupy se tu objeví, jakmile naimportuješ výpis.",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    return {
        text: tr(
            `Recent stock purchases for ${selectedMonth || 'this month'}. Every buy moves your cost basis — stay disciplined!`,
            `Nedávné akciové nákupy za ${selectedMonth || 'tento měsíc'}. Každý nákup mění tvou cenu pořízení — zůstaň disciplinovaný/á!`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'treasure-chest',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'port-header': headerInsight,
    'port-kpi': kpiInsight,
    'port-kpi-total': kpiTotalInsight,
    'port-kpi-savings': kpiSavingsCardInsight,
    'port-kpi-stocks': kpiStocksCardInsight,
    'port-kpi-properties': kpiPropertiesCardInsight,
    'port-kpi-pnl': kpiPnlCardInsight,
    'port-tabs': tabsInsight,
    'port-month-picker': portMonthPickerInsight,
    'port-add-savings-btn': addSavingsBtnInsight,
    'port-add-property-btn': addPropertyBtnInsight,
    'port-add-stock-btn': addStockBtnInsight,
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
    'port-stock-buys': stockBuysInsight,
    'port-trend': portfolioTrendInsight,
    'port-property-trend': propertyTrendInsight,
    'port-properties': propertiesInsight,
};

export function generatePortfolioInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

export function portfolioPageSummary(data) {
    const summary = data.summary || data;
    const total = summary.total_portfolio || summary.totalPortfolio || 0;
    const savings = summary.total_savings || summary.savings || 0;
    const stocks = summary.total_stocks || summary.stocks || 0;
    const properties = summary.total_properties || summary.properties || 0;
    const delta = summary.delta_total || summary.deltaTotal || summary.portfolioChange || 0;

    if (!total || total === 0) {
        return {
            text: pick([
                tr(
                    "Your portfolio is empty — add savings accounts, stocks, or properties to start tracking!",
                    "Tvé portfolio je prázdné — přidej spořicí účty, akcie nebo nemovitosti a začni sledovat!",
                ),
                tr(
                    "No portfolio data yet. Track your assets here and watch your net worth grow.",
                    "Zatím žádná data portfolia. Sleduj tu svá aktiva a dívej se, jak roste tvé čisté jmění.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
        };
    }

    const partsEn = [];
    const partsCs = [];
    if (savings > 0) { partsEn.push(`savings ${formatMoney(savings)}`); partsCs.push(`úspory ${formatMoney(savings)}`); }
    if (stocks > 0) { partsEn.push(`stocks ${formatMoney(stocks)}`); partsCs.push(`akcie ${formatMoney(stocks)}`); }
    if (properties > 0) { partsEn.push(`property ${formatMoney(properties)}`); partsCs.push(`nemovitosti ${formatMoney(properties)}`); }
    const breakdownEn = partsEn.length > 0 ? partsEn.join(', ') : '';
    const breakdownCs = partsCs.length > 0 ? partsCs.join(', ') : '';

    if (delta > 0) {
        return {
            text: pick([
                tr(
                    `Portfolio at ${formatMoney(total)} — up ${formatMoney(delta)} vs last month! ${breakdownEn ? `Split: ${breakdownEn}.` : ''}`,
                    `Portfolio na ${formatMoney(total)} — nahoru o ${formatMoney(delta)} oproti minulému měsíci! ${breakdownCs ? `Rozdělení: ${breakdownCs}.` : ''}`,
                ),
                tr(
                    `${formatMoney(total)} total portfolio, growing by ${formatMoney(delta)}. ${properties > total * 0.7 ? 'Property-heavy — consider diversifying.' : 'Nice diversification!'}`,
                    `${formatMoney(total)} celkové portfolio, roste o ${formatMoney(delta)}. ${properties > total * 0.7 ? 'Nemovitostně těžké — zvaž diverzifikaci.' : 'Pěkná diverzifikace!'}`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'smile', animation: 'hop',
        };
    }

    if (delta < 0) {
        return {
            text: pick([
                tr(
                    `Portfolio at ${formatMoney(total)}, down ${formatMoney(Math.abs(delta))} from last month. ${stocks > 0 ? 'Market fluctuations are normal — stay the course.' : 'Let\'s review what changed.'}`,
                    `Portfolio na ${formatMoney(total)}, dolů o ${formatMoney(Math.abs(delta))} oproti minulému měsíci. ${stocks > 0 ? 'Výkyvy trhu jsou normální — drž kurz.' : 'Pojďme projít, co se změnilo.'}`,
                ),
                tr(
                    `${formatMoney(total)} total, ${formatMoney(Math.abs(delta))} decline this month. ${breakdownEn ? `Breakdown: ${breakdownEn}.` : ''} Long-term matters most.`,
                    `${formatMoney(total)} celkem, pokles o ${formatMoney(Math.abs(delta))} tento měsíc. ${breakdownCs ? `Rozpis: ${breakdownCs}.` : ''} Dlouhodobý výhled je nejdůležitější.`,
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
        };
    }

    return {
        text: pick([
            tr(
                `Portfolio overview: ${formatMoney(total)} total. ${breakdownEn ? `${breakdownEn}.` : ''} Holding steady this month.`,
                `Přehled portfolia: ${formatMoney(total)} celkem. ${breakdownCs ? `${breakdownCs}.` : ''} Tento měsíc drží stabilně.`,
            ),
            tr(
                `${formatMoney(total)} across your assets. ${partsEn.length >= 3 ? 'Well diversified!' : partsEn.length >= 2 ? 'Good spread across asset types.' : 'Consider adding more asset types for diversification.'}`,
                `${formatMoney(total)} napříč tvými aktivy. ${partsEn.length >= 3 ? 'Dobře diverzifikováno!' : partsEn.length >= 2 ? 'Pěkné rozložení napříč typy aktiv.' : 'Zvaž přidání dalších typů aktiv pro diverzifikaci.'}`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
    };
}
