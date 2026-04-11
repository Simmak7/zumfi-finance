// 12 Mood Definitions for Zumfi's Monthly Reaction Engine
// Each mood has: id, priority, visual state, evaluate function, and speech lines.

import { tr } from './lang';

// Pick a random bilingual speech pair { en, cs } from the mood's speeches.
// Caller resolves the language LAZILY (via tr()) at display time, because
// buildReaction may run before Zumi's language has been synced from Settings.
function pickBilingual(speeches) {
    if (!speeches || speeches.length === 0) return null;
    return speeches[Math.floor(Math.random() * speeches.length)];
}

const MOODS = [
    // 1. Crisis — financial emergency
    {
        id: 'crisis',
        priority: 95,
        expression: 'concerned',
        mouth: 'frown',
        outfit: 'broke',
        accessory: null,
        animation: 'idle',
        speeches: [
            { en: "Tough month... let's make a plan together.",
              cs: "Těžký měsíc... pojďme spolu udělat plán." },
            { en: "We've been spending more than we earn. Time to regroup.",
              cs: "Utrácíme víc, než vyděláváme. Čas se přeskupit." },
            { en: "I'm worried, but we can turn this around!",
              cs: "Mám starost, ale otočíme to!" },
        ],
        evaluate: (snapshot, history, health) => {
            if (health.total < 20) return true;
            const months = history.months || [];
            if (months.length < 2) return false;
            const recent2 = months.slice(-2);
            return recent2.every(m => {
                const inc = m.total_income || m.income || 0;
                const exp = m.total_expenses || m.expenses || 0;
                return inc > 0 && exp > inc * 1.5;
            });
        },
    },

    // 2. Thriving — consistently excellent
    {
        id: 'thriving',
        priority: 90,
        expression: 'excited',
        mouth: 'open',
        outfit: 'celebration',
        accessory: null,
        animation: 'celebrate',
        speeches: [
            { en: "We're absolutely thriving! Keep it up!",
              cs: "Prosperujeme naplno! Pokračuj!" },
            { en: "Financial health is excellent. You're amazing!",
              cs: "Finanční zdraví je výborné. Jsi úžasný/á!" },
            { en: "Consistent savings, stable spending — perfection!",
              cs: "Pravidelné úspory, stabilní útraty — dokonalost!" },
        ],
        evaluate: (snapshot, history, health, memory) => {
            if (health.total <= 85) return false;
            if (snapshot.savingsRate < 0.25) return false;
            const hist = memory?.moodHistory || [];
            const highHealthMonths = hist.filter(h => h.healthScore >= 75).length;
            return highHealthMonths >= 2;
        },
    },

    // 3. Goal Reached — a savings goal hit 100%
    {
        id: 'goal_reached',
        priority: 88,
        expression: 'excited',
        mouth: 'open',
        outfit: 'celebration',
        accessory: null,
        animation: 'celebrate',
        speeches: [
            { en: "Goal reached! You did it!",
              cs: "Cíl splněný! Dokázal/a jsi to!" },
            { en: "Amazing — another goal conquered!",
              cs: "Úžasné — další cíl zdolán!" },
            { en: "All that discipline paid off. Celebrating with you!",
              cs: "Všechna ta disciplína se vyplatila. Slavím s tebou!" },
        ],
        evaluate: (snapshot) => {
            return snapshot.goalsReachedCount > 0;
        },
    },

    // 4. Overspending — expenses > income this month
    {
        id: 'overspending',
        priority: 80,
        expression: 'concerned',
        mouth: 'frown',
        outfit: 'broke',
        accessory: null,
        animation: 'idle',
        speeches: [
            { en: "Spending exceeded income this month. Let's review!",
              cs: "Útraty tento měsíc přesáhly příjem. Pojďme to projít!" },
            { en: "We're in the red... but there's time to adjust.",
              cs: "Jsme v minusu... ale ještě je čas to napravit." },
            { en: "Income isn't covering expenses. Let's find savings.",
              cs: "Příjem nepokrývá výdaje. Pojďme najít úspory." },
        ],
        evaluate: (snapshot) => {
            return snapshot.income > 0 && snapshot.expenses > snapshot.income;
        },
    },

    // 5. Improving — health trending up
    {
        id: 'improving',
        priority: 70,
        expression: 'happy',
        mouth: 'smile',
        outfit: 'business',
        accessory: null,
        animation: 'hop',
        speeches: [
            { en: "Things are getting better month by month!",
              cs: "Věci se měsíc od měsíce zlepšují!" },
            { en: "Great progress — the trend is looking up.",
              cs: "Skvělý pokrok — trend směřuje nahoru." },
            { en: "Your financial health is improving steadily!",
              cs: "Tvé finanční zdraví se stabilně zlepšuje!" },
        ],
        evaluate: (_snapshot, _history, health, memory) => {
            const hist = memory?.moodHistory || [];
            if (hist.length < 2) return false;
            const oldest = hist[hist.length - 1];
            return health.total - (oldest?.healthScore || 0) >= 10;
        },
    },

    // 6. Declining — health trending down
    {
        id: 'declining',
        priority: 70,
        expression: 'concerned',
        mouth: 'neutral',
        outfit: 'casual',
        accessory: null,
        animation: 'idle',
        speeches: [
            { en: "Financial health has been slipping. Let's course-correct.",
              cs: "Finanční zdraví uklouzává. Pojďme to napravit." },
            { en: "The trend is going the wrong way. Small changes help!",
              cs: "Trend jde špatným směrem. Pomohou i malé změny!" },
            { en: "Things have been declining — let's figure out why.",
              cs: "Situace se zhoršuje — pojďme zjistit proč." },
        ],
        evaluate: (_snapshot, _history, health, memory) => {
            const hist = memory?.moodHistory || [];
            if (hist.length < 2) return false;
            const oldest = hist[hist.length - 1];
            return (oldest?.healthScore || 0) - health.total >= 10;
        },
    },

    // 7. Portfolio Boom — strong gains
    {
        id: 'portfolio_boom',
        priority: 65,
        expression: 'excited',
        mouth: 'smile',
        outfit: 'business',
        accessory: 'money-tree',
        animation: 'celebrate',
        speeches: [
            { en: "Portfolio is booming! Great month for investments!",
              cs: "Portfolio letí nahoru! Skvělý měsíc pro investice!" },
            { en: "Investments are up nicely. The market is smiling!",
              cs: "Investice pěkně rostou. Trh se usmívá!" },
            { en: "Strong portfolio gains — well played!",
              cs: "Silný růst portfolia — výborně!" },
        ],
        evaluate: (snapshot) => {
            return snapshot.portfolioValue > 0 && snapshot.portfolioChange > 5;
        },
    },

    // 8. Portfolio Dip — notable losses
    {
        id: 'portfolio_dip',
        priority: 60,
        expression: 'neutral',
        mouth: 'neutral',
        outfit: 'casual',
        accessory: null,
        animation: 'idle',
        speeches: [
            { en: "Markets are down, but stay the course.",
              cs: "Trhy jsou dole, ale drž kurz." },
            { en: "Portfolio dipped — it's normal, don't panic.",
              cs: "Portfolio kleslo — je to normální, nepanikař." },
            { en: "Down months happen. Long-term thinking wins.",
              cs: "Slabé měsíce se stávají. Dlouhodobé myšlení vítězí." },
        ],
        evaluate: (snapshot) => {
            return snapshot.portfolioValue > 0 && snapshot.portfolioChange < -5;
        },
    },

    // 9. Budget Master — all categories well under budget
    {
        id: 'budget_master',
        priority: 55,
        expression: 'happy',
        mouth: 'smile',
        outfit: 'casual',
        accessory: 'sunglasses',
        animation: 'hop',
        speeches: [
            { en: "Every category under budget — impressive discipline!",
              cs: "Každá kategorie pod rozpočtem — obdivuhodná disciplína!" },
            { en: "Budget master mode! Everything is under control.",
              cs: "Mistr rozpočtu! Všechno pod kontrolou." },
            { en: "All green on the budget. You're nailing it!",
              cs: "Rozpočet celý v zeleném. Daří se ti!" },
        ],
        evaluate: (snapshot) => {
            const cats = snapshot.budgetCategories || [];
            if (cats.length === 0) return false;
            return cats.every(c => c.pct < 0.8);
        },
    },

    // 10. Budget Warning — category overspend
    {
        id: 'budget_warning',
        priority: 55,
        expression: 'concerned',
        mouth: 'frown',
        outfit: 'casual',
        accessory: null,
        animation: 'idle',
        speeches: [
            { en: "A budget category is way over limit!",
              cs: "Jedna kategorie rozpočtu je daleko přes limit!" },
            { en: "Some spending categories need attention.",
              cs: "Některé kategorie útrat potřebují pozornost." },
            { en: "Over budget on a category — let's take a look.",
              cs: "Přečerpaná kategorie — pojďme se podívat." },
        ],
        evaluate: (snapshot) => {
            const cats = snapshot.budgetCategories || [];
            return cats.some(c => c.pct > 1.2);
        },
    },

    // 11. Steady — healthy but nothing dramatic
    {
        id: 'steady',
        priority: 30,
        expression: 'happy',
        mouth: 'smile',
        outfit: 'casual',
        accessory: null,
        animation: 'idle',
        speeches: [
            { en: "Steady as she goes. Doing great!",
              cs: "Stabilně vpřed. Daří se!" },
            { en: "Finances are looking healthy and stable.",
              cs: "Finance vypadají zdravě a stabilně." },
            { en: "Everything is on track — nice and steady.",
              cs: "Vše jede podle plánu — pěkně a stabilně." },
            { en: "A calm, stable month. Just how I like it!",
              cs: "Klidný, stabilní měsíc. Přesně jak to mám rád!" },
        ],
        evaluate: (_snapshot, _history, health) => {
            return health.total >= 40 && health.total <= 85;
        },
    },

    // 12. Neutral — default / insufficient data
    {
        id: 'neutral',
        priority: 10,
        expression: 'neutral',
        mouth: 'neutral',
        outfit: 'casual',
        accessory: null,
        animation: 'idle',
        speeches: [
            { en: "Hi there! Upload some data and I'll tell you how things look.",
              cs: "Ahoj! Nahraj nějaká data a řeknu ti, jak to vypadá." },
            { en: "Not enough data yet — but I'm here for you!",
              cs: "Zatím málo dat — ale jsem tu pro tebe!" },
            { en: "Waiting for more financial info to share insights.",
              cs: "Čekám na víc finančních dat, abych mohl sdílet postřehy." },
        ],
        evaluate: () => true,
    },
];

