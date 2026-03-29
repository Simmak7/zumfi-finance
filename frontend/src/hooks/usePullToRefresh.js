import { useRef, useEffect, useCallback } from 'react';

export function usePullToRefresh(scrollContainerRef, onRefresh) {
    const startY = useRef(0);
    const pulling = useRef(false);
    const indicatorRef = useRef(null);

    const handleTouchStart = useCallback((e) => {
        // Only activate when scrolled to top
        const el = scrollContainerRef.current;
        if (!el || el.scrollTop > 0) return;
        startY.current = e.touches[0].clientY;
        pulling.current = true;
    }, [scrollContainerRef]);

    const handleTouchMove = useCallback((e) => {
        if (!pulling.current) return;
        const el = scrollContainerRef.current;
        if (!el || el.scrollTop > 0) {
            pulling.current = false;
            if (indicatorRef.current) indicatorRef.current.style.transform = 'translateY(-100%)';
            return;
        }
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0 && dy < 150) {
            e.preventDefault();
            const progress = Math.min(dy / 80, 1);
            if (indicatorRef.current) {
                indicatorRef.current.style.transform = `translateY(${dy * 0.5 - 40}px)`;
                indicatorRef.current.style.opacity = progress;
            }
        }
    }, [scrollContainerRef]);

    const handleTouchEnd = useCallback(async () => {
        if (!pulling.current) return;
        pulling.current = false;
        const indicator = indicatorRef.current;
        if (!indicator) return;

        // Check if pulled enough
        const currentTransform = indicator.style.transform;
        const match = currentTransform.match(/translateY\((.+?)px\)/);
        const currentY = match ? parseFloat(match[1]) : -40;

        if (currentY > 10) {
            // Trigger refresh
            indicator.classList.add('refreshing');
            indicator.style.transform = 'translateY(8px)';
            try {
                await onRefresh();
            } finally {
                indicator.classList.remove('refreshing');
                indicator.style.transform = 'translateY(-100%)';
                indicator.style.opacity = '0';
            }
        } else {
            indicator.style.transform = 'translateY(-100%)';
            indicator.style.opacity = '0';
        }
    }, [onRefresh]);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        // Only on mobile
        if (window.innerWidth > 768) return;

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
        };
    }, [scrollContainerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

    return indicatorRef;
}
