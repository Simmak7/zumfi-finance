import React, { useRef, useEffect } from 'react';
import { useInspector } from '../context/InspectorContext';
import { X } from 'lucide-react';
import { GoalEditor } from '../features/goals/components/GoalEditor';
import { BillEditor } from '../features/bills/components/BillEditor';
import { MortgageEditor } from '../features/bills/components/MortgageEditor';
import { TransactionDetail } from '../features/transactions/components/TransactionDetail';

import { InvestmentForm } from '../features/portfolio/components/InvestmentForm';
import { StockHoldingForm } from '../features/portfolio/components/StockHoldingForm';
import { formatMoney, formatCurrency } from '../utils/currencies';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import './InspectorPanel.css';

export function InspectorPanel() {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';
    const { isOpen, content, closeInspector } = useInspector();
    const panelRef = useRef(null);

    // Close panel when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                closeInspector();
            }
        };

        // Delay adding listener so the opening click doesn't immediately close
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, closeInspector]);

    // Swipe-to-dismiss on mobile
    useEffect(() => {
        if (!isOpen) return;
        const panel = panelRef.current;
        if (!panel || window.innerWidth > 768) return;

        let startX = 0;
        let startY = 0;
        let swiping = false;

        const onTouchStart = (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            swiping = true;
            panel.style.transition = 'none';
        };

        const onTouchMove = (e) => {
            if (!swiping) return;
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            // Only handle horizontal swipes (right direction)
            if (Math.abs(dy) > Math.abs(dx)) {
                swiping = false;
                return;
            }
            if (dx > 0) {
                // Move the inspector-col parent, not the panel itself
                const col = panel.closest('.inspector-col');
                if (col) col.style.transform = `translateX(${dx}px)`;
            }
        };

        const onTouchEnd = (e) => {
            if (!swiping) return;
            swiping = false;
            const dx = e.changedTouches[0].clientX - startX;
            const col = panel.closest('.inspector-col');
            if (col) {
                col.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                if (dx > 80) {
                    col.style.transform = 'translateX(100%)';
                    setTimeout(() => { col.style.transform = ''; closeInspector(); }, 300);
                } else {
                    col.style.transform = 'translateX(0)';
                }
            }
        };

        panel.addEventListener('touchstart', onTouchStart, { passive: true });
        panel.addEventListener('touchmove', onTouchMove, { passive: true });
        panel.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            panel.removeEventListener('touchstart', onTouchStart);
            panel.removeEventListener('touchmove', onTouchMove);
            panel.removeEventListener('touchend', onTouchEnd);
        };
    }, [isOpen, closeInspector]);

    if (!isOpen) return null;

    // Function to determine title
    const getTitle = () => {
        if (content?.type === 'add-goal') return t('inspector.addGoal');
        if (content?.type === 'edit-goal') return t('inspector.editGoal');
        if (content?.type === 'add-bill') return t('inspector.addBill');
        if (content?.type === 'edit-bill') return t('inspector.editBill');
        if (content?.type === 'add-mortgage') return t('inspector.addMortgage');
        if (content?.type === 'edit-mortgage') return t('inspector.editMortgage');
        if (content?.type === 'goal') return t('inspector.goalDetails');
        if (content?.type === 'transaction-detail') return t('inspector.transactionDetails');

        if (content?.type === 'portfolio-investment-form') return content.data?.investment ? t('inspector.editInvestment') : t('inspector.addInvestment');
        if (content?.type === 'portfolio-stock-form') return content.data?.stock ? t('inspector.editStockHolding') : t('inspector.addStockHolding');
        if (content?.type) return content.type.charAt(0).toUpperCase() + content.type.slice(1);
        return t('inspector.details');
    };

    return (
        <aside className="inspector-panel" ref={panelRef}>
            <div className="inspector-header">
                <h2>{getTitle()}</h2>
                <button onClick={closeInspector} className="close-btn"><X size={18} /></button>
            </div>

            <div className="inspector-content">
                {!content ? (
                    <div className="empty-state">
                        <p>{t('inspector.selectItem')}</p>
                    </div>
                ) : (
                    <div className="details-container">
                        {content.type === 'add-goal' && (
                            <GoalEditor onSuccess={() => window.dispatchEvent(new Event('goals-updated'))} />
                        )}

                        {content.type === 'edit-goal' && (
                            <GoalEditor goal={content.data} onSuccess={() => window.dispatchEvent(new Event('goals-updated'))} />
                        )}

                        {content.type === 'add-bill' && (
                            <BillEditor onSuccess={() => window.dispatchEvent(new Event('bills-updated'))} />
                        )}

                        {content.type === 'edit-bill' && (
                            <BillEditor bill={content.data} onSuccess={() => window.dispatchEvent(new Event('bills-updated'))} />
                        )}

                        {content.type === 'add-mortgage' && (
                            <MortgageEditor onSuccess={() => window.dispatchEvent(new Event('mortgages-updated'))} />
                        )}

                        {content.type === 'edit-mortgage' && (
                            <MortgageEditor mortgage={content.data} onSuccess={() => window.dispatchEvent(new Event('mortgages-updated'))} />
                        )}

                        {content.type === 'goal' && (
                            <div className="goal-detail-view">
                                <div className="detail-hero" style={{ borderColor: content.data.color, background: `${content.data.color}10` }}>
                                    <span className="hero-label">{t('inspector.currentSavings')}</span>
                                    <span className="hero-value" style={{ color: content.data.color }}>
                                        {formatCurrency(content.data.current_amount, currency)}
                                    </span>
                                </div>
                                <div className="detail-list">
                                    <div className="detail-row">
                                        <span>{t('inspector.target')}</span>
                                        <span className="detail-val">{formatCurrency(content.data.target_amount || 0, currency)}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span>{t('inspector.progress')}</span>
                                        <span className="detail-val">
                                            {Math.round((content.data.current_amount / (content.data.target_amount || 1)) * 100)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {content.type === 'transaction-detail' && (
                            <TransactionDetail transaction={content.data} />
                        )}

                        {content.type === 'portfolio-investment-form' && (
                            <InvestmentForm investment={content.data?.investment} />
                        )}

                        {content.type === 'portfolio-stock-form' && (
                            <StockHoldingForm stock={content.data?.stock} />
                        )}

                        {/* Default Rendering for Income/Expenses/Others */}
                        {content.type !== 'add-goal' && content.type !== 'edit-goal' && content.type !== 'goal' && content.type !== 'transaction-detail' &&
                         content.type !== 'add-bill' && content.type !== 'edit-bill' &&
                         content.type !== 'add-mortgage' && content.type !== 'edit-mortgage' &&
                         content.type !== 'portfolio-investment-form' &&
                         content.type !== 'portfolio-stock-form' && (
                            <>
                                {content.data.total && (
                                    <div className="detail-hero">
                                        <span className="hero-label">{t('inspector.total')}</span>
                                        <span className="hero-value">{formatCurrency(content.data.total, currency)}</span>
                                    </div>
                                )}

                                {content.data.items && (
                                    <div className="detail-list">
                                        <h3>{t('inspector.breakdown')}</h3>
                                        {content.data.items.map((item, idx) => (
                                            <div key={idx} className="detail-row">
                                                <span>{item.label || item.category}</span>
                                                <span className="detail-val">{formatCurrency(item.amount, currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!content.data.total && !content.data.items && (
                                    <pre className="debug-view">{JSON.stringify(content.data, null, 2)}</pre>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
