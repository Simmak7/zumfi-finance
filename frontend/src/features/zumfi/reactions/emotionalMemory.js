// Emotional Memory — persists Zumi's mood history across sessions via localStorage.

const STORAGE_KEY = 'zumi_emotional_memory';

// Migrate old key (one-time)
try {
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem('zumfi_emotional_memory')) {
        localStorage.setItem(STORAGE_KEY, localStorage.getItem('zumfi_emotional_memory'));
        localStorage.removeItem('zumfi_emotional_memory');
    }
} catch {}
const MAX_HISTORY = 6;

function getDefaultMemory() {
    return {
        lastMoodId: null,
        lastHealthScore: null,
        moodHistory: [],
        streaks: { currentMood: null, count: 0 },
        lastUpdated: null,
    };
}

/**
 * Load emotional memory from localStorage. Returns default if missing/corrupt.
 */
export function loadMemory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getDefaultMemory();
        const parsed = JSON.parse(raw);
        // Basic validation
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.moodHistory)) {
            return getDefaultMemory();
        }
        return {
            lastMoodId: parsed.lastMoodId || null,
            lastHealthScore: parsed.lastHealthScore ?? null,
            moodHistory: parsed.moodHistory.slice(0, MAX_HISTORY),
            streaks: parsed.streaks || { currentMood: null, count: 0 },
            lastUpdated: parsed.lastUpdated || null,
        };
    } catch {
        return getDefaultMemory();
    }
}

/**
 * Save emotional memory to localStorage.
 */
export function saveMemory(memory) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch {
        // Storage full or unavailable — silently fail
    }
}

/**
 * Update memory with new mood evaluation result.
 * Only updates if the month has changed (avoids duplicate entries for same month).
 * Returns the updated memory object.
 */
export function updateMemory(memory, newMoodId, newHealthScore, month) {
    const updated = { ...memory };

    // Check if we already have an entry for this month
    const existingIdx = updated.moodHistory.findIndex(h => h.month === month);
    if (existingIdx >= 0) {
        // Update existing entry for current month
        updated.moodHistory[existingIdx] = { month, moodId: newMoodId, healthScore: newHealthScore };
    } else {
        // Add new entry at the front (most recent first)
        updated.moodHistory.unshift({ month, moodId: newMoodId, healthScore: newHealthScore });
        // Trim to max history
        if (updated.moodHistory.length > MAX_HISTORY) {
            updated.moodHistory = updated.moodHistory.slice(0, MAX_HISTORY);
        }
    }

    // Update streaks
    if (newMoodId === updated.streaks.currentMood) {
        updated.streaks.count += existingIdx >= 0 ? 0 : 1; // only increment on new month
    } else {
        updated.streaks = { currentMood: newMoodId, count: 1 };
    }

    updated.lastMoodId = newMoodId;
    updated.lastHealthScore = newHealthScore;
    updated.lastUpdated = new Date().toISOString();

    return updated;
}
