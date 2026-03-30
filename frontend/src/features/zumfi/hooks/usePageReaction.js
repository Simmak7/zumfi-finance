// Page-change reaction hook — auto-triggers a data-driven insight
// when the user navigates to a new page, without requiring drag.

import { useRef, useEffect } from 'react';
import { useZumfi } from '../context/ZumfiContext';
import { generatePageSummary } from '../reactions/insightRouter';

const REACTION_DELAY_MS = 1500;  // wait for page data to populate
const PAGE_COOLDOWN_MS = 60_000; // don't re-react to same page within 60s

export function usePageReaction() {
    const {
        showSpeechBubble, setVisualState,
        pageDataRef, proximityActiveRef, pageReactionActiveRef,
    } = useZumfi();

    const lastPageRef = useRef(null);
    const timerRef = useRef(null);
    const cooldownTimerRef = useRef(null);
    const pageCooldownsRef = useRef({});

    useEffect(() => {
        const handlePageChange = (e) => {
            const newPage = e.detail?.page;
            if (!newPage || newPage === lastPageRef.current) return;

            lastPageRef.current = newPage;
            clearTimeout(timerRef.current);

            // Check per-page cooldown
            const lastTime = pageCooldownsRef.current[newPage];
            if (lastTime && Date.now() - lastTime < PAGE_COOLDOWN_MS) {
                // on cooldown
                return;
            }

            timerRef.current = setTimeout(() => {
                if (proximityActiveRef.current) return;

                const data = pageDataRef.current;
                if (!data || data._page !== newPage) return;

                const insight = generatePageSummary(data);
                if (!insight) return;
                pageReactionActiveRef.current = true;
                showSpeechBubble(insight.text, insight.type);
                setVisualState({
                    expression: insight.expression,
                    mouth: insight.mouth,
                    animation: insight.animation,
                    envEffect: insight.envEffect || null,
                });

                pageCooldownsRef.current[newPage] = Date.now();

                clearTimeout(cooldownTimerRef.current);
                cooldownTimerRef.current = setTimeout(() => {
                    pageReactionActiveRef.current = false;
                }, 5000);
            }, REACTION_DELAY_MS);
        };

        window.addEventListener('zumfi-page-change', handlePageChange);
        return () => {
            window.removeEventListener('zumfi-page-change', handlePageChange);
            clearTimeout(timerRef.current);
            clearTimeout(cooldownTimerRef.current);
        };
    }, [showSpeechBubble, setVisualState, pageDataRef, proximityActiveRef, pageReactionActiveRef]);
}
