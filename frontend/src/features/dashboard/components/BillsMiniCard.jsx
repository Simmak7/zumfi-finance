import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getBillStatus } from '../../../services/api';

const STATUS_CONFIG = {
    paid: { icon: CheckCircle, color: '#10b981', label: 'OK' },
    pending: { icon: Clock, color: '#fbbf24', label: 'Due' },
    overdue: { icon: AlertCircle, color: '#f43f5e', label: '!!' },
};

export function BillsMiniCard({ month }) {
    const [billStatuses, setBillStatuses] = useState([]);

    useEffect(() => {
        getBillStatus(month)
            .then(setBillStatuses)
            .catch(() => setBillStatuses([]));
    }, [month]);

    if (billStatuses.length === 0) return null;

    const paidCount = billStatuses.filter(b => b.status === 'paid').length;
    const totalCount = billStatuses.length;

    return (
        <div className="chart-card bills-mini-card">
            <h3>Bills Status</h3>
            <div className="bills-mini-summary">
                <span className="bills-mini-count">{paidCount}/{totalCount}</span>
                <span className="bills-mini-label">paid</span>
            </div>
            <div className="bills-mini-list">
                {billStatuses.slice(0, 6).map(item => {
                    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                    const Icon = config.icon;
                    return (
                        <div key={item.bill.id} className="bill-mini-row">
                            <Icon size={14} color={config.color} />
                            <span className="bill-mini-name">{item.bill.name}</span>
                            <span className={`bill-mini-badge ${item.status}`}>
                                {config.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            {billStatuses.length > 6 && (
                <div className="bills-mini-more">
                    +{billStatuses.length - 6} more
                </div>
            )}
        </div>
    );
}
