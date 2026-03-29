import React from 'react';

// Premium color palette matching the app's purple-gold theme
const C = {
    body: '#f5f0ff',        // Soft lavender-white
    bodyShade: '#ede5ff',   // Subtle purple tint shading
    belly: '#faf8ff',       // Lighter belly
    earInner: '#d4b896',    // Warm gold inner ear
    earInnerLight: '#e8d5b8',
    nose: '#d4a0b0',        // Muted rose-gold nose
    outline: '#d8d0e8',     // Soft purple outline
    whisker: 'rgba(180,170,200,0.4)',
    blush: '#e8c8d8',       // Soft rose-gold blush
    eye: '#2a2438',         // Deep purple-black
    eyeShine: '#ffffff',
    tooth: '#ffffff',
    toothStroke: '#e0d8ee',
    gold: '#d4a843',        // Rich gold
    goldLight: '#f0d78c',   // Light gold
    goldDark: '#b8922e',    // Dark gold
    purple: '#6366f1',      // App accent
    purpleDark: '#4f46e5',
};

function BodyBase() {
    return (
        <g id="body-base">
            {/* === Ears (positioned fully within viewBox) === */}
            {/* Left ear */}
            <ellipse cx="44" cy="42" rx="12" ry="34" fill={C.body} stroke={C.outline} strokeWidth="0.6" />
            <ellipse cx="44" cy="42" rx="6.5" ry="24" fill={C.earInner} opacity="0.6" />
            <ellipse cx="44" cy="38" rx="4" ry="16" fill={C.earInnerLight} opacity="0.3" />

            {/* Right ear - slight tilt for character */}
            <g transform="rotate(8 76 42)">
                <ellipse cx="76" cy="42" rx="12" ry="34" fill={C.body} stroke={C.outline} strokeWidth="0.6" />
                <ellipse cx="76" cy="42" rx="6.5" ry="24" fill={C.earInner} opacity="0.6" />
                <ellipse cx="76" cy="38" rx="4" ry="16" fill={C.earInnerLight} opacity="0.3" />
            </g>

            {/* === Head === */}
            <ellipse cx="60" cy="86" rx="32" ry="28" fill={C.body} stroke={C.outline} strokeWidth="0.5" />
            {/* Subtle head highlight */}
            <ellipse cx="55" cy="78" rx="14" ry="10" fill="#ffffff" opacity="0.25" />

            {/* === Body === */}
            <ellipse cx="60" cy="128" rx="25" ry="28" fill={C.body} stroke={C.outline} strokeWidth="0.5" />
            {/* Belly highlight */}
            <ellipse cx="60" cy="130" rx="17" ry="20" fill={C.belly} />
            <ellipse cx="58" cy="124" rx="8" ry="8" fill="#ffffff" opacity="0.15" />

            {/* === Paws === */}
            {/* Left paw */}
            <ellipse cx="39" cy="122" rx="8" ry="6" fill={C.body} stroke={C.outline} strokeWidth="0.4"
                transform="rotate(-8 39 122)" />
            <ellipse cx="34" cy="124" rx="3.5" ry="3" fill={C.blush} opacity="0.3" />

            {/* Right paw */}
            <ellipse cx="81" cy="122" rx="8" ry="6" fill={C.body} stroke={C.outline} strokeWidth="0.4"
                transform="rotate(8 81 122)" />
            <ellipse cx="86" cy="124" rx="3.5" ry="3" fill={C.blush} opacity="0.3" />

            {/* === Feet === */}
            <ellipse cx="48" cy="153" rx="10" ry="5.5" fill={C.body} stroke={C.outline} strokeWidth="0.4" />
            <ellipse cx="72" cy="153" rx="10" ry="5.5" fill={C.body} stroke={C.outline} strokeWidth="0.4" />

            {/* === Tail === */}
            <circle cx="60" cy="152" r="6" fill={C.body} stroke={C.outline} strokeWidth="0.4" />
            <circle cx="58" cy="150" r="2.5" fill="#ffffff" opacity="0.3" />

            {/* === Nose === */}
            <ellipse cx="60" cy="91" rx="3.5" ry="2.5" fill={C.nose} />
            <ellipse cx="59" cy="90.5" rx="1.5" ry="1" fill="#ffffff" opacity="0.3" />

            {/* === Whiskers === */}
            <line x1="37" y1="88" x2="51" y2="90" stroke={C.whisker} strokeWidth="0.5" />
            <line x1="36" y1="93" x2="51" y2="93" stroke={C.whisker} strokeWidth="0.5" />
            <line x1="37" y1="97" x2="51" y2="95" stroke={C.whisker} strokeWidth="0.5" />
            <line x1="69" y1="90" x2="83" y2="88" stroke={C.whisker} strokeWidth="0.5" />
            <line x1="69" y1="93" x2="84" y2="93" stroke={C.whisker} strokeWidth="0.5" />
            <line x1="69" y1="95" x2="83" y2="97" stroke={C.whisker} strokeWidth="0.5" />

            {/* === Cheek blush (warm gold-rose) === */}
            <circle cx="40" cy="91" r="7" fill={C.blush} opacity="0.2" />
            <circle cx="80" cy="91" r="7" fill={C.blush} opacity="0.2" />

            {/* === Gold crown accent (always present, subtle) === */}
            <circle cx="60" cy="58" r="2.5" fill={C.goldLight} opacity="0.5" />
            <circle cx="54" cy="60" r="1.5" fill={C.goldLight} opacity="0.35" />
            <circle cx="66" cy="60" r="1.5" fill={C.goldLight} opacity="0.35" />
        </g>
    );
}

