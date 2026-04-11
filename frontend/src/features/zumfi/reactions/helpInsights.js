// Help Zone Insight Generator for Zumi Proximity Interactions
//
// The Help page is an onboarding companion — so every insight here is
// encouraging, tutorial-flavoured, and nudges the user toward exploring
// features. All insights carry both a speech bubble AND an envEffect, per
// project convention.

import { tr } from './lang';

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Help Header ─────────────────────────────────────────────────────────────
function headerInsight(data) {
    return {
        text: pick([
            tr(
                "Welcome to the Help center! Every feature in Zumfi is documented below. New here? Start the guided tour — I'll walk you through each page personally!",
                "Vítej v Nápovědě! Všechny funkce Zumfi jsou popsány níže. Jsi tu poprvé? Spusť průvodce — projdu s tebou každou stránku osobně!",
            ),
            tr(
                "Lost? You're in the right place. Browse the sections or use the search to find exactly what you need. I'm here if you need me!",
                "Ztracený/á? Jsi na správném místě. Projdi si sekce nebo použij vyhledávání a najdi přesně to, co potřebuješ. Jsem tu pro tebe!",
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'wave',
        envEffect: 'light-bulb',
    };
}

// ── Guided Tour Button ──────────────────────────────────────────────────────
function tourButtonInsight(data) {
    const { totalSteps, phases } = data;
    return {
        text: pick([
            tr(
                `Click me to start the guided tour! ${phases || 9} sections, ${totalSteps || '~30'} interactive steps. I'll highlight each feature and explain how it works.`,
                `Klikni na mě a spusť průvodce! ${phases || 9} sekcí, ${totalSteps || '~30'} interaktivních kroků. Zvýrazním každou funkci a vysvětlím, jak funguje.`,
            ),
            tr(
                "Best way to learn Zumfi — click Start Tour and I'll walk you through every page, one step at a time. You can exit anytime!",
                "Nejlepší způsob, jak poznat Zumfi — klikni na Spustit průvodce a projdu s tebou každou stránku krok za krokem. Kdykoli můžeš odejít!",
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
        envEffect: 'rocket-launch',
    };
}

// ── Search Bar ──────────────────────────────────────────────────────────────
function searchInsight(data) {
    const { searchTerm, visibleCount } = data;

    if (searchTerm && visibleCount === 0) {
        return {
            text: tr(
                `Nothing matches "${searchTerm}". Try a shorter keyword or browse the sections!`,
                `Nic neodpovídá dotazu „${searchTerm}“. Zkus kratší výraz nebo se podívej na jednotlivé sekce!`,
            ),
            type: 'neutral', expression: 'concerned', mouth: 'neutral', animation: 'wave',
            envEffect: 'question-marks',
        };
    }

    if (searchTerm) {
        return {
            text: tr(
                `Found ${visibleCount} section${visibleCount === 1 ? '' : 's'} matching "${searchTerm}". Sections auto-expand when searching so you see every match.`,
                `Našel jsem ${visibleCount} ${visibleCount === 1 ? 'sekci' : 'sekcí'} odpovídající dotazu „${searchTerm}“. Při hledání se sekce automaticky rozbalují, abys viděl/a všechny shody.`,
            ),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: tr(
            "Type any feature name, KPI, or keyword — I'll filter the sections to only show what matches. Every topic is searchable!",
            "Napiš název funkce, KPI nebo klíčové slovo — sekce vyfiltruji tak, aby se zobrazily jen shody. Každé téma je vyhledatelné!",
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'magnifying-glass',
    };
}

// ── Sections List ───────────────────────────────────────────────────────────
function sectionsInsight(data) {
    const { visibleCount, totalCount, expandedId } = data;

    if (expandedId) {
        return {
            text: tr(
                `Reading about ${expandedId}? Click outside or on another section header to collapse. Each section has a "Pro tips" block at the bottom — don't miss it!`,
                `Čteš o sekci ${expandedId}? Klikni mimo, nebo na jiný nadpis sekce, abys tuto zavřel/a. Každá sekce má na konci blok „Profi tipy“ — nepřehlédni ho!`,
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: tr(
            `${visibleCount || totalCount || 9} topics available — Dashboard, Transactions, Budget, Goals, Bills, Portfolio, Import, Categories, Settings. Click any section to expand.`,
            `${visibleCount || totalCount || 9} dostupných témat — Přehled, Transakce, Rozpočet, Cíle, Platby, Portfolio, Import, Kategorie, Nastavení. Klikni na sekci a rozbal ji.`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'thought-clouds',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'help-header': headerInsight,
    'help-tour-btn': tourButtonInsight,
    'help-search': searchInsight,
    'help-sections': sectionsInsight,
};

export function generateHelpInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

// ── Page Summary (fires on navigation to /help) ─────────────────────────────
export function helpPageSummary(data) {
    return {
        text: pick([
            tr(
                "Welcome to the Help center! Need a guided walkthrough? Drag me onto the Start Tour button and I'll run you through every feature.",
                "Vítej v Nápovědě! Chceš provést aplikací krok za krokem? Přetáhni mě na tlačítko Spustit průvodce a projdu s tebou každou funkci.",
            ),
            tr(
                "Hop into any section to learn how Zumfi works. If it's your first time, I highly recommend starting with the Dashboard section!",
                "Skoč do kterékoli sekce a zjisti, jak Zumfi funguje. Pokud jsi tu poprvé, vřele doporučuji začít sekcí Přehled!",
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'wave',
    };
}
