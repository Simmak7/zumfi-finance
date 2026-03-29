import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Heart, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import { createDonateCheckout, getDonateConfig } from '../../../services/api';
import { CarrotRain } from './CarrotRain';
import './CarrotDonation.css';

// Static Stripe Payment Links — these are public URLs safe to commit.
// They always point to the project owner's Stripe account.
const PAYMENT_LINKS = {
    1: 'https://buy.stripe.com/3cIcN71tO6rmaIJ1D7dAk02',
    3: 'https://buy.stripe.com/00w28t2xS02YcQR1D7dAk03',
    5: 'https://buy.stripe.com/7sY28t3BWdTOaIJgy1dAk04',
};

const TIERS = [
    { id: 1, carrots: 1, price: '$2', label: 'donate.tier1' },
    { id: 3, carrots: 3, price: '$5', label: 'donate.tier3' },
    { id: 5, carrots: 5, price: '$10', label: 'donate.tier5' },
];

export function CarrotDonation() {
    const { t } = useTranslation();
    const [selectedTier, setSelectedTier] = useState(1);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState(null);
    const [showRain, setShowRain] = useState(false);

    useEffect(() => {
        getDonateConfig()
            .then(setConfig)
            .catch(() => setConfig({ stripe_enabled: false }));
    }, []);

    const handleDonate = async () => {
        // If backend Stripe is configured, use dynamic checkout (with carrot animation on return)
        if (config?.stripe_enabled) {
            setLoading(true);
            try {
                const successUrl = `${window.location.origin}/donate/success?tier=${selectedTier}`;
                const cancelUrl = `${window.location.origin}/donate/cancel`;
                const data = await createDonateCheckout(selectedTier, successUrl, cancelUrl);
                window.location.href = data.checkout_url;
            } catch (err) {
                console.error('Checkout failed:', err);
                setLoading(false);
            }
        } else {
            // No backend Stripe — use static payment link + carrot rain celebration
            window.open(PAYMENT_LINKS[selectedTier], '_blank');
            setShowRain(true);
        }
    };

    const handleRainFinished = useCallback(() => setShowRain(false), []);

    if (!config) return null;

    const rainCount = selectedTier >= 5 ? 60 : selectedTier >= 3 ? 40 : 25;

    return (
        <div className="carrot-donation">
            {showRain && (
                <CarrotRain
                    count={rainCount}
                    duration={6000}
                    onFinished={handleRainFinished}
                />
            )}
            <div className="carrot-donation-header">
                <motion.div
                    className="carrot-donation-icon"
                    animate={{ rotate: [0, -10, 10, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                    {'\u{1F955}'}
                </motion.div>
                <div>
                    <h3 className="carrot-donation-title">{t('donate.title')}</h3>
                    <p className="carrot-donation-subtitle">{t('donate.subtitle')}</p>
                </div>
            </div>

            <div className="carrot-tiers">
                {TIERS.map(tier => (
                    <motion.button
                        key={tier.id}
                        className={`carrot-tier${selectedTier === tier.id ? ' selected' : ''}`}
                        onClick={() => setSelectedTier(tier.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <span className="tier-carrots">
                            {Array.from({ length: tier.carrots }, (_, i) => (
                                <span key={i}>{'\u{1F955}'}</span>
                            ))}
                        </span>
                        <span className="tier-price">{tier.price}</span>
                        <span className="tier-label">{t(tier.label)}</span>
                    </motion.button>
                ))}
            </div>

            <motion.button
                className="carrot-checkout-btn"
                onClick={handleDonate}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <Heart size={16} />
                {loading ? t('donate.processing') : t('donate.buyButton')}
                {!config.stripe_enabled && <ExternalLink size={14} />}
            </motion.button>
        </div>
    );
}