function EyesLayer({ expression }) {
    switch (expression) {
        case 'happy':
            return (
                <g id="eyes-happy">
                    <ellipse cx="50" cy="82" rx="4.5" ry="5.5" fill={C.eye} />
                    <ellipse cx="70" cy="82" rx="4.5" ry="5.5" fill={C.eye} />
                    <circle cx="52" cy="80" r="2" fill={C.eyeShine} />
                    <circle cx="72" cy="80" r="2" fill={C.eyeShine} />
                    <circle cx="48.5" cy="83.5" r="0.8" fill={C.eyeShine} opacity="0.5" />
                    <circle cx="68.5" cy="83.5" r="0.8" fill={C.eyeShine} opacity="0.5" />
                    {/* Happy squint */}
                    <path d="M45 85 Q50 88 55 85" stroke={C.eye} strokeWidth="0.8" fill="none" />
                    <path d="M65 85 Q70 88 75 85" stroke={C.eye} strokeWidth="0.8" fill="none" />
                </g>
            );
        case 'excited':
            return (
                <g id="eyes-excited">
                    <ellipse cx="50" cy="81" rx="5.5" ry="6.5" fill={C.eye} />
                    <ellipse cx="70" cy="81" rx="5.5" ry="6.5" fill={C.eye} />
                    <circle cx="52" cy="79" r="2.5" fill={C.eyeShine} />
                    <circle cx="72" cy="79" r="2.5" fill={C.eyeShine} />
                    <circle cx="48" cy="83" r="1" fill={C.eyeShine} opacity="0.5" />
                    <circle cx="68" cy="83" r="1" fill={C.eyeShine} opacity="0.5" />
                    {/* Sparkles */}
                    <g fill={C.goldLight}>
                        <polygon points="57,73 58,75 60,75 58.5,76.5 59,78.5 57,77 55,78.5 55.5,76.5 54,75 56,75" />
                        <polygon points="77,75 77.8,76.5 79.5,76.5 78.2,77.5 78.6,79 77,78 75.4,79 75.8,77.5 74.5,76.5 76.2,76.5"
                            transform="scale(0.8) translate(10, 2)" />
                    </g>
                </g>
            );
        case 'concerned':
            return (
                <g id="eyes-concerned">
                    <ellipse cx="50" cy="83" rx="4.5" ry="4.5" fill={C.eye} />
                    <ellipse cx="70" cy="83" rx="4.5" ry="4.5" fill={C.eye} />
                    <circle cx="51" cy="82" r="1.5" fill={C.eyeShine} />
                    <circle cx="71" cy="82" r="1.5" fill={C.eyeShine} />
                    {/* Worried brows */}
                    <line x1="44" y1="74" x2="55" y2="76" stroke={C.outline} strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="76" y1="74" x2="65" y2="76" stroke={C.outline} strokeWidth="1.5" strokeLinecap="round" />
                </g>
            );
        case 'sleepy':
            return (
                <g id="eyes-sleepy">
                    <path d="M45 83 Q50 80 55 83" stroke={C.eye} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    <path d="M65 83 Q70 80 75 83" stroke={C.eye} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    {/* Z particles in gold */}
                    <text x="82" y="68" fontSize="7" fill={C.goldLight} opacity="0.6" fontStyle="italic">z</text>
                    <text x="89" y="58" fontSize="9" fill={C.goldLight} opacity="0.4" fontStyle="italic">z</text>
                    <text x="95" y="46" fontSize="11" fill={C.goldLight} opacity="0.25" fontStyle="italic">z</text>
                </g>
            );
        default: // neutral
            return (
                <g id="eyes-neutral">
                    <ellipse cx="50" cy="82" rx="4.5" ry="5.5" fill={C.eye} />
                    <ellipse cx="70" cy="82" rx="4.5" ry="5.5" fill={C.eye} />
                    <circle cx="52" cy="80" r="1.8" fill={C.eyeShine} />
                    <circle cx="72" cy="80" r="1.8" fill={C.eyeShine} />
                </g>
            );
    }
}

