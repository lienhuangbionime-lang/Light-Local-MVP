import json
import sys
import os

# Add current dir to path for imports
sys.path.append(os.getcwd())

from backend.services.ai_service import clean_json_output

def test_parsing():
    print("--- Starting AI Parsing Test ---")
    
    # Test 1: Severe Echoing (as seen in user logs)
    echo_text = """AI(gemma-4-31b-it) 原文: *   Role: `EchoOrder Checkout Helper`.
    *   Task: Extract shipping/customer information from an image.
    *   Output Format: Strict JSON.
    {"buyer_name": "王小明", "phone": "0912345678", "store_candidates": ["旗山門市"]}
    *   Specific Rules: ..."""
    
    result = clean_json_output(echo_text)
    print(f"Test 1 (Echoing) Input: {len(echo_text)} chars")
    print(f"Test 1 Result: {result}")
    
    try:
        parsed = json.loads(result)
        assert parsed["buyer_name"] == "王小明"
        print("✅ Test 1 Passed: Correct JSON extracted from noise.")
    except Exception as e:
        print(f"❌ Test 1 Failed: {e}")

    # Test 2: Markdown block
    markdown_text = "Here is the data: ```json\n{\"buyer_name\": \"李智\", \"phone\": \"0988777666\"}\n``` Bye."
    result2 = clean_json_output(markdown_text)
    print(f"Test 2 Result: {result2}")
    try:
        parsed2 = json.loads(result2)
        assert parsed2["buyer_name"] == "李智"
        print("✅ Test 2 Passed: Markdown JSON handled.")
    except Exception as e:
        print(f"❌ Test 2 Failed: {e}")

if __name__ == "__main__":
    test_parsing()
