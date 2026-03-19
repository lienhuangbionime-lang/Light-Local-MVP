# Skill: Backend Debugging (後端除錯協定)

當遇到傳回 500 錯誤或 API 不通時，優先檢查以下事項：

1. **循環引用 (Circular Imports)**: 檢查 `main.py` 的 top-level import，若有新增 service，請改用 Local Import (在函數內部 import)。
2. **Config 屬性**: 檢查 `backend/config.py` 是否缺少環境變數，或屬性名稱拼寫錯誤。
3. **路徑解析**: 在 Windows 環境下，確保 `os.path.join` 使用正確，特別是 `sync_brain` 的相對路徑。
4. **FastAPI 型別**: 確定 Pydantic Model 與前端傳來的 JSON 結構一致。
5. **日誌分析**: 優先讀取 `/api/health` 的回傳內容，判斷是否為 `AttributeError` 或 `ModuleNotFoundError`。
