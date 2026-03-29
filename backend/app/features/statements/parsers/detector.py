"""Bank auto-detection from document content.

Scans the first page of a PDF, Word, or image document for bank identifier
strings and returns the appropriate parser.

Supports 21+ Czech banks plus Revolut. Detection uses a two-pass strategy:
1. Header scan (first 500 chars) — bank names appear in statement headers
2. Full first-page text — catches signatures deeper in the page
3. Best-effort fallback — tries all parsers, picks the one with most results
"""

import os
import logging
from .base import BaseParser

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp', '.webp', '.heic'}

# ---------- Lazy imports to avoid circular deps ----------

from .revolut import RevolutParser
from .raiffeisen import RaiffeisenParser
from .fio import FioParser
from .csob import CeskaSporitelnaParser
from .czech_universal import CzechUniversalParser


def _czech(bank_name: str):
    """Factory: returns a CzechUniversalParser bound to a specific bank name."""
    return lambda: CzechUniversalParser(bank_name=bank_name)


# ---------- Bank signatures ----------
# Order matters: dedicated parsers first, then CzechUniversal for the rest.
# More specific keywords before generic ones. "revolut" checked last among
# dedicated parsers because it can appear in transaction descriptions.

BANK_SIGNATURES = [
    # --- Dedicated parsers (tested with real statements) ---
    (["raiffeisenbank", "raiffeisen a.s"], RaiffeisenParser),
    (["fio banka", "fiobanka", "fio.cz", "/2010"], FioParser),
    (["česká spořitelna", "ceska sporitelna", "/0800", "account plus", "george"],
     CeskaSporitelnaParser),

    # --- Czech banks → CzechUniversalParser ---
    # Air Bank (bank code 3030)
    (["air bank", "airbank", "/3030"], _czech("air_bank")),

    # Banka Creditas (bank code 2250)
    (["creditas", "banka creditas", "/2250"], _czech("creditas")),

    # Česká exportní banka (bank code 8090)
    (["česká exportní", "ceska exportni", "exportní banka", "/8090"],
     _czech("ceb")),

    # ČSOB — Československá obchodní banka (bank code 0300)
    (["československá obchodní", "ceskoslovenska obchodni",
      "čsob", "csob", "/0300"], _czech("csob")),

    # ČSOB Stavební spořitelna (bank code 7910)
    (["čsob stavební", "csob stavebni", "čmss", "cmss", "/7910"],
     _czech("csob_stavebni")),

    # ČSOB Hypoteční banka (bank code 8090 variant or ČSOB Hypo)
    (["čsob hypoteční", "csob hypotecni", "hypoteční banka čsob"],
     _czech("csob_hypo")),

    # J&T Banka (bank code 5800)
    (["j&t banka", "j & t banka", "j&t bank", "/5800"], _czech("jt_banka")),

    # Komerční banka (bank code 0100)
    (["komerční banka", "komercni banka", "kb,", "kb a.s", "/0100"],
     _czech("komercni_banka")),

    # Modrá pyramida (bank code 7990)
    (["modrá pyramida", "modra pyramida", "/7990"], _czech("modra_pyramida")),

    # Moneta Money Bank (bank code 0600)
    (["moneta money", "moneta bank", "ge money", "/0600"],
     _czech("moneta")),

    # MONETA Stavební spořitelna (bank code 7950)
    (["moneta stavební", "moneta stavebni", "wüstenrot", "wustenrot", "/7950"],
     _czech("moneta_stavebni")),

    # National Development Bank / Národní rozvojová banka (bank code 0710)
    (["národní rozvojová", "narodni rozvojova", "national development", "/0710"],
     _czech("nrb")),

    # PPF Banka (bank code 6000)
    (["ppf banka", "ppf bank", "/6000"], _czech("ppf_banka")),

    # Raiffeisen stavební spořitelna (bank code 7950 variant)
    (["raiffeisen stavební", "raiffeisen stavebni"], _czech("raiffeisen_stavebni")),

    # Stavební spořitelna České spořitelny (bank code 8060)
    (["stavební spořitelna české", "stavebni sporitelna ceske",
      "buřinka", "burinka", "/8060"], _czech("ss_ceske_sporitelny")),

    # Trinity Bank (bank code 2070)
    (["trinity bank", "trinity banka", "/2070"], _czech("trinity_bank")),

    # UniCredit Bank Czech Republic (bank code 2700)
    (["unicredit", "uni credit", "/2700"], _czech("unicredit")),

    # Všeobecná úverová banka — VÚB (Slovak, bank code 6700)
    (["všeobecná úverová", "vseobecna uverova", "vúb", "vub banka", "/6700"],
     _czech("vub")),

    # --- Generic "raiffeisen" match AFTER the specific raiffeisen stavební ---
    # This catches any Raiffeisen statement not matched by dedicated parser
    (["raiffeisen"], RaiffeisenParser),

    # --- Revolut last (can appear as merchant in other banks' statements) ---
    (["revolut", "rev.ng"], RevolutParser),
]

STOCK_KEYWORDS = [
    "portfolio breakdown",
    "stocks value",
]

