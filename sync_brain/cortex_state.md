# [CORTEX STATE: CURRENT SYSTEM LOG]
# Updated: 2026-04-04 05:06 (Taipei Time)

## 📍 Current Work Area: 7-11 Store Recognition Optimization

### 1. Database Status
- **Store Count**: 7278 stores (Scraped from official Ibon source). ✅
- **Latest Addition**: "鎮翊門市" and other new locations are now included.
- **File Integrity**: `scripts/stores.json` and `scripts/stores_cloud.json` are synced and committed.

### 2. Recognition Logic (Autonomous Mode)
- **AI Vision Prompt**: Includes spatial hint (Look at bottom-left below barcode for 6-digit ID).
- **Two-Step Pipeline**:
  - `ai_service.transcribe_image_text()` → Gemini raw text transcription.
  - `parse_service.py` → Deterministic Regex extraction (Exactly 6 digits).
  - `store_service.py` → Final DB verification and Brand filtering.
- **Success Rate**: Targeting 100% autonomous matching for clear invoice images.

### 3. Deployment Status
- **Local**: Synced and functional.
- **Cloud (Render)**: Final `stores_cloud.json` (7278 stores) and `parse_service.py` logic successfully pushed and deployed. ✅

### 4. Next Session Guardrails
- **DO NOT** revert the 6-digit regex logic in `parse_service.py`.
- **DO NOT** remove the brand-name pre-filter in `store_service.py`.
- **DO NOT** re-upload the full store list to Firestore if not necessary (use existence check in `seed_stores.py`).
