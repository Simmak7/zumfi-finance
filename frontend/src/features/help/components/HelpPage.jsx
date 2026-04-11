import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, ChevronDown, ChevronRight, Lightbulb,
    LayoutDashboard, Receipt, PiggyBank, Target, FileCheck, Wallet,
    FileSpreadsheet, Tag, Settings, Home, Play,
} from 'lucide-react';
import { useTranslation } from '../../../i18n';
import { useGuidedTour } from '../GuidedTourContext';
import { useZumfi } from '../../zumfi/context/ZumfiContext';
import { TOUR_PHASES } from '../tourSteps';
import './HelpPage.css';

const SECTIONS = [
    {
        id: 'dashboard',
        icon: LayoutDashboard,
        title: 'Dashboard',
        intro: 'Your financial command center. The page title shows "Financial Health" with a subtitle "Overview for [Month]". Four KPI cards, charts, AI insights, and month-end wizards — all driven by the month you select in the top-right Month Picker.',
        items: [
            { heading: 'Welcome & Onboarding', text: 'If you have no data for the selected month, a "Welcome to ZUMFI" card appears with 3 steps: upload your first bank statement, review and categorize transactions, and set up recurring bills. Each step links to the relevant page. Dismiss it with the X button and it won\'t appear again.' },
            { heading: 'KPI Cards', text: 'Four cards at the top: Total Income, Total Spend, Savings Rate (percentage), and Remaining Budget. The Total Income card is clickable — tap it to open an Income Breakdown popup showing each income category with its share of total income.' },
            { heading: 'Income vs Expenses Chart', text: 'A dual-area chart showing your income (green) and expenses (red) over the last 10 months. Hover any point to see exact amounts. Needs at least 2 months of data to display.' },
            { heading: 'Spending by Category', text: 'An interactive donut chart of spending by category. Click any slice or legend item to see all transactions in that category. Three icon buttons in the card header: the filter icon toggles category filter chips (click a chip to hide/show that category in the chart), the chart icon opens a Category Spending Trends modal with per-category bar charts over 12 months, and the pencil icon opens the full Category Editor.' },
            { heading: 'Top Categories', text: 'A ranked horizontal bar chart of your highest-spending categories for the selected month. Each bar is sized relative to the highest spender.' },
            { heading: 'Spending Forecast', text: 'Under "Smart AI Insights", this card shows your current spend vs AI-predicted total for the month. A progress bar with color coding: green if you\'re under 90% of predicted, yellow at 90-100%, red if over. Based on your average of the last 3 months.' },
            { heading: 'Unusual Activity', text: 'Also under "Smart AI Insights", this card flags anomalous transactions — spending spikes, category spikes, large individual transactions, or savings drops. Shows up to 3 items with severity levels (mild, moderate, severe). If nothing is unusual, shows "No Anomalies — Your spending looks normal this month."' },
            { heading: 'Close Month / Month Overview', text: 'The "Close Month" button in the header opens a 6-step wizard: (1) Month Summary with KPI recap, (2) Uncategorized Transactions review with a link to fix them, (3) Allocate Surplus to savings goals with editable amounts per goal, (4) Savings Overview showing total savings and monthly change, (5) Stock Portfolio summary with value and P&L changes, (6) Done confirmation with a log of actions taken. After closing, the button changes to "Month Overview" and all steps become freely navigable.' },
            { heading: 'Allocate Savings', text: 'When you have remaining budget, the "Allocate Savings" button appears. It opens a 3-step wizard: (1) see your available surplus (income minus expenses minus any prior allocations), (2) distribute amounts to each goal with an "Auto-suggest" button for proportional distribution and a live progress bar, (3) review and confirm. If already fully allocated, clicking the button shows a read-only summary of existing allocations instead.' },
        ],
        tips: [
            'Click the Total Income card to see which categories your income comes from.',
            'Use the filter icon on the category donut chart to hide categories you don\'t want to see (like "In & Out" transfers).',
            'The "Close Month" button changes to "Month Overview" once you\'ve already closed that month — click it to revisit any step.',
            'The Month Picker is shared across Dashboard, Bills, Budget, and Portfolio pages — changing it on one page changes it everywhere.',
        ],
    },
    {
        id: 'transactions',
        icon: Receipt,
        title: 'Transactions',
        intro: 'Browse, search, filter, and categorize all your imported transactions. The page title shows the count (e.g. "50 of 243 transactions"). The app auto-classifies transactions using keywords you define in Categories.',
        items: [
            { heading: 'Search Bar', text: 'Type to search transactions by description. The search runs server-side with a short delay for efficiency. An X button appears to clear the search when text is entered.' },
            { heading: 'Statement Filter', text: 'A "Statement" dropdown lets you filter to a specific bank statement. Each option shows the bank name and date range (e.g. "Raiffeisen — Jan 1, 2024 – Jan 31, 2024"). An X button appears to clear the filter when active.' },
            { heading: 'Sort Order', text: 'The "Order" dropdown controls sorting: Newest First (default), Oldest First, Highest Amount, Lowest Amount, Name A-Z, or Name Z-A. Your choice is remembered between sessions.' },
            { heading: 'Category Filter', text: 'A multi-select "Category" dropdown lets you check multiple categories to filter by. Shows "All categories" by default, or "N selected" when active. Click outside to close the dropdown.' },
            { heading: 'Quick Filter Pills', text: 'Four quick-filter buttons below the dropdowns: "All" (shows everything), "Review" (only uncategorized — shows a count badge), "Expense", and "Income". The active pill is highlighted.' },
            { heading: 'Status Dots', text: 'Every transaction has a colored dot next to its category name. Green = confirmed by you. Yellow = auto-categorized by a keyword match (hover to see "Auto-categorized"). Red = needs manual review (hover to see "Needs review").' },
            { heading: 'Quick Confirm', text: 'For yellow (auto-categorized) transactions, a small checkmark icon appears next to the category name. Click it to confirm the suggested category without opening any panel. A toast confirms: "Confirmed \'Category Name\'".' },
            { heading: 'Quick Categorize', text: 'For red (needs review) transactions, an inline "Categorize" dropdown appears directly on the row. Select a category from the list and it\'s applied immediately with a confirmation toast.' },
            { heading: 'Categorize Similar', text: 'For any categorized transaction, a copy icon appears on the row. Click it to apply that category to ALL other transactions with the same description. A toast shows how many were updated.' },
            { heading: 'Bulk Select & Categorize', text: 'Click the checkbox on individual rows to select them, or use "Select all" at the top. A bulk toolbar appears showing the count of selected items, a category dropdown, an "Apply" button, and a "Deselect" button. Choose a category and click Apply to categorize all selected at once.' },
            { heading: 'Transaction Detail Panel', text: 'Click any transaction row to slide open a detail panel on the right. It shows the full amount (color-coded), date, description, original description (if different), type, a category dropdown to change the category, section, original currency amount (for foreign transactions), status with confidence percentage, and transaction ID.' },
            { heading: 'Load More', text: 'Transactions load 50 at a time. A "Load more (N remaining)" button at the bottom fetches the next batch and appends it to the list.' },
        ],
        tips: [
            'Use "Categorize Similar" to quickly handle dozens of recurring transactions — one click categorizes all matching descriptions.',
            'The "Review" pill shows a badge with the exact count of transactions needing attention.',
            'Sort by "Highest Amount" to prioritize categorizing your biggest transactions first.',
            'Foreign currency transactions show both the converted amount and the original amount in the detail panel.',
        ],
    },
    {
        id: 'budget',
        icon: PiggyBank,
        title: 'Budget & Reconciliation',
        intro: 'Set monthly budgets per category and compare planned vs actual spending. The page title is "Budget & Reconciliation" with subtitle "Planned vs. Reality for [Month]". Uses the shared Month Picker to switch months.',
        items: [
            { heading: 'Budget vs Actual Chart', text: 'A vertical-layout bar chart where each category shows two horizontal bars side by side: the budget bar (indigo) and the actual spending bar. The actual bar is color-coded: green if under 80% of budget, yellow at 80-100%, and red if over 100%. Hover any bar for a tooltip showing the exact budget, spent amount, percentage, and remaining/over amount.' },
            { heading: 'Summary Stats', text: 'Three stat tiles above the chart: Total Budget (indigo), Total Spent (color changes based on overall usage — green/yellow/red), and Remaining or "Over Budget" (shows in red when overspent). A progress bar below shows overall budget consumption with the same color coding and a "X% used" label.' },
            { heading: 'Manage Budgets', text: 'Click the pencil icon in the chart header to open the budget manager popup. Each existing budget shows the category name and an editable amount input — just type a new number and press Enter or click away to save instantly. Delete a budget with the trash icon (no confirmation). Add new budgets by typing a category name and amount at the bottom — if the name matches an existing category it links to it, otherwise a new category is created automatically.' },
            { heading: 'Inherited Budgets', text: 'Budgets carry forward from the previous month automatically. You\'ll see an "(inherited)" badge next to these. Edit the amount to create a specific budget for the current month — the previous month\'s budget stays unchanged.' },
            { heading: 'Quick-Add Chips', text: 'In the budget manager, unbudgeted categories that have actual spending this month appear as clickable chips at the bottom. Click a chip to auto-fill the category name in the add row. Categories with the highest spending appear first.' },
            { heading: 'Smart Budget Suggestions', text: 'Click "Auto-suggest" in the page header to open the Smart Budget Suggestions modal. It analyzes 6 months of your spending and recommends budgets using the 50/30/20 rule (50% needs, 30% wants, 20% savings). Each suggestion shows the category, a trend indicator (Rising/Falling/Stable), current vs suggested amount (editable), and an AI-generated reasoning. Check the suggestions you agree with, optionally adjust amounts, and click "Apply N Suggestions" to set them all at once.' },
        ],
        tips: [
            'Budgets automatically carry forward — set them once and they persist every month until you change them.',
            'In the AI suggestions, trend arrows show if your spending in a category is rising (red), falling (green), or stable.',
            'You can selectively apply AI suggestions — uncheck categories you don\'t want and only the checked ones are applied.',
            'The budget manager creates new categories on-the-fly if you type a name that doesn\'t exist yet.',
        ],
    },
    {
        id: 'goals',
        icon: Target,
        title: 'Savings Goals',
        intro: 'Set savings targets with deadlines and track your progress over time. Goals appear in two places: as a radial chart widget on the Dashboard, and as detailed cards in Portfolio > Savings tab.',
        items: [
            { heading: 'Creating Goals', text: 'Click "+ Add" on the Dashboard goals widget or "Add Goal" on the Portfolio Savings tab. Fill in a name, target amount, current savings (defaults to 0), optional deadline, and pick one of 9 color tags (rose, pink, violet, indigo, blue, sky, emerald, amber, orange). Goals are created via the slide-out panel on the right.' },
            { heading: 'Dashboard Widget', text: 'The "Savings Goals" card on the Dashboard shows a stacked radial bar chart where each ring represents a goal\'s progress (0-100%). Below the chart is a legend showing each goal\'s name and current vs target amount. Click any legend row to view the goal details in the side panel.' },
            { heading: 'Progress Cards (Portfolio)', text: 'On the Portfolio Savings tab, each goal gets a donut-ring card showing the percentage in the center. Goals over 100% show an overflow ring. Completed goals show a checkmark. Below are detailed cards with progress bar, current/target amounts, delta vs last month (e.g. "+5,000 Kc vs last month" in green), and deadline if set.' },
            { heading: 'Goal Development Chart', text: 'Click the bar chart icon on any goal card in Portfolio to open a modal with an area chart showing the goal\'s saved amount over up to 12 months. A dashed horizontal line marks the target. Needs at least 2 months of data to display.' },
            { heading: 'Allocation Wizard', text: 'From the Dashboard, click "Allocate Savings" when you have surplus budget. The 3-step wizard shows your available surplus, lets you distribute amounts to each goal (with an "Auto-suggest" button for proportional distribution based on how much each goal needs), and then confirms the allocation. Goals that reach 100% are automatically marked as completed.' },
            { heading: 'Editing & Deleting', text: 'Click the pencil icon on any goal card to edit it in the side panel. You can change the name, target, current amount, deadline, or color. Delete a goal with the red "Delete Goal" button (with confirmation dialog).' },
        ],
        tips: [
            'Set a deadline to stay motivated — the app shows it on the goal card and in the development chart.',
            'The "Auto-suggest" button in the allocation wizard distributes surplus proportionally based on how much each goal still needs.',
            'When a goal reaches its target, it automatically gets a "Done" badge — you can keep it visible or delete it.',
            'Goal progress snapshots are recorded every time you update or allocate, building the history chart over time.',
        ],
    },
    {
        id: 'bills',
        icon: FileCheck,
        title: 'Bills & Mortgage',
        intro: 'Track recurring fixed expenses and mortgage payments. Two tabs: "Recurring Bills" for monthly fixed expenses, and "Mortgage" for loan tracking with amortization schedules.',
        items: [
            { heading: 'Monthly Summary Card', text: 'At the top of the Recurring Bills tab, a card shows your total "Monthly Fixed Expenses" amount and the count of tracked bills.' },
            { heading: 'Auto-Detect Bills', text: 'Click "Detect Bills" (with wand icon) to scan your transaction history for recurring payments in "Fixed Bills" categories. Found bills are automatically added. A toast tells you how many were created, or if all detected bills already exist.' },
            { heading: 'Add Bill Manually', text: 'Click "Add Bill" (with plus icon) to open the side panel where you can manually create a new recurring bill entry.' },
            { heading: 'Bill Checklist', text: 'Each bill shows as a row with its name, expected amount, and payment status for the selected month. Paid bills show the paid amount, unpaid ones show as pending or overdue.' },
            { heading: 'Missing Bills Warning', text: 'If any fixed bills haven\'t been paid this month, a yellow warning banner lists them with their typical amounts. Click "I understand" to dismiss it for that month (remembered per month). When all bills are paid, a green "All recurring fixed expenses paid this month" banner appears instead.' },
            { heading: 'Mortgage Tab — Overview', text: 'The Mortgage tab shows an "Outstanding Balance" summary card with total remaining across all mortgages, count, and total monthly payment. Each mortgage card displays a progress bar showing how much principal you\'ve paid off (percentage and amounts), remaining balance, monthly payment, interest rate, and time left (years and months).' },
            { heading: 'Mortgage — Adding & Editing', text: 'Click "Add Mortgage" to open a modal form. Fill in the name, currency, original loan amount, interest rate, term in months, monthly payment (with a calculator button to auto-compute from amount/rate/term), start date, optional fixed rate end date, extra payments made, optional balance override, linked property, and category.' },
            { heading: 'Mortgage — Payment Confirmation', text: 'The app auto-matches mortgage payments to your transactions. For auto-matched payments, a checkmark button lets you confirm. For pending/overdue months, a manual confirm button opens a transaction picker where you select which transaction was the payment.' },
            { heading: 'Mortgage — Events', text: 'Open any mortgage card to see its detail view with an events timeline. You can record events like interest rate changes, payment amount changes, extra lump-sum payments, and balance corrections. Each event updates the amortization schedule from that point forward.' },
            { heading: 'Fix Rate Expiry Reminders', text: 'If a mortgage has a fixed rate end date, reminder banners appear at 12 months, 6 months, and 1 month before expiry, showing the mortgage name and expiry date.' },
        ],
        tips: [
            'Use "Balance Correction" events to sync your mortgage balance with the bank\'s actual number — the app recalculates everything from that point.',
            'Bills auto-detect works best when your recurring expenses are categorized in "Fixed Bills" categories.',
            'The mortgage progress bar shows principal paid off — it excludes interest payments.',
            'Link a mortgage to a property in Portfolio to see your equity alongside the property value.',
        ],
    },
    {
        id: 'portfolio',
        icon: Wallet,
        title: 'Portfolio',
        intro: 'Track your complete wealth across four tabs: Overview, Savings, Properties, and Stock Portfolio. Page title is "Savings & Investments". Use the Month Picker to view historical snapshots — past months are read-only.',
        items: [
            { heading: 'Overview Tab', text: 'Shows your total portfolio value as a hero card (clickable for a full breakdown popup showing savings, stocks, and properties with percentages). Below are three cards for Total Savings, Stock Portfolio, and Properties — each with a delta vs previous month. A stacked area chart shows "Portfolio Development" over 12 months, and a donut chart shows "Portfolio Allocation" by asset type.' },
            { heading: 'Savings Tab', text: 'Manage savings accounts (name, institution, balance, currency, interest rate APY, notes, color). Each account displays as a card showing balance and institution. Click to edit. Also shows all your savings goals with progress bars, monthly deltas, and development charts. "Add Savings" and "Add Goal" buttons appear in the header.' },
            { heading: 'Properties Tab', text: 'Track property investments. Add a property with details: name, type (Flat/House), location (country, city with autocomplete), rooms, square meters, features (balcony, garden, parking), renovation state, floor, purchase price, and currency. The app auto-estimates current value using per-square-meter price data for known cities. A live metrics panel shows price per m2, estimated value, and profit/loss vs purchase price. Click the value card for a per-property breakdown. A stacked area chart shows value development over time with dashed reference lines at purchase prices.' },
            { heading: 'Stock Portfolio Tab', text: 'Track stocks, ETFs, crypto, and bonds. Each holding has a name, ticker, type, share count, average cost, current price, and currency. Two clickable KPI cards: "Stock Portfolio Value" (click for currency breakdown with exchange rates from Czech National Bank) and "Profit & Loss Balance" (click for per-trade P&L breakdown with cost, proceeds, and gains). A stacked area chart shows the top 5 holdings over 12 months. A donut chart shows allocation by holding type (ETF, Stock, Crypto, Bond). A "Realized P&L" section shows closed trades and dividends.' },
            { heading: 'Stock Detail Modal', text: 'Click any stock card to open a detail modal showing three stat boxes (Invested, Current Value, Gain/Loss), a "Monthly Development" line chart comparing invested vs value over time, and share count with average cost.' },
            { heading: 'Historical Snapshots', text: 'Select a past month to see your portfolio as it was then. The subtitle changes to "Snapshot for [Month]". Add/edit buttons are hidden. Data is read-only. If no snapshot exists for that month, a message explains that snapshots are created when you add or update portfolio items.' },
        ],
        tips: [
            'Click the total portfolio value card on Overview for a breakdown of exactly how much is in savings, stocks, and properties.',
            'Stock currency conversion uses monthly average exchange rates from the Czech National Bank (CNB).',
            'The Properties tab auto-values properties using market data for known cities — enter your city to get automatic estimates.',
            'Realized P&L shows both closed trades and dividends — upload stock and P&L statements from Import to populate this data.',
        ],
    },
    {
        id: 'import',
        icon: FileSpreadsheet,
        title: 'Import',
        intro: 'Upload bank statements and financial documents. Two views: the "Import Wizard" for uploading new files, and "View Documents" for managing previously uploaded statements. Toggle between them using the buttons in the header.',
        items: [
            { heading: 'Supported Formats', text: 'Drop or browse for files. Accepted formats: CSV, Excel (XLSX/XLS), PDF, Word (DOCX/DOC), and images (JPG, PNG, TIFF, BMP, WebP, HEIC). PDF, Word, and images are auto-parsed as bank statements. CSV and Excel files go through a column mapping wizard.' },
            { heading: 'PDF / Word / Image Auto-Parsing', text: 'Drop a PDF bank statement and the app automatically extracts transactions, dates, and amounts. Supports multiple banks (Raiffeisen, FIO, Revolut, and others). The result shows how many transactions were imported, the date range, and any skipped rows. Savings statements sync balances to Portfolio. Stock and P&L statements sync holdings and trades.' },
            { heading: 'CSV/Excel Wizard — Step 1: Upload', text: 'A large drop zone accepts your file. Drag and drop or click to browse. The file is uploaded and column headers are extracted automatically.' },
            { heading: 'CSV/Excel Wizard — Step 2: Map Columns', text: 'Map your file\'s columns to the required fields: Date Column, Description Column, and Amount Column (required), plus optional Type and Currency columns. The app auto-guesses mappings based on column names. Set the date format (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, or MM/DD/YYYY), decimal separator (period or comma), and default currency. A sample data table on the right shows your actual data to help you map correctly.' },
            { heading: 'CSV/Excel Wizard — Step 3: Preview', text: 'Shows all parsed rows in a table with Date, Description, Amount (color-coded), and Type (income/expense badge). A summary bar shows total rows found and any rows with errors. Error rows are listed below and will be skipped during import.' },
            { heading: 'CSV/Excel Wizard — Step 4: Import', text: 'Click "Start Import" to process the transactions. The result shows counts of imported and skipped (duplicate) transactions. Click "Import Another File" to restart the wizard.' },
            { heading: 'View Documents', text: 'Switch to "View Documents" to see all uploaded statements as cards. Filter by type (Bank, Savings, Stock, P&L) or by month. Each card shows the filename, bank name, upload date, transaction count, and processing status. You can assign a date period to a statement, toggle its type between Bank and Savings, view the original file, or delete the statement and all its transactions.' },
            { heading: 'Duplicate Detection', text: 'The importer automatically skips transactions that already exist in the database, so re-uploading the same statement is completely safe. The import result shows how many were skipped.' },
        ],
        tips: [
            'PDF parsing works best with official bank statements downloaded from your bank — not screenshots or photos.',
            'For CSV files, check the decimal separator setting (period vs comma) if your amounts look wrong.',
            'You can change a statement\'s type after import — use the toggle button on the document card to switch between Bank and Savings.',
            'After any import, the Month Picker across all pages automatically updates to include the newly imported months.',
        ],
    },
    {
        id: 'categories',
        icon: Tag,
        title: 'Categories',
        intro: 'Organize your transactions into categories with auto-matching keywords. An info banner at the top explains: "The app automatically learns keywords when you categorize transactions. You can add more keywords here for better matching."',
        items: [
            { heading: 'Three Sections', text: 'Categories are divided into three sections, each with a count in its heading. "Categories" (General) — normal spending and income categories like Groceries, Salary, Entertainment. "Fixed Bills" — transactions in these categories appear on the Bills page as recurring fixed expenses, with a hint shown below the heading. "In & Out Categories" — transfers between your own accounts, excluded from all financial calculations (spending totals, budgets, savings rate).' },
            { heading: 'Creating Categories', text: 'Click the "Create New Category" button at the bottom. A form opens with quick suggestion chips (different suggestions for each section — e.g., Groceries, Eating out for General; Electricity, Mortgage for Fixed Bills; Internal Transfer, Revolut Top-up for In & Out). Click a chip to auto-fill the name and color, or type a custom name. Pick a section from the dropdown and choose a color, then click "Create".' },
            { heading: 'Category Rows', text: 'Each category row shows a drag handle, an expand/collapse chevron, a colored dot, the category name, and a keyword count (e.g. "(3 keywords)"). Two action buttons appear on the right: a pencil icon to rename the category inline, and a trash icon to delete it (with confirmation — transactions are set to "Unknown", not deleted).' },
            { heading: 'Keywords & Auto-Matching', text: 'Expand any category to see its keywords panel labeled "Auto-Match Keywords". Each keyword has a text and a match type badge: SUBSTRING (matches if the keyword appears anywhere in the transaction description), EXACT (must match the full description), REGEX (pattern matching), or LEARNED (auto-learned from your manual categorizations, shown in purple). Add new keywords by typing in the input field, picking a match type, and clicking the plus button or pressing Enter. Delete a keyword with the X button next to it.' },
            { heading: 'Auto-Learning', text: 'When you manually categorize a transaction on the Transactions page, the app automatically creates a LEARNED keyword for that description. Future transactions with the same or similar descriptions are auto-categorized. You can see and manage these learned keywords in the expanded category panel.' },
            { heading: 'Move Between Sections', text: 'Expand any category and use the "Section" dropdown at the top of the panel to move it between General, Fixed Bills, and In & Out. The move happens immediately and a "Category moved" toast confirms it.' },
            { heading: 'Drag & Drop Reorder', text: 'Use the grip handle (six dots icon) on the left of each category to drag and reorder within the same section. The order is saved to the server immediately. You cannot drag categories across sections — use the Section dropdown instead.' },
            { heading: 'Color & Rename', text: 'Click the colored dot next to a category name to open an inline color picker — pick a color and save or cancel. Click the pencil icon to rename — the name becomes an editable text field, press Enter or click the checkmark to save, Escape or X to cancel.' },
        ],
        tips: [
            'Moving a category to "In & Out" excludes all its transactions from spending totals, budget calculations, and savings rate.',
            'Substring matching is the most common and flexible — "lidl" will match any transaction containing that word anywhere.',
            'Deleting a category sets its transactions to "Unknown" — the transactions themselves are never deleted.',
            'Quick suggestion chips change based on which section you have selected when creating a new category.',
        ],
    },
    {
        id: 'settings',
        icon: Settings,
        title: 'Settings',
        intro: 'Five sections to customize your app: Currency, Navigation, Account Security, Two-Factor Authentication, and Appearance. Changes in Currency, Navigation, and Appearance are saved together with the "Save Settings" button at the bottom.',
        items: [
            { heading: 'Preferred Currency', text: 'Choose your main currency from 70+ options (e.g. CZK, EUR, USD). The dashboard will show only transactions in this currency. Note: changing currency filters which transactions are displayed — it does not convert amounts between currencies.' },
            { heading: 'Navigation Customization', text: 'A drag-and-drop list of pages lets you reorder them in the sidebar by dragging the grip handle. Use the eye/eye-off icon button on each page to show or hide it from the sidebar. Hidden pages still work — only the sidebar link is removed. Dashboard is always visible and cannot be hidden (shown with an "Always visible" badge).' },
            { heading: 'Account Security', text: 'Shows your current authentication method (Email & Password, Google, or both). If Google OAuth is available and not yet linked, a "Link Google Account" button appears. For password-based accounts, a "Change Password" section lets you enter your current password and a new password (minimum 8 characters) with a live password strength indicator.' },
            { heading: 'Two-Factor Authentication', text: 'Enable 2FA for extra security. The setup flow: click "Enable 2FA", scan the displayed QR code with your authenticator app (Google Authenticator, Authy, etc.) or enter the secret key manually, then type the 6-digit verification code and click "Verify & Enable". On success, recovery codes are displayed — copy or download them as a text file. Each recovery code can only be used once. To disable 2FA, enter a current authenticator code to confirm. Note: enabling 2FA also unlocks password recovery via your authenticator.' },
            { heading: 'Appearance', text: 'A toggle switch controls the Zumi rabbit mascot. When enabled, the mascot appears on screen and reacts to your financial data with contextual tips and animations.' },
        ],
        tips: [
            'Dashboard is always visible in the sidebar — it cannot be hidden.',
            'Save your 2FA recovery codes in a safe place immediately — you cannot view them again after dismissing the screen.',
            'Changing currency does not convert transaction amounts — it filters which transactions are shown on the dashboard.',
            'Navigation order changes apply to both the desktop sidebar and the mobile bottom nav.',
        ],
    },
];

