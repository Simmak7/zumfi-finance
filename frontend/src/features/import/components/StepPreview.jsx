import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';

export function StepPreview({ previewData, onNext, onBack }) {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';
    const { total_rows, preview_rows, errors } = previewData;

    return (
        <div className="step-preview">
            <div className="preview-summary">
                <div className="preview-stat">
                    <CheckCircle size={18} color="#10b981" />
                    <span>{total_rows} {t('import.totalRowsFound')}</span>
                </div>
                {errors.length > 0 && (
                    <div className="preview-stat">
                        <AlertTriangle size={18} color="#fbbf24" />
                        <span>{errors.length} {t('import.rowsWithErrors')}</span>
                    </div>
                )}
            </div>

            <div className="preview-table-wrapper">
                <table className="preview-table">
                    <thead>
                        <tr>
                            <th>{t('txDetail.date')}</th>
                            <th>{t('txDetail.description')}</th>
                            <th>{t('txDetail.amount')}</th>
                            <th>{t('txDetail.type')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {preview_rows.map((row, i) => (
                            <tr key={i}>
                                <td>{row.date}</td>
                                <td>{row.description}</td>
                                <td className={`amount ${row.type}`}>
                                    {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount, currency)}
                                </td>
                                <td>
                                    <span className={`type-badge ${row.type}`}>{row.type}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {errors.length > 0 && (
                <div className="preview-errors">
                    <h4>{t('import.errorsWillBeSkipped')}</h4>
                    <ul>
                        {errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="wizard-actions">
                <button className="wizard-btn secondary" onClick={onBack}>{t('import.back')}</button>
                <button className="wizard-btn primary" onClick={onNext}>
                    {t('import.next')}
                </button>
            </div>
        </div>
    );
}
