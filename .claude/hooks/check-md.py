"""
PostToolUse hook: after any Edit or Write to a non-.md file, remind Claude
to check whether CLAUDE.md, MEMORY.md, definitions.md, or Front-End.md
need updating.
"""
import json
import sys

data = json.load(sys.stdin)
file_path = data.get("tool_input", {}).get("file_path", "")

if file_path and not file_path.lower().endswith(".md"):
    print(
        "HOOK REMINDER: You just modified a non-.md file. "
        "Before finishing, verify whether CLAUDE.md, MEMORY.md, "
        "definitions.md, or Front-End.md need updating to reflect this change."
    )
