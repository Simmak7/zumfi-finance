import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EFFECTS, EFFECT_DURATION, EFFECT_THROTTLE } from '../animations/environmentEffects';
import './EnvironmentEffects.css';

// ─── Individual element renderers ──────────────────────────────────────────

function Coin({ x, size, delay }) {
    return (
        <motion.circle
            cx={28 + x} cy={-10} r={size / 2}
            fill="#d4a843" stroke="#b8922e" strokeWidth={0.8}
            initial={{ y: -20, opacity: 0, rotate: 0 }}
            animate={{ y: 80, opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: 1.5, delay, ease: 'easeIn' }}
        />
    );
}

function Bill({ x, delay, size }) {
    return (
        <motion.rect
            x={22 + x} y={60} width={size} height={size * 0.5} rx={1}
            fill="#22c55e" stroke="#16a34a" strokeWidth={0.5}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: -40, opacity: [0, 1, 1, 0], x: [22 + x, 22 + x + 5, 22 + x - 5, 22 + x] }}
            transition={{ duration: 2, delay, ease: 'easeOut' }}
        />
    );
}

function Sparkle({ angle, distance, size, delay }) {
    const rad = (angle * Math.PI) / 180;
    const cx = 28 + Math.cos(rad) * distance;
    const cy = 38 + Math.sin(rad) * distance;
    return (
        <motion.polygon
            points={`${cx},${cy - size} ${cx + size * 0.3},${cy - size * 0.3} ${cx + size},${cy} ${cx + size * 0.3},${cy + size * 0.3} ${cx},${cy + size} ${cx - size * 0.3},${cy + size * 0.3} ${cx - size},${cy} ${cx - size * 0.3},${cy - size * 0.3}`}
            fill="#f0d78c"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 0.8, 1], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.5, delay, ease: 'easeInOut' }}
        />
    );
}

function Heart({ x, size, delay }) {
    const cx = 28 + x;
    return (
        <motion.text
            x={cx} y={50} fontSize={size} fill="#f43f5e" textAnchor="middle"
            initial={{ y: 50, opacity: 0, scale: 0.5 }}
            animate={{ y: -20, opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1] }}
            transition={{ duration: 1.8, delay, ease: 'easeOut' }}
        >
            ♥
        </motion.text>
    );
}

function Checkmark({ x, size, delay }) {
    return (
        <motion.text
            x={28 + x} y={50} fontSize={size} fill="#22c55e" textAnchor="middle" fontWeight="bold"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: -15, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, delay, ease: 'easeOut' }}
        >
            ✓
        </motion.text>
    );
}

function Star({ angle, distance, size, delay }) {
    const rad = (angle * Math.PI) / 180;
    const cx = 28 + Math.cos(rad) * distance;
    const cy = 38 + Math.sin(rad) * distance;
    return (
        <motion.text
            x={cx} y={cy} fontSize={size} fill="#d4a843" textAnchor="middle"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.4, delay, ease: 'easeOut' }}
        >
            ★
        </motion.text>
    );
}

function ConfettiPiece({ x, color, rotation, size, delay }) {
    return (
        <motion.rect
            x={28 + x} y={-10} width={size} height={size * 0.4} rx={0.5}
            fill={color}
            initial={{ y: -10, opacity: 0, rotate: rotation }}
            animate={{ y: 80, opacity: [0, 1, 1, 0], rotate: rotation + 360, x: [28 + x, 28 + x + (Math.random() - 0.5) * 20] }}
            transition={{ duration: 2, delay, ease: 'easeIn' }}
        />
    );
}

function FireworkBurst({ x, y, color, delay }) {
    const particles = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * 360 * (Math.PI / 180);
        return { dx: Math.cos(a) * 15, dy: Math.sin(a) * 15 };
    });
    return (
        <g>
            {particles.map((p, i) => (
                <motion.circle
                    key={i}
                    cx={28 + x} cy={38 + y} r={2}
                    fill={color}
                    initial={{ x: 0, y: 0, opacity: 0 }}
                    animate={{ x: p.dx, y: p.dy, opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, delay: delay + i * 0.03 }}
                />
            ))}
        </g>
    );
}

