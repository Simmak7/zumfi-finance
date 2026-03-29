// 12 Mood Definitions for Zumfi's Monthly Reaction Engine
// Each mood has: id, priority, visual state, evaluate function, and speech lines.

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
            "Tough month... let's make a plan together.",
            "We've been spending more than we earn. Time to regroup.",
            "I'm worried, but we can turn this around!",
        ],
        evaluate: (snapshot, history, health) => {
            if (health.total < 20) return true;
            // Spending > 150% income for 2+ consecutive months
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
            "We're absolutely thriving! Keep it up!",
            "Financial health is excellent. You're amazing!",
            "Consistent savings, stable spending — perfection!",
        ],
        evaluate: (snapshot, history, health, memory) => {
            if (health.total <= 85) return false;
            if (snapshot.savingsRate < 0.25) return false;
            // Check 3+ months of high health from memory
            const hist = memory?.moodHistory || [];
            const highHealthMonths = hist.filter(h => h.healthScore >= 75).length;
            return highHealthMonths >= 2; // current + 2 past = 3
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
            "Goal reached! You did it!",
            "Amazing — another goal conquered!",
            "All that discipline paid off. Celebrating with you!",
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
            "Spending exceeded income this month. Let's review!",
            "We're in the red... but there's time to adjust.",
            "Income isn't covering expenses. Let's find savings.",
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
            "Things are getting better month by month!",
            "Great progress — the trend is looking up.",
            "Your financial health is improving steadily!",
        ],
        evaluate: (_snapshot, _history, health, memory) => {
            const hist = memory?.moodHistory || [];
            if (hist.length < 2) return false;
            const oldest = hist[hist.length - 1]; // oldest in last 3
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
            "Financial health has been slipping. Let's course-correct.",
            "The trend is going the wrong way. Small changes help!",
            "Things have been declining — let's figure out why.",
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
            "Portfolio is booming! Great month for investments!",
            "Investments are up nicely. The market is smiling!",
            "Strong portfolio gains — well played!",
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
            "Markets are down, but stay the course.",
            "Portfolio dipped — it's normal, don't panic.",
            "Down months happen. Long-term thinking wins.",
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
            "Every category under budget — impressive discipline!",
            "Budget master mode! Everything is under control.",
            "All green on the budget. You're nailing it!",
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
            "A budget category is way over limit!",
            "Some spending categories need attention.",
            "Over budget on a category — let's take a look.",
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
            "Steady as she goes. Doing great!",
            "Finances are looking healthy and stable.",
            "Everything is on track — nice and steady.",
            "A calm, stable month. Just how I like it!",
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
            "Hi there! Upload some data and I'll tell you how things look.",
            "Not enough data yet — but I'm here for you!",
            "Waiting for more financial info to share insights.",
        ],
        evaluate: () => true, // always matches as fallback
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
        // Should never happen since 'neutral' always matches
        return buildReaction(MOODS[MOODS.length - 1]);
    }

    // Sort by priority descending
    matched.sort((a, b) => b.priority - a.priority);
    return buildReaction(matched[0]);
}

function buildReaction(mood) {
    const speeches = mood.speeches || [];
    const text = speeches.length > 0
        ? speeches[Math.floor(Math.random() * speeches.length)]
        : null;

    return {
        moodId: mood.id,
        priority: mood.priority,
        expression: mood.expression,
        mouth: mood.mouth,
        outfit: mood.outfit,
        accessory: mood.accessory,
        animation: mood.animation,
        speechBubble: text ? {
            text,
            type: mood.priority >= 70 ? 'warning' : mood.priority >= 50 ? 'positive' : 'neutral',
        } : null,
    };
}
