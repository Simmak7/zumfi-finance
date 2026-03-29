import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Calendar, FileText, Eye, CheckCircle, AlertCircle, Loader, ArrowRightLeft, Filter } from 'lucide-react';
import { getStatements, deleteStatement, updateStatement, openStatementFile, updateStatementType } from '../../../services/api';
import { formatDate, formatMonthLabel } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';
import './DocumentList.css';

const TYPE_OPTION_KEYS = [
    { value: '', key: 'documents.allTypes' },
    { value: 'bank', key: 'documents.bank' },
    { value: 'savings', key: 'documents.savings' },
    { value: 'stock', key: 'documents.stock' },
    { value: 'stock_pnl', key: 'documents.pnl' },
];

export function DocumentList() {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';
    const [statements, setStatements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterMonth, setFilterMonth] = useState('');

    useEffect(() => {
        loadStatements();
    }, []);

    const loadStatements = async () => {
        try {
            setLoading(true);
            const data = await getStatements();
            setStatements(data);
        } catch (err) {
            setError(t('documents.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('documents.confirmDelete'))) {
            return;
        }

        try {
            await deleteStatement(id);
            setStatements(statements.filter(s => s.id !== id));
            window.dispatchEvent(new Event('statements-updated'));
        } catch (err) {
            setError(t('documents.deleteFailed'));
        }
    };

    const handleStartEdit = (statement) => {
        setEditingId(statement.id);
        setPeriodStart(statement.period_start || '');
        setPeriodEnd(statement.period_end || '');
    };

    const handleSaveEdit = async (id) => {
        try {
            await updateStatement(id, periodStart || null, periodEnd || null);
            setEditingId(null);
            loadStatements();
        } catch (err) {
            setError(t('documents.updateFailed'));
        }
    };

    const handleToggleType = async (statement) => {
        const newType = statement.statement_type === 'savings' ? 'bank' : 'savings';
        try {
            await updateStatementType(statement.id, newType);
            loadStatements();
        } catch (err) {
            setError(t('documents.updateFailed'));
        }
    };

    // Compute available months from statement periods
    const availableMonths = useMemo(() => {
        const monthSet = new Set();
        for (const s of statements) {
            if (s.period_start) {
                const d = s.period_start.slice(0, 7); // "YYYY-MM"
                monthSet.add(d);
            }
            if (s.period_end) {
                const d = s.period_end.slice(0, 7);
                monthSet.add(d);
            }
        }
        return Array.from(monthSet).sort().reverse();
    }, [statements]);

    // Filter statements by type and month
    const filteredStatements = useMemo(() => {
        return statements.filter(s => {
            if (filterType && (s.statement_type || 'bank') !== filterType) return false;
            if (filterMonth) {
                const startMonth = s.period_start ? s.period_start.slice(0, 7) : null;
                const endMonth = s.period_end ? s.period_end.slice(0, 7) : null;
                if (startMonth !== filterMonth && endMonth !== filterMonth) return false;
            }
            return true;
        });
    }, [statements, filterType, filterMonth]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'processing':
                return <Loader size={16} className="status-icon status-processing spin" />;
            case 'completed':
                return <CheckCircle size={16} className="status-icon status-success" />;
            case 'failed':
                return <AlertCircle size={16} className="status-icon status-error" />;
            default:
                return null;
        }
    };

    if (loading) {
        return <div className="document-list-loading">{t('common.loading')}</div>;
    }

    if (error) {
        return <div className="document-list-error">{error}</div>;
    }

    return (
        <div className="document-list">
            {statements.length > 0 && (
                <div className="document-filters">
                    <div className="document-filter">
                        <Filter size={14} />
                        <select
                            value={filterType}
                            onChange={e => setFilterType(e.target.value)}
                        >
                            {TYPE_OPTION_KEYS.map(o => (
                                <option key={o.value} value={o.value}>{t(o.key)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="document-filter">
                        <Calendar size={14} />
                        <select
                            value={filterMonth}
                            onChange={e => setFilterMonth(e.target.value)}
                        >
                            <option value="">{t('documents.allMonths')}</option>
                            {availableMonths.map(m => (
                                <option key={m} value={m}>{formatMonthLabel(m)}</option>
                            ))}
                        </select>
                    </div>
                    {(filterType || filterMonth) && (
                        <span className="document-filter-count">
                            {filteredStatements.length} of {statements.length}
                        </span>
                    )}
                </div>
            )}

            {statements.length === 0 ? (
                <p className="document-list-empty">{t('documents.noDocuments')}</p>
            ) : filteredStatements.length === 0 ? (
                <p className="document-list-empty">{t('documents.noMatchingDocuments')}</p>
            ) : (
                <div className="document-list-grid">
                    {filteredStatements.map((statement) => (
                        <div key={statement.id} className="document-card">
                            <div className="document-header">
                                {getStatusIcon(statement.status)}
                                <FileText size={24} />
                                <div className="document-info">
                                    <h3>{statement.filename}</h3>
                                    <p className="document-meta">
                                        {statement.bank_name && <span>{t('documents.bank')}: {statement.bank_name}</span>}
                                        {statement.statement_type === 'savings' && (
                                            <span className="savings-badge">Savings</span>
                                        )}
                                        {statement.statement_type === 'stock' && (
                                            <span className="savings-badge stock-badge">Stock</span>
                                        )}
                                        {statement.statement_type === 'stock_pnl' && (
                                            <span className="savings-badge pnl-badge">P&L</span>
                                        )}
                                        <span>{t('documents.uploaded')}: {formatDate(statement.upload_date)}</span>
                                        {statement.statement_type !== 'savings' && statement.statement_type !== 'stock' && statement.statement_type !== 'stock_pnl' && (
                                            <span className="transaction-count-badge">
                                                {statement.transaction_count || 0} {t('documents.transactions')}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="document-period">
                                {editingId === statement.id ? (
                                    <div className="period-edit">
                                        <label>
                                            {t('documents.periodStart')}:
                                            <input
                                                type="date"
                                                value={periodStart}
                                                onChange={(e) => setPeriodStart(e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            {t('documents.periodEnd')}:
                                            <input
                                                type="date"
                                                value={periodEnd}
                                                onChange={(e) => setPeriodEnd(e.target.value)}
                                            />
                                        </label>
                                        <div className="period-actions">
                                            <button onClick={() => handleSaveEdit(statement.id)}>{t('common.save')}</button>
                                            <button onClick={() => setEditingId(null)}>{t('common.cancel')}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="period-display">
                                        <div>
                                            <p>
                                                <strong>{t('documents.period')}:</strong>{' '}
                                                {statement.period_start && statement.period_end
                                                    ? `${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}`
                                                    : t('documents.notAssigned')}
                                            </p>
                                            {statement.closing_balance && (
                                                <p className="closing-balance">
                                                    <strong>{t('documents.balance')}:</strong> {formatCurrency(statement.closing_balance, currency)}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            className="btn-edit-period"
                                            onClick={() => handleStartEdit(statement)}
                                        >
                                            <Calendar size={16} />
                                            {t('documents.assignToMonth')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="document-actions">
                                {statement.statement_type !== 'stock' && statement.statement_type !== 'stock_pnl' && (
                                    <button
                                        className={`btn-toggle-type ${statement.statement_type === 'savings' ? 'btn-toggle-savings' : ''}`}
                                        onClick={() => handleToggleType(statement)}
                                        title={statement.statement_type === 'savings' ? t('documents.changeToBankStatement') : t('documents.changeToSavingsStatement')}
                                    >
                                        <ArrowRightLeft size={16} />
                                        {statement.statement_type === 'savings' ? t('documents.markAsBank') : t('documents.markAsSavings')}
                                    </button>
                                )}
                                {statement.has_file && (
                                    <button
                                        className="btn-view"
                                        onClick={() => openStatementFile(statement.id)}
                                        title={t('documents.viewOriginal')}
                                    >
                                        <Eye size={16} />
                                        {t('documents.view')}
                                    </button>
                                )}
                                <button
                                    className="btn-delete"
                                    onClick={() => handleDelete(statement.id)}
                                    title={t('documents.delete')}
                                >
                                    <Trash2 size={16} />
                                    {t('documents.delete')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
