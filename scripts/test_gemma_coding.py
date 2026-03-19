import sys
import os
import asyncio
import json

# Ensure project root is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend import config
from backend.services.ai_service import call_ai_studio

async def run_coding_benchmark():
    print("=== Gemma 3 27B Coding Ability Test ===")
    
    # Check for API Key
    if not config.GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY not found in environment or config.")
        return

    model_name = config.GEMINI_VISION_MODEL.replace("models/", "")
    print(f"Testing Model: {model_name}\n")

    challenges = [
        {
            "id": "A (Algorithm)",
            "prompt": "Write a Python function to find the longest palindromic substring in a given string. Provide the code and a time complexity analysis."
        },
        {
            "id": "B (Frameworks)",
            "prompt": "Create a FastAPI endpoint definition (Python) that accepts a POST request with a JSON body representing a 'Product' (fields: name, price, quantity). Include Pydantic validation."
        },
        {
            "id": "C (Debugging)",
            "prompt": "The following Python code has a logical bug and a syntax error. Please fix both and explain the changes:\n\ndef find_max(numbers)\n    max_val = 0\n    for n in numbers:\n        if n < max_val:\n            max_val = n\n    return max_val"
        }
    ]

    for challenge in challenges:
        print(f"--- Challenge {challenge['id']} ---")
        prompt = challenge['prompt']
        
        contents = [{"parts": [{"text": prompt}]}]
        
        print("AI is thinking...")
        result = await call_ai_studio(model_name, contents)
        
        if result:
            print(f"\n[AI RESULT]\n{result}\n")
        else:
            print("Error: No response from AI.\n")
        
        print("-" * 40 + "\n")

if __name__ == "__main__":
    asyncio.run(run_coding_benchmark())
