import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, AlertCircle, Check, CheckSquare, Square, Copy,
    ShoppingBag, Utensils, Plane, Home, Wifi, Zap, HelpCircle,
    ChevronDown, SlidersHorizontal,
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import {
    searchTransactions, updateTransaction, getCategories,
    bulkUpdateTransactions, categorizeSimilar, getStatements,
} from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { useInspector } from '../../../context/InspectorContext';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import { EmptyState } from '../../../components/EmptyState';
import { formatCurrency } from '../../../utils/currencies';
import { formatDate } from '../../../utils/dates';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { useTranslation } from '../../../i18n';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import '../../../pages/Transactions.css';

const CATEGORY_ICONS = {
    'Groceries': ShoppingBag, 'Eating out': Utensils, 'Transport': Plane,
    'Our flat': Home, 'Internet': Wifi, 'Electricity': Zap, 'Unknown': HelpCircle,
};

const PAGE_SIZE = 50;

export function TransactionsPage() {
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQ, setSearchQ] = useState('');
    const [typeFilter, setTypeFilter] = useState(null);
    const [statusFilter, setStatusFilter] = useState(null);
    const [offset, setOffset] = useState(0);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkCategory, setBulkCategory] = useState('');
    const [sortBy, setSortBy] = useState(localStorage.getItem('tx-sort-by') || 'date');
    const [sortOrder, setSortOrder] = useState(localStorage.getItem('tx-sort-order') || 'desc');
    const [statements, setStatements] = useState([]);
    const [selectedStatement, setSelectedStatement] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [catDropdownOpen, setCatDropdownOpen] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [catPickerTx, setCatPickerTx] = useState(null);
    const { addToast } = useToast();
    const { openInspector } = useInspector();
    const { setPageData } = useZumfi();
    const { t } = useTranslation();
    const debounceRef = useRef(null);
    const doSearchRef = useRef(null);
    const catDropdownRef = useRef(null);

    const handleTransactionClick = (tx) => {
        openInspector('transaction-detail', tx);
    };

    // Load categories and statements on mount
    useEffect(() => {
        getCategories().then(setCategories).catch(() => {});
        getStatements().then(stmts => {
            const sorted = (stmts || [])
                .filter(s => s.status === 'completed' && s.statement_type === 'bank')
                .sort((a, b) => (b.period_end || '').localeCompare(a.period_end || ''));
            setStatements(sorted);
        }).catch(() => {});
    }, []);

    // Close category dropdown on outside click
    useEffect(() => {
        const close = (e) => {
            if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) {
                setCatDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    // Listen for category updates
    useEffect(() => {
        const handleCategoryUpdate = () => {
            getCategories().then(setCategories).catch(() => {});
            if (doSearchRef.current) {
                doSearchRef.current(0);
            }
        };
        const handleTransactionUpdate = () => {
            if (doSearchRef.current) {
                doSearchRef.current(0);
            }
        };
        window.addEventListener('categories-updated', handleCategoryUpdate);
        window.addEventListener('transaction-updated', handleTransactionUpdate);
        return () => {
            window.removeEventListener('categories-updated', handleCategoryUpdate);
            window.removeEventListener('transaction-updated', handleTransactionUpdate);
        };
    }, []);

    const doSearch = useCallback(async (newOffset = 0) => {
        setLoading(true);
        try {
            const params = { limit: PAGE_SIZE, offset: newOffset };
            if (searchQ) params.q = searchQ;
            if (typeFilter) params.type = typeFilter;
            if (statusFilter) params.status = statusFilter;
            if (selectedCategories.length > 0) {
                params.category_names = selectedCategories.join(',');
            }
            // Statement filter
            if (selectedStatement) {
                params.statement_id = selectedStatement;
            }
            params.sort_by = sortBy;
            params.sort_order = sortOrder;
            const result = await searchTransactions(params);
            if (newOffset === 0) {
                setTransactions(result.transactions || []);
            } else {
                setTransactions(prev => [...prev, ...(result.transactions || [])]);
            }
            setTotal(result.total || 0);
            setOffset(newOffset);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQ, typeFilter, statusFilter, selectedCategories, selectedStatement, sortBy, sortOrder]);

    // Update ref whenever doSearch changes
    useEffect(() => {
        doSearchRef.current = doSearch;
    }, [doSearch]);

    // Debounced search on query/filter changes
    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(0), 400);
        return () => clearTimeout(debounceRef.current);
    }, [doSearch]);

    const handleCategorize = async (tx, categoryName) => {
        const cat = categories.find(c => c.name === categoryName);
        const section = cat?.section === 'in_and_out' ? 'in_and_out' : tx.type;
        try {
            await updateTransaction(tx.id, {
                category_name: categoryName, status: 'confirmed',
            });
            setTransactions(prev => prev.map(t =>
                t.id === tx.id ? { ...t, status: 'confirmed', category_name: categoryName, section } : t
            ));
            addToast(t('transactions.categorizedAs', { name: categoryName }), 'success');
        } catch (err) {
            console.error('Categorize failed:', err);
        }
    };

    const handleBulkCategorize = async () => {
        if (!bulkCategory || selectedIds.size === 0) return;
        try {
            const result = await bulkUpdateTransactions({
                transaction_ids: [...selectedIds],
                category_name: bulkCategory,
                status: 'confirmed',
            });
            addToast(t('transactions.updated', { count: result.updated }), 'success');
            setSelectedIds(new Set());
            setBulkCategory('');
            doSearch(0);
        } catch (err) {
            console.error('Bulk update failed:', err);
            addToast(t('transactions.bulkFailed'), 'error');
        }
    };

    const handleCategorizeSimilar = async (tx, categoryName) => {
        try {
            const result = await categorizeSimilar({
                description: tx.description,
                category_name: categoryName,
            });
            addToast(t('transactions.categorizedSimilar', { count: result.updated }), 'success');
            doSearch(0);
        } catch (err) {
            console.error('Categorize similar failed:', err);
            addToast(t('transactions.categorizeSimilarFailed'), 'error');
        }
    };

    const handleConfirmCategory = async (tx) => {
        try {
            await updateTransaction(tx.id, {
                category_name: tx.category_name,
                status: 'confirmed',
            });
            setTransactions(prev => prev.map(t =>
                t.id === tx.id ? { ...t, status: 'confirmed' } : t
            ));
            addToast(t('transactions.confirmed', { name: tx.category_name }), 'success');
        } catch (err) {
            console.error('Confirm failed:', err);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    };

    const setQuickFilter = (type, status) => {
        setTypeFilter(type);
        setStatusFilter(status);
    };

    const reviewCount = transactions.filter(t => t.status === 'review').length;

    // Feed transactions data to Zumfi for proximity interactions
    useEffect(() => {
        setPageData({
            _page: 'transactions',
            transactions,
            total,
            reviewCount,
            searchQ,
            typeFilter,
            statusFilter,
            selectedCount: selectedIds.size,
            statements,
            sortBy,
            sortOrder,
        });
        return () => setPageData(null);
    }, [transactions, total, reviewCount, searchQ, typeFilter, statusFilter, selectedIds.size, statements, sortBy, sortOrder, setPageData]);
    const categoryNames = categories.length > 0
        ? categories.map(c => c.name)
        : ['Groceries', 'Eating out', 'Entertainment', 'Transport', 'Electricity', 'Mortgage', 'Internet', 'Our flat'];
    const hasMore = transactions.length < total;

    const statusDotColor = (status) => {
        if (status === 'confirmed') return '#22c55e';
        if (status === 'classified') return '#eab308';
        return '#f43f5e';
    };

    const statusDotLabel = (status) => {
        if (status === 'confirmed') return t('transactions.confirmedBy');
        if (status === 'classified') return t('transactions.autoCategorized');
        return t('transactions.needsReview');
    };

    return (
        <div className="page-container">
            <header className="page-header" data-zumfi-zone="tx-header">
                <div>
                    <h1 className="page-title">{t('transactions.title')}</h1>
                    <p className="page-subtitle">
                        {total > 0 ? t('transactions.ofTotal', { shown: transactions.length, total }) : t('transactions.subtitle')}
                    </p>
                </div>
                <div className="header-actions" data-zumfi-zone="tx-search">
                    <div className="search-bar">
                        <Search size={18} />
                        <input
                            type="text" placeholder={t('transactions.searchPlaceholder')}
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                        />
                        {searchQ && (
                            <button className="search-clear" onClick={() => setSearchQ('')}>
                                <span>&times;</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Statement + sort filters bar */}
            <button
                className="mobile-filters-toggle"
                onClick={() => setMobileFiltersOpen(prev => !prev)}
            >
                <SlidersHorizontal size={16} />
                {t('transactions.filters') || 'Filters'}
                {(selectedStatement || selectedCategories.length > 0) && (
                    <span className="mobile-filter-badge" />
                )}
            </button>
            <div className={`period-filters-row ${mobileFiltersOpen ? 'mobile-open' : ''}`}>
                {statements.length > 0 && (
                    <div className="period-filter-group" data-zumfi-zone="tx-statement-filter">
                        <label className="period-filter-label">{t('transactions.statement')}</label>
                        <select
                            className="statement-select"
                            value={selectedStatement}
                            onChange={(e) => setSelectedStatement(e.target.value)}
                        >
                            <option value="">{t('transactions.allStatements')}</option>
                            {statements.map(s => {
                                const period = s.period_start && s.period_end
                                    ? `${formatDate(s.period_start)} – ${formatDate(s.period_end)}`
                                    : '';
                                const bank = s.bank_name ? s.bank_name.charAt(0).toUpperCase() + s.bank_name.slice(1) : '';
                                const label = [bank, period].filter(Boolean).join(' — ');
                                return (
                                    <option key={s.id} value={s.id}>{label}</option>
                                );
                            })}
                        </select>
                        {selectedStatement && (
                            <button
                                className="period-clear-btn"
                                onClick={() => setSelectedStatement('')}
                                title={t('transactions.clearStatementFilter')}
                            >&times;</button>
                        )}
                    </div>
                )}
                <div className="period-filter-group" data-zumfi-zone="tx-sort">
                    <label className="period-filter-label">{t('transactions.order')}</label>
                    <select
                        className="sort-select"
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [by, order] = e.target.value.split('-');
                            setSortBy(by);
                            setSortOrder(order);
                            localStorage.setItem('tx-sort-by', by);
                            localStorage.setItem('tx-sort-order', order);
                        }}
                    >
                        <option value="date-desc">{t('transactions.newestFirst')}</option>
                        <option value="date-asc">{t('transactions.oldestFirst')}</option>
                        <option value="amount-desc">{t('transactions.highestAmount')}</option>
                        <option value="amount-asc">{t('transactions.lowestAmount')}</option>
                        <option value="description-asc">{t('transactions.nameAZ')}</option>
                        <option value="description-desc">{t('transactions.nameZA')}</option>
                    </select>
                </div>
                <div className="period-filter-group category-filter-group" ref={catDropdownRef}>
                    <label className="period-filter-label">{t('transactions.category')}</label>
                    <button
                        className={clsx('category-filter-btn', selectedCategories.length > 0 && 'has-selection')}
                        onClick={() => setCatDropdownOpen(!catDropdownOpen)}
                    >
                        {selectedCategories.length > 0
                            ? t('transactions.selected', { count: selectedCategories.length })
                            : t('transactions.allCategories')}
                        <ChevronDown size={14} className={catDropdownOpen ? 'rotated' : ''} />
                    </button>
                    {catDropdownOpen && (
                        <div className="category-filter-dropdown">
                            {categories.map(cat => (
                                <label key={cat.id || cat.name} className="cat-option">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(cat.name)}
                                        onChange={() => {
                                            setSelectedCategories(prev =>
                                                prev.includes(cat.name)
                                                    ? prev.filter(c => c !== cat.name)
                                                    : [...prev, cat.name]
                                            );
                                        }}
                                    />
                                    {cat.name}
                                </label>
                            ))}
                        </div>
                    )}
                    {selectedCategories.length > 0 && (
                        <button
                            className="period-clear-btn"
                            onClick={() => setSelectedCategories([])}
                            title={t('transactions.clearCategoryFilter')}
                        >&times;</button>
                    )}
                </div>
            </div>

            <div className="filters-row" data-zumfi-zone="tx-filters">
                {[
                    { label: t('transactions.all'), type: null, status: null },
                    { label: t('transactions.review'), type: null, status: 'review', icon: AlertCircle },
                    { label: t('transactions.expense'), type: 'expense', status: null },
                    { label: t('transactions.income'), type: 'income', status: null },
                ].map(f => (
                    <button
                        key={f.label}
                        className={clsx('filter-pill', typeFilter === f.type && statusFilter === f.status && 'active')}
                        onClick={() => setQuickFilter(f.type, f.status)}
                    >
                        {f.icon && <f.icon size={14} />}
                        {f.label}
                        {f.status === 'review' && reviewCount > 0 && <span className="badge">{reviewCount}</span>}
                    </button>
                ))}
            </div>

            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
                <div className="bulk-toolbar" data-zumfi-zone="tx-bulk">
                    <span className="bulk-count">{t('transactions.selected', { count: selectedIds.size })}</span>
                    <select
                        className="bulk-category-select"
                        value={bulkCategory}
                        onChange={(e) => setBulkCategory(e.target.value)}
                    >
                        <option value="" disabled>{t('transactions.chooseCategory')}</option>
                        {categoryNames.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button className="bulk-apply-btn" onClick={handleBulkCategorize} disabled={!bulkCategory}>
                        <Check size={14} /> {t('transactions.apply')}
                    </button>
                    <button className="bulk-deselect-btn" onClick={() => setSelectedIds(new Set())}>
                        {t('transactions.deselect')}
                    </button>
                </div>
            )}

            <div className="transactions-list" data-zumfi-zone="tx-list">
                {/* Select-all header */}
                {transactions.length > 0 && (
                    <div className="tx-list-header">
                        <button className="tx-checkbox-btn" onClick={toggleSelectAll}>
                            {selectedIds.size === transactions.length
                                ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        <span className="tx-list-header-label">{t('transactions.selectAll')}</span>
                    </div>
                )}

                {loading && transactions.length === 0 ? (
                    <SkeletonLoader variant="list-item" count={5} />
                ) : transactions.length === 0 ? (
                    <EmptyState
                        icon={Search}
                        title={t('transactions.noTransactions')}
                        description={t('transactions.noTransactionsDesc')}
                    />
                ) : (
                    transactions.map((tx, idx) => {
                        const Icon = CATEGORY_ICONS[tx.category_name] || HelpCircle;
                        const isSelected = selectedIds.has(tx.id);
                        return (
                            <motion.div
                                key={tx.id}
                                className={clsx('tx-row', tx.status === 'review' && 'needs-review', isSelected && 'selected', tx.section === 'in_and_out' && 'in-and-out')}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                                onClick={(e) => {
                                    // Don't trigger if clicking checkbox, select, or button
                                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' ||
                                        e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('select')) {
                                        return;
                                    }
                                    handleTransactionClick(tx);
                                }}
                            >
                                <button className="tx-checkbox-btn" onClick={() => toggleSelect(tx.id)}>
                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                </button>
                                <div className={`tx-icon ${tx.type}`}>
                                    <Icon size={20} />
                                </div>
                                <div className="tx-info">
                                    <div className="tx-desc">{tx.description}</div>
                                    <div className="tx-meta">
                                        <span className="tx-date">{formatDate(tx.date)}</span>
                                        <span className="tx-cat-tag">
                                            <span
                                                className="status-dot"
                                                style={{ background: statusDotColor(tx.status) }}
                                                title={statusDotLabel(tx.status)}
                                            />
                                            {tx.category_name || 'Unknown'}
                                            {tx.status === 'classified' && (
                                                <button
                                                    className="confirm-tick-btn"
                                                    title={t('transactions.confirmCategory')}
                                                    onClick={(e) => { e.stopPropagation(); handleConfirmCategory(tx); }}
                                                >
                                                    <Check size={12} />
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <div className="tx-right">
                                    <div className={clsx('tx-amount', tx.section === 'in_and_out' ? 'neutral' : tx.type)}>
                                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency || 'CZK')}
                                        {tx.original_amount && tx.original_currency && (
                                            <span className="tx-original-amount">
                                                {formatCurrency(tx.original_amount, tx.original_currency)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="tx-actions">
                                        {tx.status === 'review' && (
                                            <>
                                                <select
                                                    className="quick-cat-select desktop-only-cat"
                                                    onChange={(e) => handleCategorize(tx, e.target.value)}
                                                    value=""
                                                >
                                                    <option value="" disabled>{t('transactions.categorize')}</option>
                                                    {categoryNames.map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="mobile-cat-btn"
                                                    onClick={(e) => { e.stopPropagation(); setCatPickerTx(tx); }}
                                                >
                                                    {t('transactions.categorize')}
                                                </button>
                                            </>
                                        )}
                                        {tx.category_name && tx.category_name !== 'Unknown' && (
                                            <button
                                                className="categorize-similar-btn"
                                                title={t('transactions.categorizeAllSimilar')}
                                                onClick={() => handleCategorizeSimilar(tx, tx.category_name)}
                                            >
                                                <Copy size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}

                {hasMore && (
                    <div data-zumfi-zone="tx-pagination">
                        <button
                            className="load-more-btn"
                            onClick={() => doSearch(offset + PAGE_SIZE)}
                            disabled={loading}
                        >
                            {loading ? t('transactions.loading') : t('transactions.loadMore', { remaining: total - transactions.length })}
                        </button>
                    </div>
                )}
            </div>

            {catPickerTx && (
                <CategoryPickerSheet
                    categories={categoryNames}
                    onSelect={(cat) => handleCategorize(catPickerTx, cat)}
                    onClose={() => setCatPickerTx(null)}
                />
            )}

        </div>
    );
}
