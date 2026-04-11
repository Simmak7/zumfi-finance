import React from 'react';
import './SpeechBubble.css';

const SpeechBubble = React.memo(function SpeechBubble({ bubble, position, onDismiss }) {
    const flipBelow = position === 'below';

    if (!bubble) return null;

    return (
        <div
            className={`zumfi-speech ${bubble.type || 'neutral'} ${flipBelow ? 'below' : ''}`}
            onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
        >
            <span>{bubble.text}</span>
            <div className="speech-arrow" />
        </div>
    );
});

export { SpeechBubble };
