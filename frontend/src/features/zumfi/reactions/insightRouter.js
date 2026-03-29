// Central dispatcher — routes zone insights to page-specific generators.

import { generateDashboardInsight } from './dashboardInsights';
import { generateTransactionsInsight } from './transactionsInsights';
import { generateBudgetInsight } from './budgetInsights';
import { generateBillsInsight } from './billsInsights';
import { generateImportInsight } from './importInsights';
import { generatePortfolioInsight } from './portfolioInsights';
import { generateSettingsInsight } from './settingsInsights';

const PAGE_GENERATORS = {
    dashboard: generateDashboardInsight,
    transactions: generateTransactionsInsight,
    budget: generateBudgetInsight,
    bills: generateBillsInsight,
    import: generateImportInsight,
    portfolio: generatePortfolioInsight,
    settings: generateSettingsInsight,
};

export function generateInsight(zoneId, data) {
    if (!data || !data._page) return null;
    const generator = PAGE_GENERATORS[data._page];
    if (!generator) return null;
    return generator(zoneId, data);
}
