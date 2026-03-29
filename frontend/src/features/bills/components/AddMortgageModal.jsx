import React from 'react';
import { X } from 'lucide-react';
import { MortgageEditor } from './MortgageEditor';
import { useTranslation } from '../../../i18n';
import './MortgageDetail.css';

export function AddMortgageModal({ onClose }) {
    const { t } = useTranslation();
    return (
        <div className="mdm-overlay" onClick={onClose}>
            <div className="mdm-modal" onClick={e => e.stopPropagation()}>
                <div className="mdm-header">
                    <div className="mdm-header-left">
                        <div>
                            <h2>{t('mortgageEditor.addMortgage')}</h2>
                            <span className="mdm-header-sub">{t('mortgageEditor.createSubtitle')}</span>
                        </div>
                    </div>
                    <button className="mdm-close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="mdm-body">
                    <MortgageEditor onClose={onClose} />
                </div>
            </div>
        </div>
    );
}
