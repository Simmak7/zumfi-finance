// Bills Zone Insight Generator for Zumfi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';

// ── Bills Header ────────────────────────────────────────────────────────────
// Fixed costs as % of income context
function headerInsight(data) {
    const { billStatuses, totalMonthly, totalExpected } = data;

    if (!billStatuses || billStatuses.length === 0) {
        return {
            text: pick([
                "No bills set up yet! Add your recurring expenses — rent, utilities, subscriptions — and I'll help you stay on top of every payment.",
                "Start adding your fixed bills and I'll track due dates, flag overdue items, and keep your cash flow predictable.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const fixedTotal = totalMonthly || totalExpected || 0;

    // Check if any bills have income context attached
    const hasIncomeContext = billStatuses.some(b => b.monthlyIncome || b.income);
    const income = billStatuses.find(b => b.monthlyIncome || b.income);
    const monthlyIncome = income?.monthlyIncome || income?.income || 0;

    if (monthlyIncome > 0 && fixedTotal > 0) {
        const fixedPct = (fixedTotal / monthlyIncome * 100).toFixed(0);
        const isHigh = fixedPct > 60;
        return {
            text: pick([
                `Your ${billStatuses.length} recurring bills total ${formatMoney(fixedTotal)}, which is ${fixedPct}% of your monthly income. ${isHigh ? 'That\'s a heavy fixed-cost load — look for subscriptions you can trim.' : 'That leaves solid room for savings and discretionary spending.'}`,
                `Fixed expenses take ${fixedPct}% of your income (${formatMoney(fixedTotal)} across ${billStatuses.length} bills). ${isHigh ? 'Consider renegotiating your biggest bills to free up cash flow.' : 'A healthy ratio that gives you flexibility.'}`,
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
            `Tracking ${billStatuses.length} recurring bill${billStatuses.length !== 1 ? 's' : ''} totaling ${formatMoney(fixedTotal)}. Drag me around for details on each section!`,
            `${billStatuses.length} bills on your radar at ${formatMoney(fixedTotal)}/month. Your fixed expenses are organized and visible.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Bills Summary Row ───────────────────────────────────────────────────────
// Urgency ranking of unpaid
function summaryInsight(data) {
    const { paidCount, overdueCount, billStatuses, totalExpected, totalPaid } = data;
    const total = billStatuses?.length || 0;

    if (total === 0) {
        return {
            text: "No bills to summarize yet. Use the Autofill button to detect recurring expenses from your transactions, or add them manually!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'exclamation-marks',
        };
    }

    if (overdueCount > 0) {
        // Rank overdue bills by amount (highest first)
        const overdue = (billStatuses || [])
            .filter(b => b.status === 'overdue' || b.overdue)
            .sort((a, b) => (b.amount || 0) - (a.amount || 0));

        const topOverdue = overdue[0];
        const topName = topOverdue?.name || topOverdue?.description || 'a bill';
        const topAmt = topOverdue?.amount || 0;
        const totalOverdueAmt = overdue.reduce((s, b) => s + (b.amount || 0), 0);

        return {
            text: pick([
                `${overdueCount} bill${overdueCount !== 1 ? 's' : ''} overdue totaling ${formatMoney(totalOverdueAmt)}! Priority #1: "${topName}" at ${formatMoney(topAmt)}. Late fees add up fast — tackle the biggest ones first.`,
                `Alert: ${formatMoney(totalOverdueAmt)} in overdue payments. "${topName}" (${formatMoney(topAmt)}) should be your first call. ${overdueCount > 1 ? `Then work through the remaining ${overdueCount - 1}.` : 'Clear it before the next cycle.'}`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'lightning-bolts',
        };
    }

    if (paidCount === total && total > 0) {
        return {
            text: pick([
                `All ${total} bills paid — ${formatMoney(totalPaid)} handled! You're fully caught up with zero outstanding payments this month. That's peace of mind.`,
                `Perfect record: ${total} out of ${total} paid for ${formatMoney(totalPaid)}. Nothing overdue, nothing pending. Your creditors love you!`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'checkmarks-float',
        };
    }

    const remaining = total - paidCount;
    const remainingAmount = (totalExpected || 0) - (totalPaid || 0);

    // Find the next most urgent unpaid bill
    const unpaid = (billStatuses || [])
        .filter(b => b.status !== 'paid' && !b.paid)
        .sort((a, b) => {
            const dateA = a.dueDate || a.due_date || '';
            const dateB = b.dueDate || b.due_date || '';
            return dateA.localeCompare(dateB);
        });
    const nextDue = unpaid[0];
    const nextName = nextDue?.name || nextDue?.description || '';
    const nextSuffix = nextName ? ` Next up: "${nextName}".` : '';

    return {
        text: pick([
            `${paidCount}/${total} paid, ${formatMoney(remainingAmount)} still to go across ${remaining} bill${remaining !== 1 ? 's' : ''}.${nextSuffix}`,
            `${remaining} bill${remaining !== 1 ? 's' : ''} remaining this month, totaling ${formatMoney(remainingAmount)}.${nextSuffix} Stay ahead of the due dates!`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'checkmarks-float',
    };
}

// ── Bill Checklist ──────────────────────────────────────────────────────────
// Pattern timing analysis
function checklistInsight(data) {
    const { billStatuses, paidCount, overdueCount } = data;
    const total = billStatuses?.length || 0;

    if (total === 0) {
        return {
            text: "Your bill checklist is empty. Add bills manually or try the Autofill feature to detect recurring payments from your transaction history!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    const progress = total > 0 ? (paidCount / total * 100) : 0;

    if (progress === 100) {
        // Analyze timing — how early were bills paid
        const earlyPayers = (billStatuses || []).filter(b => {
            const dueDate = b.dueDate || b.due_date;
            const paidDate = b.paidDate || b.paid_date;
            return dueDate && paidDate && paidDate < dueDate;
        });
        const earlyPct = total > 0 ? Math.round(earlyPayers.length / total * 100) : 0;

        return {
            text: pick([
                `Checklist complete — every bill checked off! ${earlyPct > 50 ? `${earlyPct}% were paid early — you're consistently ahead of deadlines.` : 'All paid on time, which keeps your financial record clean.'}`,
                `All ${total} items done! ${earlyPayers.length > 0 ? `${earlyPayers.length} were paid before their due date — that habit protects you from surprise cash crunches.` : 'Nothing outstanding. Clean slate for the month!'}`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'confetti',
        };
    }

    if (progress >= 75) {
        const remaining = total - paidCount;
        return {
            text: pick([
                `Almost done — ${paidCount} of ${total} bills paid (${progress.toFixed(0)}%). Just ${remaining} more to check off. You tend to finish strong!`,
                `${progress.toFixed(0)}% complete with ${remaining} left. You're in the home stretch — keep the momentum going!`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'confetti',
        };
    }

    if (overdueCount > 0) {
        // Analyze if overdue bills are typically the same ones
        const overdueNames = (billStatuses || [])
            .filter(b => b.status === 'overdue' || b.overdue)
            .map(b => b.name || b.description || 'Unknown');
        const uniqueOverdue = [...new Set(overdueNames)];

        return {
            text: pick([
                `${overdueCount} overdue item${overdueCount !== 1 ? 's' : ''} flagged in your checklist: ${uniqueOverdue.slice(0, 2).join(', ')}${uniqueOverdue.length > 2 ? ` and ${uniqueOverdue.length - 2} more` : ''}. These need attention before late fees kick in.`,
                `Red flags in your checklist — ${overdueCount} overdue. ${uniqueOverdue.length === 1 ? `"${uniqueOverdue[0]}" keeps slipping — consider setting up a reminder.` : 'Don\'t let them pile up, tackle the most expensive first.'}`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            `${paidCount} of ${total} checked off (${progress.toFixed(0)}%). Each payment brings peace of mind — keep working through the list!`,
            `Progress: ${progress.toFixed(0)}%. ${total - paidCount} bills waiting. Pay them in order of due date to minimize risk of late fees.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Autofill Button Area ────────────────────────────────────────────────────
// Detection preview count
function autofillInsight(data) {
    const { billStatuses, missingBills } = data;
    const total = billStatuses?.length || 0;
    const missingCount = missingBills?.length || 0;

    if (total === 0 && missingCount === 0) {
        return {
            text: pick([
                "Try the Autofill button! I'll scan your transactions for recurring patterns and suggest bills you should be tracking. The more transaction history you have, the better my detection.",
                "The magic wand detects repeating expenses automatically. Import a few months of statements first for the best results, then hit Autofill!",
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }

    if (missingCount > 0) {
        const topMissing = missingBills.slice(0, 2).map(b => b.name || b.description || 'Unknown');
        return {
            text: pick([
                `I've detected ${missingCount} potential recurring expense${missingCount !== 1 ? 's' : ''} not yet in your bill list — including ${topMissing.join(' and ')}. Hit Autofill to review and add them!`,
                `${missingCount} bill${missingCount !== 1 ? 's' : ''} spotted in your transactions but missing from your tracker. Autofill can pull ${topMissing[0]}${missingCount > 1 ? ` and ${missingCount - 1} more` : ''} right in.`,
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'crystal-ball',
        };
    }

    return {
        text: pick([
            "Hit Autofill periodically to catch any new recurring bills I spot. New subscriptions show up in your transactions before you remember to track them!",
            "I continuously learn from your transaction patterns. Run Autofill every few months to catch new subscriptions and rate changes.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'light-bulb',
    };
}

// ── Bills Tabs (NEW) ────────────────────────────────────────────────────────
// Context-aware tab guidance
function tabsInsight(data) {
    const { activeTab, overdueCount, billStatuses, mortgages } = data;
    const total = billStatuses?.length || 0;
    const hasMortgages = mortgages && mortgages.length > 0;

    if (activeTab === 'mortgages' || activeTab === 'mortgage') {
        return {
            text: pick([
                `Viewing your mortgage${hasMortgages && mortgages.length > 1 ? 's' : ''} tab. ${hasMortgages ? `Tracking ${mortgages.length} mortgage${mortgages.length !== 1 ? 's' : ''} — your biggest long-term commitment. Drag me to each section for details.` : 'No mortgages added yet — add one to track your homeownership journey!'}`,
                `Mortgage view active. ${hasMortgages ? 'This is where you track progress toward owning your home outright.' : 'Nothing here yet. If you have a home loan, add it to see payoff projections!'}`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'swirl-burst',
        };
    }

    if (overdueCount > 0) {
        return {
            text: pick([
                `You're on the Bills tab with ${overdueCount} overdue payment${overdueCount !== 1 ? 's' : ''} to address. ${hasMortgages ? 'Once you\'re caught up, check the Mortgage tab to review your home loan progress too.' : 'Focus on clearing the overdue items first!'}`,
                `Bills tab active. Priority: clear the ${overdueCount} overdue bill${overdueCount !== 1 ? 's' : ''}. ${hasMortgages ? 'Your mortgage payments are tracked on the Mortgages tab.' : ''}`,
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'swirl-burst',
        };
    }

    if (hasMortgages) {
        return {
            text: pick([
                `Bills tab showing ${total} recurring expenses. Switch to the Mortgages tab to see your ${mortgages.length} home loan${mortgages.length !== 1 ? 's' : ''} and payoff progress.`,
                `You have both bills (${total}) and mortgages (${mortgages.length}) to track. Toggle between tabs to get the full picture of your fixed commitments.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            `Viewing your ${total} bills. This tab tracks all recurring monthly expenses — from subscriptions to utilities. Everything that hits your account on a schedule.`,
            `Bills tab active with ${total} item${total !== 1 ? 's' : ''}. Each one represents a predictable outflow. The more you track here, the more accurate your cash flow picture becomes.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Bills Missing (NEW) ────────────────────────────────────────────────────
// Deep missing bill analysis with timing
function missingInsight(data) {
    const { missingBills, billStatuses, totalMonthly } = data;
    const missing = missingBills || [];
    const tracked = billStatuses?.length || 0;

    if (missing.length === 0 && tracked === 0) {
        return {
            text: "No bills detected yet. Import more transaction history and I'll identify your recurring expenses. The more data I have, the better I can spot patterns!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    if (missing.length === 0) {
        return {
            text: pick([
                `All detected recurring expenses are already in your bill tracker. ${tracked} bill${tracked !== 1 ? 's' : ''} accounted for — your tracking is comprehensive!`,
                `No missing bills detected! Every recurring pattern I found in your transactions is already tracked. You're on top of it.`,
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

    // Check for timing patterns
    const hasFrequency = missing.some(b => b.frequency || b.interval);
    const monthlyMissing = missing.filter(b => (b.frequency || b.interval || '').toLowerCase() === 'monthly');
    const annualMissing = missing.filter(b => ['annual', 'yearly'].includes((b.frequency || b.interval || '').toLowerCase()));

    let timingNote = '';
    if (monthlyMissing.length > 0 && annualMissing.length > 0) {
        timingNote = ` ${monthlyMissing.length} are monthly and ${annualMissing.length} are annual.`;
    } else if (monthlyMissing.length > 0) {
        timingNote = ` All ${monthlyMissing.length} appear to be monthly charges.`;
    } else if (annualMissing.length > 0) {
        timingNote = ` ${annualMissing.length} appear to be annual — easy to forget!`;
    }

    if (missing.length === 1) {
        return {
            text: pick([
                `Found 1 untracked recurring expense: "${topName}" at approximately ${formatMoney(topAmt)}.${timingNote} Add it to your bill list so it doesn't slip through the cracks.`,
                `"${topName}" (~${formatMoney(topAmt)}) shows up regularly in your transactions but isn't tracked as a bill.${timingNote} Adding it improves your cash flow forecast.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'exclamation-marks',
        };
    }

    return {
        text: pick([
            `${missing.length} recurring expenses detected but not tracked, totaling ~${formatMoney(totalMissingAmt)}. Biggest: "${topName}" at ${formatMoney(topAmt)}.${timingNote} Adding these would give you a complete picture.`,
            `I found ${missing.length} bills hiding in your transactions worth ~${formatMoney(totalMissingAmt)}/period. "${topName}" (${formatMoney(topAmt)}) is the largest.${timingNote} Track them to eliminate blind spots.`,
        ]),
        type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
        envEffect: 'exclamation-marks',
    };
}

// ── Mortgage Summary (NEW) ──────────────────────────────────────────────────
// Total payoff progress %
function mortgageSummaryInsight(data) {
    const { mortgages } = data;

    if (!mortgages || mortgages.length === 0) {
        return {
            text: pick([
                "No mortgages added yet. If you have a home loan, add it here to track your payoff journey and see how extra payments can save you years of interest.",
                "Track your mortgage progress here! Add your home loan to visualize how much you've paid off and what's left on the road to full ownership.",
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
                `You're past the halfway mark! ${payoffPct.toFixed(1)}% of your mortgage${mortgages.length > 1 ? 's' : ''} paid off — ${formatMoney(totalPaid)} down, ${formatMoney(totalRemaining)} to go. The finish line is in sight!`,
                `${payoffPct.toFixed(1)}% mortgage payoff progress across ${mortgages.length} loan${mortgages.length !== 1 ? 's' : ''}. You own more of your home than the bank does — that's a milestone worth celebrating.`,
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
            envEffect: 'house-building',
        };
    }

    if (payoffPct >= 20) {
        return {
            text: pick([
                `${payoffPct.toFixed(1)}% paid off across ${mortgages.length} mortgage${mortgages.length !== 1 ? 's' : ''} (${formatMoney(totalPaid)} of ${formatMoney(totalOriginal)}). Steady progress! Your monthly commitment is ${formatMoney(totalMonthlyPayment)}.`,
                `Mortgage payoff: ${payoffPct.toFixed(1)}%. You've put ${formatMoney(totalPaid)} toward your home${mortgages.length > 1 ? 's' : ''} with ${formatMoney(totalRemaining)} remaining. Every payment builds equity.`,
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'house-building',
        };
    }

    return {
        text: pick([
            `Mortgage journey: ${payoffPct.toFixed(1)}% complete (${formatMoney(totalPaid)} paid of ${formatMoney(totalOriginal)}). It's early days, but every payment chips away at the principal. Your monthly commitment is ${formatMoney(totalMonthlyPayment)}.`,
            `${formatMoney(totalRemaining)} remaining on ${mortgages.length} mortgage${mortgages.length !== 1 ? 's' : ''}. You're ${payoffPct.toFixed(1)}% of the way there. Long road, but consistent payments compound in your favor.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'house-building',
    };
}

// ── Mortgage Progress (NEW) ─────────────────────────────────────────────────
// Per-mortgage payoff timeline
function mortgageProgressInsight(data) {
    const { mortgages } = data;

    if (!mortgages || mortgages.length === 0) {
        return {
            text: "No mortgage data to show progress for. Add your home loan details to see a payoff timeline and track your journey to ownership!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'house-building',
        };
    }

    // Find the mortgage closest to payoff and farthest from payoff
    const withProgress = mortgages.map(m => {
        const original = m.originalAmount || m.principal || m.loanAmount || 0;
        const remaining = m.remainingBalance || m.balance || m.remaining || 0;
        const monthly = m.monthlyPayment || m.payment || 0;
        const rate = m.interestRate || m.rate || 0;
        const pct = original > 0 ? ((original - remaining) / original * 100) : 0;
        // Rough months remaining calculation
        const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : 0;
        const yearsLeft = Math.floor(monthsLeft / 12);
        const monthsRemainder = monthsLeft % 12;
        return { ...m, pct, monthsLeft, yearsLeft, monthsRemainder, remaining, monthly, name: m.name || m.description || m.address || 'Mortgage' };
    }).sort((a, b) => a.monthsLeft - b.monthsLeft);

    if (mortgages.length === 1) {
        const m = withProgress[0];
        const timeStr = m.yearsLeft > 0
            ? `${m.yearsLeft} year${m.yearsLeft !== 1 ? 's' : ''}${m.monthsRemainder > 0 ? ` and ${m.monthsRemainder} month${m.monthsRemainder !== 1 ? 's' : ''}` : ''}`
            : `${m.monthsRemainder} month${m.monthsRemainder !== 1 ? 's' : ''}`;

        return {
            text: pick([
                `"${m.name}" is ${m.pct.toFixed(1)}% paid off with ~${timeStr} remaining at ${formatMoney(m.monthly)}/month. ${m.yearsLeft <= 5 ? 'The end is getting close — consider extra payments to finish even sooner!' : 'Consistent payments are your best strategy.'}`,
                `At your current pace of ${formatMoney(m.monthly)}/month, "${m.name}" will be paid off in approximately ${timeStr}. You've cleared ${m.pct.toFixed(1)}% so far.`,
            ]),
            type: m.pct > 50 ? 'positive' : 'neutral',
            expression: m.pct > 50 ? 'excited' : 'happy',
            mouth: 'smile',
            animation: 'idle',
            envEffect: m.yearsLeft <= 5 ? 'telescope' : 'house-building',
        };
    }

    // Multiple mortgages — compare timelines
    const closest = withProgress[0];
    const farthest = withProgress[withProgress.length - 1];
    const closestTime = closest.yearsLeft > 0
        ? `${closest.yearsLeft}y ${closest.monthsRemainder}m`
        : `${closest.monthsRemainder}m`;
    const farthestTime = farthest.yearsLeft > 0
        ? `${farthest.yearsLeft}y ${farthest.monthsRemainder}m`
        : `${farthest.monthsRemainder}m`;

    return {
        text: pick([
            `"${closest.name}" is closest to payoff at ${closest.pct.toFixed(1)}% (~${closestTime} left), while "${farthest.name}" has the longest road at ${farthest.pct.toFixed(1)}% (~${farthestTime}). Consider focusing extra payments on the closest one to free up cash flow sooner.`,
            `Tracking ${mortgages.length} mortgages. Nearest payoff: "${closest.name}" in ~${closestTime}. Longest: "${farthest.name}" at ~${farthestTime}. Snowball or avalanche — pick a strategy and stick with it.`,
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'telescope',
    };
}

// ── Mortgage Rate (NEW) ─────────────────────────────────────────────────────
// Rate comparison insight
function mortgageRateInsight(data) {
    const { mortgages } = data;

    if (!mortgages || mortgages.length === 0) {
        return {
            text: "Add your mortgage details including interest rate to get rate comparison insights and see how refinancing could save you money.",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'wave',
            envEffect: 'magnifying-glass',
        };
    }

    const withRates = mortgages.filter(m => (m.interestRate || m.rate || 0) > 0);

    if (withRates.length === 0) {
        return {
            text: "I don't see interest rates on your mortgages. Add them so I can analyze your rate position and spot refinancing opportunities!",
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
                `"${r.name}" is at ${r.rate.toFixed(2)}% interest. ${isHigh ? 'That\'s on the higher side — keep an eye on refinancing offers. Even a 0.5% reduction on ' + formatMoney(r.remaining) + ' could save you thousands over the life of the loan.' : isLow ? 'That\'s an excellent rate — lock it in and focus on consistent payments.' : 'A reasonable rate. Monitor the market periodically for refinancing opportunities.'}`,
                `Your mortgage rate: ${r.rate.toFixed(2)}%. ${isHigh ? 'With ' + formatMoney(r.remaining) + ' remaining, refinancing at a lower rate could meaningfully reduce your total interest costs.' : 'Solid rate. Unless the market drops significantly, your current terms are working well for you.'}`,
            ]),
            type: isHigh ? 'warning' : 'positive',
            expression: isHigh ? 'concerned' : 'happy',
            mouth: isHigh ? 'neutral' : 'smile',
            animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    // Multiple mortgages — compare rates
    const spread = highestRate.rate - lowestRate.rate;

    if (spread > 1.0) {
        return {
            text: pick([
                `Rate spread of ${spread.toFixed(2)}%: "${highestRate.name}" at ${highestRate.rate.toFixed(2)}% vs "${lowestRate.name}" at ${lowestRate.rate.toFixed(2)}%. The higher-rate loan with ${formatMoney(highestRate.remaining)} remaining is your top refinancing candidate.`,
                `"${highestRate.name}" is paying ${highestRate.rate.toFixed(2)}% while "${lowestRate.name}" enjoys ${lowestRate.rate.toFixed(2)}%. That ${spread.toFixed(2)}% gap means you could save significantly by refinancing the expensive one.`,
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    return {
        text: pick([
            `Your ${rates.length} mortgages average ${avgRate.toFixed(2)}% interest (range: ${lowestRate.rate.toFixed(2)}% – ${highestRate.rate.toFixed(2)}%). The rates are fairly close — no urgent refinancing needed, but always worth checking when rates drop.`,
            `Average mortgage rate: ${avgRate.toFixed(2)}% across ${rates.length} loans. Tight spread between ${lowestRate.rate.toFixed(2)}% and ${highestRate.rate.toFixed(2)}% means your rate position is balanced.`,
        ]),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'magnifying-glass',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'bills-header': headerInsight,
    'bills-summary': summaryInsight,
    'bills-checklist': checklistInsight,
    'bills-autofill': autofillInsight,
    'bills-tabs': tabsInsight,
    'bills-missing': missingInsight,
    'mortgage-summary': mortgageSummaryInsight,
    'mortgage-progress': mortgageProgressInsight,
    'mortgage-rate': mortgageRateInsight,
};

export function generateBillsInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}
