# Frontend Source Documentation

## Structure
- **`features/`**: Feature-based modules (auth, dashboard, transactions, budget, bills, import, portfolio, settings, categories, goals, zumfi, help, donate)
- **`components/`**: Shared UI components (Sidebar, InspectorPanel, MonthPicker, Toast, etc.)
- **`context/`**: Global state management (AuthContext, MonthContext, ToastContext, InspectorContext, SettingsContext)
- **`layout/`**: Layout wrapper containing Sidebar and main content area
- **`services/`**: API client (`api.js` -- Axios with auth interceptor)
- **`utils/`**: Shared utilities (`dates.js`, `currencies.js`)
- **`i18n/`**: Internationalization (en, cs, uk translations)

## Key Concepts
- **Feature modules**: Each feature has `components/` dir, optional `hooks/`, and `claude.md` docs
- **Inspector Context**: Used to open/close the right-hand panel from anywhere in the app
- **Month Context**: Data-driven month selection shared across Dashboard, Bills, Budget, Portfolio
- **Settings Context**: User preferences (currency, page order, language, Zumfi rabbit)
- **Zumfi Mascot**: Floating rabbit mascot with context-aware reactions (feature-level context)
- **Guided Tour**: Help system with step-by-step overlay (feature-level context)
