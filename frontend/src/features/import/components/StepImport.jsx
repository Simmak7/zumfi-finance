import React, { useState } from 'react';
import { CheckCircle, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { executeImport } from '../../../services/api';

export function StepImport({
    filename, mapping, dateFormat, decimalSeparator, defaultCurrency, accountId,
    totalRows, importResult, onExecute, onReset,
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleExecute = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await executeImport({
                filename,
                mapping,
                date_format: dateFormat,
                decimal_separator: decimalSeparator,
                default_currency: defaultCurrency,
                account_id: accountId,
            });
            onExecute(result);
            window.dispatchEvent(new Event('statements-updated'));
        } catch (err) {
            setError(err.response?.data?.detail || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    if (importResult) {
        return (
            <div className="step-result">
                <div className="result-icon">
                    <CheckCircle size={64} color="#10b981" />
                </div>
                <h2>Import Complete</h2>
                <div className="result-stats">
                    <div className="result-stat">
                        <span className="result-stat-value success">{importResult.transactions_imported}</span>
                        <span className="result-stat-label">Imported</span>
                    </div>
                    <div className="result-stat">
                        <span className="result-stat-value skipped">{importResult.transactions_skipped}</span>
                        <span className="result-stat-label">Skipped (duplicates)</span>
                    </div>
                </div>
                <p className="result-message">{importResult.message}</p>
                <div className="wizard-actions centered">
                    <button className="wizard-btn primary" onClick={onReset}>
                        <RotateCcw size={16} />
                        Import Another File
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="step-execute">
            <div className="execute-summary">
                <FileSpreadsheet size={48} strokeWidth={1.5} />
                <h2>Ready to Import</h2>
                <p className="execute-detail">{totalRows} transactions will be processed</p>
                <p className="execute-hint">Duplicates will be automatically skipped</p>
            </div>

            {error && <div className="wizard-error">{error}</div>}

            <div className="wizard-actions centered">
                <button
                    className="wizard-btn primary large"
                    disabled={loading}
                    onClick={handleExecute}
                >
                    {loading ? (
                        <>
                            <div className="spinner small" />
                            Importing...
                        </>
                    ) : (
                        'Start Import'
                    )}
                </button>
            </div>
        </div>
    );
}
