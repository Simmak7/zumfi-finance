import { useState, useEffect, useCallback, useRef } from 'react';
import { useZumfi } from '../context/ZumfiContext';

const MASCOT_WIDTH = 56;
const MASCOT_HEIGHT = 75;
const EDGE_PADDING = 8;

// Home house dimensions (matches ZumfiHome.css)
const HOME_WIDTH = 72;
const HOME_HEIGHT = 76;
const HOME_MARGIN_BOTTOM = 12;   // 0.75rem
const SIDEBAR_PADDING = 32;      // 2rem vertical padding
const SIDEBAR_H_PADDING = 24;    // 1.5rem horizontal sidebar padding
const USER_SECTION_HEIGHT = 76;  // avatar 40 + padding-top 24 + gap 12

function getConstraints() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
        left: EDGE_PADDING,  // Allow roaming on sidebar
        top: EDGE_PADDING,
        right: w - MASCOT_WIDTH - EDGE_PADDING,
        bottom: h - MASCOT_HEIGHT - EDGE_PADDING,
    };
}

function clampPosition(x, y, constraints) {
    return {
        x: Math.max(constraints.left, Math.min(x, constraints.right)),
        y: Math.max(constraints.top, Math.min(y, constraints.bottom)),
    };
}

function isPositionVisible(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return x >= 0 && x < w && y >= 0 && y < h;
}

/**
 * Home position: right next to the house icon in the sidebar.
 * Zumfi sits to the right of the house, vertically centered on it.
 */
export function getHomePosition() {
    const h = window.innerHeight;
    // House vertical center from top:
    // bottom of sidebar = h - SIDEBAR_PADDING
    // user section sits at bottom: h - SIDEBAR_PADDING - USER_SECTION_HEIGHT
    // house margin above user: HOME_MARGIN_BOTTOM
    // house top = h - SIDEBAR_PADDING - USER_SECTION_HEIGHT - HOME_MARGIN_BOTTOM - HOME_HEIGHT
    const houseTop = h - SIDEBAR_PADDING - USER_SECTION_HEIGHT - HOME_MARGIN_BOTTOM - HOME_HEIGHT;
    const houseCenterY = houseTop + HOME_HEIGHT / 2;

    return {
        x: SIDEBAR_H_PADDING + HOME_WIDTH + 8,  // right edge of house + gap = 104
        y: Math.round(houseCenterY - MASCOT_HEIGHT / 2),
    };
}

export function useZumfiDrag() {
    const { position, setPosition } = useZumfi();
    const [constraints, setConstraints] = useState(getConstraints);
    const resizeTimer = useRef(null);

    // On mount: validate position, reset if off-screen
    useEffect(() => {
        const c = getConstraints();
        if (!isPositionVisible(position.x, position.y)) {
            const home = getHomePosition();
            setPosition(home.x, home.y);
        } else {
            const clamped = clampPosition(position.x, position.y, c);
            if (clamped.x !== position.x || clamped.y !== position.y) {
                setPosition(clamped.x, clamped.y);
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Recalculate on resize
    useEffect(() => {
        const handleResize = () => {
            clearTimeout(resizeTimer.current);
            resizeTimer.current = setTimeout(() => {
                const newConstraints = getConstraints();
                setConstraints(newConstraints);
                const clamped = clampPosition(position.x, position.y, newConstraints);
                if (clamped.x !== position.x || clamped.y !== position.y) {
                    setPosition(clamped.x, clamped.y);
                }
            }, 200);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimer.current);
        };
    }, [position, setPosition]);

    const isClick = useCallback((_event, info) => {
        return Math.abs(info.offset.x) < 4 && Math.abs(info.offset.y) < 4;
    }, []);

    // Double-click: return home
    const resetPosition = useCallback(() => {
        const home = getHomePosition();
        setPosition(home.x, home.y);
    }, [setPosition]);

    return {
        constraints,
        isClick,
        position,
        setPosition,
        resetPosition,
    };
}
