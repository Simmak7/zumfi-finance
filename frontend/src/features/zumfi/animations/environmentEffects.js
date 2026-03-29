// Environment effect definitions for Zumi mascot.
// Each effect is an array of animated elements rendered around the rabbit.

// Duration each effect stays visible (ms)
export const EFFECT_DURATION = 4000;

// Throttle: minimum time between effects (ms)
export const EFFECT_THROTTLE = 5000;

/**
 * Effect catalogue. Each key maps to a config used by EnvironmentEffects.
 * - elements: array of { type, props } describing SVG/div elements
 * - category: positive | negative | neutral | analysis — for colour theming
 */
export const EFFECTS = {
    // ─── Positive / Growth ─────────────────────────────────────────────
    'raining-coins': {
        category: 'positive',
        elements: Array.from({ length: 7 }, (_, i) => ({
            type: 'coin',
            delay: i * 0.15,
            x: -30 + Math.random() * 60,
            size: 8 + Math.random() * 6,
        })),
    },
    'floating-bills': {
        category: 'positive',
        elements: Array.from({ length: 4 }, (_, i) => ({
            type: 'bill',
            delay: i * 0.25,
            x: -25 + Math.random() * 50,
            size: 12,
        })),
    },
    'golden-sparkles': {
        category: 'positive',
        elements: Array.from({ length: 10 }, (_, i) => ({
            type: 'sparkle',
            delay: i * 0.1,
            angle: (i / 10) * 360,
            distance: 28 + Math.random() * 15,
            size: 3 + Math.random() * 4,
        })),
    },
    'money-tree-growing': {
        category: 'positive',
        elements: [{ type: 'money-tree' }],
    },
    'rising-arrow': {
        category: 'positive',
        elements: [{ type: 'arrow-up' }],
    },
    'rocket-launch': {
        category: 'positive',
        elements: [{ type: 'rocket' }],
    },
    'fireworks': {
        category: 'positive',
        elements: Array.from({ length: 4 }, (_, i) => ({
            type: 'firework-burst',
            delay: i * 0.3,
            x: -30 + Math.random() * 60,
            y: -40 - Math.random() * 20,
            color: i % 2 === 0 ? '#d4a843' : '#8b5cf6',
        })),
    },
    'treasure-chest': {
        category: 'positive',
        elements: [{ type: 'treasure' }],
    },
    'confetti': {
        category: 'positive',
        elements: Array.from({ length: 12 }, (_, i) => ({
            type: 'confetti-piece',
            delay: i * 0.08,
            x: -35 + Math.random() * 70,
            color: ['#d4a843', '#8b5cf6', '#f0d78c', '#6366f1', '#22c55e'][i % 5],
            rotation: Math.random() * 360,
            size: 4 + Math.random() * 4,
        })),
    },
    'piggy-filling': {
        category: 'positive',
        elements: [{ type: 'piggy' }],
    },
    'plant-growing': {
        category: 'positive',
        elements: [{ type: 'plant' }],
    },
    'hearts': {
        category: 'positive',
        elements: Array.from({ length: 5 }, (_, i) => ({
            type: 'heart',
            delay: i * 0.2,
            x: -20 + Math.random() * 40,
            size: 6 + Math.random() * 4,
        })),
    },
    'checkmarks-float': {
        category: 'positive',
        elements: Array.from({ length: 4 }, (_, i) => ({
            type: 'checkmark',
            delay: i * 0.2,
            x: -20 + Math.random() * 40,
            size: 8,
        })),
    },
    'stars-medals': {
        category: 'positive',
        elements: Array.from({ length: 6 }, (_, i) => ({
            type: 'star',
            delay: i * 0.12,
            angle: (i / 6) * 360,
            distance: 30 + Math.random() * 10,
            size: 5 + Math.random() * 4,
        })),
    },
    'trophy': {
        category: 'positive',
        elements: [{ type: 'trophy' }],
    },
    'floating-bills': {
        category: 'positive',
        elements: Array.from({ length: 4 }, (_, i) => ({
            type: 'bill',
            delay: i * 0.25,
            x: -25 + Math.random() * 50,
            size: 12,
        })),
    },

    // ─── Flying / Particle effects ────────────────────────────────────
    'floating-bubbles': {
        category: 'positive',
        elements: Array.from({ length: 8 }, (_, i) => ({
            type: 'bubble',
            delay: i * 0.18,
            x: -25 + Math.random() * 50,
            size: 6 + Math.random() * 8,
        })),
    },
    'musical-notes': {
        category: 'positive',
        elements: Array.from({ length: 5 }, (_, i) => ({
            type: 'musical-note',
            delay: i * 0.22,
            x: -20 + Math.random() * 40,
            size: 7 + Math.random() * 4,
            note: ['♪', '♫', '♬', '♩', '♪'][i],
        })),
    },
    'diamond-sparkles': {
        category: 'positive',
        elements: Array.from({ length: 8 }, (_, i) => ({
            type: 'diamond',
            delay: i * 0.12,
            angle: (i / 8) * 360,
            distance: 25 + Math.random() * 15,
            size: 4 + Math.random() * 3,
        })),
    },
    'snowfall': {
        category: 'neutral',
        elements: Array.from({ length: 8 }, (_, i) => ({
            type: 'snowflake',
            delay: i * 0.2,
            x: -30 + Math.random() * 60,
            size: 5 + Math.random() * 4,
        })),
    },
    'lightning-bolts': {
        category: 'negative',
        elements: Array.from({ length: 3 }, (_, i) => ({
            type: 'lightning',
            delay: i * 0.3,
            x: -18 + i * 18,
        })),
    },
    'swirl-burst': {
        category: 'analysis',
        elements: Array.from({ length: 10 }, (_, i) => ({
            type: 'swirl',
            delay: i * 0.08,
            angle: (i / 10) * 360,
        })),
    },
    'microphone': {
        category: 'analysis',
        elements: [{ type: 'microphone' }],
    },
    'movie-clap': {
        category: 'analysis',
        elements: [{ type: 'movie-clap' }],
    },

    // ─── Negative / Warning ────────────────────────────────────────────
    'rain-cloud': {
        category: 'negative',
        elements: [{ type: 'cloud-rain' }],
    },
    'umbrella-open': {
        category: 'negative',
        elements: [{ type: 'umbrella' }],
    },
    'wilting-plant': {
        category: 'negative',
        elements: [{ type: 'wilt' }],
    },
    'coins-to-drain': {
        category: 'negative',
        elements: Array.from({ length: 5 }, (_, i) => ({
            type: 'drain-coin',
            delay: i * 0.15,
            x: -15 + Math.random() * 30,
            size: 7,
        })),
    },
    'sinking-anchor': {
        category: 'negative',
        elements: [{ type: 'anchor' }],
    },
    'deflating-balloon': {
        category: 'negative',
        elements: [{ type: 'balloon' }],
    },
    'exclamation-marks': {
        category: 'negative',
        elements: Array.from({ length: 3 }, (_, i) => ({
            type: 'exclamation',
            delay: i * 0.15,
            x: -20 + i * 20,
            size: 10,
        })),
    },

    // ─── Analysis / Neutral ────────────────────────────────────────────
    'crystal-ball': {
        category: 'analysis',
        elements: [{ type: 'crystal' }],
    },
    'magnifying-glass': {
        category: 'analysis',
        elements: [{ type: 'magnifier' }],
    },
    'telescope': {
        category: 'analysis',
        elements: [{ type: 'telescope' }],
    },
    'light-bulb': {
        category: 'analysis',
        elements: [{ type: 'bulb' }],
    },
    'house-building': {
        category: 'analysis',
        elements: [{ type: 'house-build' }],
    },
    'thought-clouds': {
        category: 'neutral',
        elements: Array.from({ length: 3 }, (_, i) => ({
            type: 'thought-dot',
            delay: i * 0.25,
            x: 25 + i * 6,
            y: -20 - i * 8,
            size: 4 + i * 2,
        })),
    },
    'question-marks': {
        category: 'neutral',
        elements: Array.from({ length: 3 }, (_, i) => ({
            type: 'question',
            delay: i * 0.2,
            x: -15 + i * 15,
            size: 10,
        })),
    },
};
