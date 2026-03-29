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
import { useZumfi } from '../context/ZumfiContext';

const POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes
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
];

export function useFinancialMood() {
    const { showSpeechBubble } = useZumfi();
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

            // Try AI-powered speech bubble (non-blocking)
            fetchAiInsight(snapshot, score, mood).then(aiText => {
                if (controller.signal.aborted) return;
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

    // Fallback: show static speech bubble if AI didn't fire
    useEffect(() => {
        if (reaction?.speechBubble) {
            const text = reaction.speechBubble.text;
            // Only show static text if AI hasn't already spoken
            if (text !== lastSpeechRef.current) {
                // Delay static fallback to give AI time to respond
                const timer = setTimeout(() => {
                    if (text !== lastSpeechRef.current) {
                        lastSpeechRef.current = text;
                        showSpeechBubble(text, reaction.speechBubble.type, 6000);
                    }
                }, 3000);
                return () => clearTimeout(timer);
            }
        }
    }, [reaction, showSpeechBubble]);

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
        });
        return result?.insight || null;
    } catch {
        return null;
    }
}