function DrainCoin({ x, size, delay }) {
    return (
        <motion.circle
            cx={28 + x} cy={10} r={size / 2}
            fill="#d4a843" stroke="#b8922e" strokeWidth={0.6} opacity={0.8}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: 70, opacity: [1, 1, 0.5, 0], scale: [1, 0.8, 0.5] }}
            transition={{ duration: 1.2, delay, ease: 'easeIn' }}
        />
    );
}

function Exclamation({ x, size, delay }) {
    return (
        <motion.text
            x={28 + x} y={-10} fontSize={size} fill="#f59e0b" textAnchor="middle" fontWeight="bold"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1, 1.2, 1], opacity: [0, 1, 1, 1, 0] }}
            transition={{ duration: 2, delay }}
        >
            !
        </motion.text>
    );
}

function Question({ x, size, delay }) {
    return (
        <motion.text
            x={28 + x} y={-5} fontSize={size} fill="#8b5cf6" textAnchor="middle"
            initial={{ y: 0, opacity: 0, scale: 0.5 }}
            animate={{ y: -20, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 1.5, delay, ease: 'easeOut' }}
        >
            ?
        </motion.text>
    );
}

function ThoughtDot({ x, y, size, delay }) {
    return (
        <motion.circle
            cx={x} cy={y + 38} r={size / 2}
            fill="rgba(139, 92, 246, 0.3)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth={0.5}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 0.8, 0] }}
            transition={{ duration: 1.5, delay, ease: 'easeOut' }}
        />
    );
}

// ─── Single-element effects (icons that appear beside Zumi) ─────────────

function SingleIcon({ icon, fromY = -20, toY = -35, color = '#d4a843' }) {
    return (
        <motion.text
            x={48} y={20} fontSize={18} textAnchor="middle" fill={color}
            initial={{ y: fromY, opacity: 0, scale: 0.3 }}
            animate={{ y: toY, opacity: [0, 1, 1, 0.8], scale: [0.3, 1.1, 1] }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            {icon}
        </motion.text>
    );
}

function CloudRain() {
    return (
        <g>
            {/* Cloud */}
            <motion.ellipse
                cx={28} cy={-12} rx={20} ry={8}
                fill="rgba(107, 114, 128, 0.5)" stroke="rgba(107, 114, 128, 0.6)" strokeWidth={0.5}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            />
            {/* Raindrops */}
            {Array.from({ length: 5 }, (_, i) => (
                <motion.line
                    key={i}
                    x1={16 + i * 6} y1={-2} x2={14 + i * 6} y2={6}
                    stroke="rgba(96, 165, 250, 0.7)" strokeWidth={1} strokeLinecap="round"
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: [0, 0.8, 0], y: [0, 18] }}
                    transition={{ duration: 0.8, delay: 0.6 + i * 0.15, repeat: 2, repeatDelay: 0.2 }}
                />
            ))}
        </g>
    );
}

function Rocket() {
    return (
        <g>
            {/* Rocket body */}
            <motion.g
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: -50, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
            >
                <polygon points="50,20 54,8 58,20" fill="#d4a843" />
                <rect x={51} y={20} width={6} height={10} fill="#8b5cf6" rx={1} />
                {/* Flame */}
                <motion.polygon
                    points="51,30 54,38 57,30"
                    fill="#f59e0b"
                    animate={{ scaleY: [1, 1.3, 0.8, 1.2], opacity: [1, 0.8, 1] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                />
            </motion.g>
            {/* Trail particles */}
            {Array.from({ length: 4 }, (_, i) => (
                <motion.circle
                    key={i}
                    cx={54} cy={40} r={2}
                    fill="rgba(245, 158, 11, 0.5)"
                    initial={{ y: 0, opacity: 0 }}
                    animate={{ y: 20 + i * 8, opacity: [0, 0.6, 0], scale: [1, 0.3] }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.2 }}
                />
            ))}
        </g>
    );
}

function CrystalBall() {
    return (
        <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: [0, 1, 1, 0.8] }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            {/* Ball */}
            <circle cx={50} cy={-8} r={10} fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth={1} />
            {/* Swirl inside */}
            <motion.path
                d="M45,-10 Q50,-14 55,-8 Q50,-4 47,-8"
                stroke="rgba(212, 168, 67, 0.5)" strokeWidth={0.8} fill="none"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: '50px -8px' }}
            />
            {/* Base */}
            <rect x={45} y={3} width={10} height={3} rx={1} fill="rgba(139, 92, 246, 0.4)" />
            {/* Glow */}
            <motion.circle
                cx={50} cy={-8} r={12}
                fill="none" stroke="rgba(139, 92, 246, 0.2)" strokeWidth={1}
                animate={{ r: [12, 14, 12], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            />
        </motion.g>
    );
}

