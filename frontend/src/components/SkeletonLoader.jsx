import React from 'react';
import './SkeletonLoader.css';

const variants = {
    card: () => (
        <div className="skeleton skeleton-card">
            <div className="skeleton-circle" />
            <div className="skeleton-lines">
                <div className="skeleton-line" style={{ width: '60%' }} />
                <div className="skeleton-line" style={{ width: '40%' }} />
            </div>
        </div>
    ),
    chart: () => (
        <div className="skeleton skeleton-chart">
            <div className="skeleton-line" style={{ width: '40%', marginBottom: 12 }} />
            <div className="skeleton-rect" />
        </div>
    ),
    'list-item': () => (
        <div className="skeleton skeleton-list-item">
            <div className="skeleton-circle skeleton-circle-sm" />
            <div className="skeleton-lines" style={{ flex: 1 }}>
                <div className="skeleton-line" style={{ width: '70%' }} />
                <div className="skeleton-line" style={{ width: '45%' }} />
            </div>
            <div className="skeleton-line" style={{ width: 80 }} />
        </div>
    ),
    text: () => (
        <div className="skeleton skeleton-text">
            <div className="skeleton-line" />
        </div>
    ),
};

export function SkeletonLoader({ variant = 'text', count = 1, className = '' }) {
    const Variant = variants[variant] || variants.text;
    return (
        <div className={`skeleton-wrapper ${className}`}>
            {Array.from({ length: count }, (_, i) => (
                <Variant key={i} />
            ))}
        </div>
    );
}
