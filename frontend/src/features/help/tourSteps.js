/**
 * Guided tour step definitions.
 * Each step targets a `data-zumfi-zone` attribute or a CSS selector.
 * Steps are grouped into phases (one per page/section).
 */

export const TOUR_PHASES = [
    {
        id: 'navigation',
        label: 'Navigation',
        route: '/',
        steps: [
            {
                target: '.nav-menu',
                title: 'Sidebar Navigation',
                text: 'This is your main menu. Click any page to switch. You can reorder and hide pages in Settings.',
                placement: 'right',
            },
            {
                target: '.month-picker-wrapper',
                title: 'Month Picker',
                text: 'Select which month to view. This is shared across Dashboard, Budget, Bills, and Portfolio — changing it here changes it everywhere.',
                placement: 'bottom',
            },
        ],
    },
    {
        id: 'dashboard',
        label: 'Dashboard',
        route: '/',
        steps: [
            {
                target: '[data-zumfi-zone="kpi-income"]',
                title: 'KPI Cards',
                text: 'Four key metrics: Income, Spend, Savings Rate, and Remaining Budget. Click the Income card to see a breakdown by category.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="income-chart"]',
                title: 'Income vs Expenses',
                text: '10-month trend chart showing income (green) and expenses (red). Hover any point for exact amounts.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="category-donut"]',
                title: 'Spending by Category',
                text: 'Interactive donut chart. Use the filter icon to toggle categories, the chart icon for 12-month trends, and the pencil to edit categories.',
                placement: 'top',
            },
            {
                target: '[data-zumfi-zone="top-categories"]',
                title: 'Top Categories',
                text: 'Ranked bar chart of your highest spending categories for the selected month.',
                placement: 'top',
            },
            {
                target: '[data-zumfi-zone="insights-title"]',
                title: 'Smart AI Insights',
                text: 'AI-powered analysis section with spending forecasts and anomaly detection.',
                placement: 'top',
            },
            {
                target: '[data-zumfi-zone="forecast"]',
                title: 'Spending Forecast',
                text: 'Shows current spend vs AI-predicted total. Green = under budget, yellow = close, red = over.',
                placement: 'top',
            },
            {
                target: '[data-zumfi-zone="anomalies"]',
                title: 'Unusual Activity',
                text: 'Flags anomalous transactions — spending spikes, large purchases, or savings drops. Severity coded as mild, moderate, or severe.',
                placement: 'top',
            },
        ],
    },
    {
        id: 'transactions',
        label: 'Transactions',
        route: '/transactions',
        steps: [
            {
                target: '[data-zumfi-zone="tx-search"]',
                title: 'Search Transactions',
                text: 'Type to search by description. Results update automatically with a short delay.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="tx-statement-filter"]',
                title: 'Statement Filter',
                text: 'Filter by bank statement. Each option shows the bank name and date range.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="tx-sort"]',
                title: 'Sort Order',
                text: 'Sort by date, amount, or name. Your preference is remembered between sessions.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="tx-filters"]',
                title: 'Quick Filters',
                text: 'All, Review (uncategorized), Expense, or Income. The "Review" badge shows how many need attention.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="tx-list"]',
                title: 'Transaction List',
                text: 'Click any row for full details. Status dots: green = confirmed, yellow = auto-categorized, red = needs review. Use checkboxes for bulk actions.',
                placement: 'top',
            },
        ],
    },
    {
        id: 'budget',
        label: 'Budget',
        route: '/budget',
        steps: [
            {
                target: '[data-zumfi-zone="budget-stats"]',
                title: 'Budget Summary',
                text: 'Total Budget, Total Spent, and Remaining. The progress bar shows overall usage with color coding.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="budget-suggest"]',
                title: 'AI Budget Suggestions',
                text: 'Click to get AI-recommended budgets based on your spending history using the 50/30/20 rule.',
                placement: 'bottom',
            },
        ],
    },
    {
        id: 'bills',
        label: 'Bills',
        route: '/bills',
        steps: [
            {
                target: '[data-zumfi-zone="bills-tabs"]',
                title: 'Bills Tabs',
                text: 'Switch between "Recurring Bills" for monthly fixed expenses and "Mortgage" for loan tracking.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="bills-summary"]',
                title: 'Monthly Fixed Expenses',
                text: 'Total of all your tracked recurring bills and the count of bills.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="bills-checklist"]',
                title: 'Bill Checklist',
                text: 'Each bill shows its name, expected amount, and payment status (paid, pending, or overdue). Use "Detect Bills" to auto-find recurring payments.',
                placement: 'top',
            },
            {
                target: '[data-zumfi-zone="mortgage-summary"]',
                title: 'Mortgage Overview',
                text: 'Outstanding balance across all mortgages, total count, and combined monthly payment.',
                placement: 'bottom',
                clickBefore: '.bills-tab:last-child',
            },
            {
                target: '[data-zumfi-zone="mortgage-progress"]',
                title: 'Mortgage Tracking',
                text: 'Each mortgage card shows a progress bar (principal paid off), remaining balance, monthly payment, interest rate, and time left. Confirm payments with the checkmark button. Click any card for full detail with amortization schedule and events.',
                placement: 'top',
                clickBefore: '.bills-tab:last-child',
            },
        ],
    },
    {
        id: 'portfolio',
        label: 'Portfolio',
        route: '/portfolio',
        steps: [
            {
                target: '[data-zumfi-zone="port-tabs"]',
                title: 'Portfolio Tabs',
                text: 'Four views: Overview (total wealth), Savings (accounts & goals), Properties, and Stock Portfolio.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="port-kpi"]',
                title: 'Portfolio KPIs',
                text: 'Total portfolio value, savings, stocks, and properties. Click any card for a detailed breakdown. Each shows delta vs previous month.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="port-trend"]',
                title: 'Portfolio Development',
                text: '12-month stacked area chart showing your total wealth over time by asset type.',
                placement: 'top',
                clickBefore: '.portfolio-tab:nth-child(1)',
            },
            {
                target: '[data-zumfi-zone="port-savings"]',
                title: 'Savings Accounts',
                text: 'Track your savings accounts with balances, institution, currency, and interest rate (APY). Click "Add Savings" to create one.',
                placement: 'top',
                clickBefore: '.portfolio-tab:nth-child(2)',
            },
            {
                target: '[data-zumfi-zone="port-goals"]',
                title: 'Savings Goals',
                text: 'Progress ring cards showing target vs current savings. Set deadlines, track monthly deltas, and view development charts. Allocate surplus from the Dashboard.',
                placement: 'top',
                clickBefore: '.portfolio-tab:nth-child(2)',
            },
            {
                target: '[data-zumfi-zone="port-properties"]',
                title: 'Properties',
                text: 'Track property investments with location, size, features, and auto-estimated current values based on market data. See profit/loss vs purchase price.',
                placement: 'top',
                clickBefore: '.portfolio-tab:nth-child(3)',
            },
            {
                target: '[data-zumfi-zone="port-stocks"]',
                title: 'Stock Portfolio',
                text: 'Track stocks, ETFs, crypto, and bonds. See per-holding P&L, currency breakdowns, allocation charts, and realized gains. Click value cards for detailed breakdowns.',
                placement: 'top',
                clickBefore: '.portfolio-tab:nth-child(4)',
            },
        ],
    },
    {
        id: 'import',
        label: 'Import',
        route: '/import',
        steps: [
            {
                target: '[data-zumfi-zone="import-header"]',
                title: 'Import Transactions',
                text: 'Two views: "Import Wizard" to upload new files (PDF, CSV, Excel, Word, images), and "View Documents" to manage uploaded statements.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="import-content"]',
                title: 'Upload Zone',
                text: 'Drag and drop your bank statement here, or click to browse. PDFs are auto-parsed. CSVs go through a column-mapping wizard.',
                placement: 'top',
            },
        ],
    },
    {
        id: 'settings',
        label: 'Settings',
        route: '/settings',
        steps: [
            {
                target: '[data-zumfi-zone="settings-currency"]',
                title: 'Preferred Currency',
                text: 'Set your main currency. The dashboard shows only transactions in this currency. This filters — it does not convert amounts.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="settings-navigation"]',
                title: 'Navigation Customization',
                text: 'Drag to reorder pages in the sidebar. Use the eye icon to show/hide pages. Dashboard is always visible.',
                placement: 'bottom',
            },
            {
                target: '[data-zumfi-zone="settings-appearance"]',
                title: 'Appearance',
                text: 'Toggle the Zumi mascot on or off. When enabled, it reacts to your financial data with tips and animations.',
                placement: 'top',
            },
        ],
    },
];

/** Flatten all phases into a single ordered step list with phase metadata */
export function getFlatSteps() {
    const steps = [];
    for (const phase of TOUR_PHASES) {
        for (const step of phase.steps) {
            steps.push({ ...step, phaseId: phase.id, phaseLabel: phase.label, route: phase.route });
        }
    }
    return steps;
}
