# Skill: Hugging Face Accelerate (加速庫使用指南)

由於 `chub` 在抓取 `accelerate` 時發生 Windows 相容性錯誤，此文件作為本地替代方案。

## 概述
`accelerate` 是用於簡化 PyTorch 模型分佈式訓練與推理的庫。

## 核心用法
1. **初始化**: `accelerator = Accelerator()`
2. **準備模型與數據**: `model, optimizer, data = accelerator.prepare(model, optimizer, data)`
3. **進行回傳**: `accelerator.backward(loss)`
4. **設備管理**: 它會自動處理 CPU/GPU/MPS 切換。

## 常見問題
- **Windows 報錯**: 如果在 Windows 上使用 `chub` 崩潰，請直接參考此本地 Skill。
- **環境變數**: 確保 `accelerate config` 已執行過。
