import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { getCategories } from '../../../services/api';
import { useTranslation } from '../../../i18n';

export function FilterPanel({ filters, onChange, onClear }) {
    const [expanded, setExpanded] = useState(false);
    const [categories, setCategories] = useState([]);
    const [catDropdownOpen, setCatDropdownOpen] = useState(false);
    const catRef = useRef(null);
    const { t } = useTranslation();

    useEffect(() => {
        getCategories().then(setCategories).catch(() => {});
    }, []);

    useEffect(() => {
        const close = (e) => {
            if (catRef.current && !catRef.current.contains(e.target)) setCatDropdownOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const update = (key, value) => onChange({ ...filters, [key]: value });

    const toggleCategory = (name) => {
        const current = filters.category_names || [];
        const next = current.includes(name)
            ? current.filter(c => c !== name)
            : [...current, name];
        update('category_names', next);
    };

    const activeCount = [
        filters.start_date, filters.end_date,
        filters.min_amount, filters.max_amount,
        (filters.category_names || []).length > 0 ? 'x' : null,
    ].filter(Boolean).length;

    return (
        <div className="filter-panel-wrapper">
            <button
                className={`filter-toggle-btn ${activeCount > 0 ? 'has-filters' : ''}`}
                onClick={() => setExpanded(!expanded)}
            >
                <Filter size={16} />
                {t('common.filter')} {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
                <ChevronDown size={14} className={expanded ? 'rotated' : ''} />
            </button>

            {expanded && (
                <div className="filter-panel">
                    <div className="filter-group">
                        <label className="filter-label">{t('txDetail.date')}</label>
                        <div className="filter-row">
                            <input
                                type="date" className="filter-input"
                                value={filters.start_date || ''}
                                onChange={(e) => update('start_date', e.target.value || null)}
                            />
                            <span className="filter-sep">to</span>
                            <input
                                type="date" className="filter-input"
                                value={filters.end_date || ''}
                                onChange={(e) => update('end_date', e.target.value || null)}
                            />
                        </div>
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">{t('txDetail.amount')}</label>
                        <div className="filter-row">
                            <input
                                type="number" className="filter-input" placeholder="Min"
                                value={filters.min_amount || ''}
                                onChange={(e) => update('min_amount', e.target.value || null)}
                            />
                            <span className="filter-sep">-</span>
                            <input
                                type="number" className="filter-input" placeholder="Max"
                                value={filters.max_amount || ''}
                                onChange={(e) => update('max_amount', e.target.value || null)}
                            />
                        </div>
                    </div>

                    <div className="filter-group" ref={catRef}>
                        <label className="filter-label">{t('transactions.category')}</label>
                        <button
                            className="category-dropdown-btn"
                            onClick={() => setCatDropdownOpen(!catDropdownOpen)}
                        >
                            {(filters.category_names || []).length > 0
                                ? t('transactions.selected', { count: filters.category_names.length })
                                : t('transactions.allCategories')}
                            <ChevronDown size={14} />
                        </button>
                        {catDropdownOpen && (
                            <div className="category-dropdown">
                                {categories.map(cat => (
                                    <label key={cat.id || cat.name} className="cat-option">
                                        <input
                                            type="checkbox"
                                            checked={(filters.category_names || []).includes(cat.name)}
                                            onChange={() => toggleCategory(cat.name)}
                                        />
                                        {cat.name}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {activeCount > 0 && (
                        <button className="clear-filters-btn" onClick={onClear}>
                            <X size={14} /> {t('common.clear')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
