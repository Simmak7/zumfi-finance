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
    const resetTimerRef = useRef(null);

    const isOnCooldown = useCallback((zoneId) => {
        const last = cooldownMapRef.current[zoneId];
        return last ? (Date.now() - last < COOLDOWN_MS) : false;
    }, []);

    const setGlow = useCallback((zoneId, on) => {
        const el = document.querySelector(`[data-zumfi-zone="${zoneId}"]`);
        if (el) {
            el.classList.toggle('zumfi-hover-glow', on);
        } else if (on === false && activeZoneRef.current === zoneId) {
            // Zone was removed from DOM while active — clean up
            activeZoneRef.current = null;
        }
    }, []);

    const clearActiveZone = useCallback(() => {
        if (activeZoneRef.current) {
            setGlow(activeZoneRef.current, false);
            activeZoneRef.current = null;
        }
        // Reset proximity flag after a short delay so mood system resumes
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
            proximityActiveRef.current = false;
            // Reset visual state back to idle so the rabbit doesn't stay frozen
            setVisualState({ animation: 'idle' });
        }, 3000);
    }, [setGlow, proximityActiveRef, setVisualState]);

    const checkProximity = useCallback((x, y) => {
        // Throttle DOM queries
        const now = Date.now();
        if (now - lastCheckRef.current < THROTTLE_MS) return;
        lastCheckRef.current = now;

        // Skip if no dashboard data
        if (!pageDataRef.current) return;

        const newZone = detectZone(x, y);

        // Same zone as before — nothing to do
        if (newZone === activeZoneRef.current) return;

        // Left previous zone — remove glow
        if (activeZoneRef.current) {
            setGlow(activeZoneRef.current, false);
        }

        if (!newZone) {
            activeZoneRef.current = null;
            // Start decay timer for proximity flag
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = setTimeout(() => {
                proximityActiveRef.current = false;
                setVisualState({ animation: 'idle' });
            }, 3000);
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
                clearTimeout(resetTimerRef.current);

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
