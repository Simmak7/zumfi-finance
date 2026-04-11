import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './layout/Layout';
import { DashboardPage } from './features/dashboard/components/DashboardPage';
import { TransactionsPage } from './features/transactions/components/TransactionsPage';
import { BudgetPage } from './features/budget/components/BudgetPage';
import { BillsPage } from './features/bills/components/BillsPage';
import { ImportWizardPage } from './features/import/components/ImportWizardPage';
import { SettingsPage } from './features/settings/components/SettingsPage';
import { HelpPage } from './features/help/components/HelpPage';
import { PortfolioPage } from './features/portfolio/components/PortfolioPage';
import { DonateSuccessPage } from './features/donate/components/DonateSuccessPage';
import { DonateCancelPage } from './features/donate/components/DonateCancelPage';
import { LandingPage } from './features/auth/components/LandingPage';
import { GoogleCallback } from './features/auth/components/GoogleCallback';
import { InspectorProvider } from './context/InspectorContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { MonthProvider } from './context/MonthContext';
import { ToastContainer } from './components/Toast';
import React from 'react';
import { ZumfiProvider } from './features/zumfi/context/ZumfiContext';
import { ZumfiMascot } from './features/zumfi/components/ZumfiMascot';
import { SettingsProvider } from './context/SettingsContext';
import { GuidedTourProvider } from './features/help/GuidedTourContext';
import { GuidedTourOverlay } from './features/help/components/GuidedTourOverlay';
import './App.css';

class ZumfiErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(err) { console.warn('ZumfiMascot error (non-fatal):', err.message); }
    render() { return this.state.hasError ? null : this.props.children; }
}

function AuthGuard({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (!user) {
        return <LandingPage />;
    }

    return children;
}

function ProtectedRoutes() {
    return (
        <AuthGuard>
            <MonthProvider>
            <SettingsProvider>
            <ZumfiProvider>
            <GuidedTourProvider>
                <InspectorProvider>
                    <Routes>
                        <Route path="/" element={<Layout />}>
                            <Route index element={<DashboardPage />} />
                            <Route path="transactions" element={<TransactionsPage />} />
                            <Route path="budget" element={<BudgetPage />} />
                            <Route path="bills" element={<BillsPage />} />
                            <Route path="import" element={<ImportWizardPage />} />
                            <Route path="portfolio" element={<PortfolioPage />} />
                            <Route path="help" element={<HelpPage />} />
                            <Route path="settings" element={<SettingsPage />} />
                            <Route path="donate/success" element={<DonateSuccessPage />} />
                            <Route path="donate/cancel" element={<DonateCancelPage />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </InspectorProvider>
                <GuidedTourOverlay />
                <ZumfiErrorBoundary><ZumfiMascot /></ZumfiErrorBoundary>
            </GuidedTourProvider>
            </ZumfiProvider>
            </SettingsProvider>
            </MonthProvider>
        </AuthGuard>
    );
}

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth/google/callback" element={<GoogleCallback />} />
                <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
        </BrowserRouter>
    );
}

function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <AppRoutes />
                <ToastContainer />
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