function MouthLayer({ mouth }) {
    switch (mouth) {
        case 'smile':
            return (
                <g id="mouth-smile">
                    <path d="M55 96 Q60 101 65 96" stroke={C.eye} strokeWidth="1" fill="none" />
                    <rect x="57" y="96" width="3.5" height="4.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                    <rect x="60.5" y="96" width="3.5" height="4.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                </g>
            );
        case 'frown':
            return (
                <g id="mouth-frown">
                    <path d="M55 99 Q60 96 65 99" stroke={C.eye} strokeWidth="1" fill="none" />
                    <rect x="57.5" y="95" width="3" height="3.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                    <rect x="60.5" y="95" width="3" height="3.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                </g>
            );
        case 'open':
            return (
                <g id="mouth-open">
                    <ellipse cx="60" cy="99" rx="5" ry="4.5" fill="#3d2030" />
                    <rect x="57.5" y="94" width="3" height="4.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                    <rect x="60.5" y="94" width="3" height="4.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                </g>
            );
        default: // neutral
            return (
                <g id="mouth-neutral">
                    <line x1="56" y1="97" x2="64" y2="97" stroke={C.eye} strokeWidth="1" strokeLinecap="round" />
                    <rect x="57.5" y="97" width="3" height="3.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                    <rect x="60.5" y="97" width="3" height="3.5" rx="1" fill={C.tooth} stroke={C.toothStroke} strokeWidth="0.4" />
                </g>
            );
    }
}

function OutfitLayer({ outfit }) {
    switch (outfit) {
        case 'business':
            return (
                <g id="outfit-business">
                    {/* Gold bow tie */}
                    <polygon points="53,108 60,111 60,105" fill={C.gold} />
                    <polygon points="67,108 60,111 60,105" fill={C.gold} />
                    <circle cx="60" cy="108" r="2" fill={C.goldDark} />
                    <circle cx="60" cy="108" r="1" fill={C.goldLight} opacity="0.5" />
                </g>
            );
        case 'broke':
            return (
                <g id="outfit-broke">
                    <rect x="46" y="114" width="7" height="7" rx="1" fill="none" stroke="rgba(160,150,180,0.5)" strokeWidth="0.7"
                        strokeDasharray="2 1" transform="rotate(-5 49 117)" />
                    <rect x="68" y="116" width="5" height="5" rx="1" fill="none" stroke="rgba(160,150,180,0.5)" strokeWidth="0.7"
                        strokeDasharray="2 1" transform="rotate(8 70 118)" />
                    {/* Sweat drop */}
                    <path d="M38 72 Q37 76 38 79 Q39 76 38 72" fill="rgba(130,180,255,0.4)" />
                </g>
            );
        case 'celebration':
            return (
                <g id="outfit-celebration">
                    {/* Confetti in theme colors */}
                    <rect x="28" y="52" width="3" height="3" fill={C.gold} transform="rotate(30 29 53)" />
                    <rect x="90" y="56" width="3" height="3" fill={C.purple} transform="rotate(-20 91 57)" />
                    <rect x="24" y="70" width="2" height="3.5" fill={C.purpleDark} transform="rotate(45 25 72)" />
                    <rect x="96" y="65" width="2" height="3.5" fill={C.goldLight} transform="rotate(-35 97 67)" />
                    <circle cx="22" cy="62" r="1.5" fill={C.goldLight} />
                    <circle cx="98" cy="50" r="1.5" fill={C.purple} opacity="0.7" />
                </g>
            );
        default:
            return null;
    }
}

