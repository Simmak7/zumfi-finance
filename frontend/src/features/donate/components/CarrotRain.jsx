import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CARROT_EMOJIS = ['\u{1F955}', '\u{1F955}', '\u{1F955}', '\u{1F955}', '\u{1F955}'];

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

function CarrotParticle({ id, onComplete }) {
    const startX = randomBetween(5, 95);
    const drift = randomBetween(-15, 15);
    const size = randomBetween(24, 48);
    const duration = randomBetween(2, 4.5);
    const delay = randomBetween(0, 2.5);
    const spin = randomBetween(-180, 180);

    return (
        <motion.div
            style={{
                position: 'fixed',
                left: `${startX}%`,
                top: -60,
                fontSize: size,
                zIndex: 99999,
                pointerEvents: 'none',
                willChange: 'transform',
            }}
            initial={{ y: -60, x: 0, rotate: 0, opacity: 1 }}
            animate={{
                y: window.innerHeight + 80,
                x: drift * 5,
                rotate: spin,
                opacity: [1, 1, 1, 0.8, 0],
            }}
            transition={{
                duration,
                delay,
                ease: 'easeIn',
            }}
            onAnimationComplete={() => onComplete(id)}
        >
            {CARROT_EMOJIS[Math.floor(Math.random() * CARROT_EMOJIS.length)]}
        </motion.div>
    );
}

export function CarrotRain({ count = 40, duration = 5000, onFinished }) {
    const [particles, setParticles] = useState(() =>
        Array.from({ length: count }, (_, i) => i)
    );

    const handleComplete = (id) => {
        setParticles(prev => prev.filter(p => p !== id));
    };

    useEffect(() => {
        if (particles.length === 0 && onFinished) {
            onFinished();
        }
    }, [particles.length, onFinished]);

    // Safety timeout
    useEffect(() => {
        const timer = setTimeout(() => {
            setParticles([]);
        }, duration + 3000);
        return () => clearTimeout(timer);
    }, [duration]);

    return (
        <AnimatePresence>
            {particles.map(id => (
                <CarrotParticle key={id} id={id} onComplete={handleComplete} />
            ))}
        </AnimatePresence>
    );
}
