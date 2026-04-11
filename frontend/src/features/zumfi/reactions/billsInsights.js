// Bills Zone Insight Generator for Zumfi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';
import { tr } from './lang';

// ── Bills Header ────────────────────────────────────────────────────────────
function headerInsight(data) {
    const { billStatuses, totalMonthly, totalExpected } = data;

    if (!billStatuses || billStatuses.length === 0) {
        return {
            text: pick([
                tr(
                    "No bills set up yet! Add your recurring expenses — rent, utilities, subscriptions — and I'll help you stay on top of every payment.",
                    "Zatím žádné platby! Přidej své pravidelné výdaje — nájem, energie, předplatná — a já pohlídám každou splatnost.",
                ),
                tr(
                    "Start adding your fixed bills and I'll track due dates, flag overdue items, and keep your cash flow predictable.",
                    "Začni přidávat fixní platby a já pohlídám datumy splatnosti, označím prošlé položky a udržím tvé cash flow předvídatelné.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const fixedTotal = totalMonthly || totalExpected || 0;
    const income = billStatuses.find(b => b.monthlyIncome || b.income);
    const monthlyIncome = income?.monthlyIncome || income?.income || 0;

    if (monthlyIncome > 0 && fixedTotal > 0) {
        const fixedPct = (fixedTotal / monthlyIncome * 100).toFixed(0);
        const isHigh = fixedPct > 60;
        return {
            text: pick([
                tr(
                    `Your ${billStatuses.length} recurring bills total ${formatMoney(fixedTotal)}, which is ${fixedPct}% of your monthly income. ${isHigh ? 'That\'s a heavy fixed-cost load — look for subscriptions you can trim.' : 'That leaves solid room for savings and discretionary spending.'}`,
                    `Tvých ${billStatuses.length} pravidelných plateb tvoří celkem ${formatMoney(fixedTotal)}, což je ${fixedPct}% tvého měsíčního příjmu. ${isHigh ? 'To je velká zátěž fixních nákladů — hledej předplatná, která můžeš osekat.' : 'Zbývá dost prostoru na úspory i volné útraty.'}`,
                ),
                tr(
                    `Fixed expenses take ${fixedPct}% of your income (${formatMoney(fixedTotal)} across ${billStatuses.length} bills). ${isHigh ? 'Consider renegotiating your biggest bills to free up cash flow.' : 'A healthy ratio that gives you flexibility.'}`,
                    `Fixní výdaje ti berou ${fixedPct}% příjmu (${formatMoney(fixedTotal)} napříč ${billStatuses.length} platbami). ${isHigh ? 'Zvaž jednání o největších platbách, uvolníš cash flow.' : 'Zdravý poměr, který ti dává flexibilitu.'}`,
                ),
            ]),
            type: isHigh ? 'warning' : 'positive',
            expression: isHigh ? 'concerned' : 'happy',
            mouth: isHigh ? 'neutral' : 'smile',
            animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            tr(
                `Tracking ${billStatuses.length} recurring bill${billStatuses.length !== 1 ? 's' : ''} totaling ${formatMoney(fixedTotal)}. Drag me around for details on each section!`,
                `Sleduji ${billStatuses.length} pravidelných ${billStatuses.length === 1 ? 'platbu' : billStatuses.length < 5 ? 'platby' : 'plateb'} v celkové výši ${formatMoney(fixedTotal)}. Přetáhni mě kolem a uvidíš detaily každé sekce!`,
            ),
            tr(
                `${billStatuses.length} bills on your radar at ${formatMoney(fixedTotal)}/month. Your fixed expenses are organized and visible.`,
                `${billStatuses.length} ${billStatuses.length === 1 ? 'platba' : billStatuses.length < 5 ? 'platby' : 'plateb'} pod dohledem za ${formatMoney(fixedTotal)}/měsíc. Tvé fixní výdaje jsou uspořádané a na očích.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Bills Summary Row ───────────────────────────────────────────────────────
function summaryInsight(data) {
    const { paidCount, overdueCount, billStatuses, totalExpected, totalPaid } = data;
    const total = billStatuses?.length || 0;

    if (total === 0) {
        return {
            text: tr(
                "No bills to summarize yet. Use the Autofill button to detect recurring expenses from your transactions, or add them manually!",
                "Zatím není co shrnout. Klikni na Auto-detekci a já najdu pravidelné výdaje z tvých transakcí, nebo je přidej ručně!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'exclamation-marks',
        };
    }

    if (overdueCount > 0) {
        const overdue = (billStatuses || [])
            .filter(b => b.status === 'overdue' || b.overdue)
            .sort((a, b) => (b.amount || 0) - (a.amount || 0));

        const topOverdue = overdue[0];
        const topName = topOverdue?.name || topOverdue?.description || 'a bill';
        const topAmt = topOverdue?.amount || 0;
        const totalOverdueAmt = overdue.reduce((s, b) => s + (b.amount || 0), 0);

        return {
            text: pick([
                tr(
                    `${overdueCount} bill${overdueCount !== 1 ? 's' : ''} overdue totaling ${formatMoney(totalOverdueAmt)}! Priority #1: "${topName}" at ${formatMoney(topAmt)}. Late fees add up fast — tackle the biggest ones first.`,
                    `${overdueCount} ${overdueCount === 1 ? 'prošlá platba' : overdueCount < 5 ? 'prošlé platby' : 'prošlých plateb'} v celkové výši ${formatMoney(totalOverdueAmt)}! Priorita č. 1: „${topName}“ za ${formatMoney(topAmt)}. Penále se sčítá rychle — začni největšími.`,
                ),
                tr(
                    `Alert: ${formatMoney(totalOverdueAmt)} in overdue payments. "${topName}" (${formatMoney(topAmt)}) should be your first call. ${overdueCount > 1 ? `Then work through the remaining ${overdueCount - 1}.` : 'Clear it before the next cycle.'}`,
                    `Pozor: ${formatMoney(totalOverdueAmt)} prošlých plateb. „${topName}“ (${formatMoney(topAmt)}) by měla být tvá první priorita. ${overdueCount > 1 ? `Pak vyřeš zbývajících ${overdueCount - 1}.` : 'Vyřeš ji před dalším cyklem.'}`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'lightning-bolts',
        };
    }

    if (paidCount === total && total > 0) {
        return {
            text: pick([
                tr(
                    `All ${total} bills paid — ${formatMoney(totalPaid)} handled! You're fully caught up with zero outstanding payments this month. That's peace of mind.`,
                    `Všech ${total} plateb vyřízeno — ${formatMoney(totalPaid)} hotovo! Jsi plně v pohodě, žádné nevyřízené platby. To je klid duše.`,
                ),
                tr(
                    `Perfect record: ${total} out of ${total} paid for ${formatMoney(totalPaid)}. Nothing overdue, nothing pending. Your creditors love you!`,
                    `Perfektní skóre: ${total} z ${total} zaplaceno za ${formatMoney(totalPaid)}. Nic prošlého, nic čekajícího. Věřitelé tě milují!`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'checkmarks-float',
        };
    }

    const remaining = total - paidCount;
    const remainingAmount = (totalExpected || 0) - (totalPaid || 0);

    const unpaid = (billStatuses || [])
        .filter(b => b.status !== 'paid' && !b.paid)
        .sort((a, b) => {
            const dateA = a.dueDate || a.due_date || '';
            const dateB = b.dueDate || b.due_date || '';
            return dateA.localeCompare(dateB);
        });
    const nextDue = unpaid[0];
    const nextName = nextDue?.name || nextDue?.description || '';
    const nextSuffixEn = nextName ? ` Next up: "${nextName}".` : '';
    const nextSuffixCs = nextName ? ` Na řadě: „${nextName}“.` : '';

    return {
        text: pick([
            tr(
                `${paidCount}/${total} paid, ${formatMoney(remainingAmount)} still to go across ${remaining} bill${remaining !== 1 ? 's' : ''}.${nextSuffixEn}`,
                `${paidCount}/${total} zaplaceno, zbývá ${formatMoney(remainingAmount)} napříč ${remaining} ${remaining === 1 ? 'platbou' : remaining < 5 ? 'platbami' : 'platbami'}.${nextSuffixCs}`,
            ),
            tr(
                `${remaining} bill${remaining !== 1 ? 's' : ''} remaining this month, totaling ${formatMoney(remainingAmount)}.${nextSuffixEn} Stay ahead of the due dates!`,
                `Tento měsíc zbývá ${remaining} ${remaining === 1 ? 'platba' : remaining < 5 ? 'platby' : 'plateb'} v celkové výši ${formatMoney(remainingAmount)}.${nextSuffixCs} Zůstaň před splatnostmi!`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'checkmarks-float',
    };
}

// ── Bill Checklist ──────────────────────────────────────────────────────────
function checklistInsight(data) {
    const { billStatuses, paidCount, overdueCount } = data;
    const total = billStatuses?.length || 0;

    if (total === 0) {
        return {
            text: tr(
                "Your bill checklist is empty. Add bills manually or try the Autofill feature to detect recurring payments from your transaction history!",
                "Tvůj seznam plateb je prázdný. Přidej platby ručně nebo vyzkoušej Auto-detekci — najde opakující se platby v historii transakcí!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const progress = total > 0 ? (paidCount / total * 100) : 0;

    if (progress === 100) {
        const earlyPayers = (billStatuses || []).filter(b => {
            const dueDate = b.dueDate || b.due_date;
            const paidDate = b.paidDate || b.paid_date;
            return dueDate && paidDate && paidDate < dueDate;
        });
        const earlyPct = total > 0 ? Math.round(earlyPayers.length / total * 100) : 0;

        return {
            text: pick([
                tr(
                    `Checklist complete — every bill checked off! ${earlyPct > 50 ? `${earlyPct}% were paid early — you're consistently ahead of deadlines.` : 'All paid on time, which keeps your financial record clean.'}`,
                    `Seznam hotový — každá platba odškrtnutá! ${earlyPct > 50 ? `${earlyPct}% zaplaceno dopředu — jsi trvale před splatností.` : 'Vše zaplaceno včas, což ti drží finanční historii čistou.'}`,
                ),
                tr(
                    `All ${total} items done! ${earlyPayers.length > 0 ? `${earlyPayers.length} were paid before their due date — that habit protects you from surprise cash crunches.` : 'Nothing outstanding. Clean slate for the month!'}`,
                    `Všech ${total} položek hotovo! ${earlyPayers.length > 0 ? `${earlyPayers.length} zaplaceno před splatností — ten zvyk tě chrání před náhlými problémy s cash flow.` : 'Nic nevyřízeného. Čistá tabule pro tento měsíc!'}`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'confetti',
        };
    }

    if (progress >= 75) {
        const remaining = total - paidCount;
        return {
            text: pick([
                tr(
                    `Almost done — ${paidCount} of ${total} bills paid (${progress.toFixed(0)}%). Just ${remaining} more to check off. You tend to finish strong!`,
                    `Skoro hotovo — ${paidCount} z ${total} plateb zaplaceno (${progress.toFixed(0)}%). Už jen ${remaining} odškrtnout. Ty to obvykle dotáhneš do konce!`,
                ),
                tr(
                    `${progress.toFixed(0)}% complete with ${remaining} left. You're in the home stretch — keep the momentum going!`,
                    `${progress.toFixed(0)}% hotovo, zbývá ${remaining}. Jsi v cílové rovince — udrž tempo!`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    if (overdueCount > 0) {
        const overdueNames = (billStatuses || [])
            .filter(b => b.status === 'overdue' || b.overdue)
            .map(b => b.name || b.description || 'Unknown');
        const uniqueOverdue = [...new Set(overdueNames)];

        return {
            text: pick([
                tr(
                    `${overdueCount} overdue item${overdueCount !== 1 ? 's' : ''} flagged in your checklist: ${uniqueOverdue.slice(0, 2).join(', ')}${uniqueOverdue.length > 2 ? ` and ${uniqueOverdue.length - 2} more` : ''}. These need attention before late fees kick in.`,
                    `V seznamu označeno ${overdueCount} ${overdueCount === 1 ? 'prošlá položka' : overdueCount < 5 ? 'prošlé položky' : 'prošlých položek'}: ${uniqueOverdue.slice(0, 2).join(', ')}${uniqueOverdue.length > 2 ? ` a další ${uniqueOverdue.length - 2}` : ''}. Potřebují pozornost, než přijde penále.`,
                ),
                tr(
                    `Red flags in your checklist — ${overdueCount} overdue. ${uniqueOverdue.length === 1 ? `"${uniqueOverdue[0]}" keeps slipping — consider setting up a reminder.` : 'Don\'t let them pile up, tackle the most expensive first.'}`,
                    `Červené praporky v seznamu — ${overdueCount} prošlých. ${uniqueOverdue.length === 1 ? `„${uniqueOverdue[0]}“ pořád uniká — zvaž nastavit připomínku.` : 'Nenech je navršit, začni nejdražšími.'}`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            tr(
                `${paidCount} of ${total} checked off (${progress.toFixed(0)}%). Each payment brings peace of mind — keep working through the list!`,
                `${paidCount} z ${total} odškrtnuto (${progress.toFixed(0)}%). Každá platba přináší klid — pokračuj v seznamu!`,
            ),
            tr(
                `Progress: ${progress.toFixed(0)}%. ${total - paidCount} bills waiting. Pay them in order of due date to minimize risk of late fees.`,
                `Postup: ${progress.toFixed(0)}%. ${total - paidCount} ${(total - paidCount) === 1 ? 'platba čeká' : (total - paidCount) < 5 ? 'platby čekají' : 'plateb čeká'}. Plať podle splatnosti, ať neplatíš zbytečně penále.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Autofill Button Area ────────────────────────────────────────────────────
function autofillInsight(data) {
    const { billStatuses, missingBills } = data;
    const total = billStatuses?.length || 0;
    const missingCount = missingBills?.length || 0;

    if (total === 0 && missingCount === 0) {
        return {
            text: pick([
                tr(
                    "Try the Autofill button! I'll scan your transactions for recurring patterns and suggest bills you should be tracking. The more transaction history you have, the better my detection.",
                    "Vyzkoušej Auto-detekci! Projdu tvé transakce, najdu opakující se vzorce a navrhnu platby, které bys měl/a sledovat. Čím víc historie, tím lepší detekce.",
                ),
                tr(
                    "The magic wand detects repeating expenses automatically. Import a few months of statements first for the best results, then hit Autofill!",
                    "Kouzelná hůlka najde opakované výdaje automaticky. Nejdřív naimportuj pár měsíců výpisů a pak klikni na Auto-detekci!",
                ),
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }

    if (missingCount > 0) {
        const topMissing = missingBills.slice(0, 2).map(b => b.name || b.description || 'Unknown');
        return {
            text: pick([
                tr(
                    `I've detected ${missingCount} potential recurring expense${missingCount !== 1 ? 's' : ''} not yet in your bill list — including ${topMissing.join(' and ')}. Hit Autofill to review and add them!`,
                    `Našel jsem ${missingCount} ${missingCount === 1 ? 'potenciální opakovaný výdaj' : missingCount < 5 ? 'potenciální opakované výdaje' : 'potenciálních opakovaných výdajů'} — včetně ${topMissing.join(' a ')}. Klikni na Auto-detekci a přidej je!`,
                ),
                tr(
                    `${missingCount} bill${missingCount !== 1 ? 's' : ''} spotted in your transactions but missing from your tracker. Autofill can pull ${topMissing[0]}${missingCount > 1 ? ` and ${missingCount - 1} more` : ''} right in.`,
                    `${missingCount} ${missingCount === 1 ? 'platba nalezena' : missingCount < 5 ? 'platby nalezeny' : 'plateb nalezeno'} v tvých transakcích, ale chybí v trackeru. Auto-detekce dokáže vtáhnout ${topMissing[0]}${missingCount > 1 ? ` a dalších ${missingCount - 1}` : ''}.`,
                ),
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }

    return {
        text: pick([
            tr(
                "Hit Autofill periodically to catch any new recurring bills I spot. New subscriptions show up in your transactions before you remember to track them!",
                "Klikni na Auto-detekci občas, ať zachytím nové opakované platby. Nová předplatná se objeví v transakcích dřív, než si je zapamatuješ!",
            ),
            tr(
                "I continuously learn from your transaction patterns. Run Autofill every few months to catch new subscriptions and rate changes.",
                "Průběžně se učím z tvých transakčních vzorců. Spouštěj Auto-detekci každých pár měsíců a chytíš nová předplatná i změny cen.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'light-bulb',
    };
}

// ── Bills Tabs ──────────────────────────────────────────────────────────────
function tabsInsight(data) {
    const { activeTab, overdueCount, billStatuses, mortgages } = data;
    const total = billStatuses?.length || 0;
    const hasMortgages = mortgages && mortgages.length > 0;

    if (activeTab === 'mortgages' || activeTab === 'mortgage') {
        return {
            text: pick([
                tr(
                    `Viewing your mortgage${hasMortgages && mortgages.length > 1 ? 's' : ''} tab. ${hasMortgages ? `Tracking ${mortgages.length} mortgage${mortgages.length !== 1 ? 's' : ''} — your biggest long-term commitment. Drag me to each section for details.` : 'No mortgages added yet — add one to track your homeownership journey!'}`,
                    `Díváš se na záložku hypotéky. ${hasMortgages ? `Sleduji ${mortgages.length} ${mortgages.length === 1 ? 'hypotéku' : mortgages.length < 5 ? 'hypotéky' : 'hypoték'} — tvůj největší dlouhodobý závazek. Přetáhni mě na sekce pro detaily.` : 'Zatím nejsou přidané žádné hypotéky — přidej jednu a sleduj cestu k vlastnictví bydlení!'}`,
                ),
                tr(
                    `Mortgage view active. ${hasMortgages ? 'This is where you track progress toward owning your home outright.' : 'Nothing here yet. If you have a home loan, add it to see payoff projections!'}`,
                    `Aktivní pohled na hypotéky. ${hasMortgages ? 'Tady sleduješ postup ke splacení svého bydlení.' : 'Zatím tu nic není. Pokud máš hypotéku, přidej ji a uvidíš projekce splácení!'}`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'swirl-burst',
        };
    }

    if (overdueCount > 0) {
        return {
            text: pick([
                tr(
                    `You're on the Bills tab with ${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''} to address. ${hasMortgages ? 'Once you\'re caught up, check the Mortgage tab to review your home loan progress too.' : 'Focus on clearing the overdue items first!'}`,
                    `Jsi na záložce Platby a máš ${overdueCount} ${overdueCount === 1 ? 'prošlou platbu' : overdueCount < 5 ? 'prošlé platby' : 'prošlých plateb'} k vyřešení. ${hasMortgages ? 'Až budeš v obraze, mrkni na záložku Hypotéky a zkontroluj pokrok u úvěru.' : 'Nejdřív vyřeš prošlé položky!'}`,
                ),
                tr(
                    `Bills tab active. Priority: clear the ${overdueCount} overdue bill${overdueCount !== 1 ? 's' : ''}. ${hasMortgages ? 'Your mortgage payments are tracked on the Mortgages tab.' : ''}`,
                    `Záložka Platby aktivní. Priorita: vyřešit ${overdueCount} ${overdueCount === 1 ? 'prošlou platbu' : overdueCount < 5 ? 'prošlé platby' : 'prošlých plateb'}. ${hasMortgages ? 'Splátky hypotéky sleduji na záložce Hypotéky.' : ''}`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'swirl-burst',
        };
    }

    if (hasMortgages) {
        return {
            text: pick([
                tr(
                    `Bills tab showing ${total} recurring expenses. Switch to the Mortgages tab to see your ${mortgages.length} home loan${mortgages.length !== 1 ? 's' : ''} and payoff progress.`,
                    `Záložka Platby zobrazuje ${total} pravidelných výdajů. Přepni na Hypotéky a uvidíš ${mortgages.length} ${mortgages.length === 1 ? 'hypotéku' : mortgages.length < 5 ? 'hypotéky' : 'hypoték'} i pokrok ve splácení.`,
                ),
                tr(
                    `You have both bills (${total}) and mortgages (${mortgages.length}) to track. Toggle between tabs to get the full picture of your fixed commitments.`,
                    `Sleduješ platby (${total}) i hypotéky (${mortgages.length}). Přepínej mezi záložkami a získej úplný přehled svých fixních závazků.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                `Viewing your ${total} bills. This tab tracks all recurring monthly expenses — from subscriptions to utilities. Everything that hits your account on a schedule.`,
                `Prohlížíš svých ${total} ${total === 1 ? 'platbu' : total < 5 ? 'platby' : 'plateb'}. Tato záložka sleduje všechny pravidelné měsíční výdaje — od předplatných po energie. Vše, co přijde pravidelně.`,
            ),
            tr(
                `Bills tab active with ${total} item${total !== 1 ? 's' : ''}. Each one represents a predictable outflow. The more you track here, the more accurate your cash flow picture becomes.`,
                `Záložka Platby aktivní s ${total} ${total === 1 ? 'položkou' : total < 5 ? 'položkami' : 'položkami'}. Každá je předvídatelný odchozí tok. Čím víc sleduješ, tím přesnější obraz cash flow.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Bills Missing ───────────────────────────────────────────────────────────
function missingInsight(data) {
    const { missingBills, billStatuses } = data;
    const missing = missingBills || [];
    const tracked = billStatuses?.length || 0;

    if (missing.length === 0 && tracked === 0) {
        return {
            text: tr(
                "No bills detected yet. Import more transaction history and I'll identify your recurring expenses. The more data I have, the better I can spot patterns!",
                "Zatím nic nenalezeno. Naimportuj víc historie transakcí a já identifikuji opakované výdaje. Čím víc dat, tím lépe poznám vzorce!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    if (missing.length === 0) {
        return {
            text: pick([
                tr(
                    `All detected recurring expenses are already in your bill tracker. ${tracked} bill${tracked !== 1 ? 's' : ''} accounted for — your tracking is comprehensive!`,
                    `Všechny nalezené opakované výdaje už máš v trackeru. ${tracked} ${tracked === 1 ? 'platba započtena' : tracked < 5 ? 'platby započteny' : 'plateb započteno'} — sledování je kompletní!`,
                ),
                tr(
                    `No missing bills detected! Every recurring pattern I found in your transactions is already tracked. You're on top of it.`,
                    `Žádné chybějící platby! Každý opakovaný vzorec, který jsem v transakcích našel, už sleduješ. Máš to pod kontrolou.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    const totalMissingAmt = missing.reduce((s, b) => s + (b.amount || b.estimated || 0), 0);
    const sorted = [...missing].sort((a, b) => (b.amount || b.estimated || 0) - (a.amount || a.estimated || 0));
    const topMissing = sorted[0];
    const topName = topMissing.name || topMissing.description || 'Unknown';
    const topAmt = topMissing.amount || topMissing.estimated || 0;

    const monthlyMissing = missing.filter(b => (b.frequency || b.interval || '').toLowerCase() === 'monthly');
    const annualMissing = missing.filter(b => ['annual', 'yearly'].includes((b.frequency || b.interval || '').toLowerCase()));

    let timingNoteEn = '';
    let timingNoteCs = '';
    if (monthlyMissing.length > 0 && annualMissing.length > 0) {
        timingNoteEn = ` ${monthlyMissing.length} are monthly and ${annualMissing.length} are annual.`;
        timingNoteCs = ` ${monthlyMissing.length} ${monthlyMissing.length === 1 ? 'je měsíční' : 'jsou měsíční'} a ${annualMissing.length} ${annualMissing.length === 1 ? 'je roční' : 'jsou roční'}.`;
    } else if (monthlyMissing.length > 0) {
        timingNoteEn = ` All ${monthlyMissing.length} appear to be monthly charges.`;
        timingNoteCs = ` Všech ${monthlyMissing.length} vypadá jako měsíční platby.`;
    } else if (annualMissing.length > 0) {
        timingNoteEn = ` ${annualMissing.length} appear to be annual — easy to forget!`;
        timingNoteCs = ` ${annualMissing.length} ${annualMissing.length === 1 ? 'vypadá' : 'vypadá'} jako roční — snadno se zapomenou!`;
    }

    if (missing.length === 1) {
        return {
            text: pick([
                tr(
                    `Found 1 untracked recurring expense: "${topName}" at approximately ${formatMoney(topAmt)}.${timingNoteEn} Add it to your bill list so it doesn't slip through the cracks.`,
                    `Nalezen 1 nesledovaný opakovaný výdaj: „${topName}“ zhruba za ${formatMoney(topAmt)}.${timingNoteCs} Přidej ho do seznamu plateb, ať ti neunikne.`,
                ),
                tr(
                    `"${topName}" (~${formatMoney(topAmt)}) shows up regularly in your transactions but isn't tracked as a bill.${timingNoteEn} Adding it improves your cash flow forecast.`,
                    `„${topName}“ (~${formatMoney(topAmt)}) se pravidelně objevuje v transakcích, ale není evidována jako platba.${timingNoteCs} Přidání zlepší předpověď cash flow.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    return {
        text: pick([
            tr(
                `${missing.length} recurring expenses detected but not tracked, totaling ~${formatMoney(totalMissingAmt)}. Biggest: "${topName}" at ${formatMoney(topAmt)}.${timingNoteEn} Adding these would give you a complete picture.`,
                `Nalezeno ${missing.length} opakovaných výdajů, které nesleduješ, celkem ~${formatMoney(totalMissingAmt)}. Největší: „${topName}“ za ${formatMoney(topAmt)}.${timingNoteCs} Přidání ti dá úplný obraz.`,
            ),
            tr(
                `I found ${missing.length} bills hiding in your transactions worth ~${formatMoney(totalMissingAmt)}/period. "${topName}" (${formatMoney(topAmt)}) is the largest.${timingNoteEn} Track them to eliminate blind spots.`,
                `Našel jsem ${missing.length} plateb skrytých v transakcích za ~${formatMoney(totalMissingAmt)}/období. „${topName}“ (${formatMoney(topAmt)}) je největší.${timingNoteCs} Přidej je a odstraň slepá místa.`,
            ),
        ]),
        type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        envEffect: 'exclamation-marks',
    };
}

// ── Mortgage Summary ────────────────────────────────────────────────────────
function mortgageSummaryInsight(data) {
    const { mortgages } = data;

    if (!mortgages || mortgages.length === 0) {
        return {
            text: pick([
                tr(
                    "No mortgages added yet. If you have a home loan, add it here to track your payoff journey and see how extra payments can save you years of interest.",
                    "Zatím žádné hypotéky. Pokud máš úvěr na bydlení, přidej ho sem a sleduj cestu ke splacení — uvidíš, jak mimořádné splátky ušetří roky úroků.",
                ),
                tr(
                    "Track your mortgage progress here! Add your home loan to visualize how much you've paid off and what's left on the road to full ownership.",
                    "Sleduj tu pokrok své hypotéky! Přidej úvěr a uvidíš, kolik jsi už splatil/a a kolik ještě zbývá na cestě k plnému vlastnictví.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'house-building',
        };
    }

    const totalOriginal = mortgages.reduce((s, m) => s + (m.originalAmount || m.principal || m.loanAmount || 0), 0);
    const totalRemaining = mortgages.reduce((s, m) => s + (m.remainingBalance || m.balance || m.remaining || 0), 0);
    const totalPaid = totalOriginal - totalRemaining;
    const payoffPct = totalOriginal > 0 ? (totalPaid / totalOriginal * 100) : 0;
    const totalMonthlyPayment = mortgages.reduce((s, m) => s + (m.monthlyPayment || m.payment || 0), 0);

    if (payoffPct >= 50) {
        return {
            text: pick([
                tr(
                    `You're past the halfway mark! ${payoffPct.toFixed(1)}% of your mortgage${mortgages.length > 1 ? 's' : ''} paid off — ${formatMoney(totalPaid)} down, ${formatMoney(totalRemaining)} to go. The finish line is in sight!`,
                    `Jsi za polovinou! ${payoffPct.toFixed(1)}% ${mortgages.length > 1 ? 'tvých hypoték splaceno' : 'tvé hypotéky splaceno'} — ${formatMoney(totalPaid)} uhrazeno, ${formatMoney(totalRemaining)} zbývá. Cíl je na dohled!`,
                ),
                tr(
                    `${payoffPct.toFixed(1)}% mortgage payoff progress across ${mortgages.length} loan${mortgages.length !== 1 ? 's' : ''}. You own more of your home than the bank does — that's a milestone worth celebrating.`,
                    `${payoffPct.toFixed(1)}% splaceno napříč ${mortgages.length} ${mortgages.length === 1 ? 'úvěrem' : mortgages.length < 5 ? 'úvěry' : 'úvěry'}. Vlastníš víc domova než banka — to je milník k oslavě.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'house-building',
        };
    }

    if (payoffPct >= 20) {
        return {
            text: pick([
                tr(
                    `${payoffPct.toFixed(1)}% paid off across ${mortgages.length} mortgage${mortgages.length !== 1 ? 's' : ''} (${formatMoney(totalPaid)} of ${formatMoney(totalOriginal)}). Steady progress! Your monthly commitment is ${formatMoney(totalMonthlyPayment)}.`,
                    `${payoffPct.toFixed(1)}% splaceno napříč ${mortgages.length} ${mortgages.length === 1 ? 'hypotékou' : mortgages.length < 5 ? 'hypotékami' : 'hypotékami'} (${formatMoney(totalPaid)} z ${formatMoney(totalOriginal)}). Stabilní pokrok! Tvůj měsíční závazek je ${formatMoney(totalMonthlyPayment)}.`,
                ),
                tr(
                    `Mortgage payoff: ${payoffPct.toFixed(1)}%. You've put ${formatMoney(totalPaid)} toward your home${mortgages.length > 1 ? 's' : ''} with ${formatMoney(totalRemaining)} remaining. Every payment builds equity.`,
                    `Splácení hypotéky: ${payoffPct.toFixed(1)}%. Do bydlení jsi vložil/a ${formatMoney(totalPaid)}, zbývá ${formatMoney(totalRemaining)}. Každá splátka buduje vlastní kapitál.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    return {
        text: pick([
            tr(
                `Mortgage journey: ${payoffPct.toFixed(1)}% complete (${formatMoney(totalPaid)} paid of ${formatMoney(totalOriginal)}). It's early days, but every payment chips away at the principal. Your monthly commitment is ${formatMoney(totalMonthlyPayment)}.`,
                `Cesta hypotéky: ${payoffPct.toFixed(1)}% hotovo (${formatMoney(totalPaid)} z ${formatMoney(totalOriginal)}). Je to začátek, ale každá splátka krájí z jistiny. Tvůj měsíční závazek je ${formatMoney(totalMonthlyPayment)}.`,
            ),
            tr(
                `${formatMoney(totalRemaining)} remaining on ${mortgages.length} mortgage${mortgages.length !== 1 ? 's' : ''}. You're ${payoffPct.toFixed(1)}% of the way there. Long road, but consistent payments compound in your favor.`,
                `${formatMoney(totalRemaining)} zbývá na ${mortgages.length} ${mortgages.length === 1 ? 'hypotéce' : mortgages.length < 5 ? 'hypotékách' : 'hypotékách'}. Jsi ${payoffPct.toFixed(1)}% na cestě. Dlouhá cesta, ale pravidelné splátky se ti sčítají ve tvůj prospěch.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'house-building',
    };
}

// ── Mortgage Progress ───────────────────────────────────────────────────────
function mortgageProgressInsight(data) {
    const { mortgages } = data;

    if (!mortgages || mortgages.length === 0) {
        return {
            text: tr(
                "No mortgage data to show progress for. Add your home loan details to see a payoff timeline and track your journey to ownership!",
                "Žádná data hypoték. Přidej detaily svého úvěru a uvidíš časovou osu splácení i cestu k vlastnictví!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'house-building',
        };
    }

    const withProgress = mortgages.map(m => {
        const original = m.originalAmount || m.principal || m.loanAmount || 0;
        const remaining = m.remainingBalance || m.balance || m.remaining || 0;
        const monthly = m.monthlyPayment || m.payment || 0;
        const pct = original > 0 ? ((original - remaining) / original * 100) : 0;
        const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : 0;
        const yearsLeft = Math.floor(monthsLeft / 12);
        const monthsRemainder = monthsLeft % 12;
        return { ...m, pct, monthsLeft, yearsLeft, monthsRemainder, remaining, monthly, name: m.name || m.description || m.address || 'Mortgage' };
    }).sort((a, b) => a.monthsLeft - b.monthsLeft);

    if (mortgages.length === 1) {
        const m = withProgress[0];
        const timeStrEn = m.yearsLeft > 0
            ? `${m.yearsLeft} year${m.yearsLeft !== 1 ? 's' : ''}${m.monthsRemainder > 0 ? ` and ${m.monthsRemainder} month${m.monthsRemainder !== 1 ? 's' : ''}` : ''}`
            : `${m.monthsRemainder} month${m.monthsRemainder !== 1 ? 's' : ''}`;
        const timeStrCs = m.yearsLeft > 0
            ? `${m.yearsLeft} ${m.yearsLeft === 1 ? 'rok' : m.yearsLeft < 5 ? 'roky' : 'let'}${m.monthsRemainder > 0 ? ` a ${m.monthsRemainder} ${m.monthsRemainder === 1 ? 'měsíc' : m.monthsRemainder < 5 ? 'měsíce' : 'měsíců'}` : ''}`
            : `${m.monthsRemainder} ${m.monthsRemainder === 1 ? 'měsíc' : m.monthsRemainder < 5 ? 'měsíce' : 'měsíců'}`;

        return {
            text: pick([
                tr(
                    `"${m.name}" is ${m.pct.toFixed(1)}% paid off with ~${timeStrEn} remaining at ${formatMoney(m.monthly)}/month. ${m.yearsLeft <= 5 ? 'The end is getting close — consider extra payments to finish even sooner!' : 'Consistent payments are your best strategy.'}`,
                    `„${m.name}“ je splacena z ${m.pct.toFixed(1)}%, zbývá ~${timeStrCs} při ${formatMoney(m.monthly)}/měsíc. ${m.yearsLeft <= 5 ? 'Konec se blíží — zvaž mimořádné splátky a skonči ještě dřív!' : 'Pravidelné splátky jsou tvou nejlepší strategií.'}`,
                ),
                tr(
                    `At your current pace of ${formatMoney(m.monthly)}/month, "${m.name}" will be paid off in approximately ${timeStrEn}. You've cleared ${m.pct.toFixed(1)}% so far.`,
                    `Při tvém současném tempu ${formatMoney(m.monthly)}/měsíc bude „${m.name}“ splacena za zhruba ${timeStrCs}. Dosud jsi splatil/a ${m.pct.toFixed(1)}%.`,
                ),
            ]),
            type: m.pct > 50 ? 'positive' : 'neutral',
            expression: m.pct > 50 ? 'excited' : 'happy',
            mouth: 'smile',
            animation: 'idle',
            envEffect: m.yearsLeft <= 5 ? 'telescope' : 'house-building',
        };
    }

    const closest = withProgress[0];
    const farthest = withProgress[withProgress.length - 1];
    const closestTimeEn = closest.yearsLeft > 0 ? `${closest.yearsLeft}r ${closest.monthsRemainder}m` : `${closest.monthsRemainder}m`;
    const closestTimeCs = closest.yearsLeft > 0 ? `${closest.yearsLeft}r ${closest.monthsRemainder}m` : `${closest.monthsRemainder}m`;
    const farthestTimeEn = farthest.yearsLeft > 0 ? `${farthest.yearsLeft}r ${farthest.monthsRemainder}m` : `${farthest.monthsRemainder}m`;
    const farthestTimeCs = farthest.yearsLeft > 0 ? `${farthest.yearsLeft}r ${farthest.monthsRemainder}m` : `${farthest.monthsRemainder}m`;

    return {
        text: pick([
            tr(
                `"${closest.name}" is closest to payoff at ${closest.pct.toFixed(1)}% (~${closestTimeEn} left), while "${farthest.name}" has the longest road at ${farthest.pct.toFixed(1)}% (~${farthestTimeEn}). Consider focusing extra payments on the closest one to free up cash flow sooner.`,
                `„${closest.name}“ je nejblíž splacení na ${closest.pct.toFixed(1)}% (~${closestTimeCs} zbývá), zatímco „${farthest.name}“ má nejdelší cestu na ${farthest.pct.toFixed(1)}% (~${farthestTimeCs}). Zvaž mimořádné splátky na tu nejbližší, uvolníš cash flow dřív.`,
            ),
            tr(
                `Tracking ${mortgages.length} mortgages. Nearest payoff: "${closest.name}" in ~${closestTimeEn}. Longest: "${farthest.name}" at ~${farthestTimeEn}. Snowball or avalanche — pick a strategy and stick with it.`,
                `Sleduji ${mortgages.length} hypoték. Nejbližší splacení: „${closest.name}“ za ~${closestTimeCs}. Nejdelší: „${farthest.name}“ za ~${farthestTimeCs}. Sněhová koule nebo lavina — vyber strategii a drž se jí.`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Mortgage Rate ───────────────────────────────────────────────────────────
function mortgageRateInsight(data) {
    const { mortgages } = data;

    if (!mortgages || mortgages.length === 0) {
        return {
            text: tr(
                "Add your mortgage details including interest rate to get rate comparison insights and see how refinancing could save you money.",
                "Přidej detaily hypotéky včetně úrokové sazby a získáš srovnání i nápady, kolik by ti refinancování mohlo ušetřit.",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    const withRates = mortgages.filter(m => (m.interestRate || m.rate || 0) > 0);

    if (withRates.length === 0) {
        return {
            text: tr(
                "I don't see interest rates on your mortgages. Add them so I can analyze your rate position and spot refinancing opportunities!",
                "Nevidím úrokové sazby u tvých hypoték. Přidej je a já zanalyzuji tvou pozici a najdu příležitosti k refinancování!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    const rates = withRates.map(m => ({
        name: m.name || m.description || m.address || 'Mortgage',
        rate: m.interestRate || m.rate || 0,
        remaining: m.remainingBalance || m.balance || m.remaining || 0,
        monthly: m.monthlyPayment || m.payment || 0,
    }));

    const avgRate = rates.reduce((s, r) => s + r.rate, 0) / rates.length;
    const highestRate = [...rates].sort((a, b) => b.rate - a.rate)[0];
    const lowestRate = [...rates].sort((a, b) => a.rate - b.rate)[0];

    if (rates.length === 1) {
        const r = rates[0];
        const isHigh = r.rate > 5;
        const isLow = r.rate < 3;

        return {
            text: pick([
                tr(
                    `"${r.name}" is at ${r.rate.toFixed(2)}% interest. ${isHigh ? 'That\'s on the higher side — keep an eye on refinancing offers. Even a 0.5% reduction on ' + formatMoney(r.remaining) + ' could save you thousands over the life of the loan.' : isLow ? 'That\'s an excellent rate — lock it in and focus on consistent payments.' : 'A reasonable rate. Monitor the market periodically for refinancing opportunities.'}`,
                    `„${r.name}“ má úrok ${r.rate.toFixed(2)}%. ${isHigh ? 'To je vyšší hodnota — sleduj refinancování. I snížení o 0,5% na ' + formatMoney(r.remaining) + ' ti ušetří tisíce za celou dobu úvěru.' : isLow ? 'To je výborná sazba — drž ji a soustřeď se na pravidelné splátky.' : 'Rozumná sazba. Občas sleduj trh a hledej možnosti refinancování.'}`,
                ),
                tr(
                    `Your mortgage rate: ${r.rate.toFixed(2)}%. ${isHigh ? 'With ' + formatMoney(r.remaining) + ' remaining, refinancing at a lower rate could meaningfully reduce your total interest costs.' : 'Solid rate. Unless the market drops significantly, your current terms are working well for you.'}`,
                    `Úroková sazba hypotéky: ${r.rate.toFixed(2)}%. ${isHigh ? 'S ' + formatMoney(r.remaining) + ' zbývajícího úvěru by refinancování při nižší sazbě mohlo výrazně snížit celkové úrokové náklady.' : 'Solidní sazba. Pokud trh nespadne výrazně, tvé stávající podmínky fungují dobře.'}`,
                ),
            ]),
            type: isHigh ? 'warning' : 'positive',
            expression: isHigh ? 'concerned' : 'happy',
            mouth: isHigh ? 'neutral' : 'smile',
            animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    const spread = highestRate.rate - lowestRate.rate;

    if (spread > 1.0) {
        return {
            text: pick([
                tr(
                    `Rate spread of ${spread.toFixed(2)}%: "${highestRate.name}" at ${highestRate.rate.toFixed(2)}% vs "${lowestRate.name}" at ${lowestRate.rate.toFixed(2)}%. The higher-rate loan with ${formatMoney(highestRate.remaining)} remaining is your top refinancing candidate.`,
                    `Rozpětí sazeb ${spread.toFixed(2)}%: „${highestRate.name}“ na ${highestRate.rate.toFixed(2)}% vs „${lowestRate.name}“ na ${lowestRate.rate.toFixed(2)}%. Dražší úvěr se zbývajícími ${formatMoney(highestRate.remaining)} je tvůj hlavní kandidát na refinancování.`,
                ),
                tr(
                    `"${highestRate.name}" is paying ${highestRate.rate.toFixed(2)}% while "${lowestRate.name}" enjoys ${lowestRate.rate.toFixed(2)}%. That ${spread.toFixed(2)}% gap means you could save significantly by refinancing the expensive one.`,
                    `„${highestRate.name}“ platí ${highestRate.rate.toFixed(2)}%, zatímco „${lowestRate.name}“ má ${lowestRate.rate.toFixed(2)}%. Rozdíl ${spread.toFixed(2)}% znamená, že refinancováním té dražší můžeš výrazně ušetřit.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            tr(
                `Your ${rates.length} mortgages average ${avgRate.toFixed(2)}% interest (range: ${lowestRate.rate.toFixed(2)}% – ${highestRate.rate.toFixed(2)}%). The rates are fairly close — no urgent refinancing needed, but always worth checking when rates drop.`,
                `Tvých ${rates.length} hypoték má průměrný úrok ${avgRate.toFixed(2)}% (rozsah: ${lowestRate.rate.toFixed(2)}% – ${highestRate.rate.toFixed(2)}%). Sazby jsou si blízké — refinancování nespěchá, ale stojí za to sledovat, až sazby klesnou.`,
            ),
            tr(
                `Average mortgage rate: ${avgRate.toFixed(2)}% across ${rates.length} loans. Tight spread between ${lowestRate.rate.toFixed(2)}% and ${highestRate.rate.toFixed(2)}% means your rate position is balanced.`,
                `Průměrná sazba: ${avgRate.toFixed(2)}% napříč ${rates.length} úvěry. Úzký rozsah mezi ${lowestRate.rate.toFixed(2)}% a ${highestRate.rate.toFixed(2)}% znamená, že tvá pozice je vyvážená.`,
            ),
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Bills Month Picker ──────────────────────────────────────────────────────
function billsMonthPickerInsight(data) {
    const { billStatuses, paidCount, overdueCount } = data;
    const total = (billStatuses || []).length;

    if (total === 0) {
        return {
            text: tr(
                "Hop between months to see which bills were paid, missed, or pending. Each month has its own payment history!",
                "Přepínej mezi měsíci a uvidíš, které platby byly zaplacené, prošlé nebo čekající. Každý měsíc má svou historii!",
            ),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'telescope',
        };
    }

    if (overdueCount > 0) {
        return {
            text: tr(
                `${overdueCount} overdue bill${overdueCount === 1 ? '' : 's'} this month. Pick a different month to compare — is this recurring behavior?`,
                `Tento měsíc ${overdueCount === 1 ? 'je 1 prošlá platba' : overdueCount < 5 ? `jsou ${overdueCount} prošlé platby` : `je ${overdueCount} prošlých plateb`}. Vyber jiný měsíc a porovnej — je to trvalý jev?`,
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    return {
        text: tr(
            `${paidCount}/${total} bills paid this month. Time-travel to any month to review payment history!`,
            `${paidCount}/${total} plateb tento měsíc zaplaceno. Přepni na jakýkoli měsíc a projdi si historii plateb!`,
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'telescope',
    };
}

// ── Bills Add Button ────────────────────────────────────────────────────────
function billsAddBtnInsight(data) {
    const { billStatuses } = data;
    const total = (billStatuses || []).length;

    if (total === 0) {
        return {
            text: tr(
                "Add your first bill manually! Rent, subscriptions, utilities — anything recurring. I'll track every payment for you.",
                "Přidej svou první platbu ručně! Nájem, předplatná, energie — cokoli pravidelného. Pohlídám ti každou splátku.",
            ),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'checkmarks-float',
        };
    }

    return {
        text: tr(
            `${total} bill${total === 1 ? '' : 's'} tracked. Need to add one the autofill missed? Click here!`,
            `Sleduji ${total} ${total === 1 ? 'platbu' : total < 5 ? 'platby' : 'plateb'}. Chybí ti jedna, kterou auto-detekce nenašla? Klikni sem!`,
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'hop',
        envEffect: 'light-bulb',
    };
}

// ── Mortgage Add Button ─────────────────────────────────────────────────────
function mortgageAddBtnInsight(data) {
    return {
        text: pick([
            tr(
                "Add a mortgage — I'll compute the monthly payment from principal, rate, and term, then track every payment against the amortization schedule!",
                "Přidej hypotéku — spočítám měsíční splátku z jistiny, sazby a doby, a pak budu sledovat každou splátku proti umořovacímu plánu!",
            ),
            tr(
                "New mortgage? I'll build the amortization schedule and track progress toward paying it off. Rate changes and extra payments welcome!",
                "Nová hypotéka? Postavím umořovací plán a budu sledovat pokrok ke splacení. Změny sazeb a mimořádné splátky vítány!",
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
        envEffect: 'house-building',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'bills-header': headerInsight,
    'bills-summary': summaryInsight,
    'bills-checklist': checklistInsight,
    'bills-autofill': autofillInsight,
    'bills-add-btn': billsAddBtnInsight,
    'bills-month-picker': billsMonthPickerInsight,
    'bills-tabs': tabsInsight,
    'bills-missing': missingInsight,
    'mortgage-summary': mortgageSummaryInsight,
    'mortgage-progress': mortgageProgressInsight,
    'mortgage-rate': mortgageRateInsight,
    'mortgage-add-btn': mortgageAddBtnInsight,
};

export function generateBillsInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

export function billsPageSummary(data) {
    const { billStatuses, totalMonthly, paidCount, overdueCount, mortgages, activeTab } = data;
    const bills = billStatuses || [];
    const totalBills = bills.length;
    const morts = mortgages || [];

    if (totalBills === 0 && morts.length === 0) {
        return {
            text: pick([
                tr(
                    "No bills or mortgages tracked yet. Add your recurring expenses and I'll keep an eye on them!",
                    "Zatím žádné platby ani hypotéky. Přidej pravidelné výdaje a já je pohlídám!",
                ),
                tr(
                    "Track your fixed costs here — electricity, subscriptions, mortgage. I'll remind you what's due.",
                    "Sleduj tu své fixní náklady — energie, předplatná, hypotéku. Připomenu ti, co je splatné.",
                ),
            ]),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
        };
    }

    if (activeTab === 'mortgage' && morts.length > 0) {
        const totalRemaining = morts.reduce((s, m) => s + (m.remaining_balance || m.remaining || 0), 0);
        const totalMonthlyMort = morts.reduce((s, m) => s + (m.monthly_payment || m.amount || 0), 0);
        return {
            text: pick([
                tr(
                    `${morts.length} mortgage${morts.length !== 1 ? 's' : ''} with ${formatMoney(totalRemaining)} remaining. Monthly payments: ${formatMoney(totalMonthlyMort)}.`,
                    `${morts.length} ${morts.length === 1 ? 'hypotéka' : morts.length < 5 ? 'hypotéky' : 'hypoték'} s ${formatMoney(totalRemaining)} zbývajícího dluhu. Měsíční splátky: ${formatMoney(totalMonthlyMort)}.`,
                ),
                tr(
                    `Mortgage overview: ${formatMoney(totalRemaining)} outstanding across ${morts.length} loan${morts.length !== 1 ? 's' : ''}. ${formatMoney(totalMonthlyMort)}/month in payments.`,
                    `Přehled hypoték: ${formatMoney(totalRemaining)} nesplaceno napříč ${morts.length} ${morts.length === 1 ? 'úvěrem' : morts.length < 5 ? 'úvěry' : 'úvěry'}. Splátky ${formatMoney(totalMonthlyMort)}/měsíc.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        };
    }

    if (overdueCount > 0) {
        return {
            text: pick([
                tr(
                    `${overdueCount} bill${overdueCount !== 1 ? 's' : ''} overdue! ${paidCount} of ${totalBills} paid so far. Total fixed costs: ${formatMoney(totalMonthly || 0)}/month.`,
                    `${overdueCount} ${overdueCount === 1 ? 'prošlá platba' : overdueCount < 5 ? 'prošlé platby' : 'prošlých plateb'}! Zatím zaplaceno ${paidCount} z ${totalBills}. Celkové fixní náklady: ${formatMoney(totalMonthly || 0)}/měsíc.`,
                ),
                tr(
                    `Heads up — ${overdueCount} unpaid bill${overdueCount !== 1 ? 's' : ''}. Let's get those sorted. ${totalBills - overdueCount} already taken care of.`,
                    `Pozor — ${overdueCount} ${overdueCount === 1 ? 'nezaplacená platba' : overdueCount < 5 ? 'nezaplacené platby' : 'nezaplacených plateb'}. Pojďme to vyřešit. ${totalBills - overdueCount} už vyřízeno.`,
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
        };
    }

    if (paidCount === totalBills && totalBills > 0) {
        return {
            text: pick([
                tr(
                    `All ${totalBills} bills paid this month — ${formatMoney(totalMonthly || 0)} in fixed costs covered! Clean slate.`,
                    `Všech ${totalBills} plateb tento měsíc zaplaceno — ${formatMoney(totalMonthly || 0)} fixních nákladů pokryto! Čistá tabule.`,
                ),
                tr(
                    `Every bill is checked off! ${formatMoney(totalMonthly || 0)}/month in recurring expenses, all handled.`,
                    `Každá platba odškrtnuta! ${formatMoney(totalMonthly || 0)}/měsíc v pravidelných výdajích, vše vyřešeno.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
        };
    }

    return {
        text: pick([
            tr(
                `${paidCount} of ${totalBills} bills paid. ${formatMoney(totalMonthly || 0)}/month in fixed expenses. ${totalBills - paidCount} still pending.`,
                `${paidCount} z ${totalBills} plateb zaplaceno. ${formatMoney(totalMonthly || 0)}/měsíc ve fixních výdajích. Zbývá ${totalBills - paidCount}.`,
            ),
            tr(
                `Bills: ${paidCount}/${totalBills} done. Total monthly fixed costs: ${formatMoney(totalMonthly || 0)}. Keep checking them off!`,
                `Platby: ${paidCount}/${totalBills} hotovo. Celkové měsíční fixní náklady: ${formatMoney(totalMonthly || 0)}. Pokračuj v odškrtávání!`,
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
    };
}
