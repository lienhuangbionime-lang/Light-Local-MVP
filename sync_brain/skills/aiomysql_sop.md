# Skill: aiomysql (非同步 MySQL 驅動程式)

由於 `chub` 在抓取 `aiomysql` 時發生 Windows 相容性錯誤，此文件作為本地替代方案。

## 概述
`aiomysql` 是一個基於 `asyncio` 的 MySQL 驅動程式，常用於 FastAPI 或其它非同步 Python 框架。

## 核心用法
1. **建立連接**: `conn = await aiomysql.connect(host='...', port=3306, user='...', password='...', db='...')`
2. **使用遊標**: `async with conn.cursor() as cur: await cur.execute("SELECT ...")`
3. **連接池 (Pool)**: `pool = await aiomysql.create_pool(host='...', ...)`

## 常見問題
- **Windows 報錯**: 如果在 Windows 上使用 `chub` 崩潰，請直接參考此本地 Skill。
- **依賴**: 確保已安裝 `PyMySQL`。