STOCK_PNL_KEYWORDS = [
    "profit and loss statement",
    "sells summary",
    "gross pnl",
]

SAVINGS_KEYWORDS = [
    # Czech stems — handle all grammatical cases
    "spořic",       # matches spořicí, spořicího, spořicím
    "sporic",       # without diacritics
    "termínovaný vklad", "terminovany vklad",
    "úrokový výpis", "urokovy vypis",
    "stavební spoření", "stavebni sporeni",
    # English
    "savings account", "savings statement",
    "fixed deposit", "term deposit",
]


def _extract_first_page_text(file_path: str) -> str:
    """Extract text from the first page of a document.

    Pre-loads the full document into the cache so that the subsequent
    parser.parse() call reuses the already-OCR'd pages instead of
    re-processing the entire file from scratch.
    """
    from .document_reader import preload_document

    try:
        doc = preload_document(file_path)
        if doc.pages:
            return doc.pages[0].extract_text()
        return ""
    except Exception:
        return ""


def detect_bank(file_path: str) -> BaseParser:
    """Detect the bank from document content and return appropriate parser.

    Uses a four-pass strategy that prioritizes bank **names** over bank
    **codes**. Bank codes (e.g. /2010, /2700) appear in counterparty
    account numbers inside transaction details and cause false positives
    when checked early.

    Pass order:
      1. Bank names in header (first 500 chars)
      2. Bank names in full first-page text
      3. Bank codes in header
      4. Bank codes in full first-page text
      5. Best-effort fallback (try all parsers)
    """
    text = _extract_first_page_text(file_path)
    text_lower = text.lower()
    header = text_lower[:500]

    def _try_match(search_text, use_names, use_codes):
        for keywords, parser_factory in BANK_SIGNATURES:
            name_kws = [kw for kw in keywords if not kw.startswith("/")]
            code_kws = [kw for kw in keywords if kw.startswith("/")]
            check_kws = []
            if use_names:
                check_kws.extend(name_kws)
            if use_codes:
                check_kws.extend(code_kws)
            if check_kws and any(kw in search_text for kw in check_kws):
                return _instantiate(parser_factory)
        return None

    # Pass 1: bank names in header
    parser = _try_match(header, use_names=True, use_codes=False)
    if parser:
        logger.info(f"Detected bank: {parser.BANK_NAME} (header name) for {file_path}")
        return parser

    # Pass 2: bank names in full text
    parser = _try_match(text_lower, use_names=True, use_codes=False)
    if parser:
        logger.info(f"Detected bank: {parser.BANK_NAME} (full-text name) for {file_path}")
        return parser

    # Pass 3: bank codes in header
    parser = _try_match(header, use_names=False, use_codes=True)
    if parser:
        logger.info(f"Detected bank: {parser.BANK_NAME} (header code) for {file_path}")
        return parser

    # Pass 4: bank codes in full text (least reliable — codes may be counterparty)
    parser = _try_match(text_lower, use_names=False, use_codes=True)
    if parser:
        logger.info(f"Detected bank: {parser.BANK_NAME} (full-text code) for {file_path}")
        return parser

    # Default fallback — try all parsers and pick the one that extracts
    # the most transactions, instead of blindly defaulting.
    logger.warning(
        f"No bank detected for {file_path}, will try all parsers. "
        f"First 200 chars: {text[:200]!r}"
    )
    return _best_effort_parser(file_path)


def _instantiate(parser_factory) -> BaseParser:
    """Instantiate a parser from either a class or a factory function."""
    result = parser_factory() if callable(parser_factory) else parser_factory
    if isinstance(result, type):
        result = result()
    return result


def _best_effort_parser(file_path: str) -> BaseParser:
    """Try every known parser + generic, return the one with most transactions."""
    from .generic import GenericParser

    candidates = [
        RaiffeisenParser(),
        FioParser(),
        CeskaSporitelnaParser(),
        CzechUniversalParser(bank_name="czech_universal"),
        RevolutParser(),
        GenericParser(),
    ]

    best_parser = None
    best_count = 0

    for parser in candidates:
        try:
            results = parser.parse(file_path)
            count = len(results)
            if count > best_count:
                best_count = count
                best_parser = parser
        except Exception:
            continue

    if best_parser:
        logger.info(
            f"Best-effort detection chose {best_parser.BANK_NAME} "
            f"({best_count} transactions) for {file_path}"
        )
        return best_parser

    # Absolute fallback
    return GenericParser()


def detect_statement_type(file_path: str) -> str:
    """Detect whether a statement is a stock, savings, or regular bank statement.

    Returns:
        "stock", "savings", or "bank"
    """
    text = _extract_first_page_text(file_path)
    text_lower = text.lower()

    for keyword in STOCK_PNL_KEYWORDS:
        if keyword in text_lower:
            return "stock_pnl"

    for keyword in STOCK_KEYWORDS:
        if keyword in text_lower:
            return "stock"

    for keyword in SAVINGS_KEYWORDS:
        if keyword in text_lower:
            return "savings"

    return "bank"


def detect_bank_name(file_path: str) -> str:
    """Return just the bank name string without instantiating a parser."""
    parser = detect_bank(file_path)
    return parser.BANK_NAME
