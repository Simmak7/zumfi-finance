import React from 'react';
import './EmptyState.css';

export function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
}) {
    return (
        <div className="empty-state-container">
            {Icon && (
                <div className="empty-state-icon">
                    <Icon size={36} />
                </div>
            )}
            <h3 className="empty-state-title">{title}</h3>
            {description && <p className="empty-state-desc">{description}</p>}
            <div className="empty-state-actions">
                {actionLabel && onAction && (
                    <button className="empty-state-btn primary" onClick={onAction}>
                        {actionLabel}
                    </button>
                )}
                {secondaryLabel && onSecondary && (
                    <button className="empty-state-btn secondary" onClick={onSecondary}>
                        {secondaryLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
