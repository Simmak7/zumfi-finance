import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from '../../../i18n';

export function CategoryPickerSheet({ categories, onSelect, onClose }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const inputRef = useRef(null);
    const sheetRef = useRef(null);

    useEffect(() => {
        // Focus search input after open animation
        const timer = setTimeout(() => inputRef.current?.focus(), 300);
        return () => clearTimeout(timer);
    }, []);

    // Close on backdrop click
    useEffect(() => {
        const handleClick = (e) => {
            if (sheetRef.current && !sheetRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('touchstart', handleClick, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, [onClose]);

    // Prevent body scroll when sheet is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const filtered = categories.filter(cat =>
        cat.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="cat-sheet-overlay">
            <div className="cat-sheet" ref={sheetRef}>
                <div className="cat-sheet-handle" />
                <div className="cat-sheet-header">
                    <div className="cat-sheet-search">
                        <Search size={16} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={t('transactions.searchCategories')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button className="cat-sheet-clear" onClick={() => setSearch('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="cat-sheet-list">
                    {filtered.map(cat => (
                        <button
                            key={cat}
                            className="cat-sheet-item"
                            onClick={() => { onSelect(cat); onClose(); }}
                        >
                            {cat}
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div className="cat-sheet-empty">{t('transactions.noCategoriesFound')}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
