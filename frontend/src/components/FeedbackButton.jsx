import { useState, useRef } from 'react';
import { Bug, X, Send, Paperclip, Trash2, CheckCircle } from 'lucide-react';
import { submitFeedback } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../i18n';
import './FeedbackButton.css';

const PAGES = [
    'Dashboard', 'Transactions', 'Budget', 'Portfolio',
    'Bills', 'Import', 'Settings', 'Other',
];

const MAX_FILES = 5;
const MAX_FILE_MB = 5;

export function FeedbackButton() {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [page, setPage] = useState('');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [files, setFiles] = useState([]);
    const fileRef = useRef(null);
    const { addToast } = useToast();
    const { t } = useTranslation();

    const reset = () => {
        setPage('');
        setSubject('');
        setDescription('');
        setContactEmail('');
        setFiles([]);
    };

    const handleClose = () => {
        setOpen(false);
        reset();
    };

    const handleFiles = (e) => {
        const incoming = Array.from(e.target.files || []);
        const valid = incoming.filter(f => f.size <= MAX_FILE_MB * 1024 * 1024);
        setFiles(prev => [...prev, ...valid].slice(0, MAX_FILES));
        if (fileRef.current) fileRef.current.value = '';
    };

    const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!subject.trim() || !description.trim() || !page) return;

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('subject', subject.trim());
            formData.append('page', page);
            formData.append('description', description.trim());
            formData.append('contact_email', contactEmail.trim());
            for (const f of files) {
                formData.append('attachments', f);
            }
            await submitFeedback(formData);
            addToast(t('feedback.success'), 'success', 5000);
            handleClose();
        } catch {
            addToast(t('feedback.error'), 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <button
                className="feedback-trigger"
                onClick={() => setOpen(true)}
                title={t('feedback.reportIssue')}
            >
                <Bug size={18} />
                <span>{t('feedback.fixMe')}</span>
            </button>

            {open && (
                <div className="feedback-overlay" onClick={handleClose}>
                    <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="feedback-header">
                            <h2>{t('feedback.title')}</h2>
                            <button className="feedback-close" onClick={handleClose}>
                                <X size={20} />
                            </button>
                        </div>
                        <p className="feedback-subtitle">{t('feedback.subtitle')}</p>

                        <form className="feedback-form" onSubmit={handleSubmit}>
                            <div className="feedback-field">
                                <label>{t('feedback.page')} *</label>
                                <select value={page} onChange={(e) => setPage(e.target.value)} required>
                                    <option value="">{t('feedback.selectPage')}</option>
                                    {PAGES.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="feedback-field">
                                <label>{t('feedback.subject')} *</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder={t('feedback.subjectPlaceholder')}
                                    maxLength={200}
                                    required
                                />
                            </div>

                            <div className="feedback-field">
                                <label>{t('feedback.description')} *</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('feedback.descriptionPlaceholder')}
                                    rows={5}
                                    maxLength={5000}
                                    required
                                />
                            </div>

                            <div className="feedback-field">
                                <label>{t('feedback.attachments')}</label>
                                <div className="feedback-file-area">
                                    <button
                                        type="button"
                                        className="feedback-attach-btn"
                                        onClick={() => fileRef.current?.click()}
                                        disabled={files.length >= MAX_FILES}
                                    >
                                        <Paperclip size={14} />
                                        {t('feedback.addScreenshot')}
                                    </button>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFiles}
                                        style={{ display: 'none' }}
                                    />
                                    <span className="feedback-file-hint">
                                        {t('feedback.fileHint', { max: MAX_FILES, mb: MAX_FILE_MB })}
                                    </span>
                                </div>
                                {files.length > 0 && (
                                    <div className="feedback-file-list">
                                        {files.map((f, i) => (
                                            <div key={i} className="feedback-file-item">
                                                <span>{f.name}</span>
                                                <button type="button" onClick={() => removeFile(i)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="feedback-field">
                                <label>{t('feedback.email')}</label>
                                <input
                                    type="email"
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    placeholder={t('feedback.emailPlaceholder')}
                                />
                                <span className="feedback-field-hint">{t('feedback.emailHint')}</span>
                            </div>

                            <button
                                type="submit"
                                className="feedback-submit"
                                disabled={sending || !subject.trim() || !description.trim() || !page}
                            >
                                {sending ? (
                                    <span className="feedback-sending">{t('feedback.sending')}</span>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        {t('feedback.send')}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
