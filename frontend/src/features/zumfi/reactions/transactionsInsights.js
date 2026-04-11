// Transactions Zone Insight Generator for Zumfi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';
import { tr } from './lang';

// ── Transactions Header ─────────────────────────────────────────────────────
function headerInsight(data) {
    const { total, reviewCount, statements } = data;

    if (total === 0) {
        return {
            text: pick([
                tr(
                    "No transactions yet! Import a bank statement to get started. I support PDF, CSV, and direct bank connections.",
                    "Zatím žádné transakce! Naimportuj bankovní výpis a jdeme na to. Podporuji PDF, CSV i přímé napojení na banku.",
                ),
                tr(
                    "Your money inbox is empty. Upload a statement and I'll parse, categorize, and organize everything for you.",
                    "Tvá finanční schránka je prázdná. Nahraj výpis a já vše naparsuju, zkategorizuju a uspořádám.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'exclamation-marks',
        };
    }

    const statementCount = statements?.length || 0;
    const txPerStatement = statementCount > 0 ? Math.round(total / statementCount) : 0;

    let importPatternNoteEn = '';
    let importPatternNoteCs = '';
    if (statements && statements.length >= 2) {
        const dates = statements
            .map(s => new Date(s.importDate || s.date || s.created_at))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);

        if (dates.length >= 2) {
            const spanMs = dates[dates.length - 1] - dates[0];
            const spanMonths = Math.max(1, Math.round(spanMs / (30 * 24 * 60 * 60 * 1000)));
            const avgPerMonth = Math.round(statementCount / spanMonths);
            importPatternNoteEn = ` You import about ${avgPerMonth} statement${avgPerMonth !== 1 ? 's' : ''}/month averaging ${txPerStatement} transactions each.`;
            importPatternNoteCs = ` Importuješ zhruba ${avgPerMonth} ${avgPerMonth === 1 ? 'výpis' : avgPerMonth < 5 ? 'výpisy' : 'výpisů'}/měsíc, průměrně po ${txPerStatement} transakcích.`;
        }
    }

    if (reviewCount > 10) {
        return {
            text: pick([
                tr(
                    `${reviewCount} transactions need review! That's a sizable backlog. Use bulk categorization to speed through them — select multiple similar items and apply a category at once.${importPatternNoteEn}`,
                    `${reviewCount} transakcí čeká na kontrolu! To je slušný rest. Použij hromadnou kategorizaci — označ několik podobných položek a přiřaď kategorii najednou.${importPatternNoteCs}`,
                ),
                tr(
                    `Big backlog: ${reviewCount} items to review out of ${total} total.${importPatternNoteEn} Select multiple transactions for bulk categorization to clear them quickly!`,
                    `Velký rest: ${reviewCount} položek ke kontrole z celkových ${total}.${importPatternNoteCs} Označ víc transakcí naráz a rychle je protočíš hromadnou kategorizací!`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    if (reviewCount > 0) {
        return {
            text: pick([
                tr(
                    `Just ${reviewCount} item${reviewCount !== 1 ? 's' : ''} left to review out of ${total}. Almost clean!${importPatternNoteEn}`,
                    `Už jen ${reviewCount} ${reviewCount === 1 ? 'položka' : reviewCount < 5 ? 'položky' : 'položek'} z ${total} čeká na kontrolu. Skoro hotovo!${importPatternNoteCs}`,
                ),
                tr(
                    `${reviewCount} more to categorize and your inbox is spotless. You're close!${importPatternNoteEn}`,
                    `Zbývá zkategorizovat ${reviewCount} a máš prázdnou schránku. Jsi blízko!${importPatternNoteCs}`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'checkmarks-float',
        };
    }

    return {
        text: pick([
            tr(
                `All ${total} transactions categorized — impressive organization!${importPatternNoteEn} Your financial data is clean and ready for analysis.`,
                `Všech ${total} transakcí zkategorizováno — působivá organizace!${importPatternNoteCs} Tvá finanční data jsou čistá a připravená k analýze.`,
            ),
            tr(
                `Clean inbox: ${total} transactions, zero to review.${importPatternNoteEn} Every item is categorized and accounted for.`,
                `Čistá schránka: ${total} transakcí, nic ke kontrole.${importPatternNoteCs} Každá položka je zkategorizovaná a spočítaná.`,
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
        envEffect: 'musical-notes',
    };
}

// ── Search Bar ──────────────────────────────────────────────────────────────
function searchInsight(data) {
    const { searchQ, total, transactions } = data;

    if (searchQ) {
        if (total === 0) {
            return {
                text: pick([
                    tr(
                        `No results for "${searchQ}". Try a partial match, a different spelling, or search by amount instead. I search descriptions, merchants, and notes.`,
                        `Žádné výsledky pro „${searchQ}“. Zkus část slova, jiný pravopis, nebo hledej podle částky. Prohledávám popisy, obchody i poznámky.`,
                    ),
                    tr(
                        `"${searchQ}" returned nothing. Check for typos, or try the merchant's full name. You can also search by transaction amount.`,
                        `„${searchQ}“ nic nenašlo. Zkontroluj překlepy nebo zkus celý název obchodu. Hledat můžeš i podle částky transakce.`,
                    ),
                ]),
                type: 'neutral', expression: 'concerned', mouth: 'neutral', animation: 'idle',
                envEffect: 'magnifying-glass',
            };
        }

        return {
            text: pick([
                tr(
                    `Found ${total} match${total !== 1 ? 'es' : ''} for "${searchQ}". ${total > 10 ? 'Refine your search or use filters to narrow down further.' : 'Click any result for full details.'}`,
                    `Našel jsem ${total} ${total === 1 ? 'shodu' : total < 5 ? 'shody' : 'shod'} pro „${searchQ}“. ${total > 10 ? 'Zpřesni hledání nebo použij filtry.' : 'Klikni na libovolný výsledek pro detail.'}`,
                ),
                tr(
                    `"${searchQ}" — ${total} result${total !== 1 ? 's' : ''}. ${total === 1 ? 'Exact match!' : 'Scroll through or add a filter to focus.'}`,
                    `„${searchQ}“ — ${total} ${total === 1 ? 'výsledek' : total < 5 ? 'výsledky' : 'výsledků'}. ${total === 1 ? 'Přesná shoda!' : 'Proscroluj je nebo přidej filtr.'}`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

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
                tr(
                    `Try searching for "${topMerchant[0]}" — it appears ${topMerchant[1]} times in your transactions. Or search by amount, date, or category keyword.`,
                    `Zkus hledat „${topMerchant[0]}“ — v tvých transakcích se objevuje ${topMerchant[1]}×. Hledat můžeš i podle částky, data nebo klíčového slova kategorie.`,
                ),
                tr(
                    `Pro tip: your most frequent merchant is "${topMerchant[0]}" (${topMerchant[1]} times). Search for it here, or type any amount or description.`,
                    `Profi tip: tvůj nejčastější obchod je „${topMerchant[0]}“ (${topMerchant[1]}×). Vyhledej ho tady, nebo napiš libovolnou částku či popis.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'swirl-burst',
        };
    }

    return {
        text: pick([
            tr(
                "Search by merchant name, description, amount, or even a date range. I'll filter results in real time as you type!",
                "Hledej podle názvu obchodu, popisu, částky nebo rozsahu datumů. Výsledky filtruji v reálném čase, jak píšeš!",
            ),
            tr(
                "Type here to find any transaction. Pro tip: search for a store name or specific amount to find what you're looking for fast.",
                "Tady napiš, ať najdeš libovolnou transakci. Profi tip: hledej název obchodu nebo konkrétní částku — najdeš, co potřebuješ.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'light-bulb',
    };
}

// ── Filters Row ─────────────────────────────────────────────────────────────
function filtersInsight(data) {
    const { reviewCount, typeFilter, statusFilter, total, transactions } = data;

    if (statusFilter === 'review' && reviewCount > 0) {
        const txs = transactions || [];
        const uncategorized = txs.filter(t => !t.category || t.category === 'uncategorized' || t.status === 'review');
        const expenses = uncategorized.filter(t => t.type === 'expense');
        const pctExpense = uncategorized.length > 0 ? Math.round(expenses.length / uncategorized.length * 100) : 0;

        return {
            text: pick([
                tr(
                    `Review filter active: ${reviewCount} items waiting. ${pctExpense}% are expenses — categorize those first since they affect your budget tracking directly.`,
                    `Filtr „ke kontrole“ je aktivní: ${reviewCount} položek čeká. ${pctExpense}% jsou výdaje — začni těmi, přímo ovlivňují sledování rozpočtu.`,
                ),
                tr(
                    `Showing ${reviewCount} transactions to review. ${expenses.length > 0 ? `${expenses.length} are expenses — tackle those to improve your spending reports.` : 'Mix of types. Work through them one by one or use bulk select!'}`,
                    `Zobrazuji ${reviewCount} transakcí ke kontrole. ${expenses.length > 0 ? `${expenses.length} jsou výdaje — vyřeš je, zlepšíš tím přehled útrat.` : 'Mix různých typů. Projdi je po jedné nebo použij hromadný výběr!'}`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    if (reviewCount === 0) {
        return {
            text: pick([
                tr(
                    "Zero items to review — your transaction inbox is squeaky clean! All categorized and accounted for. Nothing slipping through the cracks.",
                    "Žádné položky ke kontrole — tvá schránka transakcí je úplně čistá! Vše zkategorizované a spočítané. Nic neunikne.",
                ),
                tr(
                    "All categorized! Nothing in the review queue. Your financial data is in perfect shape for reports and budgeting.",
                    "Vše zkategorizováno! Ve frontě na kontrolu nic není. Tvá finanční data jsou v perfektním stavu pro reporty a rozpočet.",
                ),
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
                tr(
                    `Expense filter active — showing ${total} outgoing transactions${expTotal > 0 ? ` totaling ${formatMoney(expTotal)}` : ''}. These are where the budget levers are. Look for patterns and recurring charges.`,
                    `Filtr Výdaje aktivní — zobrazuji ${total} odchozích transakcí${expTotal > 0 ? ` v celkové výši ${formatMoney(expTotal)}` : ''}. Tady jsou páky pro rozpočet. Hledej vzorce a opakované poplatky.`,
                ),
                tr(
                    `Viewing ${total} expenses${expTotal > 0 ? ` (${formatMoney(expTotal)} total)` : ''}. Track where your money goes to find optimization opportunities.`,
                    `Zobrazuji ${total} výdajů${expTotal > 0 ? ` (celkem ${formatMoney(expTotal)})` : ''}. Sleduj, kam peníze jdou, a najdi příležitosti k optimalizaci.`,
                ),
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
                tr(
                    `Income filter active — ${total} incoming transactions${incTotal > 0 ? ` totaling ${formatMoney(incTotal)}` : ''}. Every source counts. Make sure all income is properly categorized for accurate reports.`,
                    `Filtr Příjmy aktivní — ${total} příchozích transakcí${incTotal > 0 ? ` v celkové výši ${formatMoney(incTotal)}` : ''}. Každý zdroj se počítá. Ujisti se, že všechny příjmy jsou správně zkategorizované, aby reporty byly přesné.`,
                ),
                tr(
                    `Viewing ${total} income items${incTotal > 0 ? ` worth ${formatMoney(incTotal)}` : ''}. Salary, freelance, refunds — knowing your inflows is just as important as tracking outflows.`,
                    `Zobrazuji ${total} příjmových položek${incTotal > 0 ? ` za ${formatMoney(incTotal)}` : ''}. Mzda, faktury, vrácení — znát příjmy je stejně důležité jako sledovat výdaje.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            tr(
                `Filter by type or status to slice your ${total} transactions. Try the Review filter to surface the ${reviewCount} uncategorized items that need attention.`,
                `Filtruj podle typu nebo stavu a rozdělej si svých ${total} transakcí. Vyzkoušej filtr „Ke kontrole“ a najdi ${reviewCount} nezkategorizovaných položek.`,
            ),
            tr(
                `${reviewCount} items need review. Click the Review pill to focus on them, or filter by Expense/Income to analyze specific flows.`,
                `${reviewCount} položek čeká na kontrolu. Klikni na tag „Ke kontrole“ nebo filtruj podle Výdaje/Příjmy a prozkoumej konkrétní toky.`,
            ),
        ]),
        type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Transaction List ────────────────────────────────────────────────────────
function listInsight(data) {
    const { transactions, total } = data;
    const txs = transactions || [];

    if (txs.length === 0) {
        return {
            text: pick([
                tr(
                    "No transactions to display. Try adjusting your filters or search terms. If the list is truly empty, import a bank statement to get started!",
                    "Nic k zobrazení. Zkus upravit filtry nebo hledaný výraz. Pokud je seznam opravdu prázdný, naimportuj výpis a můžeme začít!",
                ),
                tr(
                    "The list is empty right now. Clear your filters, broaden your search, or import new transactions.",
                    "Seznam je teď prázdný. Zruš filtry, rozšiř hledání nebo naimportuj nové transakce.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    const sorted = [...txs].sort((a, b) => Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0)));
    const largest = sorted[0];
    const largestAmt = Math.abs(Number(largest?.amount || 0));
    const largestName = largest?.merchant || largest?.description || largest?.counterparty || 'Unknown';

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
                tr(
                    `Largest transaction: ${formatMoney(largestAmt)} at "${largestName}". Most frequent: "${topMerchantName}" (${topMerchantCount} times). Click any row for full details and categorization.`,
                    `Největší transakce: ${formatMoney(largestAmt)} u „${largestName}“. Nejčastější: „${topMerchantName}“ (${topMerchantCount}×). Klikni na řádek pro detail a kategorizaci.`,
                ),
                tr(
                    `"${topMerchantName}" leads with ${topMerchantCount} transactions. Biggest single item: ${formatMoney(largestAmt)} from "${largestName}". Explore the patterns in your spending!`,
                    `„${topMerchantName}“ vede s ${topMerchantCount} transakcemi. Největší jednotlivá položka: ${formatMoney(largestAmt)} od „${largestName}“. Prozkoumej vzorce ve svých útratách!`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    if (largestAmt > 0) {
        return {
            text: pick([
                tr(
                    `Largest visible transaction: ${formatMoney(largestAmt)} from "${largestName}". ${txs.length > 1 ? `Showing ${txs.length} of ${total} total. Click any row to see details.` : 'Click it for full details.'}`,
                    `Největší viditelná transakce: ${formatMoney(largestAmt)} od „${largestName}“. ${txs.length > 1 ? `Zobrazeno ${txs.length} z ${total} celkem. Klikni na řádek pro detail.` : 'Klikni pro detail.'}`,
                ),
                tr(
                    `${txs.length} transaction${txs.length !== 1 ? 's' : ''} listed. The biggest at ${formatMoney(largestAmt)} ("${largestName}") — is it categorized correctly?`,
                    `V seznamu ${txs.length} ${txs.length === 1 ? 'transakce' : txs.length < 5 ? 'transakce' : 'transakcí'}. Největší ${formatMoney(largestAmt)} („${largestName}“) — je zařazená správně?`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            tr(
                `${txs.length} transactions visible out of ${total} total. Click any row for full details, or use search and filters to find specific items.`,
                `Zobrazeno ${txs.length} transakcí z ${total} celkem. Klikni na řádek pro detail, nebo použij hledání a filtry.`,
            ),
            tr(
                `Showing ${txs.length} transaction${txs.length !== 1 ? 's' : ''}. Each row is clickable for detailed view and quick categorization.`,
                `Zobrazuji ${txs.length} ${txs.length === 1 ? 'transakci' : txs.length < 5 ? 'transakce' : 'transakcí'}. Každý řádek je klikatelný — otevře detail a rychlou kategorizaci.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Bulk Action Toolbar ─────────────────────────────────────────────────────
function bulkInsight(data) {
    const { selectedCount, reviewCount, transactions } = data;

    if (selectedCount > 0) {
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
                text: tr(
                    `All ${selectedCount} selected are from "${topEntry[0]}" — perfect for bulk categorization! Pick the right category and apply to all at once. This also teaches the auto-categorizer for future imports.`,
                    `Všech ${selectedCount} vybraných je od „${topEntry[0]}“ — ideální pro hromadnou kategorizaci! Vyber správnou kategorii a přiřaď všem najednou. Tím se auto-kategorizace naučí pro budoucí importy.`,
                ),
                type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
                envEffect: 'checkmarks-float',
            };
        }

        return {
            text: pick([
                tr(
                    `${selectedCount} selected! Pick a category and hit Apply to bulk-categorize them all. ${selectedCount > 5 ? 'Nice batch — you\'re clearing the backlog efficiently!' : 'Quick work!'}`,
                    `${selectedCount} ${selectedCount === 1 ? 'vybráno' : 'vybráno'}! Vyber kategorii a klikni Použít — zkategorizuje je všechny najednou. ${selectedCount > 5 ? 'Pěkná dávka — likviduješ rest efektivně!' : 'Rychlá práce!'}`,
                ),
                tr(
                    `Bulk mode: ${selectedCount} items ready. Choose a category to apply to all selected transactions at once. Saves time vs one-by-one.`,
                    `Hromadný režim: ${selectedCount} položek připraveno. Vyber kategorii a aplikuj ji na všechny vybrané transakce najednou. Ušetří čas oproti jedné po druhé.`,
                ),
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'checkmarks-float',
        };
    }

    if (reviewCount > 5) {
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
                    tr(
                        `Efficiency tip: "${topGroup[0]}" appears ${topGroup[1]} times in uncategorized items. Search for it, select all matches, and bulk-categorize in one shot!`,
                        `Tip na efektivitu: „${topGroup[0]}“ se v nezkategorizovaných položkách objevuje ${topGroup[1]}×. Vyhledej ho, označ všechny shody a zkategorizuj je hromadně!`,
                    ),
                    tr(
                        `Pro tip: filter for "${topGroup[0]}" (${topGroup[1]} transactions), select all, and categorize at once. Biggest time saver when you have ${reviewCount} items to review!`,
                        `Profi tip: filtruj „${topGroup[0]}“ (${topGroup[1]} transakcí), označ všechny a zkategorizuj najednou. Největší časová úspora, když máš ${reviewCount} položek ke kontrole!`,
                    ),
                ]),
                type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
                envEffect: 'light-bulb',
            };
        }

        return {
            text: pick([
                tr(
                    `${reviewCount} items to review. Pro tip: sort by merchant, then select groups of similar transactions to bulk-categorize. Way faster than one by one!`,
                    `${reviewCount} položek ke kontrole. Profi tip: seřaď podle obchodu, pak vyber skupiny podobných transakcí a zkategorizuj je hromadně. Mnohem rychlejší než jedna po druhé!`,
                ),
                tr(
                    "Select similar transactions using checkboxes, then apply a category to all at once. It's the fastest way to clear a review backlog!",
                    "Označ podobné transakce pomocí zaškrtávátek a pak jednou aplikuj kategorii na všechny. Nejrychlejší způsob, jak protočit rest!",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                "Use the checkboxes to select transactions for bulk actions. Great for categorizing multiple items from the same merchant at once.",
                "Pomocí zaškrtávátek vybírej transakce pro hromadné akce. Skvělé pro kategorizaci víc položek od stejného obchodu najednou.",
            ),
            tr(
                "Select multiple transactions and categorize them all at once! Each bulk action also trains the auto-categorizer for future imports.",
                "Vyber víc transakcí a zkategorizuj je najednou! Každá hromadná akce navíc trénuje auto-kategorizaci pro budoucí importy.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Sort Controls ───────────────────────────────────────────────────────────
function sortInsight(data) {
    const { sortBy, sortOrder, total, reviewCount } = data;

    if (sortBy === 'amount' || sortBy === 'value') {
        return {
            text: pick([
                tr(
                    `Sorted by amount (${sortOrder === 'asc' ? 'smallest' : 'largest'} first). ${sortOrder === 'desc' ? 'Big transactions at the top — these have the most impact on your budget. Make sure they\'re categorized correctly!' : 'Starting small and working up. Flip to descending to see your biggest transactions first.'}`,
                    `Seřazeno podle částky (${sortOrder === 'asc' ? 'nejmenší' : 'největší'} první). ${sortOrder === 'desc' ? 'Velké transakce nahoře — ty mají největší dopad na rozpočet. Ujisti se, že jsou zkategorizované správně!' : 'Od nejmenších nahoru. Přepni na sestupně a uvidíš nejdřív největší transakce.'}`,
                ),
                tr(
                    `Amount sort ${sortOrder === 'desc' ? 'descending' : 'ascending'}. ${sortOrder === 'desc' ? 'Your highest-value transactions are front and center — review these carefully.' : 'Seeing the small stuff first. The micro-transactions often hide forgotten subscriptions!'}`,
                    `Řazení podle částky ${sortOrder === 'desc' ? 'sestupně' : 'vzestupně'}. ${sortOrder === 'desc' ? 'Tvé nejhodnotnější transakce jsou na očích — projdi je pozorně.' : 'Nejdřív uvidíš malé. Mikro-transakce často skrývají zapomenutá předplatná!'}`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'movie-clap',
        };
    }

    if (sortBy === 'date' || sortBy === 'created_at' || sortBy === 'transaction_date') {
        return {
            text: pick([
                tr(
                    `Sorted by date (${sortOrder === 'desc' ? 'newest' : 'oldest'} first). ${sortOrder === 'desc' ? 'Latest transactions on top — the default for staying current.' : 'Oldest first view. Useful for working through a backlog chronologically!'}`,
                    `Seřazeno podle data (${sortOrder === 'desc' ? 'nejnovější' : 'nejstarší'} první). ${sortOrder === 'desc' ? 'Nejnovější transakce nahoře — výchozí pro udržování přehledu.' : 'Pohled od nejstarších. Užitečné pro chronologické procházení restu!'}`,
                ),
                tr(
                    `Chronological view (${sortOrder === 'desc' ? 'most recent first' : 'oldest first'}). ${reviewCount > 0 ? `Try sorting by date ascending to tackle the oldest uncategorized items first — they\'re easiest to forget.` : 'Your timeline is clean and organized.'}`,
                    `Chronologický pohled (${sortOrder === 'desc' ? 'nejnovější první' : 'nejstarší první'}). ${reviewCount > 0 ? 'Zkus vzestupně podle data a vyřeš nejstarší nezkategorizované položky — na ty se nejsnáz zapomíná.' : 'Tvá časová osa je čistá a uspořádaná.'}`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (sortBy === 'merchant' || sortBy === 'description' || sortBy === 'counterparty') {
        return {
            text: pick([
                tr(
                    `Sorted alphabetically by merchant. This groups transactions from the same store together — perfect for bulk categorization! Select all items from one merchant and categorize in one click.`,
                    `Seřazeno abecedně podle obchodu. Seskupí transakce od stejného obchodu k sobě — ideální pro hromadnou kategorizaci! Označ všechny položky od jednoho obchodu a zkategorizuj jedním kliknutím.`,
                ),
                tr(
                    `Merchant sort active. Seeing transactions grouped by name makes it easy to spot patterns: repeated charges, subscription amounts, or unusual entries.`,
                    `Řazení podle obchodu aktivní. Transakce seskupené podle názvu ukazují vzorce: opakované poplatky, předplatné nebo neobvyklé položky.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (sortBy === 'category') {
        return {
            text: pick([
                tr(
                    `Sorted by category. Uncategorized items group together at the top (or bottom) — handy for finding everything that needs review in one place.`,
                    `Seřazeno podle kategorie. Nezkategorizované položky se seskupí nahoru (nebo dolů) — praktické pro nalezení všeho ke kontrole na jednom místě.`,
                ),
                tr(
                    `Category sort active. This view reveals how your spending distributes across categories. Look for any miscategorized items that seem out of place.`,
                    `Řazení podle kategorie aktivní. Tento pohled ukazuje, jak se útraty rozdělují mezi kategoriemi. Hledej špatně zařazené položky.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                `${total} transactions in view. Try sorting by amount to surface your biggest transactions, or by merchant to group similar items for bulk categorization.`,
                `V zobrazení ${total} transakcí. Zkus řadit podle částky a uvidíš nejdřív největší, nebo podle obchodu a seskupíš podobné pro hromadnou kategorizaci.`,
            ),
            tr(
                `Sort options help you find what matters. Sort by amount for high-impact items, by merchant to group duplicates, or by date to work chronologically.`,
                `Volby řazení ti pomůžou najít, co je důležité. Podle částky pro největší položky, podle obchodu pro seskupení, nebo podle data pro chronologickou práci.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Pagination ──────────────────────────────────────────────────────────────
function paginationInsight(data) {
    const { total, transactions, reviewCount } = data;
    const visible = transactions?.length || 0;

    if (total === 0) {
        return {
            text: tr(
                "Nothing to paginate — your transaction list is empty. Import a statement to populate it!",
                "Není co stránkovat — seznam transakcí je prázdný. Naimportuj výpis a naplň ho!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    if (visible >= total) {
        return {
            text: pick([
                tr(
                    `Showing all ${total} transactions on one page. ${total < 20 ? 'A manageable set — no need to scroll through multiple pages.' : `That's a lot of data in one view! Consider filtering to focus on what matters.`}`,
                    `Všech ${total} transakcí na jedné stránce. ${total < 20 ? 'Zvládnutelné množství — není třeba scrollovat přes víc stránek.' : 'To je hodně dat v jednom pohledu! Zvaž filtrování, ať se zaměříš na to podstatné.'}`,
                ),
                tr(
                    `All ${total} visible. ${reviewCount > 0 ? `${reviewCount} still need review — they're somewhere in this list. Use the Review filter to find them fast.` : 'Everything categorized and in view.'}`,
                    `Všech ${total} viditelných. ${reviewCount > 0 ? `${reviewCount} pořád čeká na kontrolu — někde v tomto seznamu. Použij filtr „Ke kontrole“ a rychle je najdeš.` : 'Vše zkategorizováno a na očích.'}`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    const pagesEstimate = Math.ceil(total / Math.max(1, visible));
    const pctShown = total > 0 ? Math.round(visible / total * 100) : 0;

    return {
        text: pick([
            tr(
                `Showing ${visible} of ${total} transactions (${pctShown}%). About ${pagesEstimate} page${pagesEstimate !== 1 ? 's' : ''} total. Use search or filters to find specific items without paging through everything.`,
                `Zobrazeno ${visible} z ${total} transakcí (${pctShown}%). Zhruba ${pagesEstimate} ${pagesEstimate === 1 ? 'stránka' : pagesEstimate < 5 ? 'stránky' : 'stránek'} celkem. Použij hledání nebo filtry, ať nemusíš procházet všechno.`,
            ),
            tr(
                `Page showing ${visible} items from a total of ${total}. ${reviewCount > 0 ? `There are ${reviewCount} items to review spread across pages — the Review filter will surface them all at once.` : 'All categorized. Browse at your leisure!'}`,
                `Stránka s ${visible} položkami z celkových ${total}. ${reviewCount > 0 ? `Napříč stránkami je ${reviewCount} položek ke kontrole — filtr „Ke kontrole“ je ukáže všechny najednou.` : 'Vše zkategorizováno. Procházej v klidu!'}`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Statement Filter ────────────────────────────────────────────────────────
function statementFilterInsight(data) {
    const { statements, total } = data;
    const stmts = statements || [];

    if (stmts.length === 0) {
        return {
            text: pick([
                tr(
                    "No statements imported yet. Upload a bank export (PDF or CSV) and I'll parse all transactions automatically. Each import becomes a filterable statement.",
                    "Zatím nenaimportované žádné výpisy. Nahraj bankovní export (PDF nebo CSV) a já naparsuju všechny transakce automaticky. Každý import se stane filtrovatelným výpisem.",
                ),
                tr(
                    "Import your first bank statement to unlock statement-based filtering. You can then view transactions from any specific import batch.",
                    "Naimportuj svůj první bankovní výpis a odemkni filtrování podle výpisu. Pak můžeš zobrazit transakce z libovolné dávky importu.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    const latest = stmts[stmts.length - 1] || stmts[0];
    const latestName = latest?.name || latest?.filename || latest?.description || 'Latest import';
    const latestCount = latest?.transactionCount || latest?.count || 0;

    const dates = stmts
        .map(s => new Date(s.importDate || s.date || s.created_at))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a - b);

    let gapNoteEn = '';
    let gapNoteCs = '';
    if (dates.length >= 2) {
        let maxGapDays = 0;
        for (let i = 1; i < dates.length; i++) {
            const gapMs = dates[i] - dates[i - 1];
            const gapDays = Math.round(gapMs / (24 * 60 * 60 * 1000));
            if (gapDays > maxGapDays) maxGapDays = gapDays;
        }
        if (maxGapDays > 45) {
            gapNoteEn = ` I noticed a ${maxGapDays}-day gap between imports — check if you're missing a statement.`;
            gapNoteCs = ` Všiml jsem si ${maxGapDays}denní mezery mezi importy — zkontroluj, jestli ti nechybí nějaký výpis.`;
        }
    }

    if (stmts.length === 1) {
        return {
            text: pick([
                tr(
                    `1 statement imported: "${latestName}"${latestCount > 0 ? ` with ${latestCount} transactions` : ''}. Import more statements to build a complete financial history and enable trend analysis!`,
                    `Naimportován 1 výpis: „${latestName}“${latestCount > 0 ? ` s ${latestCount} transakcemi` : ''}. Přidej další výpisy a postav kompletní finanční historii — odemkneš analýzu trendů!`,
                ),
                tr(
                    `Single statement on file. For the best insights, import at least 3 months of statements. I'll spot trends, anomalies, and patterns you wouldn't see in one month.`,
                    `Jeden výpis v systému. Pro nejlepší postřehy naimportuj aspoň 3 měsíce výpisů. Odhalím trendy, anomálie a vzorce, které v jednom měsíci neuvidíš.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    return {
        text: pick([
            tr(
                `${stmts.length} statements imported spanning ${total} transactions. Filter by statement to review a specific import batch. Latest: "${latestName}".${gapNoteEn}`,
                `Naimportováno ${stmts.length} výpisů s celkem ${total} transakcemi. Filtruj podle výpisu a projdi konkrétní dávku. Nejnovější: „${latestName}“.${gapNoteCs}`,
            ),
            tr(
                `Filter by any of your ${stmts.length} imported statements to isolate transactions from a specific period or bank account.${gapNoteEn}`,
                `Filtruj podle libovolného z ${stmts.length} naimportovaných výpisů a izoluj transakce z konkrétního období nebo účtu.${gapNoteCs}`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Category Filter Dropdown ────────────────────────────────────────────────
function categoryFilterInsight(data) {
    const { transactions, total } = data;
    const txs = transactions || [];

    if (txs.length === 0) {
        return {
            text: tr(
                "Filter by category to focus on one spending area at a time. Pick groceries, eating out, subscriptions — whatever you want to zoom into!",
                "Filtruj podle kategorie a zaměř se na jednu oblast útrat. Potraviny, restaurace, předplatné — cokoli chceš přiblížit!",
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    const uniqueCats = new Set(
        txs.map(t => t.category_name || 'Unknown').filter(Boolean)
    );

    return {
        text: tr(
            `Pick one or more categories to narrow this view. You have ${uniqueCats.size} distinct categor${uniqueCats.size === 1 ? 'y' : 'ies'} across ${total || txs.length} transactions — filter down to zoom in.`,
            `Vyber jednu nebo víc kategorií a zúži zobrazení. Máš ${uniqueCats.size} ${uniqueCats.size === 1 ? 'kategorii' : uniqueCats.size < 5 ? 'kategorie' : 'kategorií'} napříč ${total || txs.length} transakcemi — filtruj a přibliž si to.`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'magnifying-glass',
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
    'tx-category-filter': categoryFilterInsight,
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
            text: pick([
                tr(
                    "No transactions yet — import a bank statement and I'll parse everything automatically!",
                    "Zatím žádné transakce — naimportuj bankovní výpis a já vše naparsuju automaticky!",
                ),
                tr(
                    "Your transaction list is empty. Upload a PDF or CSV to get started.",
                    "Seznam transakcí je prázdný. Nahraj PDF nebo CSV a můžeme začít.",
                ),
            ]),
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
                tr(
                    `${total} transactions loaded, ${reviewCount} need review. ${topMerchant ? `"${topMerchant[0]}" appears ${topMerchant[1]} times — try bulk-categorizing those first!` : 'Use bulk select to speed through them!'}`,
                    `Načteno ${total} transakcí, ${reviewCount} čeká na kontrolu. ${topMerchant ? `„${topMerchant[0]}“ se objevuje ${topMerchant[1]}× — začni s nimi hromadně!` : 'Použij hromadný výběr a prolétni to!'}`,
                ),
                tr(
                    `Big backlog: ${reviewCount} uncategorized out of ${total}. ${stmtCount > 0 ? `Across ${stmtCount} imported statements.` : ''} Let's clear those!`,
                    `Velký rest: ${reviewCount} nezkategorizovaných z ${total}. ${stmtCount > 0 ? `Napříč ${stmtCount} ${stmtCount === 1 ? 'naimportovaným výpisem' : stmtCount < 5 ? 'naimportovanými výpisy' : 'naimportovanými výpisy'}.` : ''} Pojďme to vyřešit!`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        };
    }

    if (reviewCount > 0) {
        return {
            text: pick([
                tr(
                    `${total} transactions, just ${reviewCount} left to review. ${topMerchant ? `Most frequent: "${topMerchant[0]}" (${topMerchant[1]}x).` : ''} Almost clean!`,
                    `${total} transakcí, zbývá zkontrolovat už jen ${reviewCount}. ${topMerchant ? `Nejčastější: „${topMerchant[0]}“ (${topMerchant[1]}×).` : ''} Skoro hotovo!`,
                ),
                tr(
                    `Nearly there — ${reviewCount} more to categorize out of ${total}. Your data is almost spotless!`,
                    `Skoro tam — zkategorizovat zbývá ${reviewCount} z ${total}. Tvá data jsou skoro dokonalá!`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        };
    }

    return {
        text: pick([
            tr(
                `All ${total} transactions categorized! ${topMerchant ? `Top merchant: "${topMerchant[0]}" (${topMerchant[1]} visits).` : ''} ${stmtCount > 0 ? `From ${stmtCount} statements.` : ''} Pristine data!`,
                `Všech ${total} transakcí zkategorizováno! ${topMerchant ? `Nejčastější obchod: „${topMerchant[0]}“ (${topMerchant[1]}×).` : ''} ${stmtCount > 0 ? `Z ${stmtCount} ${stmtCount === 1 ? 'výpisu' : stmtCount < 5 ? 'výpisů' : 'výpisů'}.` : ''} Perfektní data!`,
            ),
            tr(
                `Clean inbox: ${total} transactions, zero to review. ${topMerchant ? `"${topMerchant[0]}" is your most visited place.` : ''} Financial data is ready for analysis!`,
                `Čistá schránka: ${total} transakcí, nic ke kontrole. ${topMerchant ? `„${topMerchant[0]}“ je tvé nejnavštěvovanější místo.` : ''} Finanční data jsou připravená k analýze!`,
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
    };
}
