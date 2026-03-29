"""Comprehensive ISO 4217 currency definitions.

Single source of truth for all currency codes, names, and symbols
used across parsers, settings validation, and API responses.
"""

# All active ISO 4217 currency codes
ALL_CURRENCY_CODES: set[str] = {
    # Major currencies
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
    # European
    "CZK", "PLN", "HUF", "RON", "BGN", "HRK", "RSD", "UAH",
    "SEK", "NOK", "DKK", "ISK", "GEL", "MDL", "MKD", "ALL",
    "BAM", "BYN",
    # Asia-Pacific
    "CNY", "HKD", "TWD", "KRW", "SGD", "MYR", "THB", "IDR",
    "PHP", "VND", "INR", "PKR", "BDT", "LKR", "NPR", "MMK",
    "KHR", "LAK", "MNT", "KZT", "UZS", "KGS", "TJS", "TMT",
    "AFN", "MVR", "BND", "FJD", "PGK", "WST", "TOP", "VUV",
    "SBD", "KPW",
    # Middle East
    "AED", "SAR", "QAR", "OMR", "BHD", "KWD", "JOD", "ILS",
    "TRY", "IQD", "IRR", "SYP", "LBP", "YER",
    # Africa
    "ZAR", "EGP", "NGN", "KES", "GHS", "TZS", "UGX", "ETB",
    "MAD", "TND", "DZD", "LYD", "SDG", "SSP", "MUR", "SCR",
    "MGA", "MWK", "ZMW", "BWP", "NAD", "SZL", "LSL", "AOA",
    "MZN", "CDF", "RWF", "BIF", "DJF", "ERN", "GMD", "GNF",
    "SLL", "LRD", "CVE", "STN", "XOF", "XAF", "XPF", "KMF",
    # Americas
    "MXN", "BRL", "ARS", "CLP", "COP", "PEN", "UYU", "PYG",
    "BOB", "VES", "GYD", "SRD", "CRC", "PAB", "DOP", "CUP",
    "HTG", "JMD", "TTD", "BBD", "BSD", "BZD", "GTQ", "HNL",
    "NIO", "AWG", "ANG", "KYD", "BMD", "XCD", "FKP",
    # Caribbean / Other
    "RUB", "AMD", "AZN",
}

