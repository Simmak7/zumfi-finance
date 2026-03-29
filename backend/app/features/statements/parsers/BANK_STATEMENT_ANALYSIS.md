# Bank Statement Format Analysis — 60 European Banks

> Generated: 2026-03-02
> Purpose: Comprehensive analysis of bank statement formats for building parsers
> Application: Zumfi Finance App (PDF/CSV statement import → transaction extraction)

---

## Table of Contents

1. [Application Requirements](#application-requirements)
2. [Czech Banks (10)](#czech-republic---10-banks)
3. [UK Banks (5)](#united-kingdom---5-banks)
4. [German Banks (5)](#germany---5-banks)
5. [French Banks (4)](#france---4-banks)
6. [Spanish Banks (4)](#spain---4-banks)
7. [Italian Banks (4)](#italy---4-banks)
8. [Dutch Banks (3)](#netherlands---3-banks)
9. [Polish Banks (3)](#poland---3-banks)
10. [Swiss Banks (3)](#switzerland---3-banks)
11. [Austrian Banks (2)](#austria---2-banks)
12. [Swedish Banks (3)](#sweden---3-banks)
13. [Norwegian Banks (2)](#norway---2-banks)
14. [Danish Banks (2)](#denmark---2-banks)
15. [Finnish Banks (2)](#finland---2-banks)
16. [Belgian Banks (2)](#belgium---2-banks)
17. [Portuguese Banks (2)](#portugal---2-banks)
18. [Irish Banks (2)](#ireland---2-banks)
19. [Romanian Banks (1)](#romania---1-bank)
20. [Hungarian Banks (1)](#hungary---1-bank)
21. [Pan-European Digital Banks](#pan-european-digital-banks)
22. [Implementation Strategy](#implementation-strategy)

---

## Application Requirements

Each parser must return transaction dicts with:

```python
{
    "date": date,                    # Transaction date (date object)
    "description": str,              # Cleaned description
    "original_description": str,     # Raw description from bank
    "amount": float,                 # Always positive
    "type": str,                     # "income" or "expense"
    "currency": str,                 # 3-letter ISO code (e.g., "CZK", "EUR", "GBP")
    "original_amount": float | None, # Foreign currency amount (optional)
    "original_currency": str | None, # Foreign currency code (optional)
}
```

Additional fields tracked by the application:
- `statement.bank_name` — auto-detected bank name
- `statement.statement_type` — "bank", "savings", "stock", "stock_pnl"
- `statement.closing_balance` — for savings statements

---

## Regional Format Conventions

| Region | Date Format | Decimal Sep | Thousands Sep | CSV Delimiter | Encoding | Debit/Credit Approach |
|--------|-------------|-------------|---------------|---------------|----------|----------------------|
| **Czech** | dd.mm.yyyy | `,` | space | `;` | Windows-1250 | Signed amount or keywords |
| **UK** | DD/MM/YYYY | `.` | `,` | `,` | UTF-8 | Separate Money In/Out columns or signed |
| **Germany** | DD.MM.YYYY | `,` | `.` | `;` | ISO-8859-1 | Signed + S/H suffix (Sparkasse) |
| **France** | DD/MM/YYYY | `,` | space | `;` | ISO-8859-1 | Two columns: Débit/Crédit |
| **Spain** | DD/MM/YYYY | `,` | `.` | `;` | Windows-1252 | Signed Importe or Debe/Haber |
| **Italy** | DD/MM/YYYY | `,` | `.` | `;` | ISO-8859-1 | Dare/Avere or signed Importo |
| **Netherlands** | DD-MM-YYYY | `,` | `.` | `;` | UTF-8 | Af/Bij (debit/credit) |
| **Poland** | DD.MM.YYYY | `,` | space | `;` | Windows-1250 | Signed or Obciążenie/Uznanie |
| **Switzerland** | DD.MM.YYYY | `.` | `'` | `;` | UTF-8 | Belastung/Gutschrift (DE) |
| **Nordics** | YYYY-MM-DD | `,` | `.` or space | `;` | UTF-8 | Signed amount |
| **Portugal** | DD-MM-YYYY | `,` | `.` | `;` | UTF-8 | Débito/Crédito |
| **Ireland** | DD/MM/YYYY | `.` | `,` | `,` | UTF-8 | Debit/Credit columns |
| **Hungary** | YYYY.MM.DD | `,` | space | `;` | UTF-8 | Signed or Terhelés/Jóváírás |

---

## CZECH REPUBLIC — 10 Banks

### CZ-1. Česká spořitelna (Erste Group) — ~4.5M customers

**Status**: NOT YET IMPLEMENTED — HIGH PRIORITY

**Detection Keywords**: `"česká spořitelna"`, `"ceska sporitelna"`, `"erste"`, `"george"`

**PDF Structure** (George online banking):
- Header: "Česká spořitelna, a.s.", account number + IBAN, statement period
- Balance summary: Počáteční zůstatek / Konečný zůstatek
- Table columns:

| Column | Name | Format | Notes |
|--------|------|--------|-------|
| 1 | Datum | dd.mm.yyyy | Transaction date |
| 2 | Valuta | dd.mm.yyyy | Value date |
| 3 | Popis operace | text | "Příchozí platba", "Platba kartou", etc. |
| 4 | Název protiúčtu | text | Counterparty name |
| 5 | Číslo protiúčtu | text | Counterparty account |
| 6 | VS | digits | Variable symbol |
| 7 | KS | digits | Constant symbol |
| 8 | SS | digits | Specific symbol |
| 9 | Částka | -1 234,56 CZK | Signed, CZK suffix |
| 10 | Zpráva pro příjemce | text | Message |

**Amount**: `-1 234,56 CZK` (space thousands, comma decimal, CZK suffix)
**Income Detection**: Sign-based + keywords: "příchozí platba", "příjem", "úrok", "vklad"
**Expense Keywords**: "platba kartou", "odchozí platba", "trvalý příkaz", "SIPO/inkaso"
**Savings**: "Spořicí účet" header, interest: "připsaný úrok"
**CSV**: `;` delimited, Windows-1250, columns: `Datum;Částka;Měna;Protiúčet;Kód banky;Název protiúčtu;VS;KS;SS;Identifikace;Popis;Poznámka`
**Parsing Notes**: Clean table layout, pdfplumber works well. Multi-page headers repeat. Card payments have merchant in "Popis" field.

---

### CZ-2. ČSOB (KBC Group) — ~3.5-4M customers

**Status**: NOT YET IMPLEMENTED — HIGH PRIORITY

**Detection Keywords**: `"čsob"`, `"csob"`, `"československá obchodní banka"`, `"ceskoslovenska obchodni banka"`, `"CEKOCZPP"`

**PDF Structure**:
- Header: "Československá obchodní banka, a.s." or "ČSOB"
- Two-line transaction blocks (date+type+amount on line 1, counterparty+symbols on line 2)

| Column | Name | Format |
|--------|------|--------|
| 1 | Datum zaúčtování | dd.mm.yyyy |
| 2 | Datum valutace | dd.mm.yyyy |
| 3 | Popis transakce | text |
| 4 | Protiúčet | account number |
| 5 | VS / KS / SS | digits |
| 6 | Částka | -1 234,56 CZK |
| 7 | Zůstatek | amount (some versions) |

**Amount**: `-1 234,56 CZK` — sometimes without CZK suffix
**Income Detection**: Sign + keywords: "příchozí úhrada", "vklad hotovosti"
**Expense Keywords**: "odchozí úhrada", "platba kartou", "výběr z bankomatu", "trvalý příkaz", "inkaso"
**Savings**: "Spořicí účet" header, interest entries
**CSV**: `;` delimited, Windows-1250, columns: `Datum;Objem;Měna;Protiúčet;Název protiúčtu;VS;KS;SS;Typ;Zpráva`
**Parsing Notes**: Two-line block format similar to Raiffeisen. Card terminal IDs in descriptions. Business vs personal account layout differences.

---

### CZ-3. Komerční banka (Société Générale) — ~1.6M customers

**Status**: NOT YET IMPLEMENTED — HIGH PRIORITY

**Detection Keywords**: `"komerční banka"`, `"komercni banka"`, `"KOMBCZPP"`, `"kb.cz"`

**PDF Structure**:
- Header: "Komerční banka, a.s."
- Strong table structure — pdfplumber extraction works well

| Column | Name | Format |
|--------|------|--------|
| 1 | Datum | dd.mm.yyyy |
| 2 | Valuta | dd.mm.yyyy |
| 3 | Název operace | text — "Bezhotovostní příjem", etc. |
| 4 | Protiúčet/Kód banky | account/bank code |
| 5 | Název protiúčtu | counterparty name |
| 6 | VS/SS/KS | combined or separate columns |
| 7 | Zpráva | message text |
| 8 | Částka v CZK | -1 234,56 |

**Amount**: `-1 234,56` (no CZK suffix in table, "v CZK" in header)
**Income Detection**: Sign-based. Keywords: "bezhotovostní příjem", "příjem"
**Expense Keywords**: "odchozí platba", "platba kartou", "inkaso", "trvalý příkaz"
**Savings**: "Spořicí konto", "termínovaný vklad", interest: "přípis úroku"
**CSV**: `;` delimited, Windows-1250/UTF-8, columns: `Datum pohybu;Datum valutace;Název operace;Číslo protiúčtu;Název protiúčtu;VS;KS;SS;Zpráva pro příjemce;Částka;Měna`
**Parsing Notes**: VS/KS/SS may be separate columns OR combined with "VS:", "KS:", "SS:" prefixes. Clean table structure.

---

### CZ-4. Moneta Money Bank — ~1M customers

**Status**: NOT YET IMPLEMENTED — MEDIUM PRIORITY

**Detection Keywords**: `"moneta"`, `"moneta money bank"`, `"ge money"`, `"AGBACZPP"`, `"smart banka"`

**PDF Structure**:
- Header: "MONETA Money Bank, a.s." (formerly GE Money Bank, rebranded 2016)

| Column | Name | Format |
|--------|------|--------|
| 1 | Datum | dd.mm.yyyy |
| 2 | Valuta | dd.mm.yyyy |
| 3 | Typ operace | text |
| 4 | Popis | text |
| 5 | Protiúčet | account |
| 6 | VS / KS / SS | digits |
| 7 | Částka | -1 234,56 CZK |

**Amount**: `-1 234,56 CZK`. Some versions use separate Příjem/Výdaj columns instead of signed amounts.
**Income Detection**: Sign-based OR column-based. Keywords: "příjem", "vklad"
**Savings**: "Spořicí účet MONETA", interest entries
**CSV**: `;` delimited, columns: Datum, Částka, Měna, Protiúčet, Popis, VS, KS, SS, Typ
**Parsing Notes**: May have separate income/expense columns in some versions. Rebrand from "GE Money" — detect both names.

---

### CZ-5. Raiffeisenbank CZ — ~800-900K customers

**Status**: ✅ IMPLEMENTED — `parsers/raiffeisen.py`

**Detection Keywords**: `"raiffeisenbank"`, `"raiffeisen"`

**Format**: Multi-line block (2-4 lines per transaction):
- Line 1: Date + Category + Amount + CZK
- Line 2: Value date + Account + [foreign amount]
- Line 3: Transaction code + Name + [exchange rate]
- Line 4: [foreign detail: amount;merchant;location;country]

**Regex**: `(\d{1,2}\.\s?\d{1,2}\.\s?\d{4})\s+(.+?)\s+(-?[\d\s]+[,.]\d{2})\s*(?:CZK|Kč)\s*$`
**Foreign Currency**: CZK as main, original foreign amount on line 2/4, exchange rate on line 3

---

### CZ-6. UniCredit Bank CZ — ~300-400K customers

**Status**: NOT YET IMPLEMENTED — LOWER PRIORITY

**Detection Keywords**: `"unicredit"`, `"BACXCZPP"`, `"unicredit bank"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Datum | dd.mm.yyyy |
| 2 | Valuta | dd.mm.yyyy |
| 3 | Typ transakce | text |
| 4 | Popis | text |
| 5 | Číslo protiúčtu | account |
| 6 | Název protiúčtu | name |
| 7 | VS / KS / SS | digits |
| 8 | Částka | -1 234,56 |
| 9 | Měna | CZK |

**Amount**: `-1 234,56` with currency in separate column
**Income Detection**: Sign-based, standard Czech keywords
**CSV**: `;` delimited, Windows-1250
**Parsing Notes**: Standard format. Corporate vs personal layouts differ.

---

### CZ-7. Fio banka — ~1.1-1.2M customers

**Status**: ✅ IMPLEMENTED — `parsers/fio.py`

**Detection Keywords**: `"fio banka"`, `"fiobanka"`, `"fio.cz"`

**Format**: Well-structured tables with clear columns:
- Datum, Objem/Částka, Měna, Protiúčet, Typ, Zpráva pro příjemce
- Date format: `d.m.yyyy` or `dd.mm.yyyy` (1 or 2 digit day/month)
- Income types: "příjem", "bezhotovostní příjem", "vklad"
- Fio has a FREE API for programmatic transaction access

---

### CZ-8. Air Bank — ~900K-1M customers

**Status**: NOT YET IMPLEMENTED — MEDIUM PRIORITY

**Detection Keywords**: `"air bank"`, `"airbank"`, `"AIRACZPP"`

**PDF Structure** (clean, modern design):
| Column | Name | Format |
|--------|------|--------|
| 1 | Datum | dd.mm.yyyy |
| 2 | Popis | text |
| 3 | Částka | -1 234,56 Kč |
| 4 | Zůstatek | balance |

**Amount**: `-1 234,56 Kč` — uses "Kč" not "CZK"
**Income Detection**: Sign-based. Keywords: "příchozí platba", "vklad", "úrok"
**Savings**: Prominent interest rate display, "přípis úroku"
**CSV**: `;` delimited, columns: Datum, Popis, Protiúčet, VS, KS, SS, Částka, Měna
**Parsing Notes**: Simplest format among Czech banks — fewer columns, digital-first design. VS/KS/SS embedded in description or secondary detail line.

---

### CZ-9. mBank CZ — ~600-700K customers

**Status**: NOT YET IMPLEMENTED — MEDIUM PRIORITY

**Detection Keywords**: `"mbank"`, `"mBank"`, `"BREXCZPP"`, `"mbank.cz"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Datum operace | dd.mm.yyyy |
| 2 | Datum zaúčtování | dd.mm.yyyy |
| 3 | Popis operace | text |
| 4 | Číslo protiúčtu | account |
| 5 | Název protiúčtu | name |
| 6 | VS / KS / SS | digits |
| 7 | Částka | -1 234,56 CZK |
| 8 | Zůstatek po operaci | balance |

**Amount**: `-1 234,56 CZK`
**Income Detection**: Sign-based. Keywords: "příchozí převod", "příjem"
**Savings**: "eMax" / "mSpoření" accounts
**CSV**: `;` delimited, columns: `Datum operace;Datum zaúčtování;Popis operace;Číslo účtu protistrany;Jméno protistrany;VS;KS;SS;Částka operace;Měna;Částka v měně účtu;Měna účtu`
**Parsing Notes**: Polish parent (mBank S.A.) — slightly different formatting. Two date columns (use "Datum operace"). Running balance column must not be confused with amount.

---

### CZ-10. Creditas — ~300-400K customers

**Status**: NOT YET IMPLEMENTED — LOWER PRIORITY

**Detection Keywords**: `"creditas"`, `"banka creditas"`, `"CTASCZ22"`, `"moravský peněžní"`

**PDF Structure**: Standard Czech format
| Column | Name | Format |
|--------|------|--------|
| 1 | Datum | dd.mm.yyyy |
| 2 | Valuta | dd.mm.yyyy |
| 3 | Popis | text |
| 4 | Protiúčet | account |
| 5 | VS / KS / SS | digits |
| 6 | Částka | -1 234,56 CZK |
| 7 | Měna | CZK |

**Savings**: Known for competitive savings rates. Interest: "úrok", tax withholding: "srážená daň z úroku"
**Parsing Notes**: Smaller bank, simpler PDFs. Former name "Moravský peněžní ústav" — detect both.

---

## UNITED KINGDOM — 5 Banks

### UK-1. Barclays — ~24M customers

**Detection Keywords**: `"barclays"`, `"barclays bank"`, `"barclays.co.uk"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Date | DD Mon YYYY (e.g., "15 Jan 2025") |
| 2 | Description | multi-line text |
| 3 | Money out | amount (debit) |
| 4 | Money in | amount (credit) |
| 5 | Balance | running balance |

**Amount**: `1,234.56` (dot decimal, comma thousands, GBP). No sign — column position determines debit/credit.
**Income Detection**: Column-based (Money In vs Money Out)
**CSV**: `,` delimited, UTF-8, columns: `Date,Description,Amount,Balance` or `Number,Date,Account,Amount,Subcategory,Memo`
**Savings**: Same layout, operations: "Interest Paid", "Transfer In/Out"
**Parsing Notes**: Multi-line descriptions. "Money out"/"Money in" two-column approach. Date format "DD Mon YYYY" requires custom format string `%d %b %Y`.

---

### UK-2. HSBC UK — ~15M customers

**Detection Keywords**: `"hsbc"`, `"hsbc uk"`, `"hsbc bank"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Date | DD Mon YY (e.g., "15 Jan 25") |
| 2 | Type | "VIS" (Visa), "DD" (Direct Debit), "FPO" (Faster Payment Out), etc. |
| 3 | Description | text |
| 4 | Paid out | debit amount |
| 5 | Paid in | credit amount |
| 6 | Balance | running balance |

**Amount**: `1,234.56` GBP (dot decimal)
**Income Detection**: "Paid in" column. Keywords: "FPI" (Faster Payment In), "CR" (credit), "INT" (interest)
**CSV**: `,` delimited, columns: `Date,Description,Amount`
**Savings**: Same structure, limited ops: interest, transfers
**Parsing Notes**: 2-digit year format. Transaction type codes (VIS, DD, FPO, BGC, etc.) are useful for categorization. Type code column is compact.

---

### UK-3. Lloyds Bank — ~26M customers

**Detection Keywords**: `"lloyds"`, `"lloyds bank"`, `"lloyds banking group"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Date | DD Mon YY |
| 2 | Payment type | "DD", "VIS", "FPO", "BGC", etc. |
| 3 | Description | text |
| 4 | Paid out | debit |
| 5 | Paid in | credit |
| 6 | Balance | running balance |

**Amount**: `£1,234.56` — pound sign may appear in PDF but not in CSV
**Income Detection**: Column-based. Keywords: "BGC" (bank giro credit), "FPI", "interest"
**CSV**: `,` delimited, columns: `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance`
**Parsing Notes**: Very similar to HSBC format. Debit/Credit as separate CSV columns. Halifax (subsidiary) uses same format.

---

### UK-4. NatWest — ~19M customers

**Detection Keywords**: `"natwest"`, `"national westminster"`, `"natwest group"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Date | DD Mon YYYY |
| 2 | Description | text |
| 3 | Type | "D/D", "POS", "FPO", "BGC", etc. |
| 4 | In | credit |
| 5 | Out | debit |
| 6 | Balance | running balance |

**Amount**: `1,234.56` GBP
**Income Detection**: "In" column
**CSV**: `,` delimited, columns: `Date,Type,Description,Value,Balance,Account Name,Account Number`
**Savings**: ISA statements — simpler format
**Parsing Notes**: "In" and "Out" columns may be reversed compared to other UK banks. Value column is signed in CSV (negative = out).

---

### UK-5. Monzo — ~9M customers

**Detection Keywords**: `"monzo"`, `"monzo bank"`

**PDF Structure** (minimal — Monzo is primarily app-based):
- Simple list format, clean design
- Date, Description, Amount, Balance

**Amount**: `1,234.56` GBP, signed in CSV (negative = expense)
**CSV** (best export among UK banks):
`,` delimited, UTF-8, columns: `Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency,Local amount,Local currency,Notes and #tags,Address,Receipt,Description,Category split,Money Out,Money In`
**Parsing Notes**: Richest CSV format of any bank. Includes category, emoji, local currency for foreign transactions. App-first: PDF statements are rare. Date: `DD/MM/YYYY`.

---

## GERMANY — 5 Banks

### DE-1. Deutsche Bank / Postbank — ~19M customers

**Detection Keywords**: `"deutsche bank"`, `"postbank"`, `"deutsche-bank.de"`

**PDF Structure** (Kontoauszug):
| Column | Name | Format |
|--------|------|--------|
| 1 | Buchungstag | DD.MM.YYYY (posting date) |
| 2 | Wert | DD.MM.YYYY (value date) |
| 3 | Umsatzart | text (transaction type) |
| 4 | Buchungsdetails | multi-line text |
| 5 | Soll (EUR) | debit amount |
| 6 | Haben (EUR) | credit amount |
| 7 | Saldo (EUR) | balance |

**Amount**: `1.234,56` (dot thousands, comma decimal)
**Income Detection**: "Haben" column. Keywords: "Gutschrift" (credit), "Gehalt" (salary), "Überweisung" (transfer in)
**Expense Keywords**: "Lastschrift" (direct debit), "Kartenzahlung" (card payment), "Überweisung" (transfer out — contextual)
**CSV**: `;` delimited, ISO-8859-1, columns: `Buchungstag;Wertstellung;Umsatzart;Buchungsdetails;Auftraggeber / Begünstigter;Kontonummer;BLZ;Betrag (EUR);Gläubiger-ID;Mandatsreferenz;Kundenreferenz`
**Savings**: "Sparkonto" — interest: "Zinsgutschrift"
**Parsing Notes**: Multi-line "Buchungsdetails" (SEPA Verwendungszweck) can span 4+ lines. Postbank has slightly different layout. Amount in CSV is signed.

---

### DE-2. Commerzbank — ~11M customers

**Detection Keywords**: `"commerzbank"`, `"commerzbank ag"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Buchungstag | DD.MM.YYYY |
| 2 | Wertstellung | DD.MM.YYYY |
| 3 | Vorgang | transaction type |
| 4 | Buchungstext | description (multi-line) |
| 5 | Umsatz in EUR | signed amount |

**Amount**: `-1.234,56` (signed, dot thousands, comma decimal)
**Income Detection**: Positive amount. Keywords: "Gutschrift", "Gehalt/Rente" (salary/pension)
**CSV**: `;` delimited, columns: `Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung`
**Parsing Notes**: Single signed column simplifies parsing. SEPA details in multi-line Buchungstext.

---

### DE-3. ING-DiBa (ING Germany) — ~9M customers

**Detection Keywords**: `"ing-diba"`, `"ing.de"`, `"ing diba"`, `"ING-DiBa AG"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Buchung | DD.MM.YYYY |
| 2 | Valuta | DD.MM.YYYY |
| 3 | Auftraggeber/Empfänger | counterparty |
| 4 | Buchungstext | description |
| 5 | Verwendungszweck | purpose/reference |
| 6 | Saldo (EUR) | balance |
| 7 | Betrag (EUR) | signed amount |

**Amount**: `-1.234,56` EUR (signed)
**Income Detection**: Positive = income. Keywords: "Gutschrift", "Gehaltszahlung"
**CSV**: `;` delimited, columns: `Buchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Betrag;Währung;Saldo`
**Savings**: "Extra-Konto" (savings) — "Zinsen" (interest) entries
**Parsing Notes**: Clean format, ING is digital-first. Separate "Verwendungszweck" (purpose) field is useful.

---

### DE-4. DKB (Deutsche Kreditbank) — ~5.5M customers

**Detection Keywords**: `"dkb"`, `"deutsche kreditbank"`, `"dkb.de"`

**PDF Structure**:
| Column | Name | Format |
|--------|------|--------|
| 1 | Buchungstag | DD.MM.YYYY |
| 2 | Wertstellung | DD.MM.YYYY |
| 3 | Buchungstext | description |
| 4 | Auftraggeber/Begünstigter | counterparty |
| 5 | Verwendungszweck | reference |
| 6 | Kontonummer | account number |
| 7 | BLZ | bank code |
| 8 | Betrag (EUR) | signed amount |
| 9 | Gläubiger-ID | creditor ID |
| 10 | Mandatsreferenz | mandate ref |
| 11 | Kundenreferenz | customer ref |

**Amount**: `-1.234,56` EUR
**CSV**: `;` delimited, ISO-8859-1 or UTF-8, same columns as PDF
**Parsing Notes**: DKB has separate formats for "Girokonto" (checking) and "Visa-Karte" (credit card). Credit card CSV has different columns: `Umsatz abgerechnet und nicht im Saldo enthalten;Wertstellung;Belegdatum;Beschreibung;Betrag (EUR);Ursprünglicher Betrag`

---

### DE-5. Sparkasse (Network) — ~50M customers collectively

**Detection Keywords**: `"sparkasse"`, `"spk"`, `"berliner sparkasse"`, `"hamburger sparkasse"` (many local variants)

**PDF Structure** (Kontoauszug):
| Column | Name | Format |
|--------|------|--------|
| 1 | Buchungstag | DD.MM. (without year!) |
| 2 | Wert | DD.MM. (without year!) |
| 3 | Vorgang / Buchungstext | multi-line text |
| 4 | Soll | debit |
| 5 | Haben | credit |

**Special**: Amounts may have `S` (Soll/debit) or `H` (Haben/credit) suffix: `1.234,56 S` or `1.234,56 H`
**Amount**: `1.234,56` with S/H suffix for debit/credit
**Income Detection**: `H` suffix or "Haben" column. Keywords: "Gutschr.", "GEHALT"
**CSV**: `;` delimited, ISO-8859-1. Format varies by local Sparkasse. Common: `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Glaeubiger ID;Mandatsreferenz;Kundenreferenz (End-to-End);Sammlerreferenz;Lastschrift Ursprungsbetrag;Auslagenersatz Ruecklastschrift;Beguenstigter/Zahlungspflichtiger;Kontonummer/IBAN;BIC (SWIFT-Code);Betrag;Waehrung;Info`
**Parsing Notes**: Most complex German bank to parse. ~370 local institutes with slight variations. Year-less dates in PDF body (infer from header). S/H suffix amounts require special handling. The existing `clean_amount()` needs extension for S/H suffix.

---

## FRANCE — 4 Banks

**Common French conventions**: Date DD/MM/YYYY, amounts `1 234,56` (space thousands, comma decimal), Débit/Crédit two-column approach, CSV `;` delimited, ISO-8859-1 encoding.

**French income keywords**: "crédit", "virement reçu", "remise", "versement", "avoir"
**French expense keywords**: "débit", "virement émis", "prélèvement", "retrait", "paiement carte", "chèque"

### FR-1. BNP Paribas — ~7M retail customers

**Detection Keywords**: `"bnp paribas"`, `"bnpp"`, `"mabanque.bnpparibas"`

**PDF Columns**: Date | Date valeur | Nature de l'opération | Débit | Crédit
**Amount**: `1 234,56` — no sign, column determines direction
**CSV**: `;` delimited, ISO-8859-1, columns: `Date opération;Date valeur;Libellé;Montant;Devise`
**Savings**: Livret A, LDD — "Intérêts" (interest), "Prélèvement forfaitaire" (tax)
**Parsing Notes**: Multi-line descriptions. Fee summary section. Card payments grouped under "FACTURETTE CARTE".

### FR-2. Crédit Agricole — ~25M retail customers

**Detection Keywords**: `"crédit agricole"`, `"credit agricole"`, `"caisse régionale de crédit agricole"`

**PDF Columns**: Date | Libellé de l'opération | Valeur (DD/MM short!) | Débit | Crédit
**CSV**: `;` delimited, ISO-8859-1, columns: `Date;Libellé;Débit;Crédit` or `Date;Date de valeur;Libellé;Montant`
**Parsing Notes**: BIGGEST CHALLENGE — regional federation with ~39 regional banks, each with slight layout variations. Value date uses short DD/MM format (no year). Card payments: "CARTE DD/MM" with merchant on next line.

### FR-3. Société Générale — ~10M retail customers

**Detection Keywords**: `"société générale"`, `"societe generale"`, `"sg "`

**PDF Columns**: Date (DD/MM short!) | Libellé | Date de valeur | Montant en euros (signed) — OR — Date | Nature et détails | Débit | Crédit
**CSV**: `;` delimited, ISO-8859-1, columns: `Date de l'opération;Libellé simplifié;Libellé de l'opération;Montant de l'opération;Devise`
**Parsing Notes**: Short date DD/MM without year — year from statement period. Two variant formats (signed single column vs debit/credit split).

### FR-4. La Banque Postale — ~10M retail customers

**Detection Keywords**: `"la banque postale"`, `"banque postale"`, `"CCP"`, `"compte chèque postal"`

**PDF Columns**: Date | Libellé des opérations | Débit en euros | Crédit en euros
**CSV**: `;` delimited, columns: `Date comptable;Date opération;Libellé;Référence;Montant(EUROS)`
**Parsing Notes**: Older CCP vs newer format — two layouts. Long reference numbers in descriptions. Marketing content mixed with data.

---

## SPAIN — 4 Banks

**Common Spanish conventions**: Date DD/MM/YYYY, amounts `1.234,56` (dot thousands, comma decimal), signed Importe or Debe/Haber columns, CSV `;` delimited.

**Spanish income keywords**: "haber", "abono", "ingreso", "transferencia recibida", "nómina", "intereses"
**Spanish expense keywords**: "debe", "cargo", "adeudo", "transferencia emitida", "recibo", "pago con tarjeta", "bizum"

### ES-1. CaixaBank — ~20M customers

**Detection Keywords**: `"caixabank"`, `"la caixa"`, `"bankia"` (legacy)

**PDF Columns**: Fecha | Fecha valor | Concepto | Importe (signed) | Saldo
**Amount**: `-1.234,56` (signed, dot thousands)
**CSV**: `;` delimited, columns: `Fecha;Fecha valor;Concepto;Movimiento;Importe;Saldo;Referencia 1;Referencia 2`
**Parsing Notes**: Merged CaixaBank + Bankia — detect both names. "Concepto" has coded operation types.

### ES-2. Banco Santander — ~17M customers (Spain)

**Detection Keywords**: `"banco santander"`, `"santander"`, `"santander.es"`

**PDF Columns**: Fecha | Fecha valor | Concepto | Detalle del movimiento | Importe (signed) | Saldo
**CSV**: `;` delimited, columns: `Fecha operación;Fecha valor;Concepto;Descripción;Importe (EUR);Saldo (EUR)`
**Parsing Notes**: Concept codes (2-3 digit numeric) precede description. Card transactions: "TARJETA *XXXX".

### ES-3. BBVA — ~14M customers

**Detection Keywords**: `"bbva"`, `"bbva.es"`, `"banco bilbao vizcaya argentaria"`

**PDF Columns**: Fecha | Fecha valor | Concepto | Importe (EUR) (signed) | Saldo (EUR)
**CSV**: `;` delimited, UTF-8, columns: `Fecha;Descripción;Importe;Moneda;Saldo`
**Parsing Notes**: Has PSD2 API (JSON). Dual format: older Cargo/Abono, newer single Importe. "Extracto Integrado" combines checking+card+loan sections.

### ES-4. Banco Sabadell — ~6M customers

**Detection Keywords**: `"banco sabadell"`, `"sabadell"`, `"banco de sabadell"`

**PDF Columns**: Fecha | Fecha valor | Concepto | Debe | Haber | Saldo — or single signed Importe
**CSV**: `;` delimited, columns: `Fecha;Concepto;Importe;Divisa;Saldo`
**Parsing Notes**: Short date DD/MM in some PDFs. Two format variants (Debe/Haber vs signed Importe).

---

## ITALY — 4 Banks

**Common Italian conventions**: Date DD/MM/YYYY, amounts `1.234,56`, Dare/Avere two-column approach (or signed Importo), CSV `;` delimited.

**Italian income keywords**: "avere", "accredito", "bonifico in entrata", "versamento", "stipendio", "interessi"
**Italian expense keywords**: "dare", "addebito", "bonifico in uscita", "prelievo", "pagamento POS", "domiciliazione", "commissione"

### IT-1. Intesa Sanpaolo — ~13.6M customers

**Detection Keywords**: `"intesa sanpaolo"`, `"intesasanpaolo"`, `"banca intesa"`

**PDF Columns**: Data operazione | Data valuta | Descrizione | Dare | Avere — or scalare format: Valuta | Descrizione | Importo (signed) | Saldo
**CSV**: `;` delimited, columns: `Data contabile;Data valuta;Descrizione;Accrediti;Addebiti`
**Savings**: "Conto deposito" — "liquidazione interessi", "ritenuta fiscale" (26% tax)
**Parsing Notes**: Three layout variants (per valuta, scalare, lista movimenti). Multi-line SEPA references. ABI causale codes.

### IT-2. UniCredit (Italy) — ~8.5M customers

**Detection Keywords**: `"unicredit"`, `"unicredit s.p.a."`, `"unicredit.it"` (NOTE: conflicts with CZ UniCredit — detect by country context)

**PDF Columns**: Data | Valuta | Descrizione operazione | Importo (signed) | Saldo — or Dare/Avere split
**CSV**: `;` delimited, columns: `Data;Data Valuta;Descrizione;Importo;Divisa`
**Parsing Notes**: Operates across IT/DE/AT/CEE — Italian format differs from CZ/AT. ABI causale codes. CBI XML format for business.

### IT-3. Banco BPM — ~4M customers

**Detection Keywords**: `"banco bpm"`, `"banca popolare di milano"`, `"banco popolare"`, `"bancobpm"`

**PDF Columns**: Data | Data valuta | Causale | Descrizione | Dare | Avere
**CSV**: `;` delimited, columns: `Data;Data Valuta;Causale;Descrizione;Importo;Divisa`
**Parsing Notes**: Merger legacy names. ABI causale codes. No grid lines — spacing-based columns harder for pdfplumber.

### IT-4. BPER Banca — ~5M customers

**Detection Keywords**: `"bper banca"`, `"bper"`, `"banca popolare dell'emilia romagna"`, `"unipol banca"` (legacy)

**PDF Columns**: Data operazione | Data valuta | Descrizione | Segno (D/A) | Importo | Saldo
**UNIQUE**: "Segno" column — `D` = dare/debit, `A` = avere/credit. Amounts are UNSIGNED.
**CSV**: `;` delimited, columns: `Data Operazione;Data Valuta;Descrizione;Importo;Divisa` (signed in CSV)
**Parsing Notes**: Segno (D/A) column is unique — must parse sign indicator separately. Absorbed several banks.

---

## NETHERLANDS — 3 Banks

**Common Dutch conventions**: Date DD-MM-YYYY or YYYYMMDD, amounts `1.234,56`, Af/Bij columns (debit/credit), CSV `;` or `,` delimited, MT940 support common.

**Dutch keywords**: "Af" (debit), "Bij" (credit), "Overschrijving" (transfer), "Betaalautomaat" (POS), "Geldautomaat" (ATM)

### NL-1. ING Bank (Netherlands) — ~8M customers

**Detection Keywords**: `"ing bank"`, `"ing.nl"`, `"ING Bank N.V."`

**PDF Columns**: Datum | Naam/Omschrijving | Rekening | Af/Bij | Bedrag (EUR) | Mutatiesoort | Mededelingen
**Amount**: `1.234,56` with "Af"/"Bij" indicator
**CSV**: `;` delimited, columns: `Datum;Naam / Omschrijving;Rekening;Tegenrekening;Code;Af Bij;Bedrag (EUR);Mutatiesoort;Mededelingen`
**MT940**: Supported for business accounts
**Parsing Notes**: "Af Bij" column values: "Af" (debit) or "Bij" (credit). CSV has separate "Af Bij" column + unsigned amount. IBAN in "Tegenrekening". NOTE: Different from ING Germany — detect by "N.V." or ".nl".

### NL-2. Rabobank — ~6.5M customers

**Detection Keywords**: `"rabobank"`, `"rabobank.nl"` (NOTE: different from Raiffeisen CZ/CH/AT)

**PDF Columns**: Datum | Omschrijving | Af | Bij | Saldo
**Amount**: Two columns Af/Bij, unsigned amounts
**CSV**: `,` delimited (unusual for NL!), columns: `IBAN/BBAN,Munt,BIC,Volgnr,Datum,Rentedatum,Bedrag,Saldo na trn,Tegenrekening IBAN/BBAN,Naam tegenpartij,Naam uiteindelijke partij,Naam initierende partij,BIC tegenpartij,Code,Batch ID,Transactiereferentie,Machtigingskenmerk,Incassant ID,Betalingskenmerk,Omschrijving-1,Omschrijving-2,Omschrijving-3,Reden retour,Oorspr bedrag,Oorspr munt,Koers`
**Parsing Notes**: Very detailed CSV with 27+ columns. Comma-delimited (not semicolon). "Bedrag" is signed.

### NL-3. ABN AMRO — ~5M customers

**Detection Keywords**: `"abn amro"`, `"abn"`, `"abnamro"`

**PDF Columns**: Datum | Omschrijving | Af | Bij | Saldo
**Amount**: Two columns Af/Bij
**CSV**: Tab-delimited (`.tab` extension), columns: `Rekeningnummer\tMuntsoort\tTransactiedatum\tRentedatum\tBeginsaldo\tEindsaldo\tTransactiebedrag\tOmschrijving`
**MT940**: Widely supported
**Parsing Notes**: Tab-delimited CSV is unusual. "Transactiebedrag" is signed. Date: YYYYMMDD format in CSV.

---

## POLAND — 3 Banks

**Common Polish conventions**: Date DD.MM.YYYY, amounts `1 234,56` (space thousands, comma decimal), CSV `;` delimited, Windows-1250 encoding.

**Polish keywords**: "Uznanie" (credit), "Obciążenie" (debit), "Przelew przychodzący" (incoming transfer), "Przelew wychodzący" (outgoing transfer), "Wypłata" (withdrawal), "Wpłata" (deposit)

### PL-1. PKO Bank Polski — ~11M customers

**Detection Keywords**: `"pko"`, `"pko bank polski"`, `"pko bp"`, `"ipko"`

**PDF Columns**: Data operacji | Data waluty | Opis operacji | Kwota (PLN) | Saldo po operacji
**Amount**: `-1 234,56 PLN` (signed, space thousands)
**CSV**: `;` delimited, Windows-1250, columns: `Data operacji;Data waluty;Typ transakcji;Kwota;Waluta;Saldo po transakcji;Opis transakcji;...`
**Parsing Notes**: Description can be 3+ lines with SEPA details. Currency PLN for domestic.

### PL-2. Bank Pekao — ~5.7M customers

**Detection Keywords**: `"pekao"`, `"bank pekao"`, `"pekao24"`

**PDF Columns**: Data | Data waluty | Opis | Obciążenie | Uznanie | Saldo
**Amount**: Two-column Obciążenie/Uznanie (debit/credit)
**CSV**: `;` delimited, columns: `Data księgowania;Data waluty;Nadawca / Odbiorca;Opis operacji;Nr rachunku;Kwota;Saldo;...`

### PL-3. mBank (Poland) — ~5.8M customers

**Detection Keywords**: `"mbank"`, `"mbank.pl"`, `"mbank s.a."` (NOTE: distinguish from mBank CZ by BIC/URL)

**PDF Columns**: Data operacji | Data księgowania | Opis operacji | Kwota | Saldo
**Amount**: `-1 234,56 PLN` (signed)
**CSV**: `;` delimited, columns: `#Data operacji;#Opis operacji;#Rachunek;#Kategoria;#Kwota;#Saldo po operacji`
**Parsing Notes**: Hash prefix on CSV column names. Category field in CSV is useful.

---

## SWITZERLAND — 3 Banks

**Common Swiss conventions**: Date DD.MM.YYYY, amounts use APOSTROPHE as thousands separator: `1'234.56` (dot decimal!), CSV `;` delimited, multi-language (DE/FR/IT).

### CH-1. UBS — ~3.5M Swiss customers

**Detection Keywords**: `"ubs"`, `"ubs ag"`, `"ubs switzerland"`

**PDF Columns**: Buchungsdatum | Text | Belastung (CHF) | Gutschrift (CHF) | Valuta | Saldo
**Amount**: `1'234.56` CHF (apostrophe thousands, DOT decimal) — Belastung/Gutschrift columns
**CSV**: `;` delimited, UTF-8, columns: `Abschlussdatum;Buchungsdatum;Valuta;Beschreibung;Belastung;Gutschrift;Saldo`
**Parsing Notes**: Swiss franc format with apostrophe thousands. Multi-language.

### CH-2. Raiffeisen Switzerland — ~3.5M customers

**Detection Keywords**: `"raiffeisen schweiz"`, `"raiffeisen suisse"` (NOTE: must not conflict with CZ Raiffeisen)

**PDF Columns**: Datum | Text | Belastung | Gutschrift | Valuta | Saldo
**Amount**: `1'234.56` CHF — same Swiss format
**Parsing Notes**: Same name root as CZ Raiffeisen — need country detection logic (CHF currency, Swiss IBAN CH...).

### CH-3. PostFinance — ~2.5M customers

**Detection Keywords**: `"postfinance"`, `"postfinance ag"`

**PDF Columns**: Datum | Buchungstext | Gutschrift (CHF) | Lastschrift (CHF) | Valuta | Saldo
**CSV**: `;` delimited, columns: `Buchungsdatum;Avisierungstext;Gutschrift in CHF;Lastschrift in CHF;Valuta;Saldo in CHF`
**Parsing Notes**: "Lastschrift" instead of "Belastung". Swiss apostrophe format.

---

## AUSTRIA — 2 Banks

**Common Austrian conventions**: Date DD.MM.YYYY, amounts `1.234,56` (dot thousands, comma decimal — different from CH!), CSV `;` delimited.

### AT-1. Erste Bank und Sparkassen — ~3.7M customers

**Detection Keywords**: `"erste bank"`, `"sparkasse"` (with AT context), `"george.at"`

**PDF Columns**: Buchungsdatum | Valuta | Buchungstext | Betrag (EUR) | Saldo
**Amount**: `-1.234,56 EUR` (signed, dot thousands, comma decimal)
**CSV**: `;` delimited, columns: `IBAN;Buchungsdatum;Valutadatum;Buchungstext;Zahlungsgrund;Empfänger/Auftraggeber;Betrag;Währung`
**Parsing Notes**: George platform (same as Česká spořitelna). Similar format but EUR and German language.

### AT-2. Raiffeisen Bank International (Austria) — ~3.5M customers

**Detection Keywords**: `"raiffeisen"` (with AT context), `"mein elba"`, `"raiffeisen.at"`

**PDF Columns**: Buchungsdatum | Wertstellung | Umsatztext | Betrag | Saldo
**Amount**: `-1.234,56 EUR`
**Parsing Notes**: Same Raiffeisen brand as CZ but different format. Detect by "EUR" currency, Austrian IBAN "AT...", or ".at" domain.

---

## SWEDEN — 3 Banks

**Common Nordic conventions**: Date YYYY-MM-DD (ISO format), amounts vary by bank, CSV `;` or `,` delimited.

**Swedish keywords**: "Insättning" (deposit), "Uttag" (withdrawal), "Överföring" (transfer), "Kortköp" (card purchase), "Ränta" (interest)

### SE-1. Swedbank — ~7M customers

**Detection Keywords**: `"swedbank"`, `"swedbank ab"`

**PDF/CSV Columns**: Transaktionsdatum | Text | Belopp (SEK) | Saldo
**Amount**: `-1 234,56` SEK (signed, space thousands, comma decimal)
**CSV**: `;` delimited, columns: `Kontonummer;Transaktionsdag;Text;Belopp;Saldo`

### SE-2. SEB — ~4M customers

**Detection Keywords**: `"seb"`, `"skandinaviska enskilda"`, `"seb.se"`

**PDF/CSV Columns**: Bokföringsdatum | Valutadag | Text | Belopp | Saldo
**Amount**: `-1 234,56` SEK (signed)
**CSV**: `;` delimited, columns: `Bokföringsdatum;Valutadag;Verifikationsnummer;Text;Belopp;Saldo`

### SE-3. Handelsbanken — ~2.5M customers

**Detection Keywords**: `"handelsbanken"`, `"shb.se"`

**PDF/CSV Columns**: Datum | Text | Belopp | Saldo
**Amount**: `-1 234,56` SEK
**CSV**: `;` delimited, columns: `Bokföringsdag;Transaktionstyp;Text;Belopp;Saldo`

---

## NORWAY — 2 Banks

**Norwegian keywords**: "Innskudd" (deposit), "Uttak" (withdrawal), "Overføring" (transfer), "Varekjøp" (purchase), "Rente" (interest)

### NO-1. DNB — ~2.9M customers

**Detection Keywords**: `"dnb"`, `"dnb bank"`, `"dnb.no"`

**PDF/CSV Columns**: Dato | Forklaring | Inn (NOK) | Ut (NOK) | Saldo
**Amount**: Two columns Inn/Ut (credit/debit), `1 234,56`
**CSV**: `;` delimited, columns: `Dato;Forklaring;Rentedato;Ut av konto;Inn på konto`

### NO-2. SpareBank 1 — ~2.5M customers

**Detection Keywords**: `"sparebank 1"`, `"sparebank1"`

**PDF/CSV Columns**: Dato | Tekst | Inn | Ut | Saldo
**Amount**: Two columns Inn/Ut, `1 234,56`
**CSV**: `;` delimited, columns: `Bokføringsdato;Rentedato;Arkivref;Type;Tekst;Ut;Inn;Tilsaldo`

---

## DENMARK — 2 Banks

**Danish keywords**: "Indbetaling" (deposit), "Udbetaling" (withdrawal), "Overførsel" (transfer), "Rente" (interest)

### DK-1. Danske Bank — ~3.3M customers

**Detection Keywords**: `"danske bank"`, `"danskebank"`, `"danske.dk"`

**PDF/CSV Columns**: Dato | Tekst | Beløb (DKK) | Saldo
**Amount**: `-1.234,56` DKK (signed, dot thousands, comma decimal)
**CSV**: `;` delimited, columns: `Dato;Tekst;Beløb;Saldo;Status;Afstemt`

### DK-2. Nordea (Denmark) — ~1.5M customers (DK)

**Detection Keywords**: `"nordea"`, `"nordea.dk"`, `"nordea bank"`

**PDF/CSV Columns**: Dato | Tekst | Beløb | Saldo
**Amount**: `-1.234,56`
**CSV**: `;` delimited, columns: `Bogføringsdato;Beløb;Afsender;Modtager;Navn;Beskrivelse;Saldo`

---

## FINLAND — 2 Banks

**Finnish keywords**: "Pano" (deposit), "Otto" (withdrawal), "Siirto" (transfer), "Korttimaksu" (card payment), "Korko" (interest)

### FI-1. OP Financial Group — ~4.4M customers

**Detection Keywords**: `"op"`, `"osuuspankki"`, `"op.fi"`, `"op financial"`

**PDF/CSV Columns**: Kirjauspäivä | Arvopäivä | Saaja/Maksaja | Selite | Viite | Määrä (EUR) | Saldo
**Amount**: `-1 234,56` EUR (signed, space thousands)
**CSV**: `;` delimited, columns: `Kirjauspäivä;Arvopäivä;Määrä;Laji;Selite;Saaja/Maksaja;Saajan tilinumero;Viite;Viesti;Arkistointitunnus`

### FI-2. Nordea (Finland) — ~2.8M customers

**Detection Keywords**: `"nordea"` (with FI context), `"nordea.fi"`

**PDF/CSV Columns**: Kirjauspäivä | Arvopäivä | Maksupäivä | Määrä | Saaja/Maksaja | Selitys | Saldo
**CSV**: `;` delimited, columns: `Kirjauspäivä;Arvopäivä;Maksupäivä;Määrä;Saaja/Maksaja;Tilinumero;BIC;Tapahtuma;Viite;Maksajan viite;Viesti;Kortinnumero;Kuitti;Arkistointitunnus`

---

## BELGIUM — 2 Banks

**Belgian keywords**: "Credit"/"Crédit" (credit), "Debet"/"Débit" (debit), "Overschrijving"/"Virement" (transfer)

### BE-1. KBC Bank — ~3.5M customers

**Detection Keywords**: `"kbc"`, `"kbc bank"`, `"kbc.be"`

**PDF Columns**: Datum | Omschrijving | Bedrag (EUR) | Saldo
**Amount**: `-1.234,56` EUR (signed, dot thousands — follows Belgian Dutch convention)
**CSV**: `;` delimited, columns: `Rekeningnummer;Rubrieknaam;Naam;Munt;Afschriftnummer;Datum;Omschrijving;Valuta;Bedrag;Saldo;Credit;Debet;rpicount;Transactiereferentie;Mededeling`

### BE-2. BNP Paribas Fortis — ~3.5M customers

**Detection Keywords**: `"bnp paribas fortis"`, `"fortis"`, `"bnpparibasfortis.be"`

**PDF Columns**: Date | Communication | Montant (EUR) | Solde
**Amount**: `-1.234,56` EUR
**CSV**: `;` delimited, columns: `Numéro de séquence;Date d'exécution;Date valeur;Montant;Devise;Contrepartie;Détails;Numéro de compte`
**Parsing Notes**: French/Dutch bilingual — statements in user's language choice.

---

## PORTUGAL — 2 Banks

**Portuguese keywords**: "Crédito" (credit), "Débito" (debit), "Transferência" (transfer), "Juros" (interest)

### PT-1. Caixa Geral de Depósitos — ~4.5M customers

**Detection Keywords**: `"caixa geral"`, `"cgd"`, `"caixadirecta"`

**PDF Columns**: Data | Data valor | Descrição | Débito | Crédito | Saldo
**Amount**: Two columns Débito/Crédito, `1.234,56` EUR
**CSV**: `;` delimited, columns: `Data Mov.;Data Valor;Descrição do Movimento;Débito;Crédito;Saldo Contabilístico;Saldo Disponível;Categoria`

### PT-2. Millennium BCP — ~2.5M customers

**Detection Keywords**: `"millennium bcp"`, `"bcp"`, `"millenniumbcp"`

**PDF Columns**: Data | Descrição | Valor | Saldo
**Amount**: `-1.234,56` EUR (signed) or Débito/Crédito columns
**CSV**: `;` delimited, columns: `Data mov.;Data valor;Descrição;Débito;Crédito;Saldo`

---

## IRELAND — 2 Banks

**IMPORTANT**: Ireland uses English dot-decimal format `1,234.56` despite being in the Eurozone. This is a parsing trap.

### IE-1. Bank of Ireland — ~2.2M customers

**Detection Keywords**: `"bank of ireland"`, `"boi"`, `"bankofireland"`

**PDF Columns**: Date | Details | Debit | Credit | Balance
**Amount**: `1,234.56` EUR (dot decimal, comma thousands — English format with EUR!)
**CSV**: `,` delimited, columns: `Date,Details,Debit,Credit,Balance`

### IE-2. AIB — ~3M customers

**Detection Keywords**: `"aib"`, `"allied irish"`, `"aib.ie"`

**PDF Columns**: Date | Description | Debit | Credit | Balance
**Amount**: `1,234.56` EUR (English format)
**CSV**: `,` delimited, columns: `Posted Account,Posted Transactions Date,Description1,Description2,Description3,Debit Amount,Credit Amount,Balance,Transaction Type`

---

## ROMANIA — 1 Bank

### RO-1. Banca Transilvania — ~3.5M customers

**Detection Keywords**: `"banca transilvania"`, `"bt.ro"`, `"bancatransilvania"`

**PDF Columns**: Data | Data valutei | Descriere | Debit | Credit | Sold
**Amount**: Two columns Debit/Credit, `1.234,56` RON
**Date**: DD.MM.YYYY
**CSV**: `;` delimited, columns: `Data;Descriere tranzactie;Referinta;Debit;Credit;Sold`
**Keywords**: "Încasare" (income), "Plată" (payment), "Dobândă" (interest)

---

## HUNGARY — 1 Bank

### HU-1. OTP Bank — ~5M customers

**Detection Keywords**: `"otp"`, `"otp bank"`, `"otpbank"`, `"otp.hu"`

**PDF Columns**: Értéknap | Könyvelés napja | Típus | Közlemény | Összeg (HUF) | Egyenleg
**Amount**: `-1 234 567 Ft` (signed, space thousands, NO decimals for HUF, Ft suffix)
**Date**: YYYY.MM.DD (Hungarian format)
**CSV**: `;` delimited, columns: `Könyvelés dátuma;Értéknap;Típus;Összeg;Pénznem;Egyenleg`
**Special**: HUF has no decimal places (integer amounts). "Ft" suffix instead of "HUF" in some PDFs.
**Keywords**: "Jóváírás" (credit), "Terhelés" (debit), "Átutalás" (transfer), "Kamat" (interest)

---

## PAN-EUROPEAN DIGITAL BANKS

### Revolut — ✅ IMPLEMENTED (`parsers/revolut.py`)
- Date: "Mon DD, YYYY" (e.g., "Dec 13, 2025")
- Regex: `^([A-Z][a-z]{2}\s\d{1,2},\s\d{4})\s+(.*?)\s+([\d,.]+)\s+([A-Z]{3})`
- Multi-currency native

### N26 (Not in top 50 but common)
**Detection Keywords**: `"n26"`, `"n26 bank"`, `"n26.com"`
**CSV**: `,` delimited, UTF-8, columns: `Date,Payee,Account number,Transaction type,Payment reference,Amount (EUR),Amount (Foreign Currency),Type Foreign Currency,Exchange Rate`
**Date**: YYYY-MM-DD (ISO format)
**Amount**: Signed, dot decimal

### Wise (TransferWise) (Not in top 50 but common)
**Detection Keywords**: `"wise"`, `"transferwise"`
**CSV**: `,` delimited, UTF-8, columns: `TransferWise ID,Date,Amount,Currency,Description,Payment Reference,Running Balance,Exchange From,Exchange To,Buy - Loss,Exchange Rate,Payer Name,Payee Name,Payee Account Number,Merchant,Total fees`
**Date**: DD-MM-YYYY
**Amount**: Signed, dot decimal

---

## Implementation Strategy

### Priority Tiers

**Tier 1 — Czech Banks (Highest Priority)**:
1. Česká spořitelna — 4.5M customers, clean tables
2. ČSOB — 3.5M customers, block format
3. Komerční banka — 1.6M customers, strong tables

**Tier 2 — Czech + Major European**:
4. Air Bank CZ — 1M customers, simplest format
5. Moneta Money Bank CZ — 1M customers
6. mBank CZ — 700K customers
7. Deutsche Bank/Postbank — 19M DE customers
8. Sparkasse — 50M DE customers (complex!)

**Tier 3 — Large European Banks**:
9. Barclays, HSBC, Lloyds (UK pattern)
10. BNP Paribas, Crédit Agricole (French pattern)
11. CaixaBank, Santander, BBVA (Spanish pattern)
12. Intesa Sanpaolo, UniCredit IT (Italian pattern)
13. ING NL, Rabobank, ABN AMRO (Dutch pattern)
14. PKO BP, Pekao (Polish pattern)

**Tier 4 — Remaining European**:
15. Nordic banks (Swedbank, SEB, DNB, Danske, OP, Nordea)
16. Swiss banks (UBS, Raiffeisen CH, PostFinance)
17. Austrian banks (Erste AT, Raiffeisen AT)
18. Belgian, Portuguese, Irish, Romanian, Hungarian banks

### Architecture Recommendations

1. **Create `CzechBankParser` intermediate class** between BaseParser and CZ bank parsers — shared Czech income/expense keywords, payment symbol extraction, common skip prefixes

2. **Extend `BaseParser.clean_amount()`** to handle:
   - Swiss apostrophe format: `1'234.56`
   - German/Spanish/Italian dot-thousands: `1.234,56`
   - Hungarian no-decimal: `1 234 567`
   - Sparkasse S/H suffix: `1.234,56 S` / `1.234,56 H`

3. **Extend `detector.py`** with country-awareness:
   - Raiffeisen appears in CZ, CH, AT — distinguish by IBAN prefix, currency, or URL
   - UniCredit appears in CZ, IT — distinguish similarly
   - Nordea appears in DK, FI, SE — distinguish by currency/language
   - mBank appears in CZ, PL — distinguish by BIC (BREXCZPP vs BREXPLPW)

4. **Add encoding detection** to CSV import:
   - Windows-1250 (Czech/Polish)
   - ISO-8859-1 (German/French/Italian)
   - Windows-1252 (Spanish)
   - UTF-8 (Nordic, modern exports)

5. **Add SAVINGS_KEYWORDS** per language in detector.py:
   - Czech: "spořicí", "spořící" (already present)
   - German: "Sparkonto", "Tagesgeld", "Festgeld"
   - French: "Livret A", "LDD", "PEL", "compte épargne"
   - Spanish: "cuenta de ahorro", "depósito a plazo"
   - Italian: "conto deposito", "libretto di risparmio"
   - etc.

### Fields Extraction Matrix

| Field | All Banks | Czech Only | Comments |
|-------|-----------|------------|----------|
| date | ✅ | ✅ | Always available |
| description | ✅ | ✅ | Multi-line in most banks |
| amount | ✅ | ✅ | Various formats |
| type (income/expense) | ✅ | ✅ | Sign, columns, or keywords |
| currency | ✅ | ✅ | EUR/GBP/CZK/etc. |
| value date | Most | ✅ | Not all banks show it |
| counterparty name | Most | ✅ | From counterparty column or description |
| counterparty account | Some | ✅ | IBAN or local format |
| variable symbol (VS) | ❌ | ✅ | Czech/Slovak specific |
| constant symbol (KS) | ❌ | ✅ | Czech/Slovak specific |
| specific symbol (SS) | ❌ | ✅ | Czech/Slovak specific |
| running balance | Some | Some | Not always per-transaction |
| foreign amount | Some | Some | Multi-currency transactions |
| reference/mandate | Most EU | Some | SEPA reference IDs |
