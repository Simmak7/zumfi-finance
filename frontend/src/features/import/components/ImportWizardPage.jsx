import React, { useState, useCallback, useEffect } from 'react';
import { FileUp, List } from 'lucide-react';
import { StepUpload } from './StepUpload';
import { StepMapColumns } from './StepMapColumns';
import { StepPreview } from './StepPreview';
import { StepImport } from './StepImport';
import { DocumentList } from './DocumentList';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { useTranslation } from '../../../i18n';
import './ImportWizard.css';

const STEPS = ['Upload', 'Map Columns', 'Preview', 'Import'];

export function ImportWizardPage() {
    const { setPageData } = useZumfi();
    const { t } = useTranslation();
    const [view, setView] = useState('wizard'); // 'wizard' or 'documents'
    const [step, setStep] = useState(0);
    const [uploadData, setUploadData] = useState(null);
    const [mapping, setMapping] = useState({
        date_column: '',
        description_column: '',
        amount_column: '',
        type_column: '',
        currency_column: '',
    });
    const [dateFormat, setDateFormat] = useState('%Y-%m-%d');
    const [decimalSeparator, setDecimalSeparator] = useState('.');
    const [defaultCurrency, setDefaultCurrency] = useState('CZK');
    const [accountId, setAccountId] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [importResult, setImportResult] = useState(null);

    const handleUploadComplete = useCallback((data) => {
        setUploadData(data);
        // Auto-guess column mapping from column names
        const cols = data.columns.map(c => c.toLowerCase());
        const guessMap = { date_column: '', description_column: '', amount_column: '', type_column: '', currency_column: '' };
        for (const col of data.columns) {
            const lower = col.toLowerCase();
            if (!guessMap.date_column && (lower.includes('date') || lower.includes('datum'))) {
                guessMap.date_column = col;
            } else if (!guessMap.description_column && (lower.includes('desc') || lower.includes('name') || lower.includes('text') || lower.includes('memo'))) {
                guessMap.description_column = col;
            } else if (!guessMap.amount_column && (lower.includes('amount') || lower.includes('sum') || lower.includes('value') || lower.includes('castka'))) {
                guessMap.amount_column = col;
            } else if (!guessMap.type_column && (lower.includes('type') || lower.includes('kind') || lower.includes('direction'))) {
                guessMap.type_column = col;
            } else if (!guessMap.currency_column && (lower.includes('currency') || lower.includes('curr') || lower.includes('mena'))) {
                guessMap.currency_column = col;
            }
        }
        setMapping(guessMap);
        setStep(1);
    }, []);

    const handlePreviewReady = useCallback((data) => {
        setPreviewData(data);
        setStep(2);
    }, []);

    const handleImportDone = useCallback((result) => {
        setImportResult(result);
    }, []);

    // Feed import data to Zumfi for proximity interactions
    useEffect(() => {
        setPageData({
            _page: 'import',
            step,
            view,
            hasFile: !!uploadData,
            importResult,
            totalRows: uploadData?.total_rows || 0,
        });
        return () => setPageData(null);
    }, [step, view, uploadData, importResult, setPageData]);

    const reset = useCallback(() => {
        setStep(0);
        setUploadData(null);
        setMapping({ date_column: '', description_column: '', amount_column: '', type_column: '', currency_column: '' });
        setDateFormat('%Y-%m-%d');
        setDecimalSeparator('.');
        setDefaultCurrency('CZK');
        setAccountId(null);
        setPreviewData(null);
        setImportResult(null);
    }, []);

    return (
        <div className="page-container">
            <header className="page-header" data-zumfi-zone="import-header">
                <div>
                    <h1 className="page-title">{t('import.title')}</h1>
                    <p className="page-subtitle">{t('import.subtitle')}</p>
                </div>
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${view === 'wizard' ? 'active' : ''}`}
                        onClick={() => setView('wizard')}
                    >
                        <FileUp size={18} />
                        {t('import.importWizard')}
                    </button>
                    <button
                        className={`toggle-btn ${view === 'documents' ? 'active' : ''}`}
                        onClick={() => setView('documents')}
                    >
                        <List size={18} />
                        {t('import.viewDocuments')}
                    </button>
                </div>
            </header>

            {view === 'documents' ? (
                <div data-zumfi-zone="import-documents">
                    <DocumentList />
                </div>
            ) : (
                <>
            <div className="wizard-content" data-zumfi-zone="import-content">
                {step === 0 && (
                    <StepUpload onComplete={handleUploadComplete} />
                )}
                {step === 1 && uploadData && (
                    <StepMapColumns
                        columns={uploadData.columns}
                        sampleRows={uploadData.sample_rows}
                        mapping={mapping}
                        setMapping={setMapping}
                        dateFormat={dateFormat}
                        setDateFormat={setDateFormat}
                        decimalSeparator={decimalSeparator}
                        setDecimalSeparator={setDecimalSeparator}
                        defaultCurrency={defaultCurrency}
                        setDefaultCurrency={setDefaultCurrency}
                        filename={uploadData.filename}
                        onPreview={handlePreviewReady}
                        onBack={() => setStep(0)}
                    />
                )}
                {step === 2 && previewData && (
                    <StepPreview
                        previewData={previewData}
                        onNext={() => setStep(3)}
                        onBack={() => setStep(1)}
                    />
                )}
                {step === 3 && uploadData && (
                    <StepImport
                        filename={uploadData.filename}
                        mapping={mapping}
                        dateFormat={dateFormat}
                        decimalSeparator={decimalSeparator}
                        defaultCurrency={defaultCurrency}
                        accountId={accountId}
                        totalRows={uploadData.total_rows}
                        importResult={importResult}
                        onExecute={handleImportDone}
                        onReset={reset}
                    />
                )}
                    </div>
                </>
            )}
        </div>
    );
}
