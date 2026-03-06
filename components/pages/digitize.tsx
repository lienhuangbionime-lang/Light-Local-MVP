"use client"

import React, { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Upload, Plus, Trash2, Calculator, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ImportItem {
  id: string
  name: string
  foreignPrice: number
  quantity: number
}

export function DigitizePage() {
  const { addBatch, addItem: addStoreItem, addShipment, batches, geminiApiKey } = useAppStore()
  const { toast } = useToast()

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [hasUploaded, setHasUploaded] = useState(false)
  const [shipmentName, setShipmentName] = useState("")
  const [exchangeRate, setExchangeRate] = useState("800")
  const [shippingCost, setShippingCost] = useState("1500")
  const [items, setItems] = useState<ImportItem[]>([
    { id: "1", name: "", foreignPrice: 0, quantity: 1 },
  ])

  const handleUpload = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    if (!e || !e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    setIsUploading(true)

    try {
      // 1. Convert to Base64 using a Promise so we can await it
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = () => reject(new Error("Failed to read file"))
      })

      // 2. Call OCR Endpoint
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64String,
          mimeType: file.type || "image/jpeg",
          apiKey: geminiApiKey
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "API 發生錯誤，請檢查 API Key 是否正確或圖片大小")
      }

      const data = await response.json()

      if (data.items && Array.isArray(data.items)) {
        const mappedItems = data.items.map((item: any) => ({
          id: crypto.randomUUID(),
          name: item.name || "未命名商品",
          foreignPrice: item.foreignPrice || 0,
          quantity: item.quantity || 1
        }))

        setItems(mappedItems)
        setShipmentName(`${new Date().toLocaleDateString("zh-TW")} 機辨進單`)
        setHasUploaded(true)

        toast({
          title: "單據辨識完成",
          description: `成功辨識 ${mappedItems.length} 項商品，請確認後提交`,
        })
      } else {
        throw new Error("Invalid format from OCR")
      }
    } catch (error: any) {
      console.error(error)
      toast({
        title: "圖片辨識失敗",
        description: error.message || "系統無法辨識此圖片內容，請使用手動輸入",
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const calculateTwdCost = (item: ImportItem) => {
    const rate = parseFloat(exchangeRate) || 800
    const baseTwd = item.foreignPrice * (1000 / rate)

    // Convert shipping from VND to TWD
    const shippingVnd = parseFloat(shippingCost) || 0
    const totalShippingTwd = shippingVnd * (1000 / rate)

    const validItems = items.filter(i => i.name.trim() && i.quantity > 0)
    const totalQuantity = validItems.reduce((sum, i) => sum + i.quantity, 0)

    const shippingPerItemTwd = totalQuantity > 0 ? (totalShippingTwd / totalQuantity) : 0
    const itemShippingTwd = shippingPerItemTwd * item.quantity

    return Math.round(baseTwd + (itemShippingTwd / item.quantity))
  }

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), name: "", foreignPrice: 0, quantity: 1 },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof ImportItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  const handleSubmit = () => {
    if (!shipmentName.trim()) {
      toast({
        title: "請輸入批次名稱",
        variant: "destructive",
      })
      return
    }

    const validItems = items.filter((item) => item.name.trim() && item.quantity > 0)
    if (validItems.length === 0) {
      toast({
        title: "請至少新增一項商品",
        variant: "destructive",
      })
      return
    }

    // 1. Create a quick batch for this legacy M3 process
    const tempBatchId = crypto.randomUUID()
    const rate = parseFloat(exchangeRate) || 800

    addBatch({
      id: tempBatchId,
      name: shipmentName,
      exchangeRate: rate
    })

    // 2. Add Items FIRST
    validItems.forEach((item) => {
      addStoreItem({
        name: item.name,
        foreignCost: item.foreignPrice,
        quantity: item.quantity,
        batchId: tempBatchId,
        weightRatio: 1 // Default
      })
    })

    // 3. Add Shipments LAST (so it can amortize over items)
    const shippingVnd = parseFloat(shippingCost) || 0
    const totalShippingTwd = shippingVnd * (1000 / rate)

    addShipment({
      batchId: tempBatchId,
      totalCostTWD: totalShippingTwd,
      amortizationMethod: "count", // Default to count for manual digitize entry
    })

    toast({
      title: "進貨成功",
      description: `已新增 ${validItems.length} 項商品`,
    })

    // Reset form
    setHasUploaded(false)
    setShipmentName("")
    setItems([{ id: "1", name: "", foreignPrice: 0, quantity: 1 }])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">單據辨識與進貨</h1>
        <p className="text-sm text-muted-foreground">上傳單據或手動輸入品項</p>
      </header>

      {/* Upload Area */}
      {!hasUploaded && (
        <Card className="border-dashed border-2">
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                {isUploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                ) : (
                  <Camera className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="text-center">
                <p className="font-medium">
                  {isUploading ? "正在辨識中..." : "上傳或拍攝單據"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  支援圖片格式，將自動辨識品項
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={handleUpload}
                  className="hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleUpload}
                  className="hidden"
                />

                <Button onClick={() => cameraInputRef.current?.click()} disabled={isUploading}>
                  <Camera className="h-4 w-4 mr-2" />
                  拍攝
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  上傳
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHasUploaded(true)}
                className="text-muted-foreground"
              >
                或直接手動輸入
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Form */}
      {hasUploaded && (
        <>
          {/* Batch Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                批次資訊
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="shipmentName">批次名稱</Label>
                <Input
                  id="shipmentName"
                  value={shipmentName}
                  onChange={(e) => setShipmentName(e.target.value)}
                  placeholder="例：2024年3月 河內批貨"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="exchangeRate">匯率 (VND → TWD)</Label>
                  <Input
                    id="exchangeRate"
                    type="number"
                    step="0.00001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="shippingCost">總運費 (VND)</Label>
                  <Input
                    id="shippingCost"
                    type="number"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">品項清單</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-muted/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">品項 {index + 1}</span>
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="品名"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">外幣單價 (VND)</Label>
                      <Input
                        type="number"
                        value={item.foreignPrice || ""}
                        onChange={(e) =>
                          updateItem(item.id, "foreignPrice", parseInt(e.target.value) || 0)
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">數量</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, "quantity", parseInt(e.target.value) || 1)
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {item.foreignPrice > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm text-muted-foreground">預估台幣成本</span>
                      <span className="font-semibold text-primary">
                        ${calculateTwdCost(item).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addItem}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                新增品項
              </Button>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button onClick={handleSubmit} className="w-full h-12 text-base">
            <Check className="h-5 w-5 mr-2" />
            確認進貨
          </Button>
        </>
      )}
    </div>
  )
}
