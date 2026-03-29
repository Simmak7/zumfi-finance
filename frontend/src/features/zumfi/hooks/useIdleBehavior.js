import { useState, useEffect, useRef, useCallback } from 'react';

const IDLE_STATES = ['sitting', 'idle', 'hop', 'sitting', 'idle', 'walk'];

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

export function useIdleBehavior(active) {
    const [idleState, setIdleState] = useState({
        animation: 'idle',
        expression: 'happy',
        mouth: 'smile',
    });

    const timerRef = useRef(null);
    const stateIndexRef = useRef(0);
    const lastInteractionRef = useRef(Date.now());
    const isSleepingRef = useRef(false);

    const wakeUp = useCallback(() => {
        lastInteractionRef.current = Date.now();
        if (isSleepingRef.current) {
            isSleepingRef.current = false;
            setIdleState({
                animation: 'hop',
                expression: 'happy',
                mouth: 'smile',
            });
        }
    }, []);

    useEffect(() => {
        if (!active) {
            clearTimeout(timerRef.current);
            return;
        }

        function cycle() {
            const now = Date.now();
            const timeSinceInteraction = now - lastInteractionRef.current;

            // Sleep after 25-40 seconds of inactivity
            if (timeSinceInteraction > 25000 && !isSleepingRef.current) {
                isSleepingRef.current = true;
                setIdleState({
                    animation: 'sleep',
                    expression: 'sleepy',
                    mouth: 'neutral',
                });
                timerRef.current = setTimeout(cycle, randomBetween(8000, 15000));
                return;
            }

            if (isSleepingRef.current) {
                // Stay asleep until interaction
                timerRef.current = setTimeout(cycle, 5000);
                return;
            }

            // Cycle through idle states
            stateIndexRef.current = (stateIndexRef.current + 1) % IDLE_STATES.length;
            const nextAnim = IDLE_STATES[stateIndexRef.current];

            let expression = 'happy';
            let mouth = 'smile';

            if (nextAnim === 'sitting') {
                expression = 'neutral';
                mouth = 'neutral';
            } else if (nextAnim === 'walk') {
                expression = 'happy';
                mouth = 'neutral';
            } else if (nextAnim === 'hop') {
                expression = 'excited';
                mouth = 'smile';
            }

            setIdleState({ animation: nextAnim, expression, mouth });

            const delay = nextAnim === 'sitting'
                ? randomBetween(8000, 15000)
                : nextAnim === 'walk'
                    ? randomBetween(4000, 7000)
                    : randomBetween(3000, 6000);

            timerRef.current = setTimeout(cycle, delay);
        }

        // Start first cycle after a short delay
        timerRef.current = setTimeout(cycle, randomBetween(3000, 6000));

        return () => clearTimeout(timerRef.current);
    }, [active]);

    return { idleState, wakeUp };
}
