import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './MonthPicker.css';

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_FULL = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function parseMonth(value) {
    if (!value) return { year: new Date().getFullYear(), month: new Date().getMonth() };
    const [y, m] = value.split('-').map(Number);
    return { year: y, month: m - 1 };
}

function toValue(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function MonthPicker({ value, onChange, max, allowEmpty }) {
    const [open, setOpen] = useState(false);
    const [yearMode, setYearMode] = useState(false);
    const { year: selectedYear, month: selectedMonth } = parseMonth(value);
    const [viewYear, setViewYear] = useState(selectedYear);
    const ref = useRef(null);

    const currentYear = new Date().getFullYear();
    const maxParsed = max ? parseMonth(max) : null;

    useEffect(() => {
        function handleClickOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
                setYearMode(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (open) setViewYear(selectedYear);
    }, [open]);

    function isDisabled(year, month) {
        if (!maxParsed) return false;
        return year > maxParsed.year || (year === maxParsed.year && month > maxParsed.month);
    }

    function handleSelect(month) {
        if (isDisabled(viewYear, month)) return;
        onChange(toValue(viewYear, month));
        setOpen(false);
        setYearMode(false);
    }

    function handleYearSelect(year) {
        setViewYear(year);
        setYearMode(false);
    }

    const label = value
        ? `${MONTH_FULL[selectedMonth]} ${selectedYear}`
        : 'All months';

    const yearStart = currentYear - 5;
    const yearEnd = maxParsed ? maxParsed.year : currentYear;

    return (
        <div className="month-picker-wrapper" ref={ref}>
            <button
                className="month-picker-trigger"
                onClick={() => setOpen(!open)}
                type="button"
            >
                <Calendar size={16} />
                <span>{label}</span>
            </button>
            {allowEmpty && value && (
                <button
                    className="month-picker-clear"
                    onClick={(e) => { e.stopPropagation(); onChange(''); }}
                    type="button"
                    title="Clear month filter"
                >
                    <X size={14} />
                </button>
            )}

            {open && (
                <div className="month-picker-dropdown">
                    <div className="mp-year-row">
                        <button
                            className="mp-arrow"
                            onClick={() => setViewYear(v => v - 1)}
                            disabled={viewYear <= yearStart}
                            type="button"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            className="mp-year-label"
                            onClick={() => setYearMode(!yearMode)}
                            type="button"
                        >
                            {viewYear}
                        </button>
                        <button
                            className="mp-arrow"
                            onClick={() => setViewYear(v => v + 1)}
                            disabled={viewYear >= yearEnd}
                            type="button"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {yearMode ? (
                        <div className="mp-year-grid">
                            {Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => yearStart + i).map(y => (
                                <button
                                    key={y}
                                    className={`mp-year-btn ${y === viewYear ? 'active' : ''}`}
                                    onClick={() => handleYearSelect(y)}
                                    type="button"
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="mp-month-grid">
                            {MONTHS.map((m, i) => {
                                const disabled = isDisabled(viewYear, i);
                                const active = viewYear === selectedYear && i === selectedMonth;
                                return (
                                    <button
                                        key={m}
                                        className={`mp-month-btn ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                        onClick={() => handleSelect(i)}
                                        disabled={disabled}
                                        type="button"
                                    >
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
