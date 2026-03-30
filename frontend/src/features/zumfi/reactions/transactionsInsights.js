// Transactions Zone Insight Generator for Zumfi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';

// ── Transactions Header ─────────────────────────────────────────────────────
// Pattern comparison ("you import X/month average")
function headerInsight(data) {
    const { total, transactions, reviewCount, statements } = data;

    if (total === 0) {
        return {
            text: pick([
                "No transactions yet! Import a bank statement to get started. I support PDF, CSV, and direct bank connections.",
                "Your money inbox is empty. Upload a statement and I'll parse, categorize, and organize everything for you.",
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'exclamation-marks',
        };
    }

    // Calculate import rate from statements if available
    const statementCount = statements?.length || 0;
    const txPerStatement = statementCount > 0 ? Math.round(total / statementCount) : 0;

    // Analyze import pattern from statement dates
    let importPatternNote = '';
    if (statements && statements.length >= 2) {
        const dates = statements
            .map(s => new Date(s.importDate || s.date || s.created_at))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);

        if (dates.length >= 2) {
            const spanMs = dates[dates.length - 1] - dates[0];
            const spanMonths = Math.max(1, Math.round(spanMs / (30 * 24 * 60 * 60 * 1000)));
            const avgPerMonth = Math.round(statementCount / spanMonths);
            importPatternNote = ` You import about ${avgPerMonth} statement${avgPerMonth !== 1 ? 's' : ''}/month averaging ${txPerStatement} transactions each.`;
        }
    }

    if (reviewCount > 10) {
        return {
            text: pick([
                `${reviewCount} transactions need review! That's a sizable backlog. Use bulk categorization to speed through them — select multiple similar items and apply a category at once.${importPatternNote}`,
                `Big backlog: ${reviewCount} items to review out of ${total} total.${importPatternNote} Select multiple transactions for bulk categorization to clear them quickly!`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    if (reviewCount > 0) {
        return {
            text: pick([
                `Just ${reviewCount} item${reviewCount !== 1 ? 's' : ''} left to review out of ${total}. Almost clean!${importPatternNote}`,
                `${reviewCount} more to categorize and your inbox is spotless. You're close!${importPatternNote}`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'checkmarks-float',
        };
    }

    return {
        text: pick([
            `All ${total} transactions categorized — impressive organization!${importPatternNote} Your financial data is clean and ready for analysis.`,
            `Clean inbox: ${total} transactions, zero to review.${importPatternNote} Every item is categorized and accounted for.`,
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
        envEffect: 'musical-notes',
    };
}

// ── Search Bar ──────────────────────────────────────────────────────────────
// Smart search suggestions
function searchInsight(data) {
    const { searchQ, total, transactions } = data;

    if (searchQ) {
        if (total === 0) {
            return {
                text: pick([
                    `No results for "${searchQ}". Try a partial match, a different spelling, or search by amount instead. I search descriptions, merchants, and notes.`,
                    `"${searchQ}" returned nothing. Check for typos, or try the merchant's full name. You can also search by transaction amount.`,
                ]),
                type: 'neutral', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'magnifying-glass',
            };
        }

        return {
            text: pick([
                `Found ${total} match${total !== 1 ? 'es' : ''} for "${searchQ}". ${total > 10 ? 'Refine your search or use filters to narrow down further.' : 'Click any result for full details.'}`,
                `"${searchQ}" — ${total} result${total !== 1 ? 's' : ''}. ${total === 1 ? 'Exact match!' : 'Scroll through or add a filter to focus.'}`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    // Suggest smart searches based on transaction data
    const txs = transactions || [];
    const merchants = {};
    txs.forEach(t => {
        const name = t.merchant || t.description || t.counterparty || '';
        if (name) merchants[name] = (merchants[name] || 0) + 1;
    });
    const topMerchant = Object.entries(merchants).sort((a, b) => b[1] - a[1])[0];

    if (topMerchant && topMerchant[1] > 2) {
        return {
            text: pick([
                `Try searching for "${topMerchant[0]}" — it appears ${topMerchant[1]} times in your transactions. Or search by amount, date, or category keyword.`,
                `Pro tip: your most frequent merchant is "${topMerchant[0]}" (${topMerchant[1]} times). Search for it here, or type any amount or description.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'swirl-burst',
        };
    }

    return {
        text: pick([
            "Search by merchant name, description, amount, or even a date range. I'll filter results in real time as you type!",
            "Type here to find any transaction. Pro tip: search for a store name or specific amount to find what you're looking for fast.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'light-bulb',
    };
}

// ── Filters Row ─────────────────────────────────────────────────────────────
// Contextual filter insight
function filtersInsight(data) {
    const { reviewCount, typeFilter, statusFilter, total, transactions } = data;

    if (statusFilter === 'review' && reviewCount > 0) {
        const txs = transactions || [];
        const uncategorized = txs.filter(t => !t.category || t.category === 'uncategorized' || t.status === 'review');
        const expenses = uncategorized.filter(t => t.type === 'expense');
        const pctExpense = uncategorized.length > 0 ? Math.round(expenses.length / uncategorized.length * 100) : 0;

        return {
            text: pick([
                `Review filter active: ${reviewCount} items waiting. ${pctExpense}% are expenses — categorize those first since they affect your budget tracking directly.`,
                `Showing ${reviewCount} transactions to review. ${expenses.length > 0 ? `${expenses.length} are expenses — tackle those to improve your spending reports.` : 'Mix of types. Work through them one by one or use bulk select!'}`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    if (reviewCount === 0) {
        return {
            text: pick([
                "Zero items to review — your transaction inbox is squeaky clean! All categorized and accounted for. Nothing slipping through the cracks.",
                "All categorized! Nothing in the review queue. Your financial data is in perfect shape for reports and budgeting.",
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'telescope',
        };
    }

    if (typeFilter === 'expense') {
        const txs = transactions || [];
        const expTotal = txs.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
        return {
            text: pick([
                `Expense filter active — showing ${total} outgoing transactions${expTotal > 0 ? ` totaling ${formatMoney(expTotal)}` : ''}. These are where the budget levers are. Look for patterns and recurring charges.`,
                `Viewing ${total} expenses${expTotal > 0 ? ` (${formatMoney(expTotal)} total)` : ''}. Track where your money goes to find optimization opportunities.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    if (typeFilter === 'income') {
        const txs = transactions || [];
        const incTotal = txs.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
        return {
            text: pick([
                `Income filter active — ${total} incoming transactions${incTotal > 0 ? ` totaling ${formatMoney(incTotal)}` : ''}. Every source counts. Make sure all income is properly categorized for accurate reports.`,
                `Viewing ${total} income items${incTotal > 0 ? ` worth ${formatMoney(incTotal)}` : ''}. Salary, freelance, refunds — knowing your inflows is just as important as tracking outflows.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            `Filter by type or status to slice your ${total} transactions. Try the Review filter to surface the ${reviewCount} uncategorized items that need attention.`,
            `${reviewCount} items need review. Click the Review pill to focus on them, or filter by Expense/Income to analyze specific flows.`,
        ]),
        type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Transaction List ────────────────────────────────────────────────────────
// Largest transaction, most frequent merchant
function listInsight(data) {
    const { transactions, total, reviewCount } = data;
    const txs = transactions || [];

    if (txs.length === 0) {
        return {
            text: pick([
                "No transactions to display. Try adjusting your filters or search terms. If the list is truly empty, import a bank statement to get started!",
                "The list is empty right now. Clear your filters, broaden your search, or import new transactions.",
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    // Find largest transaction
    const sorted = [...txs].sort((a, b) => Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0)));
    const largest = sorted[0];
    const largestAmt = Math.abs(Number(largest?.amount || 0));
    const largestName = largest?.merchant || largest?.description || largest?.counterparty || 'Unknown';

    // Find most frequent merchant
    const merchantCounts = {};
    txs.forEach(t => {
        const name = (t.merchant || t.description || t.counterparty || '').trim();
        if (name) merchantCounts[name] = (merchantCounts[name] || 0) + 1;
    });
    const topMerchantEntry = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0];
    const topMerchantName = topMerchantEntry?.[0] || '';
    const topMerchantCount = topMerchantEntry?.[1] || 0;

    if (largestAmt > 0 && topMerchantCount > 2) {
        return {
            text: pick([
                `Largest transaction: ${formatMoney(largestAmt)} at "${largestName}". Most frequent: "${topMerchantName}" (${topMerchantCount} times). Click any row for full details and categorization.`,
                `"${topMerchantName}" leads with ${topMerchantCount} transactions. Biggest single item: ${formatMoney(largestAmt)} from "${largestName}". Explore the patterns in your spending!`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    if (largestAmt > 0) {
        return {
            text: pick([
                `Largest visible transaction: ${formatMoney(largestAmt)} from "${largestName}". ${txs.length > 1 ? `Showing ${txs.length} of ${total} total. Click any row to see details.` : 'Click it for full details.'}`,
                `${txs.length} transaction${txs.length !== 1 ? 's' : ''} listed. The biggest at ${formatMoney(largestAmt)} ("${largestName}") — is it categorized correctly?`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            `${txs.length} transactions visible out of ${total} total. Click any row for full details, or use search and filters to find specific items.`,
            `Showing ${txs.length} transaction${txs.length !== 1 ? 's' : ''}. Each row is clickable for detailed view and quick categorization.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Bulk Action Toolbar ─────────────────────────────────────────────────────
// Efficiency tip for bulk categorization
function bulkInsight(data) {
    const { selectedCount, reviewCount, transactions } = data;

    if (selectedCount > 0) {
        // Analyze if selected items share a common merchant
        const txs = transactions || [];
        const selected = txs.filter(t => t.selected);
        const merchants = {};
        selected.forEach(t => {
            const name = (t.merchant || t.description || '').trim();
            if (name) merchants[name] = (merchants[name] || 0) + 1;
        });
        const topEntry = Object.entries(merchants).sort((a, b) => b[1] - a[1])[0];
        const sameMerchant = topEntry && topEntry[1] === selectedCount;

        if (sameMerchant) {
            return {
                text: `All ${selectedCount} selected are from "${topEntry[0]}" — perfect for bulk categorization! Pick the right category and apply to all at once. This also teaches the auto-categorizer for future imports.`,
                type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'checkmarks-float',
            };
        }

        return {
            text: pick([
                `${selectedCount} selected! Pick a category and hit Apply to bulk-categorize them all. ${selectedCount > 5 ? 'Nice batch — you\'re clearing the backlog efficiently!' : 'Quick work!'}`,
                `Bulk mode: ${selectedCount} items ready. Choose a category to apply to all selected transactions at once. Saves time vs one-by-one.`,
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'checkmarks-float',
        };
    }

    if (reviewCount > 5) {
        // Suggest efficient bulk workflow
        const txs = transactions || [];
        const uncategorized = txs.filter(t => !t.category || t.category === 'uncategorized' || t.status === 'review');
        const merchants = {};
        uncategorized.forEach(t => {
            const name = (t.merchant || t.description || '').trim();
            if (name) merchants[name] = (merchants[name] || 0) + 1;
        });
        const topGroup = Object.entries(merchants).sort((a, b) => b[1] - a[1])[0];

        if (topGroup && topGroup[1] > 2) {
            return {
                text: pick([
                    `Efficiency tip: "${topGroup[0]}" appears ${topGroup[1]} times in uncategorized items. Search for it, select all matches, and bulk-categorize in one shot!`,
                    `Pro tip: filter for "${topGroup[0]}" (${topGroup[1]} transactions), select all, and categorize at once. Biggest time saver when you have ${reviewCount} items to review!`,
                ]),
                type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
                envEffect: 'light-bulb',
            };
        }

        return {
            text: pick([
                `${reviewCount} items to review. Pro tip: sort by merchant, then select groups of similar transactions to bulk-categorize. Way faster than one by one!`,
                "Select similar transactions using checkboxes, then apply a category to all at once. It's the fastest way to clear a review backlog!",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            "Use the checkboxes to select transactions for bulk actions. Great for categorizing multiple items from the same merchant at once.",
            "Select multiple transactions and categorize them all at once! Each bulk action also trains the auto-categorizer for future imports.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Sort Controls (NEW) ────────────────────────────────────────────────────
// Sort guidance
function sortInsight(data) {
    const { sortBy, sortOrder, total, reviewCount, transactions } = data;

    if (sortBy === 'amount' || sortBy === 'value') {
        return {
            text: pick([
                `Sorted by amount (${sortOrder === 'asc' ? 'smallest' : 'largest'} first). ${sortOrder === 'desc' ? 'Big transactions at the top — these have the most impact on your budget. Make sure they\'re categorized correctly!' : 'Starting small and working up. Flip to descending to see your biggest transactions first.'}`,
                `Amount sort ${sortOrder === 'desc' ? 'descending' : 'ascending'}. ${sortOrder === 'desc' ? 'Your highest-value transactions are front and center — review these carefully.' : 'Seeing the small stuff first. The micro-transactions often hide forgotten subscriptions!'}`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'movie-clap',
        };
    }

    if (sortBy === 'date' || sortBy === 'created_at' || sortBy === 'transaction_date') {
        return {
            text: pick([
                `Sorted by date (${sortOrder === 'desc' ? 'newest' : 'oldest'} first). ${sortOrder === 'desc' ? 'Latest transactions on top — the default for staying current.' : 'Oldest first view. Useful for working through a backlog chronologically!'}`,
                `Chronological view (${sortOrder === 'desc' ? 'most recent first' : 'oldest first'}). ${reviewCount > 0 ? `Try sorting by date ascending to tackle the oldest uncategorized items first — they\'re easiest to forget.` : 'Your timeline is clean and organized.'}`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (sortBy === 'merchant' || sortBy === 'description' || sortBy === 'counterparty') {
        return {
            text: pick([
                `Sorted alphabetically by merchant. This groups transactions from the same store together — perfect for bulk categorization! Select all items from one merchant and categorize in one click.`,
                `Merchant sort active. Seeing transactions grouped by name makes it easy to spot patterns: repeated charges, subscription amounts, or unusual entries.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (sortBy === 'category') {
        return {
            text: pick([
                `Sorted by category. Uncategorized items group together at the top (or bottom) — handy for finding everything that needs review in one place.`,
                `Category sort active. This view reveals how your spending distributes across categories. Look for any miscategorized items that seem out of place.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    // Default / unknown sort
    return {
        text: pick([
            `${total} transactions in view. Try sorting by amount to surface your biggest transactions, or by merchant to group similar items for bulk categorization.`,
            `Sort options help you find what matters. Sort by amount for high-impact items, by merchant to group duplicates, or by date to work chronologically.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Pagination (NEW) ───────────────────────────────────────────────────────
// Count context
function paginationInsight(data) {
    const { total, transactions, reviewCount } = data;
    const visible = transactions?.length || 0;

    if (total === 0) {
        return {
            text: "Nothing to paginate — your transaction list is empty. Import a statement to populate it!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    if (visible >= total) {
        return {
            text: pick([
                `Showing all ${total} transactions on one page. ${total < 20 ? 'A manageable set — no need to scroll through multiple pages.' : `That's a lot of data in one view! Consider filtering to focus on what matters.`}`,
                `All ${total} visible. ${reviewCount > 0 ? `${reviewCount} still need review — they're somewhere in this list. Use the Review filter to find them fast.` : 'Everything categorized and in view.'}`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    const pagesEstimate = Math.ceil(total / Math.max(1, visible));
    const pctShown = total > 0 ? Math.round(visible / total * 100) : 0;

    return {
        text: pick([
            `Showing ${visible} of ${total} transactions (${pctShown}%). About ${pagesEstimate} page${pagesEstimate !== 1 ? 's' : ''} total. Use search or filters to find specific items without paging through everything.`,
            `Page showing ${visible} items from a total of ${total}. ${reviewCount > 0 ? `There are ${reviewCount} items to review spread across pages — the Review filter will surface them all at once.` : 'All categorized. Browse at your leisure!'}`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Statement Filter (NEW) ─────────────────────────────────────────────────
// Statement-specific insight
function statementFilterInsight(data) {
    const { statements, total, transactions } = data;
    const stmts = statements || [];

    if (stmts.length === 0) {
        return {
            text: pick([
                "No statements imported yet. Upload a bank export (PDF or CSV) and I'll parse all transactions automatically. Each import becomes a filterable statement.",
                "Import your first bank statement to unlock statement-based filtering. You can then view transactions from any specific import batch.",
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    // Analyze statements
    const latest = stmts[stmts.length - 1] || stmts[0];
    const latestName = latest?.name || latest?.filename || latest?.description || 'Latest import';
    const latestCount = latest?.transactionCount || latest?.count || 0;
    const latestDate = latest?.importDate || latest?.date || latest?.created_at || '';

    // Check for date gaps between statements
    const dates = stmts
        .map(s => new Date(s.importDate || s.date || s.created_at))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a - b);

    let gapNote = '';
    if (dates.length >= 2) {
        let maxGapDays = 0;
        for (let i = 1; i < dates.length; i++) {
            const gapMs = dates[i] - dates[i - 1];
            const gapDays = Math.round(gapMs / (24 * 60 * 60 * 1000));
            if (gapDays > maxGapDays) maxGapDays = gapDays;
        }
        if (maxGapDays > 45) {
            gapNote = ` I noticed a ${maxGapDays}-day gap between imports — check if you're missing a statement.`;
        }
    }

    if (stmts.length === 1) {
        return {
            text: pick([
                `1 statement imported: "${latestName}"${latestCount > 0 ? ` with ${latestCount} transactions` : ''}. Import more statements to build a complete financial history and enable trend analysis!`,
                `Single statement on file. For the best insights, import at least 3 months of statements. I'll spot trends, anomalies, and patterns you wouldn't see in one month.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    return {
        text: pick([
            `${stmts.length} statements imported spanning ${total} transactions. Filter by statement to review a specific import batch. Latest: "${latestName}".${gapNote}`,
            `Filter by any of your ${stmts.length} imported statements to isolate transactions from a specific period or bank account.${gapNote}`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'tx-header': headerInsight,
    'tx-search': searchInsight,
    'tx-filters': filtersInsight,
    'tx-list': listInsight,
    'tx-bulk': bulkInsight,
    'tx-sort': sortInsight,
    'tx-pagination': paginationInsight,
    'tx-statement-filter': statementFilterInsight,
};

export function generateTransactionsInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

export function transactionsPageSummary(data) {
    const { total, reviewCount, transactions, statements } = data;

    if (total === 0) {
        return {
            text: pick(["No transactions yet — import a bank statement and I'll parse everything automatically!", "Your transaction list is empty. Upload a PDF or CSV to get started."]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
        };
    }

    const txs = transactions || [];
    const merchants = {};
    txs.forEach(t => {
        const name = (t.merchant || t.description || t.counterparty || '').trim();
        if (name) merchants[name] = (merchants[name] || 0) + 1;
    });
    const topMerchant = Object.entries(merchants).sort((a, b) => b[1] - a[1])[0];
    const stmtCount = statements?.length || 0;

    if (reviewCount > 10) {
        return {
            text: pick([
                `${total} transactions loaded, ${reviewCount} need review. ${topMerchant ? `"${topMerchant[0]}" appears ${topMerchant[1]} times — try bulk-categorizing those first!` : 'Use bulk select to speed through them!'}`,
                `Big backlog: ${reviewCount} uncategorized out of ${total}. ${stmtCount > 0 ? `Across ${stmtCount} imported statements.` : ''} Let's clear those!`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        };
    }

    if (reviewCount > 0) {
        return {
            text: pick([
                `${total} transactions, just ${reviewCount} left to review. ${topMerchant ? `Most frequent: "${topMerchant[0]}" (${topMerchant[1]}x).` : ''} Almost clean!`,
                `Nearly there — ${reviewCount} more to categorize out of ${total}. Your data is almost spotless!`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        };
    }

    return {
        text: pick([
            `All ${total} transactions categorized! ${topMerchant ? `Top merchant: "${topMerchant[0]}" (${topMerchant[1]} visits).` : ''} ${stmtCount > 0 ? `From ${stmtCount} statements.` : ''} Pristine data!`,
            `Clean inbox: ${total} transactions, zero to review. ${topMerchant ? `"${topMerchant[0]}" is your most visited place.` : ''} Financial data is ready for analysis!`,
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
    };
}
