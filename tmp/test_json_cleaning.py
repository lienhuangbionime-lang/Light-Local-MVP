import re
import json

def clean_json_output(text: str) -> str:
    """
    Strips role-echoing preamble, markdown blocks, and trailing noise from AI output.
    Attempts to extract the first valid {...} or [...] block.
    """
    if not text:
        return ""
    
    # [NEW] 1. Try extracting content between strict delimiters first
    delimiter_match = re.search(r'\[START_JSON\]\s*([\s\S]*?)\s*\[END_JSON\]', text)
    if delimiter_match:
        content = delimiter_match.group(1).strip()
        # Clean up Markdown markers if they survived inside delimiters
        content = content.replace("```json", "").replace("```", "").strip()
        return content

    # 2. Look for the FIRST JSON block specifically (avoiding echoing noise at the end)
    # This non-greedy match captures the first balanceable block
    match = re.search(r'(\{[\s\S]*?\}|\[[\s\S]*?\])', text)
    if match:
        return match.group(0)
    
    # 3. Fallback: manual cleanup of common markers
    cleaned = text.replace("```json", "").replace("```", "").strip()
    return cleaned

def test_cleaning():
    # Case 1: Perfect delimiter use
    raw_1 = "Some intro [START_JSON] {\"name\": \"test\"} [END_JSON] some noise"
    # Case 2: Role-Echoing at the end
    raw_2 = "{\"items\": [\"7-ELEVEN\"]} * Role: EchoOrder Checkout Helper... * Task: Transcribe..."
    # Case 3: Mixed markdown and delimiters
    raw_3 = "[START_JSON] ```json\n{\"id\": 123}\n``` [END_JSON]"
    
    print(f"Test 1 (Delimiters): {clean_json_output(raw_1)}")
    print(f"Test 2 (Role-Echoing): {clean_json_output(raw_2)}")
    print(f"Test 3 (Mixed): {clean_json_output(raw_3)}")

    assert json.loads(clean_json_output(raw_1))["name"] == "test"
    assert "7-ELEVEN" in json.loads(clean_json_output(raw_2))["items"]
    assert json.loads(clean_json_output(raw_3))["id"] == 123
    print("\n✅ All cleaning tests passed!")

if __name__ == "__main__":
    test_cleaning()
