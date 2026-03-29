import React, { useState } from 'react';
import { previewImport } from '../../../services/api';

const DATE_FORMATS = [
    { label: 'YYYY-MM-DD', value: '%Y-%m-%d' },
    { label: 'DD.MM.YYYY', value: '%d.%m.%Y' },
    { label: 'DD/MM/YYYY', value: '%d/%m/%Y' },
    { label: 'MM/DD/YYYY', value: '%m/%d/%Y' },
];

export function StepMapColumns({
    columns, sampleRows, mapping, setMapping,
    dateFormat, setDateFormat, decimalSeparator, setDecimalSeparator,
    defaultCurrency, setDefaultCurrency,
    filename, onPreview, onBack,
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const updateMapping = (key, value) => {
        setMapping(prev => ({ ...prev, [key]: value }));
    };

    const canProceed = mapping.date_column && mapping.description_column && mapping.amount_column;

    const handlePreview = async () => {
        setError('');
        setLoading(true);
        try {
            const data = await previewImport({
                filename,
                mapping,
                date_format: dateFormat,
                decimal_separator: decimalSeparator,
            });
            onPreview(data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Preview failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="step-map">
            <div className="map-grid">
                <div className="map-section">
                    <h3>Column Mapping</h3>
                    <div className="map-fields">
                        {[
                            { key: 'date_column', label: 'Date Column', required: true },
                            { key: 'description_column', label: 'Description Column', required: true },
                            { key: 'amount_column', label: 'Amount Column', required: true },
                            { key: 'type_column', label: 'Type Column', required: false },
                            { key: 'currency_column', label: 'Currency Column', required: false },
                        ].map(({ key, label, required }) => (
                            <div key={key} className="map-field">
                                <label>{label} {required && <span className="required">*</span>}</label>
                                <select
                                    value={mapping[key] || ''}
                                    onChange={(e) => updateMapping(key, e.target.value)}
                                >
                                    <option value="">-- Select column --</option>
                                    {columns.map(col => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <h3>Format Options</h3>
                    <div className="map-fields">
                        <div className="map-field">
                            <label>Date Format</label>
                            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                                {DATE_FORMATS.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="map-field">
                            <label>Decimal Separator</label>
                            <div className="toggle-group">
                                <button
                                    className={`toggle-btn ${decimalSeparator === '.' ? 'active' : ''}`}
                                    onClick={() => setDecimalSeparator('.')}
                                >
                                    Period (1,234.56)
                                </button>
                                <button
                                    className={`toggle-btn ${decimalSeparator === ',' ? 'active' : ''}`}
                                    onClick={() => setDecimalSeparator(',')}
                                >
                                    Comma (1 234,56)
                                </button>
                            </div>
                        </div>
                        <div className="map-field">
                            <label>Default Currency</label>
                            <p className="map-hint">Used when Currency Column is not mapped or empty</p>
                            <select value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value)}>
                                <option value="CZK">CZK - Czech Koruna</option>
                                <option value="EUR">EUR - Euro</option>
                                <option value="USD">USD - US Dollar</option>
                                <option value="GBP">GBP - British Pound</option>
                                <option value="PLN">PLN - Polish Zloty</option>
                                <option value="CHF">CHF - Swiss Franc</option>
                                <option value="JPY">JPY - Japanese Yen</option>
                                <option value="CAD">CAD - Canadian Dollar</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="map-section">
                    <h3>Sample Data</h3>
                    <div className="sample-table-wrapper">
                        <table className="sample-table">
                            <thead>
                                <tr>
                                    {columns.map(col => (
                                        <th key={col}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sampleRows.slice(0, 5).map((row, i) => (
                                    <tr key={i}>
                                        {columns.map(col => (
                                            <td key={col}>{row[col] || ''}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {error && <div className="wizard-error">{error}</div>}

            <div className="wizard-actions">
                <button className="wizard-btn secondary" onClick={onBack}>Back</button>
                <button
                    className="wizard-btn primary"
                    disabled={!canProceed || loading}
                    onClick={handlePreview}
                >
                    {loading ? 'Loading preview...' : 'Preview'}
                </button>
            </div>
        </div>
    );
}
