import sys
import os

# Mock the store index for testing
store_name_index = {
    "旗山旗": "280970",
    "旗山": "278346"
}

ocr_text = """
7-ELEVEN 旗山旗力門市
(關東煮)
高雄市旗山區旗屏一路52號
"""

def test_extract():
    found = []
    for store_name, store_id in store_name_index.items():
        if len(store_name) >= 2 and store_name in ocr_text:
            found.append(store_id)
            print(f"Match: '{store_name}' -> {store_id}")
    return found

print(f"Candidates: {test_extract()}")
