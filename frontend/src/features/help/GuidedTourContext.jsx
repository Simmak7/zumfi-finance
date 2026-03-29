import React, { createContext, useContext, useState, useCallback } from 'react';

const GuidedTourContext = createContext(null);

export function GuidedTourProvider({ children }) {
    const [active, setActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    const startTour = useCallback(() => {
        setStepIndex(0);
        setActive(true);
    }, []);

    const stopTour = useCallback(() => {
        setActive(false);
        setStepIndex(0);
    }, []);

    const nextStep = useCallback(() => setStepIndex(i => i + 1), []);
    const prevStep = useCallback(() => setStepIndex(i => Math.max(0, i - 1)), []);
    const goToStep = useCallback((i) => setStepIndex(i), []);

    return (
        <GuidedTourContext.Provider value={{
            active, stepIndex, startTour, stopTour, nextStep, prevStep, goToStep,
        }}>
            {children}
        </GuidedTourContext.Provider>
    );
}

export function useGuidedTour() {
    const ctx = useContext(GuidedTourContext);
    if (!ctx) throw new Error('useGuidedTour must be used within GuidedTourProvider');
    return ctx;
}