function AccessoryLayer({ accessory }) {
    switch (accessory) {
        case 'sunglasses':
            return (
                <g id="acc-sunglasses">
                    {/* Gold-framed sunglasses */}
                    <rect x="42" y="77" rx="3" ry="3" width="14" height="10" fill="rgba(30,25,40,0.85)"
                        stroke={C.gold} strokeWidth="0.8" />
                    <rect x="64" y="77" rx="3" ry="3" width="14" height="10" fill="rgba(30,25,40,0.85)"
                        stroke={C.gold} strokeWidth="0.8" />
                    <line x1="56" y1="82" x2="64" y2="82" stroke={C.gold} strokeWidth="0.8" />
                    <line x1="42" y1="82" x2="36" y2="80" stroke={C.gold} strokeWidth="0.8" />
                    <line x1="78" y1="82" x2="84" y2="80" stroke={C.gold} strokeWidth="0.8" />
                    <line x1="45" y1="79" x2="48" y2="81" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
                    <line x1="67" y1="79" x2="70" y2="81" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
                </g>
            );
        case 'piggy-bank':
            return (
                <g id="acc-piggy" transform="translate(82, 112) scale(0.55)">
                    <ellipse cx="15" cy="15" rx="13" ry="11" fill={C.goldLight} stroke={C.gold} strokeWidth="1" />
                    <ellipse cx="4" cy="12" rx="4" ry="3" fill={C.goldLight} stroke={C.gold} strokeWidth="0.7" />
                    <circle cx="6" cy="10" r="1.5" fill={C.eye} />
                    <rect x="10" y="4" width="7" height="2" rx="1" fill={C.goldDark} />
                    <rect x="7" y="24" width="4" height="5" rx="1" fill={C.goldLight} stroke={C.gold} strokeWidth="0.5" />
                    <rect x="19" y="24" width="4" height="5" rx="1" fill={C.goldLight} stroke={C.gold} strokeWidth="0.5" />
                    <circle cx="14" cy="1" r="3.5" fill={C.gold} stroke={C.goldDark} strokeWidth="0.5" />
                    <text x="12.5" y="3" fontSize="4" fill={C.goldDark} fontWeight="bold">$</text>
                </g>
            );
        case 'money-tree':
            return (
                <g id="acc-money-tree" transform="translate(14, 104) scale(0.5)">
                    <path d="M6 34 L11 43 L29 43 L34 34 Z" fill="#5c4a2e" stroke="#4a3a20" strokeWidth="0.5" />
                    <rect x="9" y="31" width="22" height="4" rx="1" fill="#7a6340" />
                    <rect x="18" y="10" width="4" height="22" rx="1" fill="#5a8c3e" />
                    <circle cx="12" cy="10" r="5" fill={C.gold} stroke={C.goldDark} strokeWidth="0.5" />
                    <circle cx="28" cy="8" r="5" fill={C.gold} stroke={C.goldDark} strokeWidth="0.5" />
                    <circle cx="20" cy="2" r="5" fill={C.gold} stroke={C.goldDark} strokeWidth="0.5" />
                    <circle cx="8" cy="20" r="4" fill={C.goldLight} stroke={C.gold} strokeWidth="0.5" />
                    <circle cx="32" cy="18" r="4" fill={C.goldLight} stroke={C.gold} strokeWidth="0.5" />
                    <text x="10" y="12.5" fontSize="5" fill={C.goldDark} fontWeight="bold">$</text>
                    <text x="26" y="10.5" fontSize="5" fill={C.goldDark} fontWeight="bold">$</text>
                    <text x="18" y="4.5" fontSize="5" fill={C.goldDark} fontWeight="bold">$</text>
                </g>
            );
        case 'party-hat':
            return null;
        default:
            return null;
    }
}

const ZumfiBody = React.memo(function ZumfiBody({ expression, mouth, outfit, accessory }) {
    return (
        <svg
            viewBox="0 0 120 165"
            width="56"
            height="77"
            className="zumfi-body"
            style={{ pointerEvents: 'auto', overflow: 'visible' }}
        >
            <BodyBase />
            {outfit === 'celebration' && <OutfitLayer outfit={outfit} />}
            <EyesLayer expression={accessory === 'sunglasses' ? 'neutral' : expression} />
            <MouthLayer mouth={mouth} />
            {outfit !== 'celebration' && <OutfitLayer outfit={outfit} />}
            <AccessoryLayer accessory={accessory} />
        </svg>
    );
});

export { ZumfiBody };
