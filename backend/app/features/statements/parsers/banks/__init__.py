"""Bank parser registry — per-bank packages for isolated parser code."""

from .raiffeisen import RaiffeisenParser
from .fio import FioParser
from .ceska_sporitelna import CeskaSporitelnaParser
from .revolut import RevolutParser, RevolutStockParser, RevolutPnlParser
from .czech_universal import CzechUniversalParser
from .unicredit import UniCreditParser
from .mbank import MBankParser
from .csob import CsobParser
