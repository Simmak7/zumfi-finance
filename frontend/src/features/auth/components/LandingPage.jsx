import { useState } from 'react';
import { useTranslation } from '../../../i18n';
import { LoginPage } from './LoginPage';
import { FileText, TrendingUp, PiggyBank, Shield, ArrowRight, X } from 'lucide-react';
import './LandingPage.css';

export function LandingPage() {
    const { t } = useTranslation();
    const [showAuth, setShowAuth] = useState(false);
    const [startAsRegister, setStartAsRegister] = useState(false);

    const openSignIn = () => {
        setStartAsRegister(false);
        setShowAuth(true);
    };

    const openRegister = () => {
        setStartAsRegister(true);
        setShowAuth(true);
    };

    return (
        <div className="landing-page">
            <div className="landing-orb landing-orb-1" />
            <div className="landing-orb landing-orb-2" />

            <div className="landing-content">
                <nav className="landing-nav">
                    <div className="landing-brand">
                        <span className="logo-zum">ZUM</span><span className="logo-fi">FI</span>
                        <span className="brand-label">Finance</span>
                    </div>
                    <button className="landing-nav-signin" onClick={openSignIn}>
                        {t('landing.signIn')}
                    </button>
                </nav>

                <section className="landing-hero">
                    <h1 className="landing-title">
                        {t('landing.heroLine1')}<br />
                        <span className="landing-title-accent">{t('landing.heroLine2')}</span>
                    </h1>
                    <p className="landing-subtitle">{t('landing.heroSubtitle')}</p>
                    <div className="landing-cta-row">
                        <button className="landing-cta-primary" onClick={openRegister}>
                            {t('landing.getStarted')}
                            <ArrowRight size={18} />
                        </button>
                        <span className="landing-cta-hint">{t('landing.free')}</span>
                    </div>
                </section>

                <section className="landing-features">
                    <div className="feature-card">
                        <div className="feature-icon fi-import"><FileText size={22} /></div>
                        <h3>{t('landing.fImportTitle')}</h3>
                        <p>{t('landing.fImportDesc')}</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon fi-portfolio"><TrendingUp size={22} /></div>
                        <h3>{t('landing.fPortfolioTitle')}</h3>
                        <p>{t('landing.fPortfolioDesc')}</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon fi-budget"><PiggyBank size={22} /></div>
                        <h3>{t('landing.fBudgetTitle')}</h3>
                        <p>{t('landing.fBudgetDesc')}</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon fi-secure"><Shield size={22} /></div>
                        <h3>{t('landing.fSecureTitle')}</h3>
                        <p>{t('landing.fSecureDesc')}</p>
                    </div>
                </section>
            </div>

            {showAuth && (
                <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && setShowAuth(false)}>
                    <div className="auth-modal">
                        <button className="auth-modal-close" onClick={() => setShowAuth(false)}>
                            <X size={20} />
                        </button>
                        <LoginPage defaultRegister={startAsRegister} />
                    </div>
                </div>
            )}
        </div>
    );
}
