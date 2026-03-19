import re
from typing import Dict, List

def normalize_text(text: str) -> str:
    return text.strip().upper()

def parse_comment(text: str) -> Dict:
    normalized = normalize_text(text)
    # The new tightened pattern: [^\w\s] ensures it's NOT a letter, number, or whitespace
    # [\+\uff0b\u2795] explicitly includes common plus signs
    pattern = r'([A-Za-z0-9]{1,5})\s*([^\w\s]|[\+\uff0b\u2795])+\s*(\d+)'
    matches = re.findall(pattern, normalized)
    return matches

# Test cases
test_messages = [
    "A+1",     # SHOULD match
    "A + 1",   # SHOULD match
    "感謝您的喊單！您預定了: A x1。", # SHOULD NOT match (x is a word char)
    "A x 1",   # SHOULD NOT match
    "A 1",     # SHOULD NOT match (whitespace only)
    "B➕2",    # SHOULD match (emoji plus)
    "C＋10",   # SHOULD match (full-width plus)
]

print("--- Tightened Regex Test ---")
for msg in test_messages:
    m = parse_comment(msg)
    status = "✅ Correct" if (("+" in msg or "➕" in msg or "＋" in msg) == bool(m)) else "❌ Failed"
    # Adjustment for Case 3 specifically
    if "感謝您的喊單" in msg and not m:
        status = "✅ Correct (Suppressed confirmation)"
    
    print(f"Input: '{msg}' -> Matches: {m} | {status}")
