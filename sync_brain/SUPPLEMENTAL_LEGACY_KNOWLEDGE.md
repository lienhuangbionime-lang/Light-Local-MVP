# Supplemental Legacy Knowledge (from LifeOS v4.0) 🏺

This document captures high-signal patterns and hard-won stability rules from the legacy LifeOS/Cortex system to be adopted by the **Local-First MVP**.

---

## 🛡️ Stability & Security Protocols (Windows/Render)

### 1. The "CP950 Emoji" Guard
- **Rule**: NEVER use emojis in Python `print()` statements.
- **Reason**: In Windows environments (like the user's local dev), the default `cp950` encoding will crash the entire process if it encounters a multi-byte emoji character.
- **Implementation**: Stick to ASCII markers (e.g., `[OK]`, `[ERROR]`, `[SYSTEM]`) for backend logging.

### 2. IPv6 Connectivity Fix
- **Rule**: ALWAYS use `127.0.0.1` instead of `localhost` for local backend calls.
- **Reason**: Next.js and some Python libraries occasionally hang on Windows when trying to resolve `localhost` via IPv6.

### 3. Explicit Header Whitelisting
- **Rule**: Always explicitly list custom headers in `main.py` `CORSMiddleware`.
- **Implementation**: Ensure `allow_headers=["*"]` or specifically include `X-Admin-Signature`, `X-Admin-Timestamp`.

---

## 🧠 AI Intelligence Hardening

### 1. Regex Exact-Value Injection
- **Pattern**: When the AI extracts data (like product codes), it may occasionally hallucinate or change casing.
- **Guidance**: Use regex to scan the raw prompt for existing product codes and "force-inject" the exact match into the JSON output if the AI's version is slightly off.

### 2. Multi-Tier Quota Fallback
- **Pattern**: If Gemini 3.1 Pro hits a 429 error (Quota Exhausted), the system should silently retry with a "Lite" model (e.g., Gemini 1.5 Flash) rather than failing.
- **Current Status**: Tiered routing is implemented; basic retry logic is in `call_ai_studio`.

---

## 👔 Clothing Industry Logic (Landed Cost)

Legacy notes emphasize **Logistics Amortization (物流攤提)** which is critical for accurate profit calculation:
- **By Quantity (按件數均攤)**: Simple but unfair to small items.
- **By Weight (按重量比例攤提)**: Critical for "heavy coats" vs "light jewelry."
- **Logic**: Calculate `Final Landed Cost = Wholesale Price + (Total Batch Shipping / Weight Ratio)`.

---

## 📋 Dev-AI Collaboration Patterns

- **Reflective Handoff**: Each major change (like the Phase 3 modularization) should be followed by a "Reflective Summary" in `sync_brain/history/`.
- **Glass Box Protocol**: All AI decisions, especially regarding model choice and path overrides, must be visible in logs.

---
**Transferred from Legacy Brain**: 2026-03-18
