# [CORTEX STATE: CURRENT SYSTEM LOG]
# Updated: 2026-04-09 06:05 (Taipei Time)

## 📍 Current Work Area: System-Wide AI Vision Stabilization

### 1. Recognition & Extraction Logic (Two-Step Pipeline) ✅
- **Architecture**: Separated Transcription (OCR) from Structured Parsing across ALL modules.
- **7-11 Store Recognition**:
  - `ai_service.transcribe_image_text()` → Gemini raw text.
  - `parse_service.py` → Deterministic Regex extraction (6 digits) + Store Name cross-referencing.
  - **Success Rate**: Verified via `tmp/test_ocr_fixed.py`.
- **Digitize Module (Item Extraction)**:
  - `app/api/ocr/route.ts` → Refactored to 2-step pipeline for robust item list extraction.
  - **UI Feedback**: Added specific error fragment in `digitize.tsx` for extraction failures.

### 2. Database Status
- **Store Count**: 7278 stores (Scraped from official Ibon source). ✅
- **Sync Status**: `stores_cloud.json` synced with local.

### 3. Deployment Status
- **Production (Render)**: Pushing latest stabilization logic to `main` branch. 🚀

### 4. Next Session Guardrails
- **DO NOT** revert the two-step OCR logic in `/api/ocr` or `/api/checkout/...`.
- **DO NOT** simplify the 6-digit regex logic in `parse_service.py`.
