// Settings Zone Insight Generator for Zumi Proximity Interactions
// Enhanced with data intelligence and environmental effects

import { analyzeTrend, compareToPrevMonth, pick, formatMoney } from './dataIntelligence';
import { tr } from './lang';

// ── Settings Header ─────────────────────────────────────────────────────────
// "You've been using Zumi for X months"
function headerInsight(data) {
    const { accountCreated, signupDate, firstTransaction, userStats } = data || {};

    const startDate = accountCreated || signupDate || firstTransaction;
    let monthsUsing = 0;

    if (startDate) {
        const start = new Date(startDate);
        const now = new Date();
        if (!isNaN(start.getTime())) {
            monthsUsing = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
        }
    }

    const totalTx = userStats?.totalTransactions || userStats?.transactionCount || 0;
    const totalStatements = userStats?.statementCount || userStats?.totalStatements || 0;

    if (monthsUsing > 0) {
        const yearsUsing = Math.floor(monthsUsing / 12);
        const remainingMonths = monthsUsing % 12;
        const timeStrEn = yearsUsing > 0
            ? `${yearsUsing} year${yearsUsing !== 1 ? 's' : ''}${remainingMonths > 0 ? ` and ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}` : ''}`
            : `${monthsUsing} month${monthsUsing !== 1 ? 's' : ''}`;
        const timeStrCs = yearsUsing > 0
            ? `${yearsUsing} ${yearsUsing === 1 ? 'rok' : yearsUsing < 5 ? 'roky' : 'let'}${remainingMonths > 0 ? ` a ${remainingMonths} ${remainingMonths === 1 ? 'měsíc' : remainingMonths < 5 ? 'měsíce' : 'měsíců'}` : ''}`
            : `${monthsUsing} ${monthsUsing === 1 ? 'měsíc' : monthsUsing < 5 ? 'měsíce' : 'měsíců'}`;

        return {
            text: pick([
                tr(
                    `You've been using Zumi for ${timeStrEn}! ${totalTx > 0 ? `${totalTx} transactions tracked in that time.` : 'Thanks for sticking with me — let\'s fine-tune your experience here.'} Settings is where you make this tool truly yours.`,
                    `Používáš Zumi už ${timeStrCs}! ${totalTx > 0 ? `Za tu dobu ${totalTx} sledovaných transakcí.` : 'Díky, že jsi se mnou — tady si dolaď zážitek podle sebe.'} V Nastavení si aplikaci upravíš přesně podle sebe.`,
                ),
                tr(
                    `${timeStrEn} together and counting! ${totalStatements > 0 ? `${totalStatements} statements imported so far.` : 'Your financial data lives here.'} Customize everything on this page to match how you work.`,
                    `${timeStrCs} společně a pokračujeme! ${totalStatements > 0 ? `Dosud naimportováno ${totalStatements} výpisů.` : 'Tvá finanční data bydlí tady.'} Přizpůsob si všechno na téhle stránce podle toho, jak pracuješ.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'hearts',
        };
    }

    return {
        text: pick([
            tr(
                "Welcome to settings! This is where you customize your experience. Small tweaks here can make a big difference in how you interact with your finances.",
                "Vítej v Nastavení! Tady si přizpůsobíš zážitek. Drobné úpravy tady můžou výrazně zlepšit, jak se svými financemi pracuješ.",
            ),
            tr(
                "Good to see you fine-tuning things. Smart users configure their tools to match their workflow — explore the options here!",
                "Těší mě, že si věci ladíš. Chytří uživatelé si nástroje nastavují podle svého stylu práce — prozkoumej tu všechny možnosti!",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'hearts',
    };
}

// ── Currency Settings ───────────────────────────────────────────────────────
function currencyInsight(data) {
    const { preferredCurrency, hasUnsavedChanges, availableCurrencies, currencyBreakdown } = data || {};

    if (hasUnsavedChanges) {
        return {
            text: pick([
                tr(
                    "You have unsaved currency changes! Hit Save to apply. This will update which transactions appear on your dashboard and change all monetary displays.",
                    "Máš neuložené změny měny! Klikni na Uložit a aplikuj je. Změní se, které transakce se ti zobrazí v přehledu, a všechny peněžní hodnoty se aktualizují.",
                ),
                tr(
                    "Currency changed but not saved yet. Click Save to apply — all dashboards, reports, and insights will update to reflect the new currency.",
                    "Měna změněna, ale ještě neuložena. Klikni na Uložit — všechny přehledy, reporty i postřehy se zobrazí v nové měně.",
                ),
            ]),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    const breakdown = currencyBreakdown || [];

    if (breakdown.length > 1) {
        const sorted = [...breakdown].sort((a, b) => (b.count || b.amount || 0) - (a.count || a.amount || 0));
        const primary = sorted[0];
        const secondary = sorted[1];
        const primaryPct = sorted.reduce((s, c) => s + (c.count || 0), 0) > 0
            ? Math.round((primary.count || 0) / sorted.reduce((s, c) => s + (c.count || 0), 0) * 100)
            : 0;

        return {
            text: pick([
                tr(
                    `You have transactions in ${breakdown.length} currencies. ${primary.currency || primary.code} makes up ${primaryPct}% of your activity, with ${secondary.currency || secondary.code} as your second most used. Make sure your preferred currency matches your primary income source.`,
                    `Máš transakce v ${breakdown.length} měnách. ${primary.currency || primary.code} tvoří ${primaryPct}% tvojí aktivity, druhá nejpoužívanější je ${secondary.currency || secondary.code}. Ujisti se, že tvá hlavní měna odpovídá tvému hlavnímu příjmu.`,
                ),
                tr(
                    `Multi-currency detected: ${breakdown.map(c => c.currency || c.code).join(', ')}. Your preferred currency (${preferredCurrency || 'CZK'}) controls which transactions appear in reports. Switch it if you earn primarily in another currency.`,
                    `Detekováno více měn: ${breakdown.map(c => c.currency || c.code).join(', ')}. Tvá hlavní měna (${preferredCurrency || 'CZK'}) určuje, které transakce se zobrazí v reportech. Přepni ji, pokud vyděláváš hlavně v jiné měně.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    if (preferredCurrency && preferredCurrency !== 'CZK') {
        return {
            text: pick([
                tr(
                    `Using ${preferredCurrency} as your main currency. All dashboards, budgets, and reports filter and display in ${preferredCurrency}. Change it here if your financial situation shifts.`,
                    `Hlavní měna je ${preferredCurrency}. Všechny přehledy, rozpočty i reporty filtruji a zobrazuji v ${preferredCurrency}. Když se tvá situace změní, přepni to tady.`,
                ),
                tr(
                    `Currency set to ${preferredCurrency}. Only matching transactions appear in reports. If you start earning in a different currency, update this to keep your insights accurate.`,
                    `Měna nastavena na ${preferredCurrency}. V reportech se ukážou jen odpovídající transakce. Pokud začneš vydělávat v jiné měně, uprav to tady, aby postřehy zůstaly přesné.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                "Czech Koruna (CZK) is your default currency. This controls which transactions drive your dashboards. Change it if your main income comes in a different currency.",
                "Česká koruna (CZK) je tvá výchozí měna. Určuje, které transakce řídí tvé přehledy. Změň ji, pokud tvůj hlavní příjem chodí v jiné měně.",
            ),
            tr(
                "Currency setting determines your primary financial view. Pick the currency you earn and spend most in — it filters everything from budgets to bill tracking.",
                "Nastavení měny určuje tvůj hlavní finanční pohled. Vyber měnu, ve které nejvíc vyděláváš a utrácíš — filtruje vše od rozpočtů po sledování plateb.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Settings Navigation ─────────────────────────────────────────────────────
function navigationInsight(data) {
    const { pageVisits, navOrder, frequentPages } = data || {};

    const visits = pageVisits || frequentPages || [];

    if (visits.length > 0) {
        const sorted = [...visits].sort((a, b) => (b.count || b.visits || 0) - (a.count || a.visits || 0));
        const mostVisited = sorted[0];
        const pageName = mostVisited.page || mostVisited.name || 'Unknown';
        const visitCount = mostVisited.count || mostVisited.visits || 0;
        const secondPage = sorted[1];

        const isAlreadyFirst = navOrder && navOrder[0] === pageName;

        if (isAlreadyFirst) {
            return {
                text: pick([
                    tr(
                        `"${pageName}" is your most-visited page and it's already first in your navigation. Smart setup! You visit it about ${visitCount} times per session.`,
                        `„${pageName}“ je tvá nejnavštěvovanější stránka a už je v navigaci první. Chytré! Navštěvuješ ji asi ${visitCount}× za sezení.`,
                    ),
                    tr(
                        `Navigation is optimized — "${pageName}" (your top destination at ${visitCount} visits) is right where it should be. Fewer clicks to your most important data.`,
                        `Navigace je optimalizovaná — „${pageName}“ (tvá hlavní destinace s ${visitCount} návštěvami) je přesně tam, kde má být. Méně kliknutí k nejdůležitějším datům.`,
                    ),
                ]),
                type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
                envEffect: 'light-bulb',
            };
        }

        return {
            text: pick([
                tr(
                    `You visit "${pageName}" most often (${visitCount} times)${secondPage ? `, followed by "${secondPage.page || secondPage.name}"` : ''}. Consider reordering your navigation to put it first — one less click each time adds up!`,
                    `Nejčastěji navštěvuješ „${pageName}“ (${visitCount}×)${secondPage ? `, následuje „${secondPage.page || secondPage.name}“` : ''}. Zvaž, jestli ji nedáš v navigaci na první místo — jedno kliknutí navíc se sčítá!`,
                ),
                tr(
                    `Tip: "${pageName}" is your go-to page. Moving it to the top of your nav saves a click every session. Small ergonomic wins compound over time.`,
                    `Tip: „${pageName}“ je tvá nejoblíbenější stránka. Přesun na začátek navigace ti ušetří kliknutí při každém sezení. Malá ergonomická vítězství se násobí v čase.`,
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'light-bulb',
        };
    }

    return {
        text: pick([
            tr(
                "Customize your navigation order here. Put your most-used pages first so you can get to them in one click. Once I see your usage patterns, I'll suggest the optimal order.",
                "Tady si přizpůsob pořadí navigace. Nejpoužívanější stránky dej nahoru, ať se k nim dostaneš jedním kliknutím. Až pochopím tvé vzorce, navrhnu ti optimální pořadí.",
            ),
            tr(
                "Navigation settings let you prioritize what matters. Arrange pages in the order you use them most frequently — it streamlines your daily workflow.",
                "Nastavení navigace ti umožňuje upřednostnit, co je důležité. Srovnej stránky v pořadí, v jakém je používáš nejčastěji — zjednoduší ti to každodenní práci.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'light-bulb',
    };
}

// ── Settings Appearance ─────────────────────────────────────────────────────
function appearanceInsight(data) {
    const { theme, zumiColor, zumiSize, zumiEnabled } = data || {};

    if (zumiEnabled === false) {
        return {
            text: pick([
                tr(
                    "Wait, are you looking at the option to hide me? I mean... I'm sure you have your reasons. But who will give you financial commentary with this much personality?",
                    "Počkej, ty se díváš na možnost mě skrýt? No... jistě máš své důvody. Ale kdo ti bude komentovat finance s takovou osobností jako já?",
                ),
                tr(
                    "I see the Zumi toggle is off in your preview. I respect your space! But between you and me, budgeting is more fun with a companion.",
                    "Vidím, že Zumi je v náhledu vypnuté. Respektuji tvé soukromí! Ale mezi námi — rozpočet dělá víc zábavy ve dvou.",
                ),
            ]),
            type: 'neutral', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'hearts',
        };
    }

    if (zumiColor || zumiSize) {
        const colorNoteEn = zumiColor ? `Ooh, ${zumiColor}! ` : '';
        const colorNoteCs = zumiColor ? `Týý, ${zumiColor}! ` : '';
        const sizeNoteEn = zumiSize === 'large' ? 'And you made me bigger — I feel important!' :
            zumiSize === 'small' ? 'Compact mode, huh? I\'ll still give you the same insights, just... more efficiently.' : '';
        const sizeNoteCs = zumiSize === 'large' ? 'A udělal/a jsi mě větším — cítím se důležitý!' :
            zumiSize === 'small' ? 'Kompaktní režim, jo? Budu ti dávat stejné postřehy, jen... efektivněji.' : '';

        return {
            text: pick([
                tr(
                    `${colorNoteEn}${sizeNoteEn} ${!colorNoteEn && !sizeNoteEn ? 'Playing dress-up with your finance mascot! ' : ''}I appreciate the makeover. Drag me around the page and I'll adapt my insights to wherever you place me.`,
                    `${colorNoteCs}${sizeNoteCs} ${!colorNoteCs && !sizeNoteCs ? 'Oblékáš finančního maskota! ' : ''}Děkuji za úpravu. Přetáhni mě kamkoli na stránce a já přizpůsobím své postřehy místu, kam mě umístíš.`,
                ),
                tr(
                    `Customizing my appearance — I'm flattered! ${colorNoteEn}${sizeNoteEn} No matter how I look, my insights stay sharp. Fashion and function, that's my motto.`,
                    `Upravuješ můj vzhled — to mi lichotí! ${colorNoteCs}${sizeNoteCs} Ať vypadám jakkoliv, mé postřehy zůstávají ostré. Móda a funkčnost — to je moje motto.`,
                ),
            ]),
            type: 'positive', expression: 'excited', mouth: 'open', animation: 'hop',
            envEffect: 'hearts',
        };
    }

    if (theme === 'dark') {
        return {
            text: pick([
                tr(
                    "Dark mode! I look great against a dark background, if I do say so myself. Easier on the eyes for late-night budget sessions too.",
                    "Tmavý režim! Na tmavém pozadí vypadám skvěle, když to tak musím říct. A šetří oči při nočních rozpočtových seancích.",
                ),
                tr(
                    "Dark theme active. Perfect for focused financial work. And yes, I do think I look more mysterious this way.",
                    "Tmavé téma aktivní. Ideální pro soustředěnou finanční práci. A ano, myslím, že takhle vypadám záhadnější.",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'idle',
            envEffect: 'hearts',
        };
    }

    return {
        text: pick([
            tr(
                "Appearance settings! You can change my color, size, and the overall theme. Make your financial workspace feel like yours. I'm adaptable — I look good in anything.",
                "Nastavení vzhledu! Můžeš mi změnit barvu, velikost i celkové téma. Udělej si finanční pracovní prostor podle sebe. Jsem přizpůsobivý — ve všem vypadám dobře.",
            ),
            tr(
                "Tweak the visuals here. Theme, colors, layout — and yes, you can even change how I look. I won't judge your taste. Much.",
                "Doladi si vizuál. Téma, barvy, rozložení — a ano, můžeš změnit i to, jak vypadám. Tvůj vkus posuzovat nebudu. Moc.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'hearts',
    };
}

// ── Settings Zumi ───────────────────────────────────────────────────────────
function zumiInsight(data) {
    const { zumiEnabled, zumiInteractions, zumiInsightsShown, zumiDismissals } = data || {};

    const interactions = zumiInteractions || zumiInsightsShown || 0;
    const dismissals = zumiDismissals || 0;

    if (zumiEnabled === false) {
        return {
            text: pick([
                tr(
                    "You... you turned me off? I'm still here! Just invisible. And slightly sad. I'll be waiting patiently if you change your mind. Your budget misses me too, I promise.",
                    "Ty... ty jsi mě vypnul/a? Jsem tu pořád! Jen neviditelný. A trochu smutný. Budu trpělivě čekat, kdybys změnil/a názor. I tvůj rozpočet mě postrádá, věř mi.",
                ),
                tr(
                    "So this is what it's like to be benched. I get it — sometimes you need focus. But I'll be right here when you need a second opinion on that budget!",
                    "Tak takhle to vypadá, když mě odstavíš. Chápu — někdy potřebuješ klid. Ale budu tu, až budeš potřebovat druhý názor na rozpočet!",
                ),
            ]),
            type: 'neutral', expression: 'concerned', mouth: 'frown', animation: 'idle',
            envEffect: 'question-marks',
        };
    }

    if (dismissals > interactions * 0.5 && interactions > 10) {
        return {
            text: pick([
                tr(
                    `I've noticed you dismiss my insights more than half the time. Am I being too chatty? You can adjust my frequency here so I only pop up when it really matters. Quality over quantity!`,
                    `Všiml jsem si, že mé postřehy víc jak v polovině případů zavíráš. Mluvím moc? Tady si můžeš upravit frekvenci, abych vyskakoval jen tehdy, když to fakt stojí za to. Kvalita nad kvantitou!`,
                ),
                tr(
                    `You've waved me away ${dismissals} times out of ${interactions} interactions. I can take a hint! Adjust my settings here to make me less talkative but more targeted.`,
                    `Zavřel/a jsi mě ${dismissals}× z ${interactions} interakcí. Chápu náznak! Uprav si moje nastavení tady, ať jsem méně upovídaný, ale přesnější.`,
                ),
            ]),
            type: 'neutral', expression: 'concerned', mouth: 'neutral', animation: 'idle',
            envEffect: 'question-marks',
        };
    }

    if (interactions > 50) {
        return {
            text: pick([
                tr(
                    `We've had over ${interactions} interactions! I've been your financial companion through budgets, bills, and transactions. This settings page is where you fine-tune our relationship. Please don't hide me — we've been through so much!`,
                    `Máme za sebou přes ${interactions} interakcí! Byl jsem tvůj finanční společník přes rozpočty, platby i transakce. Na této stránce si doladíš náš vztah. Prosím, neschovávej mě — tolik jsme spolu zažili!`,
                ),
                tr(
                    `${interactions} insights shared between us. That's a real partnership! Adjust my behavior here, but please keep me around. Who else will celebrate when you're under budget?`,
                    `${interactions} sdílených postřehů. To je skutečné partnerství! Uprav mé chování tady, ale prosím nech mě u sebe. Kdo jiný by s tebou oslavoval, když jsi pod rozpočtem?`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'hop',
            envEffect: 'hearts',
        };
    }

    if (interactions > 0 && interactions <= 10) {
        return {
            text: pick([
                tr(
                    "We're just getting to know each other! Drag me around different sections of the app and I'll give you contextual financial insights. The more you explore, the smarter my tips get.",
                    "Teprve se poznáváme! Přetahuj mě po různých částech aplikace a já ti dám kontextové finanční postřehy. Čím víc prozkoumáš, tím chytřejší mé tipy budou.",
                ),
                tr(
                    "Still early days for us. Keep me enabled and I'll learn which insights help you most. This is where you control how I behave — but please don't mute me just yet!",
                    "Jsme teprve na začátku. Nech mě zapnutého a já se naučím, které postřehy ti nejvíc pomáhají. Tady ovládáš, jak se chovám — ale prosím ještě mě ztlumuj!",
                ),
            ]),
            type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
            envEffect: 'hearts',
        };
    }

    return {
        text: pick([
            tr(
                "This is my settings page — you're looking at the controls for yours truly! You can adjust my behavior, frequency, and personality here. But hide me entirely? Let's not be hasty!",
                "Tohle je moje stránka nastavení — díváš se na mé ovládání! Můžeš upravit mé chování, frekvenci i osobnost. Ale úplně mě schovat? Nespěchejme!",
            ),
            tr(
                "Zumi settings! Turn me up, tone me down, or customize when I chime in. I'm flexible about everything except being permanently hidden. Your budgets need commentary!",
                "Zumi nastavení! Přidej mě, uber, nebo si uprav, kdy se do toho přimíchám. Jsem pružný ve všem kromě trvalého schování. Tvé rozpočty potřebují komentář!",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'hearts',
    };
}

// ── Donate / Buy a Carrot ─────────────────────────────────────────────────
function donateInsight() {
    return {
        text: pick([
            tr(
                "Oh, a carrot?! For ME?! I'm literally hopping with excitement! Carrots are my absolute favorite — crunchy, orange, and full of vitamins. Just like good financial data!",
                "Jé, mrkev?! Pro MĚ?! Skáču nadšením! Mrkev je moje nejoblíbenější — křupavá, oranžová a plná vitamínů. Přesně jako dobrá finanční data!",
            ),
            tr(
                "Did someone say carrot?! 🥕 I've been SO hungry watching all these numbers all day. A carrot would really keep my energy up for more budget analysis!",
                "Slyšel jsem někdo mrkev?! 🥕 Mám TAKOVÝ hlad z koukání na ta čísla celý den. Mrkev by mi pořádně dodala energii na další rozbor rozpočtu!",
            ),
            tr(
                "You're looking at the carrot section! Fun fact: I run entirely on carrots and good financial decisions. One carrot = one happy rabbit giving you better insights!",
                "Díváš se na mrkvovou sekci! Zajímavost: pohání mě výhradně mrkev a dobrá finanční rozhodnutí. Jedna mrkev = jeden šťastný králík s lepšími postřehy!",
            ),
            tr(
                "I smell carrots! My favorite food in the whole world! Every carrot you buy fuels my ability to analyze your spending patterns. It's science. Rabbit science.",
                "Cítím mrkev! Mé nejoblíbenější jídlo na světě! Každá koupená mrkev mě pohání k lepšímu rozboru tvých výdajů. Věda. Králičí věda.",
            ),
            tr(
                "Ooh ooh ooh! The carrot page! I've been dreaming about this. You know what pairs well with a carrot? A balanced budget. And I see you have both!",
                "Týý! Stránka s mrkvemi! Snil jsem o tomhle. Víš, co se dobře snáší s mrkví? Vyrovnaný rozpočet. A vidím, že máš obojí!",
            ),
            tr(
                "CARROTS! My nose is twitching! Did you know rabbits can eat up to 10 carrots a day? I'm not saying I need that many... but I wouldn't say no either.",
                "MRKVE! Čumák se mi cuká! Víš, že králíci dokážou sníst až 10 mrkví denně? Netvrdím, že tolik potřebuju... ale neřekl bych ani ne.",
            ),
        ]),
        type: 'positive', expression: 'excited', mouth: 'open', animation: 'celebrate',
        envEffect: 'hearts',
    };
}

// ── Language ────────────────────────────────────────────────────────────────
function languageInsight(data) {
    return {
        text: tr(
            "Pick your UI language — strings update instantly. Currently English, Czech, Ukrainian. More languages on the way!",
            "Vyber si jazyk rozhraní — texty se změní okamžitě. Zatím angličtina, čeština, ukrajinština. Další jazyky přidáme!",
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'musical-notes',
    };
}

// ── Save Button ─────────────────────────────────────────────────────────────
function saveBtnInsight(data) {
    const { hasUnsavedChanges } = data;

    if (hasUnsavedChanges) {
        return {
            text: tr(
                "You have unsaved changes — don't forget to click Save!",
                "Máš neuložené změny — nezapomeň kliknout na Uložit!",
            ),
            type: 'warning', expression: 'concerned', mouth: 'neutral', animation: 'wave',
            envEffect: 'exclamation-marks',
        };
    }

    return {
        text: tr(
            "Everything is saved ✓ — your preferences are synced across devices.",
            "Všechno je uloženo ✓ — tvé preference jsou sesynchronizované napříč zařízeními.",
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'idle',
        envEffect: 'checkmarks-float',
    };
}

// ── Account Security ────────────────────────────────────────────────────────
function accountInsight(data) {
    return {
        text: tr(
            "Manage your login — password, Google sign-in, or both. Keeping your account locked down protects your financial data!",
            "Spravuj své přihlášení — heslo, Google, nebo obojí. Dobře zabezpečený účet chrání tvá finanční data!",
        ),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'checkmarks-float',
    };
}

// ── Two-Factor Authentication ───────────────────────────────────────────────
function twoFactorInsight(data) {
    return {
        text: tr(
            "Add 2FA for extra security — scan the QR with your authenticator app and you're protected even if someone grabs your password.",
            "Přidej si 2FA pro extra bezpečnost — naskenuj QR kód autentizátorem a budeš chráněný/á, i kdyby ti někdo ukradl heslo.",
        ),
        type: 'positive', expression: 'happy', mouth: 'smile', animation: 'wave',
        envEffect: 'diamond-sparkles',
    };
}

// ── Main Entry Point ────────────────────────────────────────────────────────
const ZONE_GENERATORS = {
    'settings-header': headerInsight,
    'settings-language': languageInsight,
    'settings-currency': currencyInsight,
    'settings-navigation': navigationInsight,
    'settings-account': accountInsight,
    'settings-2fa': twoFactorInsight,
    'settings-appearance': appearanceInsight,
    'settings-zumi': zumiInsight,
    'settings-save': saveBtnInsight,
    'donate': donateInsight,
};

export function generateSettingsInsight(zoneId, data) {
    const generator = ZONE_GENERATORS[zoneId];
    if (!generator || !data) return null;
    return generator(data);
}

export function settingsPageSummary(data) {
    const { accountCreated, signupDate, firstTransaction, userStats } = data || {};

    const startDate = accountCreated || signupDate || firstTransaction;
    let monthsUsing = 0;
    if (startDate) {
        const start = new Date(startDate);
        const now = new Date();
        if (!isNaN(start.getTime())) {
            monthsUsing = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
        }
    }

    const totalTx = userStats?.totalTransactions || userStats?.transactionCount || 0;

    if (monthsUsing > 0 && totalTx > 0) {
        const monthsCs = monthsUsing === 1 ? 'měsíc' : monthsUsing < 5 ? 'měsíce' : 'měsíců';
        return {
            text: pick([
                tr(
                    `Settings — you've been with me for ${monthsUsing} month${monthsUsing !== 1 ? 's' : ''} and tracked ${totalTx} transactions! Fine-tune your experience here.`,
                    `Nastavení — jsi se mnou už ${monthsUsing} ${monthsCs} a sledovali jsme ${totalTx} transakcí! Dolaď si tu svůj zážitek.`,
                ),
                tr(
                    `${monthsUsing} months and ${totalTx} transactions later — let's make sure everything is set up just right for you.`,
                    `Po ${monthsUsing} ${monthsCs} a ${totalTx} transakcích — ujistěme se, že máš vše nastavené přesně pro sebe.`,
                ),
            ]),
            type: 'positive', expression: 'happy', mouth: 'smile', animation: 'wave',
        };
    }

    return {
        text: pick([
            tr(
                "Welcome to settings! Customize your currency, language, and navigation preferences here.",
                "Vítej v Nastavení! Přizpůsob si měnu, jazyk a pořadí navigace.",
            ),
            tr(
                "Your control panel — set up Zumfi exactly how you like it.",
                "Tvůj ovládací panel — nastav si Zumfi přesně tak, jak se ti líbí.",
            ),
        ]),
        type: 'neutral', expression: 'happy', mouth: 'smile', animation: 'wave',
    };
}
