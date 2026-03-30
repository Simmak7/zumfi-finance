import React, { useCallback, useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, animate as motionAnimate } from 'framer-motion';
import { useZumfi } from '../context/ZumfiContext';
import { useZumfiDrag, getHomePosition } from '../hooks/useZumfiDrag';
import { useIdleBehavior } from '../hooks/useIdleBehavior';
import { useFinancialMood } from '../hooks/useFinancialMood';
import { useZumfiProximity } from '../hooks/useZumfiProximity';
import { usePageReaction } from '../hooks/usePageReaction';
import { zumfiVariants } from '../animations/variants';
import { ZumfiBody } from './ZumfiBody';
import { SpeechBubble } from './SpeechBubble';
import { EnvironmentEffects } from './EnvironmentEffects';
import './ZumfiMascot.css';
import './ZumfiProximity.css';

const CLICK_ANIMATIONS = ['hop', 'wave'];

export const ZumfiMascot = React.memo(function ZumfiMascot() {
    const { visual, speechBubble, prefs, setVisualState, showSpeechBubble, dismissSpeechBubble, proximityActiveRef, pageReactionActiveRef } = useZumfi();
    const { constraints, isClick, position, setPosition, resetPosition } = useZumfiDrag();
    const { reaction } = useFinancialMood();
    const hasReaction = !!reaction;
    const { idleState, wakeUp } = useIdleBehavior(!hasReaction);
    const { checkProximity, clearActiveZone } = useZumfiProximity();
    usePageReaction();
    const [clickAnim, setClickAnim] = useState(null);
    const clickTimerRef = useRef(null);

    // Motion values are the single source of truth for visual position.
    // React state (position) is only for persistence (localStorage) and constraints.
    const motionX = useMotionValue(position.x);
    const motionY = useMotionValue(position.y);

    // Sync motion values when position changes externally (resize, mount validation)
    useEffect(() => {
        motionX.set(position.x);
        motionY.set(position.y);
    }, [position.x, position.y, motionX, motionY]);

    // Apply financial reaction or idle state (skip if proximity or page reaction is active)
    useEffect(() => {
        if (proximityActiveRef.current) return;
        if (pageReactionActiveRef.current) return;
        if (reaction) {
            setVisualState({
                expression: reaction.expression,
                mouth: reaction.mouth,
                outfit: reaction.outfit || visual.outfit,
                accessory: reaction.accessory,
                animation: reaction.animation || 'idle',
            });
        } else if (!clickAnim) {
            setVisualState({
                expression: idleState.expression,
                mouth: idleState.mouth,
                animation: idleState.animation,
            });
        }
    }, [reaction, idleState, clickAnim]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDragStart = useCallback(() => {
        document.body.classList.add('zumfi-dragging');
    }, []);

    const handleDrag = useCallback(() => {
        checkProximity(motionX.get(), motionY.get());
    }, [checkProximity, motionX, motionY]);

    const handleDragEnd = useCallback((event, info) => {
        document.body.classList.remove('zumfi-dragging');
        clearActiveZone();
        if (isClick(event, info)) {
            // Barely moved — snap back to pre-drag position and play click anim
            motionX.set(position.x);
            motionY.set(position.y);
            wakeUp();
            const anim = CLICK_ANIMATIONS[Math.floor(Math.random() * CLICK_ANIMATIONS.length)];
            setClickAnim(anim);
            setVisualState({ animation: anim, expression: 'excited', mouth: 'open' });
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = setTimeout(() => {
                setClickAnim(null);
            }, 800);
        } else {
            // Real drag — clamp to constraints and persist
            const clampedX = Math.max(constraints.left, Math.min(motionX.get(), constraints.right));
            const clampedY = Math.max(constraints.top, Math.min(motionY.get(), constraints.bottom));
            motionX.set(clampedX);
            motionY.set(clampedY);
            setPosition(clampedX, clampedY);
        }
    }, [isClick, wakeUp, setVisualState, motionX, motionY, position, constraints, setPosition, clearActiveZone]);

    // Double-click: animate Zumfi home smoothly
    const goHome = useCallback(() => {
        const home = getHomePosition();
        motionAnimate(motionX, home.x, { duration: 0.35, ease: 'easeInOut' });
        motionAnimate(motionY, home.y, {
            duration: 0.35,
            ease: 'easeInOut',
            onComplete: () => resetPosition(),
        });
        showSpeechBubble("Home sweet home!", 'positive', 2000);
    }, [motionX, motionY, resetPosition, showSpeechBubble]);

    // Listen for home icon double-click
    useEffect(() => {
        window.addEventListener('zumi-go-home', goHome);
        return () => window.removeEventListener('zumi-go-home', goHome);
    }, [goHome]);

    // Clean up click timer
    useEffect(() => {
        return () => clearTimeout(clickTimerRef.current);
    }, []);

    if (!prefs.visible) return null;

    const animKey = clickAnim || visual.animation || 'idle';
    const bubblePosition = position.y < 100 ? 'below' : 'above';

    return (
        <motion.div
            className="zumfi-mascot"
            style={{
                x: motionX,
                y: motionY,
            }}
            drag
            dragMomentum={false}
            dragElastic={0.1}
            dragConstraints={{
                left: constraints.left,
                right: constraints.right,
                top: constraints.top,
                bottom: constraints.bottom,
            }}
            onDragStart={handleDragStart}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            onMouseDown={wakeUp}
            onDoubleClick={goHome}
            whileHover={{ scale: 1.05 }}
        >
            <motion.div
                className="zumfi-inner"
                animate={zumfiVariants[animKey] || zumfiVariants.idle}
            >
                <SpeechBubble bubble={speechBubble} position={bubblePosition} onDismiss={dismissSpeechBubble} />
                <EnvironmentEffects effect={visual.envEffect} />
                <ZumfiBody
                    expression={visual.expression}
                    mouth={visual.mouth}
                    outfit={visual.outfit}
                    accessory={visual.accessory}
                />
            </motion.div>
        </motion.div>
    );
});
