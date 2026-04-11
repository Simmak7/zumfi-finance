// Proximity detection hook — triggers Zumfi insights when dragged over page zones.
// Uses data-zumfi-zone DOM attributes + getBoundingClientRect for overlap detection.

import { useRef, useCallback } from 'react';
import { useZumfi } from '../context/ZumfiContext';
import { generateInsight } from '../reactions/insightRouter';

const MASCOT_WIDTH = 56;
const MASCOT_HEIGHT = 75;
const PROXIMITY_MARGIN = 30;  // extra px around Zumfi for "near" detection
const COOLDOWN_MS = 15_000;   // don't re-trigger same zone within 15s
const THROTTLE_MS = 100;      // limit DOM queries to ~10/s
const SPEECH_HOLD_MS = 2000;  // keep proximity flag briefly so speech isn't overwritten

function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function detectZone(mascotX, mascotY) {
    const mascotRect = {
        left: mascotX - PROXIMITY_MARGIN,
        top: mascotY - PROXIMITY_MARGIN,
        right: mascotX + MASCOT_WIDTH + PROXIMITY_MARGIN,
        bottom: mascotY + MASCOT_HEIGHT + PROXIMITY_MARGIN,
    };

    const zones = document.querySelectorAll('[data-zumfi-zone]');
    for (const el of zones) {
        const rect = el.getBoundingClientRect();
        if (rectsOverlap(mascotRect, rect)) {
            return el.dataset.zumfiZone;
        }
    }
    return null;
}

export function useZumfiProximity() {
    const {
        showSpeechBubble, setVisualState,
        pageDataRef, proximityActiveRef,
    } = useZumfi();

    const activeZoneRef = useRef(null);
    const cooldownMapRef = useRef({});
    const lastCheckRef = useRef(0);
    const holdTimerRef = useRef(null);
    const mismatchCountRef = useRef(0);  // zone-exit hysteresis counter

    const isOnCooldown = useCallback((zoneId) => {
        const last = cooldownMapRef.current[zoneId];
        return last ? (Date.now() - last < COOLDOWN_MS) : false;
    }, []);

    const setGlow = useCallback((zoneId, on) => {
        const el = document.querySelector(`[data-zumfi-zone="${zoneId}"]`);
        if (el) {
            el.classList.toggle('zumfi-hover-glow', on);
        }
    }, []);

    // Hard reset — called on drag end. No timers, no conditions.
    const clearActiveZone = useCallback(() => {
        mismatchCountRef.current = 0;
        // Remove glow from any active zone
        if (activeZoneRef.current) {
            setGlow(activeZoneRef.current, false);
            activeZoneRef.current = null;
        }
        // Also remove any stale glows (safety net for zones removed from DOM)
        document.querySelectorAll('.zumfi-hover-glow').forEach(el => {
            el.classList.remove('zumfi-hover-glow');
        });

        // Brief hold so speech bubble isn't immediately overwritten by mood
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
            proximityActiveRef.current = false;
            setVisualState({ animation: 'idle' });
        }, SPEECH_HOLD_MS);
    }, [setGlow, proximityActiveRef, setVisualState]);

    const checkProximity = useCallback((x, y) => {
        // Throttle DOM queries
        const now = Date.now();
        if (now - lastCheckRef.current < THROTTLE_MS) return;
        lastCheckRef.current = now;

        if (!pageDataRef.current) return;

        const newZone = detectZone(x, y);

        // Same zone as before — nothing to do, reset hysteresis
        if (newZone === activeZoneRef.current) {
            mismatchCountRef.current = 0;
            return;
        }

        // Zone changed — require 2 consecutive mismatches before transitioning.
        // Prevents rapid flicker when rabbit is on the boundary between two zones.
        mismatchCountRef.current++;
        if (mismatchCountRef.current < 2) return;
        mismatchCountRef.current = 0;

        // Left previous zone — remove glow
        if (activeZoneRef.current) {
            setGlow(activeZoneRef.current, false);
        }

        if (!newZone) {
            activeZoneRef.current = null;
            return;
        }

        // Entered new zone
        activeZoneRef.current = newZone;
        setGlow(newZone, true);

        // Trigger insight if not on cooldown
        if (!isOnCooldown(newZone)) {
            const insight = generateInsight(newZone, pageDataRef.current);
            if (insight) {
                proximityActiveRef.current = true;
                clearTimeout(holdTimerRef.current);

                showSpeechBubble(insight.text, insight.type);
                setVisualState({
                    expression: insight.expression,
                    mouth: insight.mouth,
                    animation: insight.animation,
                    envEffect: insight.envEffect || null,
                });
                cooldownMapRef.current[newZone] = Date.now();
            }
        }
    }, [pageDataRef, proximityActiveRef, showSpeechBubble, setVisualState, setGlow, isOnCooldown]);

    return { checkProximity, clearActiveZone };
}
