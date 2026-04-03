import sys
import os
import re

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from services.order_service import parse_comment

def test_regex():
    print("--- Testing Regex Optimization ---")
    test_cases = [
        ("A+1", True),
        ("A+ 1", True),
        ("A + 1", True),
        ("A1", True),
        ("A 1", True),
        ("代號1", True),
        ("代號 1", True),
        ("B+6", True),
    ]
    
    for text, expected in test_cases:
        result = parse_comment(text)
        matched = len(result.get("items", [])) > 0
        status = "PASSED" if matched == expected else "FAILED"
        print(f"[{status}] Input: '{text}' -> Matched: {matched}")
        if matched:
            item = result["items"][0]
            print(f"      Extracted: Code={item['product_code']}, Qty={item['quantity']}")

if __name__ == "__main__":
    test_regex()