function Magnifier() {
    return (
        <motion.g
            initial={{ x: 15, y: -15, scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: [0, 1, 1, 0.8] }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            <circle cx={0} cy={0} r={7} fill="none" stroke="#d4a843" strokeWidth={1.5} />
            <line x1={5} y1={5} x2={11} y2={11} stroke="#d4a843" strokeWidth={2} strokeLinecap="round" />
        </motion.g>
    );
}

function Telescope() {
    return (
        <motion.g
            initial={{ x: 42, y: -20, opacity: 0, rotate: -30 }}
            animate={{ opacity: [0, 1, 1, 0.8], rotate: -15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            <rect x={0} y={0} width={18} height={5} rx={2} fill="#8b5cf6" />
            <circle cx={19} cy={2.5} r={4} fill="none" stroke="#d4a843" strokeWidth={1} />
        </motion.g>
    );
}

function Microphone() {
    return (
        <motion.g
            initial={{ x: 45, y: -25, opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0.8], scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            {/* Mic head */}
            <circle cx={0} cy={-4} r={6} fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth={1} />
            {/* Grid lines */}
            <line x1={-4} y1={-6} x2={4} y2={-6} stroke="rgba(139, 92, 246, 0.35)" strokeWidth={0.5} />
            <line x1={-5} y1={-4} x2={5} y2={-4} stroke="rgba(139, 92, 246, 0.35)" strokeWidth={0.5} />
            <line x1={-4} y1={-2} x2={4} y2={-2} stroke="rgba(139, 92, 246, 0.35)" strokeWidth={0.5} />
            {/* Stick */}
            <rect x={-1} y={2} width={2} height={12} rx={1} fill="rgba(107, 114, 128, 0.6)" />
            {/* Base */}
            <ellipse cx={0} cy={14} rx={4} ry={1.5} fill="rgba(107, 114, 128, 0.4)" />
            {/* Sound waves */}
            {[8, 11, 14].map((r, i) => (
                <motion.path
                    key={i}
                    d={`M${r},-4 A${r},${r} 0 0,1 ${r},${-4 + r * 0.6}`}
                    fill="none" stroke="rgba(139, 92, 246, 0.3)" strokeWidth={0.6}
                    animate={{ opacity: [0, 0.6, 0] }}
                    transition={{ duration: 1.2, delay: i * 0.25, repeat: Infinity }}
                />
            ))}
        </motion.g>
    );
}

function MovieClap() {
    return (
        <motion.g
            initial={{ x: 44, y: -22, opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0.8], scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            {/* Board body */}
            <rect x={-10} y={-2} width={20} height={14} rx={1.5} fill="rgba(99, 102, 241, 0.4)" stroke="#6366f1" strokeWidth={0.8} />
            {/* Clapper top - hinged */}
            <motion.g
                style={{ transformOrigin: '-10px -2px' }}
                animate={{ rotate: [0, -25, 0] }}
                transition={{ duration: 0.6, delay: 0.5, ease: 'easeInOut' }}
            >
                <rect x={-10} y={-7} width={20} height={5} rx={1} fill="rgba(99, 102, 241, 0.6)" stroke="#6366f1" strokeWidth={0.8} />
                {/* Stripes */}
                {[-6, -2, 2, 6].map((sx) => (
                    <rect key={sx} x={sx} y={-6} width={2.5} height={3.5} fill="rgba(255, 255, 255, 0.3)" transform={`skewX(-10)`} />
                ))}
            </motion.g>
            {/* Text lines on board */}
            <line x1={-7} y1={3} x2={7} y2={3} stroke="rgba(255, 255, 255, 0.25)" strokeWidth={0.6} />
            <line x1={-7} y1={6} x2={4} y2={6} stroke="rgba(255, 255, 255, 0.25)" strokeWidth={0.6} />
            <line x1={-7} y1={9} x2={6} y2={9} stroke="rgba(255, 255, 255, 0.25)" strokeWidth={0.6} />
        </motion.g>
    );
}

function Umbrella() {
    return (
        <motion.g
            initial={{ x: 10, y: -30, opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0.8], scale: 1, y: -20 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeOut' }}
        >
            {/* Canopy */}
            <path d="M0,0 Q10,-14 20,0" fill="rgba(139, 92, 246, 0.5)" stroke="#8b5cf6" strokeWidth={1} />
            {/* Handle */}
            <line x1={10} y1={0} x2={10} y2={15} stroke="#8b5cf6" strokeWidth={1.2} />
            <path d="M10,15 Q10,18 7,18" fill="none" stroke="#8b5cf6" strokeWidth={1.2} />
        </motion.g>
    );
}

function Trophy() {
    return (
        <motion.g
            initial={{ x: 44, y: 20, opacity: 0, scale: 0.3 }}
            animate={{ y: -15, opacity: [0, 1, 1, 0.8], scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            {/* Cup */}
            <path d="M-5,0 L-3,-10 L3,-10 L5,0 Z" fill="#d4a843" />
            {/* Handles */}
            <path d="M-5,-3 Q-9,-3 -8,-7 Q-7,-10 -5,-8" fill="none" stroke="#d4a843" strokeWidth={1} />
            <path d="M5,-3 Q9,-3 8,-7 Q7,-10 5,-8" fill="none" stroke="#d4a843" strokeWidth={1} />
            {/* Base */}
            <rect x={-3} y={0} width={6} height={2} fill="#b8922e" rx={0.5} />
            <rect x={-5} y={2} width={10} height={2} fill="#b8922e" rx={0.5} />
        </motion.g>
    );
}

function Piggy() {
    return (
        <motion.g
            initial={{ x: 44, y: 5, opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0.8], scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            {/* Body */}
            <ellipse cx={0} cy={0} rx={9} ry={7} fill="rgba(244, 114, 182, 0.4)" stroke="rgba(244, 114, 182, 0.7)" strokeWidth={0.8} />
            {/* Snout */}
            <ellipse cx={8} cy={0} rx={3} ry={2} fill="rgba(244, 114, 182, 0.6)" />
            {/* Ears */}
            <ellipse cx={-3} cy={-6} rx={2} ry={3} fill="rgba(244, 114, 182, 0.5)" transform="rotate(-15 -3 -6)" />
            <ellipse cx={3} cy={-6} rx={2} ry={3} fill="rgba(244, 114, 182, 0.5)" transform="rotate(15 3 -6)" />
            {/* Slot */}
            <rect x={-3} y={-8} width={6} height={1.5} rx={0.75} fill="rgba(107, 114, 128, 0.6)" />
            {/* Coin going in */}
            <motion.circle
                cx={0} cy={-18} r={3}
                fill="#d4a843"
                animate={{ y: [0, 10], opacity: [1, 0] }}
                transition={{ duration: 0.6, delay: 1, repeat: 2, repeatDelay: 0.4 }}
            />
        </motion.g>
    );
}

function Plant() {
    return (
        <motion.g
            initial={{ x: -12, y: 25 }}
        >
            {/* Pot */}
            <path d="M-5,0 L-3,8 L3,8 L5,0 Z" fill="rgba(180, 120, 60, 0.6)" />
            {/* Stem */}
            <motion.line
                x1={0} y1={0} x2={0} y2={-20}
                stroke="#22c55e" strokeWidth={1.5}
                initial={{ y2: 0 }}
                animate={{ y2: -20 }}
                transition={{ duration: 1.5 }}
            />
            {/* Leaves */}
            <motion.g
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.8 }}
            >
                <ellipse cx={-5} cy={-12} rx={4} ry={2} fill="#22c55e" transform="rotate(-30 -5 -12)" />
                <ellipse cx={5} cy={-16} rx={4} ry={2} fill="#22c55e" transform="rotate(30 5 -16)" />
            </motion.g>
            {/* $ leaf at top */}
            <motion.text
                x={0} y={-22} fontSize={6} fill="#d4a843" textAnchor="middle" fontWeight="bold"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: [0, 1.2, 1] }}
                transition={{ delay: 1.2, duration: 0.6 }}
            >
                $
            </motion.text>
        </motion.g>
    );
}

function MoneyTree() {
    return (
        <motion.g initial={{ x: -15, y: 15 }}>
            {/* Trunk */}
            <motion.rect
                x={-1.5} y={0} width={3} height={20} rx={1}
                fill="rgba(120, 80, 40, 0.6)"
                initial={{ height: 0 }}
                animate={{ height: 20 }}
                transition={{ duration: 1 }}
            />
            {/* Canopy */}
            <motion.ellipse
                cx={0} cy={-5} rx={12} ry={10}
                fill="rgba(34, 197, 94, 0.3)" stroke="rgba(34, 197, 94, 0.5)" strokeWidth={0.5}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
            />
            {/* Coins on tree */}
            {[-8, -2, 5, 0, -5, 7].map((cx, i) => (
                <motion.circle
                    key={i}
                    cx={cx} cy={-8 + (i % 2) * 6} r={2.5}
                    fill="#d4a843"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1 + i * 0.15, duration: 0.4 }}
                />
            ))}
        </motion.g>
    );
}

function ArrowUp() {
    return (
        <motion.g
            initial={{ x: 48, y: 30, opacity: 0 }}
            animate={{ y: -20, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2, ease: 'easeOut' }}
        >
            <polygon points="0,-8 5,0 2,0 2,12 -2,12 -2,0 -5,0" fill="#22c55e" />
            {/* Trail sparkles */}
            {[0, 1, 2].map((i) => (
                <motion.circle
                    key={i}
                    cx={0} cy={12 + i * 4} r={1}
                    fill="rgba(34, 197, 94, 0.4)"
                    animate={{ opacity: [0.4, 0] }}
                    transition={{ duration: 0.5, delay: i * 0.2 }}
                />
            ))}
        </motion.g>
    );
}

function Anchor() {
    return (
        <motion.g
            initial={{ x: 48, y: -20, opacity: 0 }}
            animate={{ y: 30, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2, ease: 'easeIn' }}
        >
            {/* Shaft */}
            <line x1={0} y1={-8} x2={0} y2={8} stroke="#6b7280" strokeWidth={2} />
            {/* Cross bar */}
            <line x1={-5} y1={-3} x2={5} y2={-3} stroke="#6b7280" strokeWidth={1.5} />
            {/* Ring */}
            <circle cx={0} cy={-10} r={2.5} fill="none" stroke="#6b7280" strokeWidth={1.5} />
            {/* Flukes */}
            <path d="M-6,8 Q0,4 6,8" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round" />
        </motion.g>
    );
}

function Balloon() {
    return (
        <motion.g initial={{ x: 48, y: -25 }}>
            <motion.ellipse
                cx={0} cy={0} rx={8} ry={10}
                fill="rgba(244, 63, 94, 0.3)" stroke="rgba(244, 63, 94, 0.5)" strokeWidth={0.8}
                initial={{ rx: 8, ry: 10, opacity: 1 }}
                animate={{ rx: 4, ry: 5, opacity: 0.3, y: 20 }}
                transition={{ duration: 2.5, ease: 'easeIn' }}
            />
            <motion.line
                x1={0} y1={10} x2={0} y2={20}
                stroke="rgba(107, 114, 128, 0.5)" strokeWidth={0.5}
                animate={{ y1: 5, y2: 25 }}
                transition={{ duration: 2.5, ease: 'easeIn' }}
            />
        </motion.g>
    );
}

function Wilt() {
    return (
        <motion.g initial={{ x: -12, y: 25 }}>
            {/* Pot */}
            <path d="M-5,0 L-3,8 L3,8 L5,0 Z" fill="rgba(180, 120, 60, 0.6)" />
            {/* Stem drooping */}
            <motion.path
                d="M0,0 Q0,-10 0,-18"
                stroke="#84cc16" strokeWidth={1.5} fill="none"
                initial={{ d: 'M0,0 Q0,-10 0,-18' }}
                animate={{ d: 'M0,0 Q-8,-8 -10,-5' }}
                transition={{ duration: 1.5 }}
            />
            {/* Wilting leaf */}
            <motion.ellipse
                cx={-10} cy={-5} rx={4} ry={2}
                fill="rgba(132, 204, 22, 0.4)"
                initial={{ fill: 'rgba(34, 197, 94, 0.6)' }}
                animate={{ fill: 'rgba(180, 160, 60, 0.4)' }}
                transition={{ duration: 2 }}
            />
        </motion.g>
    );
}

function Treasure() {
    return (
        <motion.g
            initial={{ x: 44, y: 10, opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0.8], scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
        >
            {/* Chest base */}
            <rect x={-8} y={0} width={16} height={8} rx={1} fill="#8b5cf6" />
            {/* Chest lid opening */}
            <motion.rect
                x={-8} y={-2} width={16} height={4} rx={1}
                fill="#6366f1"
                initial={{ rotate: 0 }}
                animate={{ rotate: -30 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                style={{ transformOrigin: '-8px -2px' }}
            />
            {/* Golden glow */}
            <motion.ellipse
                cx={0} cy={-2} rx={6} ry={3}
                fill="rgba(212, 168, 67, 0.4)"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.4, 0.6] }}
                transition={{ delay: 0.7, duration: 1.5, repeat: Infinity }}
            />
        </motion.g>
    );
}

function HouseBuild() {
    return (
        <motion.g initial={{ x: -15, y: 10 }}>
            {/* Foundation */}
            <motion.rect
                x={-8} y={5} width={16} height={3} fill="rgba(107, 114, 128, 0.5)"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            />
            {/* Walls */}
            <motion.rect
                x={-7} y={-5} width={14} height={10} fill="rgba(139, 92, 246, 0.3)"
                stroke="rgba(139, 92, 246, 0.5)" strokeWidth={0.5}
                initial={{ height: 0, y: 5 }}
                animate={{ height: 10, y: -5 }}
                transition={{ delay: 0.3, duration: 0.8 }}
            />
            {/* Roof */}
            <motion.polygon
                points="0,-12 -10,-5 10,-5"
                fill="rgba(212, 168, 67, 0.4)" stroke="rgba(212, 168, 67, 0.6)" strokeWidth={0.5}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
            />
            {/* Door */}
            <motion.rect
                x={-2} y={0} width={4} height={5} rx={0.5}
                fill="rgba(212, 168, 67, 0.3)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3, duration: 0.3 }}
            />
        </motion.g>
    );
}

// ─── More flying particle animations ─────────────────────────────────────

function Bubble({ x, size, delay }) {
    return (
        <motion.circle
            cx={28 + x} cy={60} r={size / 2}
            fill="rgba(139, 92, 246, 0.08)" stroke="rgba(139, 92, 246, 0.3)" strokeWidth={0.5}
            initial={{ y: 0, opacity: 0, scale: 0.3 }}
            animate={{ y: -80, opacity: [0, 0.7, 0.7, 0], scale: [0.3, 1, 1.1, 0.9] }}
            transition={{ duration: 2.2, delay, ease: 'easeOut' }}
        />
    );
}

function MusicalNote({ x, size, delay, note }) {
    return (
        <motion.text
            x={28 + x} y={50} fontSize={size} fill="#8b5cf6" textAnchor="middle"
            initial={{ y: 50, opacity: 0, rotate: -15 }}
            animate={{ y: -25, opacity: [0, 1, 1, 0], rotate: [-15, 10, -5, 15] }}
            transition={{ duration: 2, delay, ease: 'easeOut' }}
        >
            {note}
        </motion.text>
    );
}

function Diamond({ angle, distance, size, delay }) {
    const rad = (angle * Math.PI) / 180;
    const cx = 28 + Math.cos(rad) * distance;
    const cy = 38 + Math.sin(rad) * distance;
    const half = size / 2;
    return (
        <motion.polygon
            points={`${cx},${cy - size} ${cx + half},${cy} ${cx},${cy + size * 0.4} ${cx - half},${cy}`}
            fill="rgba(99, 202, 255, 0.5)" stroke="rgba(99, 202, 255, 0.8)" strokeWidth={0.4}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, delay, ease: 'easeOut' }}
        />
    );
}

function Snowflake({ x, size, delay }) {
    return (
        <motion.text
            x={28 + x} y={-10} fontSize={size} fill="rgba(186, 220, 255, 0.8)" textAnchor="middle"
            initial={{ y: -15, opacity: 0, rotate: 0 }}
            animate={{ y: 75, opacity: [0, 0.8, 0.8, 0], rotate: 180, x: [28 + x, 28 + x + 4, 28 + x - 4, 28 + x + 2] }}
            transition={{ duration: 2.8, delay, ease: 'linear' }}
        >
            ❄
        </motion.text>
    );
}

function Lightning({ x, delay }) {
    return (
        <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.2, 1, 0] }}
            transition={{ duration: 0.8, delay }}
        >
            <polygon
                points={`${28 + x},${-8} ${32 + x},${4} ${29 + x},${4} ${33 + x},${18} ${26 + x},${6} ${29 + x},${6}`}
                fill="rgba(250, 204, 21, 0.7)" stroke="#eab308" strokeWidth={0.5}
            />
        </motion.g>
    );
}

