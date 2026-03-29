import { useRef, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { InspectorPanel } from '../components/InspectorPanel';
import { MobileNav } from '../components/MobileNav';
import { useInspector } from '../context/InspectorContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import clsx from 'clsx';
import './Layout.css';

export function Layout() {
    const { isOpen, closeInspector } = useInspector();
    const mainRef = useRef(null);

    const handleRefresh = useCallback(() => {
        return new Promise((resolve) => {
            // Dispatch a custom event that pages can listen for
            window.dispatchEvent(new Event('pull-to-refresh'));
            // Give pages time to react
            setTimeout(resolve, 600);
        });
    }, []);

    const indicatorRef = usePullToRefresh(mainRef, handleRefresh);

    return (
        <div className={clsx("app-shell", isOpen && "inspector-open")}>
            <aside className="sidebar-col">
                <Sidebar />
            </aside>
            <main className="app-main" ref={mainRef}>
                <div className="ptr-indicator" ref={indicatorRef}>
                    <div className="ptr-spinner" />
                </div>
                <Outlet />
            </main>
            {isOpen && <div className="inspector-backdrop" onClick={closeInspector} />}
            <div className="inspector-col">
                <InspectorPanel />
            </div>
            <MobileNav />
        </div>
    );
}
