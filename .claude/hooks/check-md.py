"""
PostToolUse hook: fires after every Edit/Write to a non-.md file.
Exits with code 2 to block and force Claude to update docs before continuing.
"""
import sys
import json

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
path = data.get("tool_input", {}).get("file_path", "")

# Only block on non-.md file edits
if not path.endswith(".md"):
    print(
        "HOOK REMINDER: Update ALL FOUR doc files if relevant to this change:\n"
        "  - CLAUDE.md (project instructions)\n"
        "  - MEMORY.md (persistent memory)\n"
        "  - definitions.md (strategy/parameter definitions)\n"
        "  - Front-End.md (frontend architecture)\n"
        "Do this NOW before making any further edits.",
        file=sys.stderr
    )
    sys.exit(2)
