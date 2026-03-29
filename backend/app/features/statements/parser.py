"""Bank statement parser — thin dispatcher for PDF and Word documents.

Delegates to bank-specific parsers via auto-detection.
Supports PDF (.pdf) and Word (.docx, .doc) documents.
Maintains backward-compatible parse_pdf() API.
"""

from features.statements.parsers.detector import detect_bank, detect_bank_name


def parse_pdf(pdf_path: str) -> list[dict]:
    """Parse a bank statement document (PDF or Word) and return transaction dicts.

    Auto-detects the bank from document content and uses the
    appropriate parser. Falls back to Revolut parser.

    Args:
        pdf_path: Path to the document file (.pdf, .docx, or .doc)
                 Note: parameter name is 'pdf_path' for backward compatibility,
                 but it accepts Word documents as well.

    Returns:
        List of transaction dictionaries
    """
    parser = detect_bank(pdf_path)
    return parser.parse(pdf_path)
