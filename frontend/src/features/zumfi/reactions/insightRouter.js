// Central dispatcher — routes zone insights to page-specific generators.

import { generateDashboardInsight, dashboardPageSummary } from './dashboardInsights';
import { generateTransactionsInsight, transactionsPageSummary } from './transactionsInsights';
import { generateBudgetInsight, budgetPageSummary } from './budgetInsights';
import { generateBillsInsight, billsPageSummary } from './billsInsights';
import { generateImportInsight, importPageSummary } from './importInsights';
import { generatePortfolioInsight, portfolioPageSummary } from './portfolioInsights';
import { generateSettingsInsight, settingsPageSummary } from './settingsInsights';
import { generateHelpInsight, helpPageSummary } from './helpInsights';

const PAGE_GENERATORS = {
    dashboard: generateDashboardInsight,
    transactions: generateTransactionsInsight,
    budget: generateBudgetInsight,
    bills: generateBillsInsight,
    import: generateImportInsight,
    portfolio: generatePortfolioInsight,
    settings: generateSettingsInsight,
    help: generateHelpInsight,
};

const PAGE_SUMMARY_GENERATORS = {
    dashboard: dashboardPageSummary,
    transactions: transactionsPageSummary,
    budget: budgetPageSummary,
    bills: billsPageSummary,
    import: importPageSummary,
    portfolio: portfolioPageSummary,
    settings: settingsPageSummary,
    help: helpPageSummary,
};

export function generateInsight(zoneId, data) {
    if (!data || !data._page) return null;
    const generator = PAGE_GENERATORS[data._page];
    if (!generator) return null;
    return generator(zoneId, data);
}

export function generatePageSummary(data) {
    if (!data || !data._page) return null;
    const generator = PAGE_SUMMARY_GENERATORS[data._page];
    if (!generator) return null;
    return generator(data);
}
