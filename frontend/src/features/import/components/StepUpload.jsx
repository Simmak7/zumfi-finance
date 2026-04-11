import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, History, AlertTriangle } from 'lucide-react';
import { uploadImportFile, importExcelHistory } from '../../../services/api';
import { formatDate } from '../../../utils/dates';
import { useTranslation } from '../../../i18n';

export function StepUpload({ onComplete, onExcelHistoryDone }) {
    const { t } = useTranslation();
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [excelMode, setExcelMode] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [historyResult, setHistoryResult] = useState(null);
    const inputRef = useRef(null);
    const excelInputRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['csv', 'xlsx', 'xls', 'pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp', 'heic'].includes(ext)) {
            setError('Unsupported file type. Use CSV, Excel, PDF, Word, or image files');
            return;
        }

        setError('');
        setUploading(true);
        try {
            const data = await uploadImportFile(file);
            // If it's a PDF/Word document, it was auto-parsed, skip to success
            if (data.is_statement) {
                // Format period for display
                let periodText = '';
                if (data.period_start && data.period_end) {
                    const startFmt = formatDate(data.period_start);
                    const endFmt = formatDate(data.period_end);

                    if (startFmt === endFmt) {
                        periodText = ` for ${startFmt}`;
                    } else {
                        periodText = ` from ${startFmt} to ${endFmt}`;
                    }
                }

                // Show success message
                const isSavings = data.statement_type === 'savings';
                const isStock = data.statement_type === 'stock';
                const isPnl = data.statement_type === 'stock_pnl';
                const isZeroTx = !isSavings && !isStock && !isPnl && data.total_rows === 0;
                setHistoryResult({
                    transactions_imported: (isSavings || isStock || isPnl) ? null : data.total_rows,
                    transactions_skipped: 0,
                    isWarning: isZeroTx,
                    message: isPnl
                        ? `P&L statement processed from ${file.name}. ${data.total_rows} trades/dividends synced to Stock Portfolio.`
                        : isStock
                        ? `Stock statement processed from ${file.name}. ${data.total_rows} holdings synced to Stock Portfolio.`
                        : isSavings
                        ? `Savings statement processed from ${file.name}. Balance synced to Portfolio.`
                        : isZeroTx
                        ? (data.message || `No transactions could be extracted from ${file.name}. Try importing as CSV instead with column mapping.`)
                        : `Successfully imported ${data.total_rows} transactions${periodText} from ${file.name}. Go to Dashboard and select the correct month to view them.`
                });
                window.dispatchEvent(new Event('statements-updated'));
            } else {
                // CSV/Excel - proceed to mapping step
                onComplete(data);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleExcelHistory = async (file) => {
        if (!file) return;
        setError('');
        setUploading(true);
        try {
            const result = await importExcelHistory(file, year);
            setHistoryResult(result);
            window.dispatchEvent(new Event('statements-updated'));
        } catch (err) {
            setError(err.response?.data?.detail || 'Excel history import failed');
        } finally {
            setUploading(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setDragging(true);
    };

    if (historyResult) {
        return (
            <div className="step-upload">
                <div className="step-result">
                    <div className="result-icon">
                        {historyResult.isWarning
                            ? <AlertTriangle size={64} color="#f59e0b" />
                            : <History size={64} color="#10b981" />
                        }
                    </div>
                    <h2>{historyResult.isWarning ? t('import.noTransactionsFound') : t('import.importComplete')}</h2>
                    {historyResult.transactions_imported != null && (
                        <div className="result-stats">
                            <div className="result-stat">
                                <span className="result-stat-value success">{historyResult.transactions_imported}</span>
                                <span className="result-stat-label">{t('import.imported')}</span>
                            </div>
                            <div className="result-stat">
                                <span className="result-stat-value skipped">{historyResult.transactions_skipped}</span>
                                <span className="result-stat-label">{t('import.skipped')}</span>
                            </div>
                        </div>
                    )}
                    <p className="result-message">{historyResult.message}</p>
                    <div className="wizard-actions centered">
                        <button className="wizard-btn primary" onClick={() => { setHistoryResult(null); setExcelMode(false); }}>
                            {t('import.done')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="step-upload">
            {!excelMode ? (
                <>
                    <div
                        className={`drop-zone ${dragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onDragLeave={() => setDragging(false)}
                        onClick={() => !uploading && inputRef.current?.click()}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png,.tiff,.tif,.bmp,.webp,.heic,image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFile(e.target.files[0])}
                        />
                        {uploading ? (
                            <div className="drop-zone-content">
                                <div className="spinner" />
                                <p>{t('import.uploading')}</p>
                            </div>
                        ) : (
                            <div className="drop-zone-content">
                                <Upload size={48} strokeWidth={1.5} />
                                <p className="drop-zone-title">
                                    {window.innerWidth <= 768 ? t('import.tapToChoose') : t('import.dropFiles')}
                                </p>
                                <p className="drop-zone-hint"></p>
                            </div>
                        )}
                    </div>

                </>
            ) : (
                <div className="excel-history-panel">
                    <h3>{t('import.importHistoryTitle')}</h3>
                    <p className="excel-history-desc">
                        {t('import.importHistoryDesc')}
                    </p>
                    <div className="excel-history-fields">
                        <div className="map-field">
                            <label>{t('import.year')}</label>
                            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                                {[2023, 2024, 2025, 2026].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <input
                        ref={excelInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={(e) => handleExcelHistory(e.target.files[0])}
                    />

                    <div className="wizard-actions">
                        <button className="wizard-btn secondary" onClick={() => setExcelMode(false)}>
                            {t('import.back')}
                        </button>
                        <button
                            className="wizard-btn primary"
                            disabled={uploading}
                            onClick={() => excelInputRef.current?.click()}
                        >
                            {uploading ? (
                                <>
                                    <div className="spinner small" />
                                    {t('import.executing')}
                                </>
                            ) : (
                                t('import.chooseFinanceXlsx')
                            )}
                        </button>
                    </div>
                </div>
            )}

            {error && <div className="wizard-error">{error}</div>}
        </div>
    );
}
