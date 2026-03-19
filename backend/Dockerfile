# 使用 Python 3.11 映像檔
FROM python:3.11-slim-bookworm

# 安裝 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# 設定工作目錄
WORKDIR /app

# 複製依賴文件
COPY requirements.txt ./

# 安裝依賴 (使用 uv pip 以加速安裝，--system 表示安裝到系統環境)
RUN uv pip install --system --no-cache -r requirements.txt

# 複製程式碼
COPY . .

# 曝露埠號 (Render.com 預設為 10000)
EXPOSE 10000

# 啟動命令 (使用 /bin/sh 以執行環境變數替換)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
