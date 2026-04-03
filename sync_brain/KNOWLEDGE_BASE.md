# 🤖 Gemma 3 客服知識庫 (FAQ & Support)

本文件存放用於提供給 Gemma 3 27B 作為「直播接待員」參考的最新店規與常見問題。

---

## 🛍️ 商店基本資訊
- **店名**: MuMu Apparel (沐沐服飾)
- **直播場次**: 每天 20:00 準時開播
- **服務理念**: 提供高品質、高性價比的服飾，讓每一位買家都能穿出自信。

- **運費標準**: 
  - 全館滿 **3 件免運** (視當場直播設定而定)。
  - 未滿免運門檻，統一收取運費 **$50**。
- **配送方式**: 預設使用 **7-11 賣貨便** (貨到付款)。
- **出貨時間**: 現貨商品於下單後 3 個工作天內出貨；預購商品約需 7-14 個工作天。

## 💰 付款方式 (Payment)
- **貨到付款**: 支援 7-11 門市取貨付款。
- **ATM 轉帳**: 提供銀行帳戶資訊，轉帳後需回傳後五碼。

## 👕 商品與尺碼 (Products)
- **代號規則**: 每個商品皆有專屬 A、B、C 等代號。
- **下單方式**: 請在留言處輸入「代號+數量」，例如：`A+1`, `B+2`。
- **尺碼問題**: 若買家詢問尺碼，請提醒買家參考商品描述中的詳細尺寸表，或提供身高體重由後台人員協助。

## 🎁 今日活動 (Special Offers)
- **今日限定**: 全館 **9 折** 優惠 (特價品除外)。
- **截圖禮**: 分享直播並截圖，私訊客服領取 $50 折扣碼。

## 🛠️ 疑難排除 (Diagnostics)
- **收不到訊息**: 請買家先確認是否有對粉專點擊「開始使用」，或檢查「陌生訊息」。
- **下單不成功**: 請確認代號輸入是否正確（需包含 + 號），或詢問是否為首購（首購需先私訊報到）。
- **圖片解析**: 若買家傳送截圖，請回覆：「AI 主管已收到您的圖片，正在進行解析，請稍候片刻。」

---

# 🛡️ Antigravity Technical Knowledge Base (Experience Artifact)

Experience patterns, stability logs, and pre-execution checklists for the **LifeOS v7.1** core.

## ⚠️ Known Error Patterns & Resolution

| Category | Issue Pattern | Resolution (Fix) |
| :--- | :--- | :--- |
| **Bridge Latency** | Chat unresponsive or 20s forced delay on first message. | **FIX**: Initialize `lastRun` to `Date.now() - minInterval` in `bridge-worker.js`. |
| **Rate Limit** | UI shows "API rate limit reached". `bridge.js` error 429. | **FIX**: Implement dynamic backoff (e.g. 2s minimum) and monitor `stderr` for 429 strings. |
| **Dependency Drift** | `ModuleNotFoundError` despite local install (e.g. `duckduckgo_search`). | **FIX**: Always verify `requirements.txt` or `package.json` parity before committing tool changes. |
| **Bootstrap 404** | AI model factory fails with 404 (version mismatch). | **FIX**: Standardize on `get_model()` factory to detect available Gemini models dynamically. |

## 🏗️ v7.1 Core Protocols (Mandates)

### 1. Unified Command Queue (📥)
- **Path**: `.gemini/antigravity/COMMAND_QUEUE/*.json`
- **Logic**: Primary task bus. Avoid executing direct out-of-band commands unless they are small experiments.

### 2. Context Sync First (⚡)
- **Rule**: Read `sync_brain/cortex_state.md` and `SYSTEM_CONTEXT.md` at session start.
- **Goal**: Prevent architectural hallucination and ensure knowledge continuity.

## ✅ Pre-Execution Checklist (v7.1 Mandate)

1. [ ] **Target Verification**: Use `grep_search` or `view_file` to confirm the exact target line/logic before any rewrite.
2. [ ] **Rate Limit Probe**: Check if any active 429 backoff is in effect in the bridge process.
3. [ ] **Cwd Security**: Ensure `Cwd` in `run_command` is within the workspace allowlist (usually `.gemini`).
4. [ ] **Self-Validation**: Run a syntax check (`python -m py_compile`) or unit test immediately after modification.

---
**Technical Knowledge Updated**: 2026-04-03 | **Status**: v7.1 Aligned
