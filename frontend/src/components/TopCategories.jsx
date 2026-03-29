import React from 'react';
import { formatMoney } from '../utils/currencies';
import { useTranslation } from '../i18n';
import './SmartComponents.css';

export function TopCategories({ categories }) {
    const { t } = useTranslation();
    if (!categories || categories.length === 0) return null;

    const maxAmount = Math.max(...categories.map(c => c.amount));

    return (
        <div className="smart-card top-cat-card">
            <h3>{t('charts.topCategories')}</h3>
            <div className="cat-list">
                {categories.map((cat, idx) => (
                    <div key={idx} className="cat-item-row">
                        <div className="cat-details">
                            <span className="cat-name">{cat.category}</span>
                            <span className="cat-val">{formatMoney(cat.amount)}</span>
                        </div>
                        <div className="cat-bar-bg">
                            <div
                                className="cat-bar-fill"
                                style={{
                                    width: `${(cat.amount / maxAmount) * 100}%`,
                                    backgroundColor: `hsl(${220 + (idx * 20)}, 70%, 60%)`
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
