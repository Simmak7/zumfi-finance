// Import Zone Insight Generator for Zumi Proximity Interactions

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Import Header ───────────────────────────────────────────────────────────
function headerInsight(data) {
    const { view } = data;

    if (view === 'documents') {
        return {
            text: pick([
                "Viewing your imported documents. Each one created transactions!",
                "Document library — see everything you've imported so far.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            "Ready to import! I support CSV, Excel, PDF, and Word bank statements.",
            "Upload your bank export and I'll transform it into transactions.",
            "The import wizard walks you through step by step. Let's go!",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'light-bulb',
    };
}

// ── Wizard Steps ────────────────────────────────────────────────────────────
function wizardInsight(data) {
    const { step } = data;

    const stepMessages = {
        0: [
            "Step 1: Upload your file. Drag & drop or click to browse!",
            "Start here — pick a CSV, Excel, PDF, or DOCX file.",
        ],
        1: [
            "Step 2: Map your columns. I auto-guessed some — check if they're right!",
            "Tell me which columns are dates, descriptions, and amounts.",
        ],
        2: [
            "Step 3: Preview your data. Make sure everything looks correct!",
            "Review the parsed transactions before importing them.",
        ],
        3: [
            "Final step! Hit import to add these transactions to your account.",
            "Almost done — one click and your transactions will be saved!",
        ],
    };

    const messages = stepMessages[step] || stepMessages[0];
    const animation = step === 3 ? 'hop' : 'idle';
    const expression = step === 3 ? 'excited' : 'happy';
    const envEffect = step === 3 ? 'confetti' : 'thought-clouds';

    return {
        text: pick(messages),
        type: 'neutral', expression, mouth: 'smile', animation,
        envEffect,
    };
}

// ── Wizard Content (step-specific) ──────────────────────────────────────────
function contentInsight(data) {
    const { step, hasFile, importResult, totalRows } = data;

    if (step === 0 && !hasFile) {
        return {
            text: pick([
                "Supported formats: CSV, XLS/XLSX, PDF, DOCX. Most banks export these!",
                "Pro tip: PDF statements from Czech banks like FIO and Raiffeisen work great!",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'light-bulb',
        };
    }

    if (step === 1) {
        return {
            text: pick([
                "Match each column to its meaning. The date and amount columns are critical!",
                "I tried to auto-detect columns. Fix any mistakes before continuing.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    if (step === 2) {
        return {
            text: pick([
                totalRows ? `${totalRows} rows parsed. Review them and click Next to import!` : "Preview loaded. Check that amounts and dates look right!",
                "Scan through the preview. Catch any errors before importing!",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'telescope',
        };
    }

    if (step === 3 && importResult) {
        const created = importResult.created || 0;
        const skipped = importResult.skipped || 0;
        if (created > 0) {
            return {
                text: pick([
                    `Success! ${created} transactions imported${skipped > 0 ? `, ${skipped} duplicates skipped` : ''}! Your financial data is now up to date.`,
                    `Done! ${created} new transactions added to your account. Head to the dashboard to see the impact!`,
                ]),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
                envEffect: 'confetti',
            };
        }
        return {
            text: "All transactions were duplicates — nothing new to import. Your data is already current!",
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'checkmarks-float',
        };
    }

    if (step === 3) {
        return {
            text: pick([
                "Ready to import! Click the button to save your transactions.",
                "One click away from adding these to your financial history!",
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'golden-sparkles',
        };
    }

    return {
        text: "Follow the wizard steps to import your bank data.",
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Document List ───────────────────────────────────────────────────────────
function documentsInsight(data) {
    const { view } = data;

    if (view !== 'documents') {
        return {
            text: pick([
                "Switch to 'View Documents' to see all your imported files.",
                "Your document library is in the other tab. Click 'View Documents'.",
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            "Here are all your uploaded statements. Each file created transactions automatically.",
            "Your import history — every document you've processed is here.",
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'import-header': headerInsight,
    'import-wizard': wizardInsight,
    'import-content': contentInsight,
    'import-documents': documentsInsight,
};

export function generateImportInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

export function importPageSummary(data) {
    const { view, step, hasFile } = data;

    if (view === 'documents') {
        return {
            text: pick(["Your import library — every statement you've uploaded is here. Ready to add more?", "Browsing your document history. Click 'Import' to add a new statement!"]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        };
    }

    if (step > 0 && hasFile) {
        return {
            text: pick([`You're on step ${step + 1} of the import wizard — keep going!`, "Mid-import! Follow the steps and I'll handle the parsing."]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'hop',
        };
    }

    return {
        text: pick(["Ready to import! I support PDF, CSV, and Excel bank statements. Drag and drop or browse to get started.", "Upload your next bank statement — I'll auto-detect the format and parse all transactions."]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
    };
}
