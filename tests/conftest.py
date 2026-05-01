import sys
from pathlib import Path

# Make backend modules importable
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
# Make test helpers importable
sys.path.insert(0, str(Path(__file__).parent))
