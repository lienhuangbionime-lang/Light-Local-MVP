import asyncio
import json
import base64
import os
import sys

# Set up paths to import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

async def test_ai_extraction():
    # Force a known model for local testing
    import backend.config as config
    config.GEMINI_VISION_MODEL = "models/gemini-1.5-flash"
    
    from backend.services.ai_service import ask_gemini_secretary
    
    print(f"Using Model: {config.GEMINI_VISION_MODEL}")
    
    # Use a dummy prompt and text to see if it mirrors
    test_prompt = "You are a helpful assistant. Return JSON only: {\"status\": \"ok\"}"
    
    print("Testing with system_instruction refactor...")
    result = await ask_gemini_secretary(
        text_content="Hello, please extract nothing but return the JSON status ok.",
        system_prompt=test_prompt
    )
    
    print(f"Result: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    if result and result.get("status") == "ok":
        print("✅ SUCCESS: No prompt mirroring detected.")
    else:
        print("❌ FAILURE: Extraction failed or mirrored prompt.")

if __name__ == "__main__":
    asyncio.run(test_ai_extraction())
