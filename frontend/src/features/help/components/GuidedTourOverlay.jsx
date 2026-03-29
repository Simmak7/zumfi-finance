import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { useGuidedTour } from '../GuidedTourContext';
import { getFlatSteps, TOUR_PHASES } from '../tourSteps';
import './GuidedTourOverlay.css';

const STEPS = getFlatSteps();
const PADDING = 8;
const TOOLTIP_GAP = 12;

function getRect(el) {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
}

function computeTooltipPos(targetRect, placement, tipW, tipH) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top, left;

    switch (placement) {
        case 'right':
            top = targetRect.top + targetRect.height / 2 - tipH / 2;
            left = targetRect.right + TOOLTIP_GAP + PADDING;
            break;
        case 'left':
            top = targetRect.top + targetRect.height / 2 - tipH / 2;
            left = targetRect.left - tipW - TOOLTIP_GAP - PADDING;
            break;
        case 'top':
            top = targetRect.top - tipH - TOOLTIP_GAP - PADDING;
            left = targetRect.left + targetRect.width / 2 - tipW / 2;
            break;
        case 'bottom':
        default:
            top = targetRect.bottom + TOOLTIP_GAP + PADDING;
            left = targetRect.left + targetRect.width / 2 - tipW / 2;
            break;
    }

    // Clamp within viewport
    if (top < 8) top = 8;
    if (top + tipH > vh - 8) top = vh - tipH - 8;
    if (left < 8) left = 8;
    if (left + tipW > vw - 8) left = vw - tipW - 8;

    return { top, left };
}

