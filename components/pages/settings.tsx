"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Download, Upload, Trash2, Database, Shield, Info, Key } from "lucide-react"
import { useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SettingsPage() {
  const { batches, items, shipments, sales, clearData, mergeData, geminiApiKey, setGeminiApiKey, backendUrl, setBackendUrl } = useAppStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, mode: "replace" | "merge") => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsedData = JSON.parse(content)

        // Basic structural validation
        if (
          !Array.isArray(parsedData.batches) ||
          !Array.isArray(parsedData.items) ||
          !Array.isArray(parsedData.sales)
        ) {
          throw new Error("備份檔案格式不正確")
        }

        if (mode === "replace") {
          // Update Store (Overwrite)
          useAppStore.setState({
            batches: parsedData.batches,
            items: parsedData.items,
            shipments: parsedData.shipments || [],
            sales: parsedData.sales,
            geminiApiKey: parsedData.geminiApiKey || ""
          })
        } else {
          // Smart Merge
          mergeData(parsedData)
        }

        toast({
          title: mode === "replace" ? "還原成功" : "合併成功",
          description: mode === "replace" ? "資料已成功還原" : "資料已完成累計合併",
        })
      } catch (error: any) {
        toast({
          title: "匯入失敗",
          description: error.message || "檔案讀取錯誤",
          variant: "destructive",
        })
      }
    }
    reader.readAsText(file)
    // Clear input
    e.target.value = ""
  }

  const handleExport = () => {
    const dataObj = useAppStore.getState()
    const data = JSON.stringify(dataObj, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `logistics-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "匯出成功",
      description: "備份檔案已下載",
    })
  }

  const handleClearAll = () => {
    clearData()
    toast({
      title: "資料已清空",
      description: "所有本地資料已被刪除",
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">設定與備份</h1>
        <p className="text-sm text-muted-foreground">管理您的本地資料</p>
      </header>

      {/* Data Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            資料統計
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{shipments.length + batches.length}</p>
              <p className="text-xs text-muted-foreground">進貨與批次</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-muted-foreground">商品</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{sales.length}</p>
              <p className="text-xs text-muted-foreground">銷售紀錄</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            AI 辨識與直播設定
          </CardTitle>
          <CardDescription>
            配置您的 Gemini API 與 EchoOrder 緩衝閘道
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="apiKey" className="text-muted-foreground text-xs">
              Gemini API Key (用於單據辨識)
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="AIzaSy..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="backendUrl" className="text-muted-foreground text-xs">
              EchoOrder 緩衝閘道 URL (Render.com)
            </Label>
            <Input
              id="backendUrl"
              type="text"
              placeholder="https://your-app.onrender.com"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Export & Import */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">資料備份</CardTitle>
            <CardDescription>
              將資料匯出為 JSON 檔案
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              匯出資料 (JSON)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">資料還原與累計</CardTitle>
            <CardDescription>
              上傳備份檔進行覆蓋或累計合併
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={(e) => {
                const mode = (e.target as any)._mode || "merge"
                handleImport(e, mode)
              }}
              className="hidden"
            />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="outline" onClick={() => { (fileInputRef.current as any)._mode = "merge" }}>
                  <Upload className="h-4 w-4 mr-2" />
                  累計合併 (Master 模式)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>進行智慧累計合併？</AlertDialogTitle>
                  <AlertDialogDescription>
                    系統將把備份檔中的新資料「加進」目前的手機中。若 ID 重複則會更新該筆內容，這適合用於每個月的月報備份累加成總表。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => fileInputRef.current?.click()}>
                    確定合併
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="ghost" size="sm" onClick={() => { (fileInputRef.current as any)._mode = "replace" }}>
                  還原並覆蓋所有資料
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要「完全覆蓋」嗎？</AlertDialogTitle>
                  <AlertDialogDescription>
                    這會刪除目前手機裡的所有資料，並改用備份檔中的內容。此動作無法復原。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => fileInputRef.current?.click()} className="bg-destructive text-destructive-foreground">
                    確定覆蓋
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            隱私說明
          </CardTitle>
        </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            本系統採用 Local-First 架構，您的所有資料皆儲存於手機瀏覽器的本地空間中。
          </p>
          <p>
            我們不會將您的進銷存資料上傳至任何雲端伺服器。單據辨識功能僅傳送圖片至 AI 服務進行文字辨識，辨識完成後圖片立即丟棄，不會保留。
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            危險區域
          </CardTitle>
          <CardDescription>
            清空所有資料後將無法復原，請先匯出備份
          </CardDescription>
        </CardHeader>
          <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                清空所有本地資料
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>確定要清空所有資料嗎？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作將永久刪除所有批次、商品、銷售紀錄等資料，且無法復原。
                  建議您先匯出備份。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  className="border border-destructive text-destructive bg-background hover:bg-destructive/10"
                >
                  確定清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Info className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-medium">物流與取貨記帳系統</p>
              <p className="text-xs text-muted-foreground">Local-First MVP v1.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