function Swirl({ angle, delay }) {
    const rad = (angle * Math.PI) / 180;
    const cx = 28 + Math.cos(rad) * 20;
    const cy = 38 + Math.sin(rad) * 20;
    return (
        <motion.circle
            cx={cx} cy={cy} r={2}
            fill="rgba(212, 168, 67, 0.5)"
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: [0, 1, 0.5],
                opacity: [0, 0.8, 0],
                cx: [cx, cx + Math.cos(rad) * 15],
                cy: [cy, cy + Math.sin(rad) * 15],
            }}
            transition={{ duration: 1.6, delay, ease: 'easeOut' }}
        />
    );
}

// ─── Element type → component mapping ───────────────────────────────────

const ELEMENT_MAP = {
    'coin': Coin,
    'bill': Bill,
    'sparkle': Sparkle,
    'heart': Heart,
    'checkmark': Checkmark,
    'star': Star,
    'confetti-piece': ConfettiPiece,
    'firework-burst': FireworkBurst,
    'drain-coin': DrainCoin,
    'exclamation': Exclamation,
    'question': Question,
    'thought-dot': ThoughtDot,
    'cloud-rain': CloudRain,
    'rocket': Rocket,
    'crystal': CrystalBall,
    'magnifier': Magnifier,
    'telescope': Telescope,
    'bulb': Microphone,
    'microphone': Microphone,
    'movie-clap': MovieClap,
    'bubble': Bubble,
    'musical-note': MusicalNote,
    'diamond': Diamond,
    'snowflake': Snowflake,
    'lightning': Lightning,
    'swirl': Swirl,
    'umbrella': Umbrella,
    'trophy': Trophy,
    'piggy': Piggy,
    'plant': Plant,
    'money-tree': MoneyTree,
    'arrow-up': ArrowUp,
    'anchor': Anchor,
    'balloon': Balloon,
    'wilt': Wilt,
    'treasure': Treasure,
    'house-build': HouseBuild,
};

// ─── Main component ────────────────────────────────────────────────────

export const EnvironmentEffects = React.memo(function EnvironmentEffects({ effect }) {
    const [activeEffect, setActiveEffect] = useState(null);
    const lastTriggerRef = useRef(0);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!effect) return;

        const effectConfig = EFFECTS[effect];
        if (!effectConfig) return;

        // Throttle effects
        const now = Date.now();
        if (now - lastTriggerRef.current < EFFECT_THROTTLE) return;
        lastTriggerRef.current = now;

        setActiveEffect({ id: effect, config: effectConfig, key: now });

        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setActiveEffect(null), EFFECT_DURATION);

        return () => clearTimeout(timerRef.current);
    }, [effect]);

    return (
        <div className="zumi-env-effects">
            <AnimatePresence>
                {activeEffect && (
                    <motion.svg
                        key={activeEffect.key}
                        viewBox="0 0 56 75"
                        width={120}
                        height={160}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeEffect.config.elements.map((el, i) => {
                            const Component = ELEMENT_MAP[el.type];
                            if (!Component) return null;
                            return <Component key={i} {...el} />;
                        })}
                    </motion.svg>
                )}
            </AnimatePresence>
        </div>
    );
});
