import React, { createContext, useContext, useState } from 'react';

const InspectorContext = createContext();

export function InspectorProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState(null); // { type: 'transaction'|'goal'|'category', data: ... }

    const openInspector = (type, data) => {
        setContent({ type, data });
        setIsOpen(true);
    };

    const closeInspector = () => {
        setIsOpen(false);
        setContent(null);
    };

    return (
        <InspectorContext.Provider value={{ isOpen, content, openInspector, closeInspector, setIsOpen }}>
            {children}
        </InspectorContext.Provider>
    );
}

export function useInspector() {
    return useContext(InspectorContext);
}
