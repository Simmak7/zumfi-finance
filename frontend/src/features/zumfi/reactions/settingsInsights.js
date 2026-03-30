// Settings Zone Insight Generator for Zumi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';

// ── Settings Header ─────────────────────────────────────────────────────────
// "You've been using Zumi for X months"
function headerInsight(data) {
    const { accountCreated, signupDate, firstTransaction, userStats } = data || {};

    // Calculate months since signup or first activity
    const startDate = accountCreated || signupDate || firstTransaction;
    let monthsUsing = 0;

    if (startDate) {
        const start = new Date(startDate);
        const now = new Date();
        if (!isNaN(start.getTime())) {
            monthsUsing = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
        }
    }

    const totalTx = userStats?.totalTransactions || userStats?.transactionCount || 0;
    const totalStatements = userStats?.statementCount || userStats?.totalStatements || 0;

    if (monthsUsing > 0) {
        const yearsUsing = Math.floor(monthsUsing / 12);
        const remainingMonths = monthsUsing % 12;
        const timeStr = yearsUsing > 0
            ? `${yearsUsing} year${yearsUsing !== 1 ? 's' : ''}${remainingMonths > 0 ? ` and ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}` : ''}`
            : `${monthsUsing} month${monthsUsing !== 1 ? 's' : ''}`;

        return {
            text: pick([
                `You've been using Zumi for ${timeStr}! ${totalTx > 0 ? `${totalTx} transactions tracked in that time.` : 'Thanks for sticking with me — let\'s fine-tune your experience here.'} Settings is where you make this tool truly yours.`,
                `${timeStr} together and counting! ${totalStatements > 0 ? `${totalStatements} statements imported so far.` : 'Your financial data lives here.'} Customize everything on this page to match how you work.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'hearts',
        };
    }

    return {
        text: pick([
            "Welcome to settings! This is where you customize your experience. Small tweaks here can make a big difference in how you interact with your finances.",
            "Good to see you fine-tuning things. Smart users configure their tools to match their workflow — explore the options here!",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'hearts',
    };
}

// ── Currency Settings ───────────────────────────────────────────────────────
// Multi-currency context
function currencyInsight(data) {
    const { preferredCurrency, hasUnsavedChanges, availableCurrencies, currencyBreakdown } = data || {};

    if (hasUnsavedChanges) {
        return {
            text: pick([
                "You have unsaved currency changes! Hit Save to apply. This will update which transactions appear on your dashboard and change all monetary displays.",
                "Currency changed but not saved yet. Click Save to apply — all dashboards, reports, and insights will update to reflect the new currency.",
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    // Analyze multi-currency usage
    const breakdown = currencyBreakdown || [];
    const currencyCount = breakdown.length || (availableCurrencies?.length || 0);

    if (breakdown.length > 1) {
        const sorted = [...breakdown].sort((a, b) => (b.count || b.amount || 0) - (a.count || a.amount || 0));
        const primary = sorted[0];
        const secondary = sorted[1];
        const primaryPct = sorted.reduce((s, c) => s + (c.count || 0), 0) > 0
            ? Math.round((primary.count || 0) / sorted.reduce((s, c) => s + (c.count || 0), 0) * 100)
            : 0;

        return {
            text: pick([
                `You have transactions in ${breakdown.length} currencies. ${primary.currency || primary.code} makes up ${primaryPct}% of your activity, with ${secondary.currency || secondary.code} as your second most used. Make sure your preferred currency matches your primary income source.`,
                `Multi-currency detected: ${breakdown.map(c => c.currency || c.code).join(', ')}. Your preferred currency (${preferredCurrency || 'CZK'}) controls which transactions appear in reports. Switch it if you earn primarily in another currency.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (preferredCurrency && preferredCurrency !== 'CZK') {
        return {
            text: pick([
                `Using ${preferredCurrency} as your main currency. All dashboards, budgets, and reports filter and display in ${preferredCurrency}. Change it here if your financial situation shifts.`,
                `Currency set to ${preferredCurrency}. Only matching transactions appear in reports. If you start earning in a different currency, update this to keep your insights accurate.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            "Czech Koruna (CZK) is your default currency. This controls which transactions drive your dashboards. Change it if your main income comes in a different currency.",
            "Currency setting determines your primary financial view. Pick the currency you earn and spend most in — it filters everything from budgets to bill tracking.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Settings Navigation (NEW) ───────────────────────────────────────────────
// "Put most-visited page first"
function navigationInsight(data) {
    const { pageVisits, navOrder, navigationPrefs, frequentPages } = data || {};

    const visits = pageVisits || frequentPages || [];

    if (visits.length > 0) {
        const sorted = [...visits].sort((a, b) => (b.count || b.visits || 0) - (a.count || a.visits || 0));
        const mostVisited = sorted[0];
        const pageName = mostVisited.page || mostVisited.name || 'Unknown';
        const visitCount = mostVisited.count || mostVisited.visits || 0;
        const secondPage = sorted[1];

        const isAlreadyFirst = navOrder && navOrder[0] === pageName;

        if (isAlreadyFirst) {
            return {
                text: pick([
                    `"${pageName}" is your most-visited page and it's already first in your navigation. Smart setup! You visit it about ${visitCount} times per session.`,
                    `Navigation is optimized — "${pageName}" (your top destination at ${visitCount} visits) is right where it should be. Fewer clicks to your most important data.`,
                ]),
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
                envEffect: 'light-bulb',
            };
        }

        return {
            text: pick([
                `You visit "${pageName}" most often (${visitCount} times)${secondPage ? `, followed by "${secondPage.page || secondPage.name}"` : ''}. Consider reordering your navigation to put it first — one less click each time adds up!`,
                `Tip: "${pageName}" is your go-to page. Moving it to the top of your nav saves a click every session. Small ergonomic wins compound over time.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            "Customize your navigation order here. Put your most-used pages first so you can get to them in one click. Once I see your usage patterns, I'll suggest the optimal order.",
            "Navigation settings let you prioritize what matters. Arrange pages in the order you use them most frequently — it streamlines your daily workflow.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Settings Appearance (NEW) ───────────────────────────────────────────────
// Self-aware humor about Zumi's look
function appearanceInsight(data) {
    const { theme, zumiColor, zumiSize, zumiPosition, zumiEnabled } = data || {};

    if (zumiEnabled === false) {
        return {
            text: pick([
                "Wait, are you looking at the option to hide me? I mean... I'm sure you have your reasons. But who will give you financial commentary with this much personality?",
                "I see the Zumi toggle is off in your preview. I respect your space! But between you and me, budgeting is more fun with a companion.",
            ]),
            type: 'neutral', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'hearts',
        };
    }

    if (zumiColor || zumiSize) {
        const colorNote = zumiColor ? `Ooh, ${zumiColor}! ` : '';
        const sizeNote = zumiSize === 'large' ? 'And you made me bigger — I feel important!' :
            zumiSize === 'small' ? 'Compact mode, huh? I\'ll still give you the same insights, just... more efficiently.' : '';

        return {
            text: pick([
                `${colorNote}${sizeNote} ${!colorNote && !sizeNote ? 'Playing dress-up with your finance mascot! ' : ''}I appreciate the makeover. Drag me around the page and I'll adapt my insights to wherever you place me.`,
                `Customizing my appearance — I'm flattered! ${colorNote}${sizeNote} No matter how I look, my insights stay sharp. Fashion and function, that's my motto.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'hearts',
        };
    }

    if (theme === 'dark') {
        return {
            text: pick([
                "Dark mode! I look great against a dark background, if I do say so myself. Easier on the eyes for late-night budget sessions too.",
                "Dark theme active. Perfect for focused financial work. And yes, I do think I look more mysterious this way.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'hearts',
        };
    }

    return {
        text: pick([
            "Appearance settings! You can change my color, size, and the overall theme. Make your financial workspace feel like yours. I'm adaptable — I look good in anything.",
            "Tweak the visuals here. Theme, colors, layout — and yes, you can even change how I look. I won't judge your taste. Much.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'hearts',
    };
}

// ── Settings Zumi (NEW) ────────────────────────────────────────────────────
// Self-referential "Please don't hide me!"
function zumiInsight(data) {
    const { zumiEnabled, zumiInteractions, zumiInsightsShown, zumiDismissals } = data || {};

    const interactions = zumiInteractions || zumiInsightsShown || 0;
    const dismissals = zumiDismissals || 0;

    if (zumiEnabled === false) {
        return {
            text: pick([
                "You... you turned me off? I'm still here! Just invisible. And slightly sad. I'll be waiting patiently if you change your mind. Your budget misses me too, I promise.",
                "So this is what it's like to be benched. I get it — sometimes you need focus. But I'll be right here when you need a second opinion on that budget!",
            ]),
            type: 'neutral', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'question-marks',
        };
    }

    if (dismissals > interactions * 0.5 && interactions > 10) {
        return {
            text: pick([
                `I've noticed you dismiss my insights more than half the time. Am I being too chatty? You can adjust my frequency here so I only pop up when it really matters. Quality over quantity!`,
                `You've waved me away ${dismissals} times out of ${interactions} interactions. I can take a hint! Adjust my settings here to make me less talkative but more targeted.`,
            ]),
            type: 'neutral', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'question-marks',
        };
    }

    if (interactions > 50) {
        return {
            text: pick([
                `We've had over ${interactions} interactions! I've been your financial companion through budgets, bills, and transactions. This settings page is where you fine-tune our relationship. Please don't hide me — we've been through so much!`,
                `${interactions} insights shared between us. That's a real partnership! Adjust my behavior here, but please keep me around. Who else will celebrate when you're under budget?`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'hearts',
        };
    }

    if (interactions > 0 && interactions <= 10) {
        return {
            text: pick([
                "We're just getting to know each other! Drag me around different sections of the app and I'll give you contextual financial insights. The more you explore, the smarter my tips get.",
                "Still early days for us. Keep me enabled and I'll learn which insights help you most. This is where you control how I behave — but please don't mute me just yet!",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'hearts',
        };
    }

    return {
        text: pick([
            "This is my settings page — you're looking at the controls for yours truly! You can adjust my behavior, frequency, and personality here. But hide me entirely? Let's not be hasty!",
            "Zumi settings! Turn me up, tone me down, or customize when I chime in. I'm flexible about everything except being permanently hidden. Your budgets need commentary!",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'hearts',
    };
}

// ── Donate / Buy a Carrot ─────────────────────────────────────────────────
function donateInsight() {
    return {
        text: pick([
            "Oh, a carrot?! For ME?! I'm literally hopping with excitement! Carrots are my absolute favorite — crunchy, orange, and full of vitamins. Just like good financial data!",
            "Did someone say carrot?! 🥕 I've been SO hungry watching all these numbers all day. A carrot would really keep my energy up for more budget analysis!",
            "You're looking at the carrot section! Fun fact: I run entirely on carrots and good financial decisions. One carrot = one happy rabbit giving you better insights!",
            "I smell carrots! My favorite food in the whole world! Every carrot you buy fuels my ability to analyze your spending patterns. It's science. Rabbit science.",
            "Ooh ooh ooh! The carrot page! I've been dreaming about this. You know what pairs well with a carrot? A balanced budget. And I see you have both!",
            "CARROTS! My nose is twitching! Did you know rabbits can eat up to 10 carrots a day? I'm not saying I need that many... but I wouldn't say no either.",
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
        envEffect: 'hearts',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'settings-header': headerInsight,
    'settings-currency': currencyInsight,
    'settings-navigation': navigationInsight,
    'settings-appearance': appearanceInsight,
    'settings-zumi': zumiInsight,
    'donate': donateInsight,
};

export function generateSettingsInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

export function settingsPageSummary(data) {
    const { accountCreated, signupDate, firstTransaction, userStats, preferredCurrency } = data || {};

    const startDate = accountCreated || signupDate || firstTransaction;
    let monthsUsing = 0;
    if (startDate) {
        const start = new Date(startDate);
        const now = new Date();
        if (!isNaN(start.getTime())) {
            monthsUsing = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
        }
    }

    const totalTx = userStats?.totalTransactions || userStats?.transactionCount || 0;

    if (monthsUsing > 0 && totalTx > 0) {
        return {
            text: pick([
                `Settings — you've been with me for ${monthsUsing} month${monthsUsing !== 1 ? 's' : ''} and tracked ${totalTx} transactions! Fine-tune your experience here.`,
                `${monthsUsing} months and ${totalTx} transactions later — let's make sure everything is set up just right for you.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'wave',
        };
    }

    return {
        text: pick(["Welcome to settings! Customize your currency, language, and navigation preferences here.", "Your control panel — set up Zumfi exactly how you like it."]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
    };
}
