# 使用 Python 3.11 映像檔
FROM python:3.11-slim-bookworm

# 安裝 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# 設定工作目錄
WORKDIR /app

# 複製依賴文件
COPY pyproject.toml uv.lock ./

# 安裝依賴 (不使用虛擬環境，直接安裝在系統中以減少映像檔大小)
RUN uv sync --frozen --no-cache

# 複製程式碼
COPY . .

# 曝露埠號 (Render.com 預設為 10000)
EXPOSE 10000

# 啟動命令
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
