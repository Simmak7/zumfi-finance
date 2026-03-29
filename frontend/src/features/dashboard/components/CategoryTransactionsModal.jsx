import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { searchTransactions } from '../../../services/api';
import { formatDate } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/currencies';
import { SkeletonLoader } from '../../../components/SkeletonLoader';
import './CategoryTransactionsModal.css';

export function CategoryTransactionsModal({ category, month, onClose }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const [year, mon] = month.split('-').map(Number);
                const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
                const lastDay = new Date(year, mon, 0).getDate();
                const endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                const categoryNames = category.groupedCategories
                    ? category.groupedCategories.join(',')
                    : category.category;

                const result = await searchTransactions({
                    category_names: categoryNames,
                    start_date: startDate,
                    end_date: endDate,
                    type: 'expense',
                    limit: 200,
                    sort_by: 'amount',
                    sort_order: 'desc',
                });
                setTransactions(result.transactions || result || []);
            } catch (err) {
                console.error('Failed to load category transactions:', err);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [category, month]);

    return (
        <div className="ctm-overlay" onClick={onClose}>
            <div className="ctm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ctm-header">
                    <div className="ctm-header-title">
                        <span
                            className="ctm-color-dot"
                            style={{ background: category.color }}
                        />
                        <h2>{category.category}</h2>
                        <span className="ctm-amount">
                            {formatCurrency(category.amount)}
                        </span>
                    </div>
                    <button className="mcw-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {category.groupedCategories && (
                    <div className="ctm-subtitle">
                        Includes: {category.groupedCategories.join(', ')}
                    </div>
                )}

                <div className="ctm-body">
                    {loading ? (
                        <SkeletonLoader variant="list-item" count={5} />
                    ) : transactions.length === 0 ? (
                        <div className="ctm-empty">No transactions found.</div>
                    ) : (
                        <div className="ctm-list">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="ctm-tx-row">
                                    <div className="ctm-tx-info">
                                        <span className="ctm-tx-desc">
                                            {tx.description}
                                        </span>
                                        <span className="ctm-tx-meta">
                                            {formatDate(tx.date)}
                                            {category.groupedCategories && (
                                                <span className="ctm-tx-cat">
                                                    {' '}&mdash; {tx.category_name}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <span className="ctm-tx-amount">
                                        -{formatCurrency(tx.amount, tx.currency || 'CZK')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ctm-footer">
                    <span className="ctm-count">
                        {loading ? '' : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
                    </span>
                </div>
            </div>
        </div>
    );
}
