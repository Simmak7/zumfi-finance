import { useState, useEffect, useRef, useCallback } from 'react';
import {
    getDashboardSummary, getMonthlyHistory, getForecast,
    getGoals, getBudgetSummary, getPortfolioSummary, getBillStatus,
    getZumiInsight,
} from '../../../services/api';
import {
    buildMonthlySnapshot, buildHistoricalContext, computeHealthScore,
    evaluateMoods, loadMemory, saveMemory, updateMemory,
} from '../reactions';
import { getZumiLanguage } from '../reactions/lang';
import { useZumfi } from '../context/ZumfiContext';

const POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MOOD_SPEECH_DELAY = 4000; // wait before showing mood speech (gives page reaction time)
const DEBOUNCE_MS = 1000;

function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const FINANCIAL_EVENTS = [
    'transaction-updated',
    'goals-updated',
    'portfolio-updated',
    'budget-updated',
    'bills-updated',
    'settings-updated',
    'categories-updated',
    // Re-evaluate when Zumi's language flips so the AI insight + mood
    // speech are refreshed in the new language. The mood's `text` field
    // is a lazy getter so the static path doesn't strictly need a re-run,
    // but the AI insight (which hits Ollama) needs to be re-fetched in
    // the new language — so we still evaluate().
    'zumi-language-changed',
];

export function useFinancialMood() {
    const { showSpeechBubble, proximityActiveRef, pageReactionActiveRef } = useZumfi();
    const [reaction, setReaction] = useState(null);
    const [healthScore, setHealthScore] = useState(null);
    const [loading, setLoading] = useState(true);
    const abortRef = useRef(null);
    const pollRef = useRef(null);
    const debounceRef = useRef(null);
    const lastSpeechRef = useRef('');

    const evaluate = useCallback(async () => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            setLoading(true);
            const month = getCurrentMonth();

            // Fetch all data in parallel — each can fail independently
            const [dashboard, history, forecast, goals, budget, portfolio, bills] =
                await Promise.allSettled([
                    getDashboardSummary(month),
                    getMonthlyHistory(6),
                    getForecast(),
                    getGoals(),
                    getBudgetSummary(month),
                    getPortfolioSummary(month),
                    getBillStatus(month),
                ]);

            if (controller.signal.aborted) return;

            const val = (r) => r.status === 'fulfilled' ? r.value : null;

            // Build monthly snapshot
            const snapshot = buildMonthlySnapshot(
                val(dashboard),
                val(budget),
                val(portfolio),
                val(goals),
                val(forecast),
            );

            // Build historical context from 6-month history
            const historicalCtx = buildHistoricalContext(val(history));

            // Compute health score
            const score = computeHealthScore(snapshot, historicalCtx);

            // Load emotional memory
            const memory = loadMemory();

            // Evaluate moods
            const mood = evaluateMoods(snapshot, historicalCtx, score, memory);

            // Update and persist emotional memory
            const updatedMemory = updateMemory(memory, mood.moodId, score.total, month);
            saveMemory(updatedMemory);

            // Try AI-powered speech bubble (non-blocking, respects priority)
            fetchAiInsight(snapshot, score, mood).then(aiText => {
                if (controller.signal.aborted) return;
                if (proximityActiveRef.current || pageReactionActiveRef.current) return;
                if (aiText && aiText !== lastSpeechRef.current) {
                    lastSpeechRef.current = aiText;
                    const type = mood.priority >= 70 ? 'warning' : mood.priority >= 50 ? 'positive' : 'neutral';
                    showSpeechBubble(aiText, type, 8000);
                }
            });

            setReaction(mood);
            setHealthScore(score);
        } catch {
            // Network error or abort — keep previous state
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Initial fetch + polling
    useEffect(() => {
        evaluate();
        pollRef.current = setInterval(evaluate, POLL_INTERVAL);
        return () => {
            clearInterval(pollRef.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, [evaluate]);

    // Listen to window events for re-evaluation (debounced)
    useEffect(() => {
        const handleEvent = () => {
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(evaluate, DEBOUNCE_MS);
        };

        for (const evt of FINANCIAL_EVENTS) {
            window.addEventListener(evt, handleEvent);
        }
        return () => {
            for (const evt of FINANCIAL_EVENTS) {
                window.removeEventListener(evt, handleEvent);
            }
            clearTimeout(debounceRef.current);
        };
    }, [evaluate]);

    // Fallback: show static speech bubble if AI didn't fire.
    // Respects proximity and page-reaction priority.
    //
    // Text resolution is LAZY — we read `speechBubble.text` inside the
    // timeout callback (not when the effect mounts) so the lazy getter on
    // the mood reaction picks up the *current* language at display time.
    // This matters when the page just loaded: the mood is evaluated with
    // Zumi's language still defaulted to 'en' because SettingsContext
    // hasn't resolved yet, and we want the actual bubble shown 4s later
    // to reflect the user's real language once settings have loaded.
    useEffect(() => {
        if (!reaction?.speechBubble) return;
        const bubble = reaction.speechBubble;
        // Dedup key for cross-language transitions: keyed on English text
        // (stable across languages) so switching EN→CS still triggers a
        // new bubble rather than being suppressed as "same text".
        const dedupKey = bubble.key || bubble.text;
        if (dedupKey === lastSpeechRef.current) return;

        const timer = setTimeout(() => {
            if (proximityActiveRef.current || pageReactionActiveRef.current) return;
            // Read text HERE, not outside the timeout — the getter resolves
            // the current language at this moment.
            const text = bubble.text;
            if (!text) return;
            lastSpeechRef.current = dedupKey;
            showSpeechBubble(text, bubble.type, 6000);
        }, MOOD_SPEECH_DELAY);
        return () => clearTimeout(timer);
    }, [reaction, showSpeechBubble, proximityActiveRef, pageReactionActiveRef]);

    return { reaction, healthScore, loading };
}

/**
 * Fetch AI-generated insight for Zumfi's speech bubble.
 * Returns null if AI is unavailable — caller uses static fallback.
 */
async function fetchAiInsight(snapshot, score, mood) {
    try {
        const result = await getZumiInsight({
            mood: mood.moodId,
            income: snapshot.income,
            expenses: snapshot.expenses,
            savings_rate: snapshot.savingsRate * 100,
            health_score: score.total,
            portfolio_change: snapshot.portfolioValue > 0 ? snapshot.portfolioChange : null,
            budget_pct: snapshot.budgetTotal > 0 ? snapshot.budgetPct * 100 : null,
            goals_reached: snapshot.goalsReachedCount,
            goal_count: snapshot.goalCount,
            // Pass the current Zumi language so the backend LLM prompt can
            // instruct Ollama to respond in Czech / Ukrainian / etc.
            language: getZumiLanguage(),
        });
        return result?.insight || null;
    } catch {
        return null;
    }
}
