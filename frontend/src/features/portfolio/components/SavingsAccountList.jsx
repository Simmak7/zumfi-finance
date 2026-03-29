import React, { useState } from 'react';
import { PiggyBank, Percent, Building2, Plus } from 'lucide-react';
import { formatMoney } from '../../../utils/currencies';
import { SavingsAccountModal } from './SavingsAccountModal';
import { useTranslation } from '../../../i18n';

export function SavingsAccountList({ accounts, onRefresh, fullWidth, readOnly }) {
    const { t } = useTranslation();
    const [modalAccount, setModalAccount] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    return (
        <div className={`portfolio-section ${fullWidth ? 'portfolio-section-full' : ''}`}>
            <h2 className="section-title">
                <PiggyBank size={20} />
                {t('portfolio.savingsAccounts')}
                <span className="section-count">{accounts.length}</span>
                {!readOnly && (
                    <button
                        className="section-add-btn"
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={12} />
                        <span>{t('portfolio.addSavingAccount')}</span>
                    </button>
                )}
            </h2>

            {accounts.length === 0 ? (
                <div className="portfolio-empty">
                    <PiggyBank size={32} />
                    <p>{t('portfolio.noSavingsAccounts')}</p>
                    <p className="empty-hint">{t('portfolio.noSavingsAccountsHint')}</p>
                </div>
            ) : (
                <div className="portfolio-cards">
                    {accounts.map(account => (
                        <div
                            key={account.id}
                            className="portfolio-card savings-card"
                            onClick={readOnly ? undefined : () => setModalAccount(account)}
                        >
                            <div className="card-top-row">
                                <div
                                    className="card-color-dot"
                                    style={{ background: account.color || '#22c55e' }}
                                />
                                <span className="card-name">{account.name}</span>
                            </div>
                            {account.institution && (
                                <div className="card-meta">
                                    <Building2 size={14} />
                                    <span>{account.institution}</span>
                                </div>
                            )}
                            <div className="card-balance">
                                {formatMoney(account.balance)} {account.currency}
                            </div>
                            {account.interest_rate && (
                                <div className="card-rate">
                                    <Percent size={14} />
                                    <span>{Number(account.interest_rate)}% APY</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {modalAccount && (
                <SavingsAccountModal
                    account={modalAccount}
                    onClose={() => setModalAccount(null)}
                    onSuccess={onRefresh}
                />
            )}

            {showAddModal && (
                <SavingsAccountModal
                    account={null}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={onRefresh}
                />
            )}
        </div>
    );
}