export function GuidedTourOverlay() {
    const { active, stepIndex, stopTour, nextStep, prevStep, goToStep } = useGuidedTour();
    const navigate = useNavigate();
    const location = useLocation();
    const tooltipRef = useRef(null);
    const [targetRect, setTargetRect] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    const [transitioning, setTransitioning] = useState(false);

    const step = STEPS[stepIndex];
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === STEPS.length - 1;

    // Find current phase index for the progress bar
    const currentPhaseIdx = TOUR_PHASES.findIndex(p => p.id === step?.phaseId);

    // Navigate to the correct route when step changes
    useEffect(() => {
        if (!active || !step) return;
        if (location.pathname !== step.route) {
            setTransitioning(true);
            navigate(step.route);
        }
    }, [active, stepIndex, step, location.pathname, navigate]);

    // Find and highlight the target element
    const updateTarget = useCallback(() => {
        if (!active || !step) return;

        // Click a tab or element before looking for the target (e.g. switch to Mortgage tab)
        if (step.clickBefore) {
            const clickEl = document.querySelector(step.clickBefore);
            if (clickEl) clickEl.click();
        }

        // Small delay after click to let React re-render the tab content
        const findAndHighlight = () => {
            const selectors = step.target.split(',').map(s => s.trim());
            let el = null;
            for (const sel of selectors) {
                el = document.querySelector(sel);
                if (el) break;
            }

            if (el) {
                const rect = getRect(el);
                setTargetRect(rect);
                setTransitioning(false);

                // Scroll element into view
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // Position tooltip after render settles (double-RAF for scroll + tab switch)
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (tooltipRef.current && el.isConnected) {
                            const tipRect = tooltipRef.current.getBoundingClientRect();
                            const freshRect = getRect(el);
                            setTargetRect(freshRect);
                            const pos = computeTooltipPos(freshRect, step.placement, tipRect.width, tipRect.height);
                            setTooltipPos(pos);
                        }
                    });
                });
            } else {
                setTargetRect(null);
            }
        };

        // If we clicked a tab, wait a tick for React to render new content
        if (step.clickBefore) {
            setTimeout(findAndHighlight, 80);
        } else {
            findAndHighlight();
        }
    }, [active, step]);

    useEffect(() => {
        if (!active) return;
        // Delay to let the page render after navigation
        const timer = setTimeout(updateTarget, 350);
        return () => clearTimeout(timer);
    }, [active, stepIndex, location.pathname, updateTarget]);

    // Re-position on resize/scroll
    useEffect(() => {
        if (!active) return;
        const handler = () => updateTarget();
        window.addEventListener('resize', handler);
        window.addEventListener('scroll', handler, true);
        return () => {
            window.removeEventListener('resize', handler);
            window.removeEventListener('scroll', handler, true);
        };
    }, [active, updateTarget]);

    // Keyboard navigation
    useEffect(() => {
        if (!active) return;
        const handler = (e) => {
            if (e.key === 'Escape') stopTour();
            else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                if (!isLast) nextStep();
                else stopTour();
            }
            else if (e.key === 'ArrowLeft' && !isFirst) prevStep();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [active, isFirst, isLast, nextStep, prevStep, stopTour]);

    if (!active || !step) return null;

    // Skip to next phase
    const handleSkipPhase = () => {
        const nextPhaseIdx = currentPhaseIdx + 1;
        if (nextPhaseIdx >= TOUR_PHASES.length) {
            stopTour();
            return;
        }
        // Find the first step of the next phase
        let idx = 0;
        for (let i = 0; i <= nextPhaseIdx - 1; i++) {
            idx += TOUR_PHASES[i].steps.length;
        }
        goToStep(idx);
    };

    return (
        <div className="guided-tour-overlay">
            {/* Dark backdrop with hole cut out for the target */}
            <svg className="guided-tour-backdrop" width="100%" height="100%">
                <defs>
                    <mask id="tour-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left - PADDING}
                                y={targetRect.top - PADDING}
                                width={targetRect.width + PADDING * 2}
                                height={targetRect.height + PADDING * 2}
                                rx="8"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0" y="0"
                    width="100%" height="100%"
                    fill="rgba(0,0,0,0.65)"
                    mask="url(#tour-mask)"
                />
            </svg>

            {/* Highlight ring around target */}
            {targetRect && (
                <div
                    className="guided-tour-highlight"
                    style={{
                        top: targetRect.top - PADDING,
                        left: targetRect.left - PADDING,
                        width: targetRect.width + PADDING * 2,
                        height: targetRect.height + PADDING * 2,
                    }}
                />
            )}

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className={`guided-tour-tooltip ${transitioning ? 'loading' : ''}`}
                style={{ top: tooltipPos.top, left: tooltipPos.left }}
            >
                {/* Header */}
                <div className="tour-tooltip-header">
                    <span className="tour-phase-badge">{step.phaseLabel}</span>
                    <button className="tour-close-btn" onClick={stopTour} title="End tour">
                        <X size={14} />
                    </button>
                </div>

                {/* Content */}
                <h3 className="tour-tooltip-title">{step.title}</h3>
                <p className="tour-tooltip-text">{step.text}</p>

                {/* Phase progress dots */}
                <div className="tour-phase-dots">
                    {TOUR_PHASES.map((phase, i) => (
                        <div
                            key={phase.id}
                            className={`tour-phase-dot ${i === currentPhaseIdx ? 'active' : ''} ${i < currentPhaseIdx ? 'done' : ''}`}
                            title={phase.label}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div className="tour-tooltip-footer">
                    <span className="tour-step-counter">
                        {stepIndex + 1} / {STEPS.length}
                    </span>

                    <div className="tour-tooltip-actions">
                        <button
                            className="tour-btn tour-btn-skip"
                            onClick={handleSkipPhase}
                            title="Skip to next section"
                        >
                            <SkipForward size={13} />
                            <span>Skip section</span>
                        </button>

                        {!isFirst && (
                            <button className="tour-btn tour-btn-prev" onClick={prevStep}>
                                <ChevronLeft size={14} />
                                <span>Back</span>
                            </button>
                        )}

                        {isLast ? (
                            <button className="tour-btn tour-btn-finish" onClick={stopTour}>
                                Finish
                            </button>
                        ) : (
                            <button className="tour-btn tour-btn-next" onClick={nextStep}>
                                <span>Next</span>
                                <ChevronRight size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
