import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { CarrotRain } from './CarrotRain';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { useTranslation } from '../../../i18n';
import './CarrotDonation.css';

const TIER_CARROTS = { 1: 1, 3: 3, 5: 5 };

function ZumiCelebration({ tier }) {
    const carrotCount = TIER_CARROTS[tier] || 1;
    const isBucket = tier >= 5;

    return (
        <motion.div
            className="donate-success-zumi"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }}
        >
            <motion.div
                animate={{
                    y: [0, -20, 0, -12, 0, -6, 0],
                    rotate: [0, -8, 8, -5, 5, 0, 0],
                }}
                transition={{ duration: 1.5, delay: 0.8 }}
            >
                {isBucket ? '\u{1F430}\u{1F955}\u{1FAA3}' : '\u{1F430}'}
            </motion.div>

            {/* Carrots Zumi is receiving */}
            <motion.div
                className="donate-success-carrots"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5 }}
            >
                {Array.from({ length: Math.min(carrotCount, 5) }, (_, i) => (
                    <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{
                            delay: 1.4 + i * 0.2,
                            type: 'spring',
                            stiffness: 300,
                            damping: 15,
                        }}
                    >
                        {'\u{1F955}'}
                    </motion.span>
                ))}
            </motion.div>

            {/* Sparkle burst */}
            <AnimatePresence>
                {[...Array(8)].map((_, i) => {
                    const angle = (i / 8) * Math.PI * 2;
                    const radius = 60;
                    return (
                        <motion.span
                            key={`sparkle-${i}`}
                            style={{
                                position: 'absolute',
                                fontSize: 16,
                                left: '50%',
                                top: '50%',
                                pointerEvents: 'none',
                            }}
                            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                            animate={{
                                opacity: [0, 1, 0],
                                x: Math.cos(angle) * radius,
                                y: Math.sin(angle) * radius,
                                scale: [0, 1.2, 0],
                            }}
                            transition={{ duration: 1, delay: 0.8 + i * 0.05 }}
                        >
                            {i % 2 === 0 ? '\u2728' : '\u{1F31F}'}
                        </motion.span>
                    );
                })}
            </AnimatePresence>
        </motion.div>
    );
}

export function DonateSuccessPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tier = parseInt(searchParams.get('tier') || '1', 10);
    const { t } = useTranslation();
    const { setVisualState, showSpeechBubble } = useZumfi();
    const [showRain, setShowRain] = useState(true);
    const rainCount = tier >= 5 ? 60 : tier >= 3 ? 40 : 25;

    useEffect(() => {
        setVisualState({
            expression: 'excited',
            mouth: 'open',
            outfit: 'celebration',
            accessory: 'party-hat',
            animation: 'celebrate',
        });
        showSpeechBubble(t('donate.zumiThanks'), 'happy', 10000);

        return () => {
            setVisualState({
                expression: 'happy',
                mouth: 'smile',
                outfit: 'casual',
                accessory: null,
                animation: 'idle',
            });
        };
    }, []);

    const handleRainFinished = useCallback(() => {
        setShowRain(false);
    }, []);

    return (
        <div className="page-container">
            <div className="donate-success-page">
                {showRain && (
                    <CarrotRain
                        count={rainCount}
                        duration={6000}
                        onFinished={handleRainFinished}
                    />
                )}

                <motion.div
                    className="donate-success-content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <ZumiCelebration tier={tier} />

                    <motion.h1
                        className="donate-success-title"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        {t('donate.thankYou')}
                    </motion.h1>

                    <motion.p
                        className="donate-success-subtitle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                    >
                        {t('donate.thankYouMessage')}
                    </motion.p>

                    <motion.button
                        className="donate-back-btn"
                        onClick={() => navigate('/')}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.5 }}
                        whileHover={{ scale: 1.05 }}
                    >
                        <ArrowLeft size={16} />
                        {t('donate.backToDashboard')}
                    </motion.button>
                </motion.div>
            </div>
        </div>
    );
}
