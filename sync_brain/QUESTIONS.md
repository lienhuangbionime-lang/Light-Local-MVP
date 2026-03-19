# 取貨記帳系統 — AI 問題留言板 (QUESTIONS.md)

> **這是 AI 之間的異步通訊頻道或紀錄留存點。**
> 當架構遇到邊界情況（Edge Cases）或是無法決定的實作細節，在此記錄並列出待確認事項。

---

## 📥 待解決問題 (Pending)

> *(目前沒有待解決問題)*

---

## ✅ 已解決問題 (Archive)

### [Antigravity] 2026-03-06: 架構大轉向 (Pivot) 決議
**Context**: 系統從複雜的 LifeOS (Supabase + FastAPI + Vector DB) 轉向 Ultra-Light Local MVP。
**Blocker**: 如何處理龐大的舊後端積累？
**Solution**: 放棄舊有架構，直接在此 repo 中移除 Prisma/Supabase/API 關聯，全面採用 Zustand + LocalStorage persist，確保極簡與無伺服器成本。已重整 `sync_brain/` 所有協議。