CURRENCY_NAMES: dict[str, str] = {
    # Major
    "USD": "US Dollar", "EUR": "Euro", "GBP": "British Pound",
    "JPY": "Japanese Yen", "CHF": "Swiss Franc",
    "CAD": "Canadian Dollar", "AUD": "Australian Dollar",
    "NZD": "New Zealand Dollar",
    # European
    "CZK": "Czech Koruna", "PLN": "Polish Zloty",
    "HUF": "Hungarian Forint", "RON": "Romanian Leu",
    "BGN": "Bulgarian Lev", "HRK": "Croatian Kuna",
    "RSD": "Serbian Dinar", "UAH": "Ukrainian Hryvnia",
    "SEK": "Swedish Krona", "NOK": "Norwegian Krone",
    "DKK": "Danish Krone", "ISK": "Icelandic Krona",
    "GEL": "Georgian Lari", "MDL": "Moldovan Leu",
    "MKD": "Macedonian Denar", "ALL": "Albanian Lek",
    "BAM": "Bosnia Mark", "BYN": "Belarusian Ruble",
    # Asia-Pacific
    "CNY": "Chinese Yuan", "HKD": "Hong Kong Dollar",
    "TWD": "Taiwan Dollar", "KRW": "South Korean Won",
    "SGD": "Singapore Dollar", "MYR": "Malaysian Ringgit",
    "THB": "Thai Baht", "IDR": "Indonesian Rupiah",
    "PHP": "Philippine Peso", "VND": "Vietnamese Dong",
    "INR": "Indian Rupee", "PKR": "Pakistani Rupee",
    "BDT": "Bangladeshi Taka", "LKR": "Sri Lankan Rupee",
    "NPR": "Nepalese Rupee", "MMK": "Myanmar Kyat",
    "KHR": "Cambodian Riel", "LAK": "Lao Kip",
    "MNT": "Mongolian Tugrik", "KZT": "Kazakh Tenge",
    "UZS": "Uzbek Som", "KGS": "Kyrgyz Som",
    "TJS": "Tajik Somoni", "TMT": "Turkmen Manat",
    "AFN": "Afghan Afghani", "MVR": "Maldivian Rufiyaa",
    "BND": "Brunei Dollar", "FJD": "Fijian Dollar",
    "PGK": "Papua New Guinean Kina", "KPW": "North Korean Won",
    # Middle East
    "AED": "UAE Dirham", "SAR": "Saudi Riyal",
    "QAR": "Qatari Riyal", "OMR": "Omani Rial",
    "BHD": "Bahraini Dinar", "KWD": "Kuwaiti Dinar",
    "JOD": "Jordanian Dinar", "ILS": "Israeli Shekel",
    "TRY": "Turkish Lira", "IQD": "Iraqi Dinar",
    "IRR": "Iranian Rial", "LBP": "Lebanese Pound",
    "YER": "Yemeni Rial", "SYP": "Syrian Pound",
    # Africa
    "ZAR": "South African Rand", "EGP": "Egyptian Pound",
    "NGN": "Nigerian Naira", "KES": "Kenyan Shilling",
    "GHS": "Ghanaian Cedi", "TZS": "Tanzanian Shilling",
    "UGX": "Ugandan Shilling", "ETB": "Ethiopian Birr",
    "MAD": "Moroccan Dirham", "TND": "Tunisian Dinar",
    "DZD": "Algerian Dinar", "LYD": "Libyan Dinar",
    "MUR": "Mauritian Rupee", "SCR": "Seychellois Rupee",
    "MGA": "Malagasy Ariary", "ZMW": "Zambian Kwacha",
    "BWP": "Botswana Pula", "NAD": "Namibian Dollar",
    "MZN": "Mozambican Metical", "RWF": "Rwandan Franc",
    "XOF": "West African CFA", "XAF": "Central African CFA",
    "XPF": "CFP Franc",
    # Americas
    "MXN": "Mexican Peso", "BRL": "Brazilian Real",
    "ARS": "Argentine Peso", "CLP": "Chilean Peso",
    "COP": "Colombian Peso", "PEN": "Peruvian Sol",
    "UYU": "Uruguayan Peso", "PYG": "Paraguayan Guarani",
    "BOB": "Bolivian Boliviano", "VES": "Venezuelan Bolivar",
    "CRC": "Costa Rican Colon", "DOP": "Dominican Peso",
    "JMD": "Jamaican Dollar", "TTD": "Trinidad Dollar",
    "GTQ": "Guatemalan Quetzal", "HNL": "Honduran Lempira",
    "NIO": "Nicaraguan Cordoba", "PAB": "Panamanian Balboa",
    "CUP": "Cuban Peso", "HTG": "Haitian Gourde",
    "BBD": "Barbadian Dollar", "BSD": "Bahamian Dollar",
    "BZD": "Belize Dollar", "GYD": "Guyanese Dollar",
    "SRD": "Surinamese Dollar", "BMD": "Bermudian Dollar",
    "KYD": "Cayman Dollar", "XCD": "East Caribbean Dollar",
    "FKP": "Falkland Pound", "AWG": "Aruban Florin",
    # Other
    "RUB": "Russian Ruble", "AMD": "Armenian Dram",
    "AZN": "Azerbaijani Manat",
}

CURRENCY_SYMBOLS: dict[str, str] = {
    "USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥",
    "CHF": "Fr", "CAD": "C$", "AUD": "A$", "NZD": "NZ$",
    "CZK": "Kč", "PLN": "zł", "HUF": "Ft", "RON": "lei",
    "BGN": "лв", "HRK": "kn", "RSD": "din", "UAH": "₴",
    "SEK": "kr", "NOK": "kr", "DKK": "kr", "ISK": "kr",
    "CNY": "¥", "HKD": "HK$", "TWD": "NT$", "KRW": "₩",
    "SGD": "S$", "MYR": "RM", "THB": "฿", "IDR": "Rp",
    "PHP": "₱", "VND": "₫", "INR": "₹", "PKR": "₨",
    "BDT": "৳", "LKR": "Rs", "NPR": "₨",
    "AED": "د.إ", "SAR": "﷼", "QAR": "﷼", "OMR": "﷼",
    "BHD": "BD", "KWD": "KD", "JOD": "JD", "ILS": "₪",
    "TRY": "₺", "EGP": "E£",
    "ZAR": "R", "NGN": "₦", "KES": "KSh", "GHS": "₵",
    "MXN": "MX$", "BRL": "R$", "ARS": "AR$", "CLP": "CL$",
    "COP": "COL$", "PEN": "S/.", "RUB": "₽",
    "GEL": "₾", "BYN": "Br", "MNT": "₮", "KZT": "₸",
}


def is_valid_currency(code: str) -> bool:
    """Check if a string is a valid ISO 4217 currency code."""
    return code in ALL_CURRENCY_CODES
