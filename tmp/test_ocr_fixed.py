import os
import asyncio
import base64
import json
import sys

# Add project root to sys.path
sys.path.append(os.getcwd())

# Mock environment variables for testing
os.environ["GEMINI_VISION_MODEL"] = "models/gemma-4-31b-it"

from backend.services.ai_service import ask_gemini_secretary, transcribe_image_text
from backend.services.store_service import resolve_store_info

async def test_image(image_path, label):
    print(f"\n[TEST] {label} ({os.path.basename(image_path)})")
    if not os.path.exists(image_path):
        print(f"Skipping: File not found at {image_path}")
        return

    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    # 1. Test AI Secretary (JSON + Store Candidates)
    print("  -> Calling AI Secretary...")
    res = await ask_gemini_secretary("", image_data_base64=image_b64)
    print(f"  Result: {json.dumps(res, ensure_ascii=False) if res else 'None (FAILED)'}")

    # 2. Test OCR Transcription (Two-Step Fallback)
    print("  -> Calling OCR Transcription...")
    ocr_text = await transcribe_image_text(image_b64)
    if ocr_text:
        print(f"  OCR Text (partial): {ocr_text[:200]}...")
    else:
        print("  OCR Text: None (FAILED)")

    # 3. Test Store Resolution (Integration)
    if res or ocr_text:
        candidates = res.get("store_candidates", []) if res else []
        if res and res.get("shipping_info"): candidates.append(res["shipping_info"])
        
        # Simulating main.py logic for candidates
        from backend.services.parse_service import extract_store_candidates_from_ocr, extract_store_names_from_ocr
        from backend.services.store_service import _STORE_BY_NAME
        
        ocr_candidates = []
        if ocr_text:
            ocr_candidates = extract_store_candidates_from_ocr(ocr_text)
            name_matched_ids = extract_store_names_from_ocr(ocr_text, _STORE_BY_NAME)
            ocr_candidates = name_matched_ids + ocr_candidates
        
        all_candidates = ocr_candidates + candidates
        print(f"  All Candidates: {all_candidates}")
        
        store_info = await resolve_store_info("", candidates=all_candidates)
        print(f"  Resolved Store: {store_info}")

async def main():
    images = [
        (r"c:\Users\lien.huang\AppData\Local-First MVP\tmp\archive\2026-04-03\51a585b5-1fc1-458c-bba2-ee8c7cae976d.jpg", "7-11 Google Maps Screenshot"),
        (r"c:\Users\lien.huang\AppData\Local-First MVP\tmp\archive\2026-04-03\650845136_1607311167372760_3537869982557355364_n.jpg", "Address Screenshot"),
        (r"c:\Users\lien.huang\AppData\Local-First MVP\9367e4b1-2896-450d-a946-34601312bdfe.jpg", "Vietnamese Handwritten Receipt")
    ]

    import sys
    idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    if idx < len(images):
        path, label = images[idx]
        await test_image(path, label)
    else:
        print("Index out of range")

if __name__ == "__main__":
    asyncio.run(main())
