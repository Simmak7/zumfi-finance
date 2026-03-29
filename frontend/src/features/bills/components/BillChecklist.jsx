import React, { useState } from 'react';
import { Trash2, Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import { useInspector } from '../../../context/InspectorContext';
import { useToast } from '../../../context/ToastContext';
import { EmptyState } from '../../../components/EmptyState';
import { deleteBill } from '../../../services/api';
import { formatCurrency } from '../../../utils/currencies';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../i18n';

export function BillChecklist({ billStatuses, onRefresh }) {
    const { openInspector } = useInspector();
    const { addToast } = useToast();
    const { settings } = useSettings();
    const { t } = useTranslation();
    const currency = settings?.preferred_currency || 'CZK';
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleDeleteClick = (e, billId) => {
        e.stopPropagation();
        setConfirmDeleteId(billId);
    };

    const handleDeleteConfirm = async (e, billId) => {
        e.stopPropagation();
        try {
            await deleteBill(billId);
            addToast(t('bills.billRemoved'), 'success');
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error("Error deleting bill:", err);
            addToast(t('bills.billRemoveFailed'), 'error');
        } finally {
            setConfirmDeleteId(null);
        }
    };

    if (!billStatuses || billStatuses.length === 0) {
        return (
            <EmptyState
                icon={Receipt}
                title={t('bills.noBills')}
                description={t('bills.noBillsDesc')}
                actionLabel={t('bills.addFirstBill')}
                onAction={() => openInspector('add-bill', null)}
            />
        );
    }

    return (
        <div className="bill-list">
            {billStatuses.map((item, idx) => (
                <motion.div
                    key={item.bill.id}
                    className="bill-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => openInspector('edit-bill', item.bill)}
                >
                    <div className="bill-info">
                        <span className="bill-name">{item.bill.name}</span>
                    </div>
                    <div className="bill-amount">
                        <span>{formatCurrency(item.paid_amount != null ? item.paid_amount : item.bill.expected_amount, currency)}</span>
                    </div>
                    {confirmDeleteId === item.bill.id ? (
                        <span className="bill-confirm-delete" onClick={e => e.stopPropagation()}>
                            <button className="bill-confirm-yes" onClick={(e) => handleDeleteConfirm(e, item.bill.id)}>
                                {t('bills.remove')}
                            </button>
                            <button className="bill-confirm-no" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}>
                                {t('common.cancel')}
                            </button>
                        </span>
                    ) : (
                        <button
                            className="bill-delete-btn"
                            onClick={(e) => handleDeleteClick(e, item.bill.id)}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </motion.div>
            ))}
        </div>
    );
}