/**
 * Evaluate all moods against current data, return the highest-priority match.
 * Returns mood object with a random speech line attached.
 */
export function evaluateMoods(snapshot, history, healthScore, memory) {
    const matched = [];

    for (const mood of MOODS) {
        try {
            if (mood.evaluate(snapshot, history, healthScore, memory)) {
                matched.push(mood);
            }
        } catch {
            // Skip moods that error during evaluation
        }
    }

    if (matched.length === 0) {
        return buildReaction(MOODS[MOODS.length - 1]);
    }

    matched.sort((a, b) => b.priority - a.priority);
    return buildReaction(matched[0]);
}

function buildReaction(mood) {
    const pair = pickBilingual(mood.speeches);
    const type = mood.priority >= 70 ? 'warning' : mood.priority >= 50 ? 'positive' : 'neutral';

    // LAZY language resolution — `text` is a getter so the display path
    // reads `currentLang` at the moment the bubble is shown, not when the
    // mood was first built (which often happens before Settings has loaded
    // on first page render).
    const speechBubble = pair
        ? {
            // Stable key used by lastSpeechRef dedup so language switch
            // actually re-triggers the bubble. Keyed on the English line
            // because the English text is stable across languages.
            key: `${mood.id}:${pair.en}`,
            get text() { return tr(pair.en, pair.cs); },
            type,
        }
        : null;

    return {
        moodId: mood.id,
        priority: mood.priority,
        expression: mood.expression,
        mouth: mood.mouth,
        outfit: mood.outfit,
        accessory: mood.accessory,
        animation: mood.animation,
        speechBubble,
    };
}
