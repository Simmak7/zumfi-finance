// Import Zone Insight Generator for Zumi Proximity Interactions

import { tr } from './lang';

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Import Header ───────────────────────────────────────────────────────────
function headerInsight(data) {
    const { view } = data;

    if (view === 'documents') {
        return {
            text: pick([
                tr(
                    "Viewing your imported documents. Each one created transactions!",
                    "Prohlížíš si naimportované dokumenty. Každý z nich vytvořil transakce!",
                ),
                tr(
                    "Document library — see everything you've imported so far.",
                    "Knihovna dokumentů — přehled všeho, co jsi dosud naimportoval/a.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            tr(
                "Ready to import! I support CSV, Excel, PDF, and Word bank statements.",
                "Můžeme importovat! Podporuji CSV, Excel, PDF i Wordové bankovní výpisy.",
            ),
            tr(
                "Upload your bank export and I'll transform it into transactions.",
                "Nahraj si bankovní výpis a já ho proměním v transakce.",
            ),
            tr(
                "The import wizard walks you through step by step. Let's go!",
                "Průvodce importem tě provede krok za krokem. Jdeme na to!",
            ),
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
            tr(
                "Step 1: Upload your file. Drag & drop or click to browse!",
                "Krok 1: Nahraj soubor. Přetáhni ho sem nebo klikni pro výběr!",
            ),
            tr(
                "Start here — pick a CSV, Excel, PDF, or DOCX file.",
                "Začni tady — vyber CSV, Excel, PDF nebo DOCX soubor.",
            ),
        ],
        1: [
            tr(
                "Step 2: Map your columns. I auto-guessed some — check if they're right!",
                "Krok 2: Namapuj sloupce. Některé jsem uhodl — zkontroluj, jestli sedí!",
            ),
            tr(
                "Tell me which columns are dates, descriptions, and amounts.",
                "Řekni mi, které sloupce jsou datumy, popisy a částky.",
            ),
        ],
        2: [
            tr(
                "Step 3: Preview your data. Make sure everything looks correct!",
                "Krok 3: Náhled dat. Ujisti se, že vše vypadá správně!",
            ),
            tr(
                "Review the parsed transactions before importing them.",
                "Před importem si parsované transakce projdi.",
            ),
        ],
        3: [
            tr(
                "Final step! Hit import to add these transactions to your account.",
                "Poslední krok! Zmáčkni Importovat a transakce se přidají na tvůj účet.",
            ),
            tr(
                "Almost done — one click and your transactions will be saved!",
                "Už jen kousek — jedno kliknutí a transakce budou uloženy!",
            ),
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
                tr(
                    "Supported formats: CSV, XLS/XLSX, PDF, DOCX. Most banks export these!",
                    "Podporované formáty: CSV, XLS/XLSX, PDF, DOCX. Většina bank je umí exportovat!",
                ),
                tr(
                    "Pro tip: PDF statements from Czech banks like FIO and Raiffeisen work great!",
                    "Profi tip: PDF výpisy českých bank jako FIO nebo Raiffeisen fungují skvěle!",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'light-bulb',
        };
    }

    if (step === 1) {
        return {
            text: pick([
                tr(
                    "Match each column to its meaning. The date and amount columns are critical!",
                    "Přiřaď každému sloupci jeho význam. Sloupce datum a částka jsou klíčové!",
                ),
                tr(
                    "I tried to auto-detect columns. Fix any mistakes before continuing.",
                    "Zkusil jsem sloupce poznat automaticky. Oprav případné chyby, než budeš pokračovat.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'magnifying-glass',
        };
    }

    if (step === 2) {
        return {
            text: pick([
                totalRows
                    ? tr(
                        `${totalRows} rows parsed. Review them and click Next to import!`,
                        `Naparsováno ${totalRows} řádků. Projdi si je a pokračuj tlačítkem Další!`,
                    )
                    : tr(
                        "Preview loaded. Check that amounts and dates look right!",
                        "Náhled načten. Zkontroluj, jestli částky a datumy vypadají správně!",
                    ),
                tr(
                    "Scan through the preview. Catch any errors before importing!",
                    "Projdi si náhled. Zachyť případné chyby ještě před importem!",
                ),
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
                    tr(
                        `Success! ${created} transactions imported${skipped > 0 ? `, ${skipped} duplicates skipped` : ''}! Your financial data is now up to date.`,
                        `Hotovo! Naimportováno ${created} transakcí${skipped > 0 ? `, přeskočeno ${skipped} duplicit` : ''}! Tvá finanční data jsou aktuální.`,
                    ),
                    tr(
                        `Done! ${created} new transactions added to your account. Head to the dashboard to see the impact!`,
                        `Hotovo! Přidáno ${created} nových transakcí. Mrkni na přehled a uvidíš dopad!`,
                    ),
                ]),
                type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
                envEffect: 'confetti',
            };
        }
        return {
            text: tr(
                "All transactions were duplicates — nothing new to import. Your data is already current!",
                "Všechny transakce byly duplicity — nic nového k importu. Tvá data jsou už aktuální!",
            ),
            type: 'neutral', expression: 'neutral', mouth: 'neutral', animation: 'idle',
            envEffect: 'checkmarks-float',
        };
    }

    if (step === 3) {
        return {
            text: pick([
                tr(
                    "Ready to import! Click the button to save your transactions.",
                    "Můžeme importovat! Klikni na tlačítko a transakce se uloží.",
                ),
                tr(
                    "One click away from adding these to your financial history!",
                    "Ještě jedno kliknutí a tohle se přidá do tvé finanční historie!",
                ),
            ]),
            type: 'neutral', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'golden-sparkles',
        };
    }

    return {
        text: tr(
            "Follow the wizard steps to import your bank data.",
            "Postupuj podle kroků průvodce a naimportuj svá bankovní data.",
        ),
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
                tr(
                    "Switch to 'View Documents' to see all your imported files.",
                    "Přepni se na „Zobrazit dokumenty“ a uvidíš všechny naimportované soubory.",
                ),
                tr(
                    "Your document library is in the other tab. Click 'View Documents'.",
                    "Tvá knihovna dokumentů je ve druhé záložce. Klikni na „Zobrazit dokumenty“.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                "Here are all your uploaded statements. Each file created transactions automatically.",
                "Tady jsou všechny nahrané výpisy. Každý soubor automaticky vytvořil transakce.",
            ),
            tr(
                "Your import history — every document you've processed is here.",
                "Historie importů — každý zpracovaný dokument najdeš tady.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'thought-clouds',
    };
}

// ── View Toggle (Wizard vs Documents) ───────────────────────────────────────
function viewToggleInsight(data) {
    const { view, hasFile } = data;

    if (view === 'wizard') {
        return {
            text: pick([
                tr(
                    "Toggle to Documents to see everything you've imported so far. Or stay here and upload a new file!",
                    "Přepni na Dokumenty a uvidíš vše, co jsi už naimportoval/a. Nebo zůstaň tady a nahraj nový soubor!",
                ),
                hasFile
                    ? tr(
                        "Wizard in progress — don't lose your place! Click Documents to peek at prior imports.",
                        "Průvodce běží — neztrať místo! Klikni na Dokumenty a mrkni na předchozí importy.",
                    )
                    : tr(
                        "Upload a new file to start the wizard, or switch to Documents to review past imports.",
                        "Nahraj nový soubor a spusť průvodce, nebo se přepni na Dokumenty a projdi minulé importy.",
                    ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'thought-clouds',
        };
    }

    return {
        text: pick([
            tr(
                "Documents view — click any row to inspect or delete. Switch back to Wizard when you're ready to import more!",
                "Zobrazení dokumentů — klikni na řádek pro detail nebo smazání. Až budeš chtít importovat další, přepni zpět na Průvodce!",
            ),
            tr(
                "Your imported file archive. Delete one to also remove its transactions, or flip back to the Wizard to add new data.",
                "Archiv naimportovaných souborů. Smazáním souboru odstraníš i jeho transakce, nebo se přepni zpět na Průvodce a přidej nová data.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'checkmarks-float',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'import-header': headerInsight,
    'import-wizard': wizardInsight,
    'import-content': contentInsight,
    'import-documents': documentsInsight,
    'import-view-toggle': viewToggleInsight,
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
            text: pick([
                tr(
                    "Your import library — every statement you've uploaded is here. Ready to add more?",
                    "Tvá knihovna importů — všechny nahrané výpisy jsou tady. Chceš přidat další?",
                ),
                tr(
                    "Browsing your document history. Click 'Import' to add a new statement!",
                    "Prohlížíš si historii dokumentů. Klikni na „Import“ a přidej nový výpis!",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        };
    }

    if (step > 0 && hasFile) {
        return {
            text: pick([
                tr(
                    `You're on step ${step + 1} of the import wizard — keep going!`,
                    `Jsi v kroku ${step + 1} průvodce importem — pokračuj!`,
                ),
                tr(
                    "Mid-import! Follow the steps and I'll handle the parsing.",
                    "Import v běhu! Jdi podle kroků a parsování nech na mně.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'hop',
        };
    }

    return {
        text: pick([
            tr(
                "Ready to import! I support PDF, CSV, and Excel bank statements. Drag and drop or browse to get started.",
                "Můžeme importovat! Podporuji PDF, CSV i Excel bankovní výpisy. Přetáhni soubor nebo ho vyber a pojedeme.",
            ),
            tr(
                "Upload your next bank statement — I'll auto-detect the format and parse all transactions.",
                "Nahraj další bankovní výpis — formát poznám sám a naparsuju všechny transakce.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
    };
}
