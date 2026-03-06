"""
Stop hook: fires once when Claude finishes a response.
Reminds Claude to update all four .md files if any code was changed.
"""
print(
    "HOOK REMINDER: Before this response is complete, verify whether "
    "CLAUDE.md, MEMORY.md, definitions.md, and Front-End.md need updating "
    "to reflect any code changes made in this response. Update ALL FOUR if relevant."
)
