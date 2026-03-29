import React from 'react';
import './ZumfiHome.css';

/**
 * Zumi's home — a colourful house in the sidebar.
 * Purple base with golden roof, matching the ZumFi brand.
 */
export const ZumfiHome = React.memo(function ZumfiHome() {
    const handleDoubleClick = () => {
        window.dispatchEvent(new CustomEvent('zumi-go-home'));
    };

    return (
        <div className="zumfi-home" onDoubleClick={handleDoubleClick}>
            <svg
                viewBox="0 0 64 68"
                width="64"
                height="68"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Roof glow */}
                <ellipse cx="32" cy="28" rx="26" ry="8" fill="rgba(212, 168, 67, 0.08)" />

                {/* House body — purple gradient */}
                <rect x="12" y="30" width="40" height="32" rx="3"
                    fill="url(#homeBodyGrad)"
                />
                {/* Body border */}
                <rect x="12" y="30" width="40" height="32" rx="3"
                    fill="none"
                    stroke="rgba(99, 102, 241, 0.4)"
                    strokeWidth="1.2"
                />

                {/* Roof — golden triangle */}
                <path d="M32 6L6 32h52L32 6z"
                    fill="url(#homeRoofGrad)"
                />
                <path d="M32 6L6 32h52L32 6z"
                    fill="none"
                    stroke="rgba(212, 168, 67, 0.6)"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                />

                {/* Chimney */}
                <rect x="42" y="14" width="6" height="16" rx="1.5"
                    fill="rgba(99, 102, 241, 0.35)"
                    stroke="rgba(212, 168, 67, 0.3)"
                    strokeWidth="0.8"
                />

                {/* Window left */}
                <rect x="17" y="36" width="10" height="10" rx="1.5"
                    fill="rgba(212, 168, 67, 0.12)"
                    stroke="rgba(212, 168, 67, 0.45)"
                    strokeWidth="1"
                />
                {/* Window cross */}
                <line x1="22" y1="36" x2="22" y2="46" stroke="rgba(212, 168, 67, 0.3)" strokeWidth="0.8" />
                <line x1="17" y1="41" x2="27" y2="41" stroke="rgba(212, 168, 67, 0.3)" strokeWidth="0.8" />
                {/* Window glow */}
                <rect x="17.5" y="36.5" width="4" height="4" rx="0.5" fill="rgba(245, 158, 11, 0.1)" />

                {/* Window right */}
                <rect x="37" y="36" width="10" height="10" rx="1.5"
                    fill="rgba(212, 168, 67, 0.12)"
                    stroke="rgba(212, 168, 67, 0.45)"
                    strokeWidth="1"
                />
                <line x1="42" y1="36" x2="42" y2="46" stroke="rgba(212, 168, 67, 0.3)" strokeWidth="0.8" />
                <line x1="37" y1="41" x2="47" y2="41" stroke="rgba(212, 168, 67, 0.3)" strokeWidth="0.8" />
                <rect x="37.5" y="36.5" width="4" height="4" rx="0.5" fill="rgba(245, 158, 11, 0.1)" />

                {/* Door — golden arch */}
                <path d="M27 62V50a5 5 0 0110 0v12"
                    fill="rgba(212, 168, 67, 0.18)"
                    stroke="rgba(212, 168, 67, 0.55)"
                    strokeWidth="1.2"
                />
                {/* Doorknob */}
                <circle cx="35" cy="55" r="1.2" fill="rgba(212, 168, 67, 0.7)" />

                {/* Roof ridge ornament — small golden diamond */}
                <path d="M32 8l2.5 4h-5l2.5-4z" fill="rgba(245, 158, 11, 0.5)" />

                {/* Gradients */}
                <defs>
                    <linearGradient id="homeBodyGrad" x1="32" y1="30" x2="32" y2="62" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(99, 102, 241, 0.25)" />
                        <stop offset="100%" stopColor="rgba(79, 70, 160, 0.35)" />
                    </linearGradient>
                    <linearGradient id="homeRoofGrad" x1="32" y1="6" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="rgba(245, 158, 11, 0.5)" />
                        <stop offset="50%" stopColor="rgba(212, 168, 67, 0.35)" />
                        <stop offset="100%" stopColor="rgba(212, 168, 67, 0.15)" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
});
