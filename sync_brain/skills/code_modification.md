# Skill: Code Modification (代碼修改規則)

當使用者要求修改程式碼或修復 Bug 時，請遵循以下步驟：

1. **先讀後改**: 永遠先使用 `read_file` 讀取檔案全文，了解脈絡。
2. **理解架構**: 檢查是否涉及 `config.py` 或核心 service。
3. **安全修改**: 使用 `write_file` 覆寫檔案時，確保語法正確（包含縮進與冒號）。
4. **完整紀錄**: 修改完成後，必須在對話中告知使用者修改了哪些行，並在 `evolution_log.json` 中留下摘要。
5. **考慮副作用**: 注意是否會打破循環引用 (Circular Imports)。
