"""Backward-compatible import shim for scraper utilities.

New code should import from backend.utils.scraper_utils. Existing code that
imports backend.scraper_utils keeps working.
"""

from backend.utils.scraper_utils import *  # noqa: F401,F403
