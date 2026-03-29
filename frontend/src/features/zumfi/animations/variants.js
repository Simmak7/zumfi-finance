export const zumfiVariants = {
    idle: {
        y: [0, -3, 0],
        transition: {
            y: { repeat: Infinity, duration: 3, ease: 'easeInOut' },
        },
    },

    hop: {
        y: [0, -22, 0],
        rotate: [0, -5, 5, 0],
        transition: {
            duration: 0.5,
            ease: 'easeOut',
        },
    },

    walk: {
        x: [0, 8, 0, -8, 0],
        rotate: [0, 3, 0, -3, 0],
        transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
        },
    },

    wave: {
        rotate: [0, -10, 10, -10, 0],
        transition: {
            duration: 0.8,
            ease: 'easeInOut',
        },
    },

    sleep: {
        y: [0, 2, 0],
        scale: [1, 0.98, 1],
        transition: {
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
        },
    },

    celebrate: {
        y: [0, -25, 0, -15, 0],
        rotate: [0, -8, 8, -4, 0],
        scale: [1, 1.1, 1, 1.05, 1],
        transition: {
            duration: 1,
            ease: 'easeOut',
        },
    },

    sitting: {
        y: [0, -1, 0],
        transition: {
            y: { repeat: Infinity, duration: 5, ease: 'easeInOut' },
        },
    },
};

export const speechBubbleVariants = {
    initial: { opacity: 0, y: 10, scale: 0.8 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.8 },
};
