import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Tag, Hash, FileText } from 'lucide-react';
import { getCategories, updateTransaction } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../utils/currencies';
import { formatDate } from '../../../utils/dates';
import { useTranslation } from '../../../i18n';

export function TransactionDetail({ transaction }) {
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [localCategory, setLocalCategory] = useState(null);
    const { addToast } = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        getCategories().then(setCategories).catch(() => {});
    }, []);

    if (!transaction) return <p>{t('transactions.noTransactions')}</p>;

    const formatAmount = (amount, currency = 'CZK') => {
        return formatCurrency(amount, currency);
    };

    const getConfidenceColor = (confidence) => {
        if (!confidence) return '#888';
        if (confidence >= 0.9) return '#10b981';
        if (confidence >= 0.7) return '#f59e0b';
        return '#ef4444';
    };

    const handlePickCategory = async (categoryName) => {
        if (saving || categoryName === transaction.category_name) return;
        setSaving(true);
        try {
            await updateTransaction(transaction.id, {
                category_name: categoryName,
                status: 'confirmed',
            });
            setLocalCategory(categoryName);
            addToast(t('transactions.categorizedAs', { name: categoryName }), 'success');
            window.dispatchEvent(new Event('transaction-updated'));
        } catch (err) {
            addToast(t('transactions.bulkFailed'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="transaction-detail">
            {/* Amount Hero */}
            <div className="detail-hero" style={{
                borderLeft: `4px solid ${transaction.type === 'income' ? '#10b981' : '#ef4444'}`,
                background: transaction.type === 'income' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                marginBottom: '1.5rem'
            }}>
                <span className="hero-label" style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.5rem'
                }}>{t('txDetail.amount')}</span>
                <span className="hero-value" style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    color: transaction.type === 'income' ? '#10b981' : '#ef4444'
                }}>
                    {transaction.type === 'income' ? '+' : '-'} {formatAmount(Math.abs(transaction.amount), transaction.currency)}
                </span>
            </div>

            {/* Details List */}
            <div className="detail-list">
                <div className="detail-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        <Calendar size={16} /> {t('txDetail.date')}
                    </span>
                    <span className="detail-val" style={{ color: 'white' }}>
                        {formatDate(transaction.date)}
                    </span>
                </div>

                <div className="detail-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        <FileText size={16} /> {t('txDetail.description')}
                    </span>
                    <span className="detail-val" style={{ color: 'white', textAlign: 'right', maxWidth: '60%' }}>
                        {transaction.description}
                    </span>
                </div>

                {transaction.original_description && transaction.original_description !== transaction.description && (
                    <div className="detail-row" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            <FileText size={16} /> {t('txDetail.originalAmount')}
                        </span>
                        <span className="detail-val" style={{
                            fontSize: '0.85em',
                            color: 'rgba(255, 255, 255, 0.5)',
                            textAlign: 'right',
                            maxWidth: '60%'
                        }}>
                            {transaction.original_description}
                        </span>
                    </div>
                )}

                <div className="detail-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        <Tag size={16} /> {t('txDetail.type')}
                    </span>
                    <span className="detail-val" style={{
                        color: transaction.type === 'income' ? '#10b981' : '#ef4444',
                        textTransform: 'capitalize'
                    }}>
                        {transaction.type}
                    </span>
                </div>

                <div className="detail-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        <Tag size={16} /> {t('txDetail.category')}
                    </span>
                    <select
                        value={localCategory ?? transaction.category_name ?? ''}
                        disabled={saving}
                        onChange={(e) => handlePickCategory(e.target.value)}
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '0.5rem',
                            padding: '0.4rem 0.75rem',
                            color: 'white',
                            fontSize: '0.9rem',
                            cursor: saving ? 'wait' : 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="" style={{ background: '#1e293b' }}>{t('transactions.chooseCategory')}</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.name} style={{ background: '#1e293b' }}>
                                {cat.name}
                            </option>
                        ))}
                    </select>
                </div>

                {transaction.section && (
                    <div className="detail-row" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            <Hash size={16} /> {t('categories.section')}
                        </span>
                        <span className="detail-val" style={{ color: 'white' }}>
                            {transaction.section}
                        </span>
                    </div>
                )}

                {transaction.original_amount && transaction.original_currency && (
                    <div className="detail-row" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            <DollarSign size={16} /> {t('txDetail.originalAmount')}
                        </span>
                        <span className="detail-val" style={{ color: 'white' }}>
                            {formatAmount(transaction.original_amount, transaction.original_currency)}
                        </span>
                    </div>
                )}

                <div className="detail-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        <Tag size={16} /> {t('txDetail.status')}
                    </span>
                    <span className="detail-val" style={{ textTransform: 'capitalize', color: 'white' }}>
                        {transaction.status}
                        {transaction.confidence && (
                            <span style={{
                                marginLeft: '8px',
                                color: getConfidenceColor(transaction.confidence),
                                fontWeight: 600
                            }}>
                                ({Math.round(transaction.confidence * 100)}%)
                            </span>
                        )}
                    </span>
                </div>

                {transaction.id && (
                    <div className="detail-row" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            <Hash size={16} /> {t('txDetail.title')}
                        </span>
                        <span className="detail-val" style={{ fontSize: '0.9em', color: 'rgba(255, 255, 255, 0.5)' }}>
                            #{transaction.id}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
