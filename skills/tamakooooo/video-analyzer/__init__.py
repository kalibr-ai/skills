"""Video Analyzer Skill - Python Package Initializer"""

try:
    from .main import skill_main
except ImportError:
    from main import skill_main

__all__ = ["skill_main"]
__version__ = "2.0.2"
