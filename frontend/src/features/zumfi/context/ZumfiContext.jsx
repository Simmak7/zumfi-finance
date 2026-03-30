import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ZumfiContext = createContext(null);

const POSITION_KEY = 'zumi_position';
const PREFS_KEY = 'zumi_prefs';

// Migrate old localStorage keys (one-time)
function migrateStorageKey(oldKey, newKey) {
    try {
        if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
            localStorage.setItem(newKey, localStorage.getItem(oldKey));
            localStorage.removeItem(oldKey);
        }
    } catch {}
}
migrateStorageKey('zumfi_position', POSITION_KEY);
migrateStorageKey('zumfi_prefs', PREFS_KEY);

function getDefaultPosition() {
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    // Home: right next to house icon in sidebar bottom
    // House: 72x76, above user section (76px) + margin (12px) + sidebar padding (32px)
    const houseTop = h - 32 - 76 - 12 - 76;
    const houseCenterY = houseTop + 76 / 2;
    return { x: 104, y: Math.round(houseCenterY - 75 / 2) }; // 24(sidebar pad) + 72(house) + 8(gap)
}

function loadPosition() {
    try {
        const raw = localStorage.getItem(POSITION_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                const w = window.innerWidth;
                const h = window.innerHeight;
                // If saved position is off-screen, reset to default
                if (parsed.x < 0 || parsed.x > w || parsed.y < 0 || parsed.y > h) {
                    localStorage.removeItem(POSITION_KEY);
                    return getDefaultPosition();
                }
                return parsed;
            }
        }
    } catch {}
    return getDefaultPosition();
}

function loadPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) return JSON.parse(raw);
    } catch {}
    return { visible: true, muteSpeech: false };
}

const DEFAULT_VISUAL = {
    expression: 'happy',
    mouth: 'smile',
    outfit: 'casual',
    accessory: null,
    animation: 'idle',
    envEffect: null,
};

/**
 * Calculate speech bubble duration based on text length.
 * Average reading speed ~200 wpm = ~3.3 words/sec.
 * Min 8s, then +1s per ~15 extra characters beyond 60.
 */
function calculateDuration(text) {
    const MIN = 8000;
    const BASE_CHARS = 60;
    const MS_PER_CHAR = 67;
    const len = (text || '').length;
    if (len <= BASE_CHARS) return MIN;
    return MIN + Math.round((len - BASE_CHARS) * MS_PER_CHAR);
}

export function ZumfiProvider({ children }) {
    const [visual, setVisual] = useState(DEFAULT_VISUAL);
    const [speechBubble, setSpeechBubble] = useState(null);
    const [position, setPositionState] = useState(loadPosition);
    const [prefs, setPrefs] = useState(loadPrefs);
    const speechTimerRef = useRef(null);
    const pageDataRef = useRef(null);
    const proximityActiveRef = useRef(false);
    const pageReactionActiveRef = useRef(false);

    // Persist prefs
    useEffect(() => {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }, [prefs]);

    const setVisualState = useCallback((partial) => {
        setVisual(prev => ({ ...prev, ...partial }));
    }, []);

    const showSpeechBubble = useCallback((text, type = 'neutral', duration = null) => {
        if (prefs.muteSpeech) return;
        clearTimeout(speechTimerRef.current);
        setSpeechBubble({ text, type });
        const effectiveDuration = duration ?? calculateDuration(text);
        speechTimerRef.current = setTimeout(() => setSpeechBubble(null), effectiveDuration);
    }, [prefs.muteSpeech]);

    const dismissSpeechBubble = useCallback(() => {
        clearTimeout(speechTimerRef.current);
        setSpeechBubble(null);
    }, []);

    const setPosition = useCallback((x, y) => {
        const pos = { x, y };
        setPositionState(pos);
        localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
    }, []);

    const toggleVisible = useCallback(() => {
        setPrefs(prev => ({ ...prev, visible: !prev.visible }));
    }, []);

    const setVisible = useCallback((val) => {
        setPrefs(prev => ({ ...prev, visible: !!val }));
    }, []);

    const toggleMuteSpeech = useCallback(() => {
        setPrefs(prev => ({ ...prev, muteSpeech: !prev.muteSpeech }));
    }, []);

    const setPageData = useCallback((data) => {
        const prevPage = pageDataRef.current?._page;
        pageDataRef.current = data;
        if (data?._page && data._page !== prevPage) {
            window.dispatchEvent(new CustomEvent('zumfi-page-change', { detail: { page: data._page } }));
        }
    }, []);

    // Cleanup speech timer
    useEffect(() => {
        return () => clearTimeout(speechTimerRef.current);
    }, []);

    const value = {
        visual,
        speechBubble,
        position,
        prefs,
        setVisualState,
        showSpeechBubble,
        dismissSpeechBubble,
        setPosition,
        toggleVisible,
        setVisible,
        toggleMuteSpeech,
        pageDataRef,
        proximityActiveRef,
        pageReactionActiveRef,
        setPageData,
    };

    return (
        <ZumfiContext.Provider value={value}>
            {children}
        </ZumfiContext.Provider>
    );
}

export function useZumfi() {
    const ctx = useContext(ZumfiContext);
    if (!ctx) throw new Error('useZumfi must be used within ZumfiProvider');
    return ctx;
}