function HelpSection({ section, isExpanded, onToggle, searchTerm, t }) {
    const Icon = section.icon;

    const filteredItems = searchTerm
        ? section.items.filter(item =>
            item.heading.toLowerCase().includes(searchTerm) ||
            item.text.toLowerCase().includes(searchTerm)
        )
        : section.items;

    const filteredTips = searchTerm
        ? section.tips.filter(tip => tip.toLowerCase().includes(searchTerm))
        : section.tips;

    if (searchTerm && filteredItems.length === 0 && filteredTips.length === 0) return null;

    return (
        <div className={`help-section ${isExpanded ? 'expanded' : ''}`}>
            <button className="help-section-header" onClick={onToggle}>
                <div className="help-section-left">
                    <div className="help-section-icon"><Icon size={18} /></div>
                    <div>
                        <span className="help-section-title">{section.title}</span>
                        <span className="help-section-count">{section.items.length} {t('help.topics')}</span>
                    </div>
                </div>
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>

            {isExpanded && (
                <div className="help-section-body">
                    <p className="help-section-intro">{section.intro}</p>

                    <div className="help-items">
                        {filteredItems.map((item, i) => (
                            <div key={i} className="help-item">
                                <h4>{item.heading}</h4>
                                <p>{item.text}</p>
                            </div>
                        ))}
                    </div>

                    {filteredTips.length > 0 && (
                        <div className="help-tips">
                            <div className="help-tips-header">
                                <Lightbulb size={14} />
                                <span>{t('help.proTips')}</span>
                            </div>
                            <ul>
                                {filteredTips.map((tip, i) => (
                                    <li key={i}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function HelpPage() {
    const [expandedId, setExpandedId] = useState(null);
    const [search, setSearch] = useState('');
    const { t } = useTranslation();
    const { startTour } = useGuidedTour();
    const { setPageData } = useZumfi();

    const totalSteps = TOUR_PHASES.reduce((sum, p) => sum + p.steps.length, 0);
    const searchTerm = search.toLowerCase().trim();

    const visibleSections = useMemo(() => {
        if (!searchTerm) return SECTIONS;
        return SECTIONS.filter(s =>
            s.title.toLowerCase().includes(searchTerm) ||
            s.intro.toLowerCase().includes(searchTerm) ||
            s.items.some(item =>
                item.heading.toLowerCase().includes(searchTerm) ||
                item.text.toLowerCase().includes(searchTerm)
            ) ||
            s.tips.some(tip => tip.toLowerCase().includes(searchTerm))
        );
    }, [searchTerm]);

    // Feed help data to Zumfi for proximity interactions
    useEffect(() => {
        setPageData({
            _page: 'help',
            searchTerm,
            expandedId,
            visibleCount: visibleSections.length,
            totalCount: SECTIONS.length,
            phases: TOUR_PHASES.length,
            totalSteps,
        });
        return () => setPageData(null);
    }, [searchTerm, expandedId, visibleSections.length, totalSteps, setPageData]);

    // Auto-expand all when searching
    const getExpanded = (id) => {
        if (searchTerm) return true;
        return expandedId === id;
    };

    return (
        <div className="page-container">
            <header className="page-header" data-zumfi-zone="help-header">
                <div>
                    <h1 className="page-title">{t('help.title')}</h1>
                    <p className="page-subtitle">{t('help.subtitle')}</p>
                </div>
            </header>

            <button
                className="tour-start-btn"
                data-zumfi-zone="help-tour-btn"
                onClick={startTour}
            >
                <Play size={18} />
                <div className="tour-start-content">
                    <span className="tour-start-label">{t('help.startTour')}</span>
                    <span className="tour-start-desc">
                        {TOUR_PHASES.length} {t('help.sections')} &middot; {totalSteps} {t('help.interactiveSteps')}
                    </span>
                </div>
            </button>

            <div className="help-search" data-zumfi-zone="help-search">
                <Search size={16} />
                <input
                    type="text"
                    placeholder={t('help.searchPlaceholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {search && (
                    <button className="help-search-clear" onClick={() => setSearch('')}>
                        &times;
                    </button>
                )}
            </div>

            {visibleSections.length === 0 && (
                <div className="help-empty">{t('help.noResults')}</div>
            )}

            <div className="help-sections" data-zumfi-zone="help-sections">
                {visibleSections.map(section => (
                    <HelpSection
                        key={section.id}
                        section={section}
                        isExpanded={getExpanded(section.id)}
                        onToggle={() => setExpandedId(prev => prev === section.id ? null : section.id)}
                        searchTerm={searchTerm}
                        t={t}
                    />
                ))}
            </div>
        </div>
    );
}
