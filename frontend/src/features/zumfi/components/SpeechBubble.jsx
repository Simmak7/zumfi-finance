import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { speechBubbleVariants } from '../animations/variants';
import './SpeechBubble.css';

const SpeechBubble = React.memo(function SpeechBubble({ bubble, position, onDismiss }) {
    const flipBelow = position === 'below';

    return (
        <AnimatePresence>
            {bubble && (
                <motion.div
                    className={`zumfi-speech ${bubble.type || 'neutral'} ${flipBelow ? 'below' : ''}`}
                    variants={speechBubbleVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                    <span>{bubble.text}</span>
                    <div className="speech-arrow" />
                </motion.div>
            )}
        </AnimatePresence>
    );
});

export { SpeechBubble };
