import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import './CarrotDonation.css';

export function DonateCancelPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="page-container">
            <div className="donate-cancel-page">
                <motion.div
                    className="donate-cancel-zumi"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                >
                    {'\u{1F430}\u{1F4AD}'}
                </motion.div>

                <h1 className="donate-cancel-title">{t('donate.cancelTitle')}</h1>
                <p className="donate-cancel-subtitle">{t('donate.cancelMessage')}</p>

                <motion.button
                    className="donate-back-btn"
                    onClick={() => navigate('/')}
                    whileHover={{ scale: 1.05 }}
                >
                    <ArrowLeft size={16} />
                    {t('donate.backToDashboard')}
                </motion.button>
            </div>
        </div>
    );
}
