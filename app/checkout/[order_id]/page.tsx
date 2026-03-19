"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ShoppingCart, MapPin, Phone, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Camera, ImagePlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export default function CheckoutPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const orderId = params.order_id as string
  const { toast } = useToast()

  // 優先從查詢參數獲取後端 URL，否則使用預設值
  const backendUrl = searchParams.get("backend") || searchParams.get("b") || "https://echoorder-buffer.onrender.com"
  
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isParsing, setIsParsing] = useState(false)

  // 表單資料
  const [formData, setFormData] = useState({
    buyer_name: "",
    shipping_info: "",
    phone: ""
  })

  // 防止重複提示門市資訊
  const [storeInfoApplied, setStoreInfoApplied] = useState(false)

    useEffect(() => {
      if (storeInfoApplied) return
      
      const storeId = searchParams.get('storeId')
      const storeName = searchParams.get('storeName')
      
      if (storeName) {
        setFormData(prev => ({
          ...prev,
          shipping_info: `${storeId ? storeId + ' ' : ''}${storeName}`
        }))
        setStoreInfoApplied(true)
        toast({ title: "已自動帶入門市資訊", description: `${storeName} (${storeId})` })
      }
    }, [searchParams, toast, storeInfoApplied])

  // 1. 獲取訂單詳情
  useEffect(() => {
    async function fetchOrder() {
      console.log(`[Checkout] Attempting fetch: ${backendUrl}/api/checkout/${orderId}`);
      try {
        const sig = searchParams.get("s")
        if (!sig) throw new Error("缺少安全驗證碼 (Signature Missing)")

        const res = await fetch(`${backendUrl}/api/checkout/${orderId}?s=${sig}`)
        if (res.status === 403) throw new Error("安全驗證失敗：連結已失效或單號遭竄改")
        if (!res.ok) throw new Error("找不到訂單或訂單已過期")
        const data = await res.json()
        
        if (data.status === "HARVESTED") {
          setIsSuccess(true)
          setOrder(data)
          return
        }
        
        if (data.status !== "PENDING") {
          setIsSuccess(true)
        }
        
        setOrder(data)
        // 預填買家姓名
        setFormData(prev => ({ ...prev, buyer_name: data.fb_user_name || "" }))
      } catch (err: any) {
        console.error(`[Checkout] Fetch failed for ${backendUrl}/api/checkout/${orderId}:`, err);
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [orderId, backendUrl])

  // 2. 提交確認
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.shipping_info || !formData.phone) {
      toast({ title: "請填寫完整資訊", variant: "destructive" })
      return
    }

    // 手機號碼格式檢查 (台灣手機：09 開頭，共 10 碼)
    const phoneRegex = /^09\d{8}$/
    if (!phoneRegex.test(formData.phone)) {
      toast({ 
        title: "手機格式錯誤", 
        description: "請輸入正確的台灣手機號碼 (例如: 0912345678)", 
        variant: "destructive" 
      })
      return
    }

    setSubmitting(true)
    try {
      const sig = searchParams.get("s")
      const res = await fetch(`${backendUrl}/api/checkout/${orderId}/confirm?s=${sig}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setIsSuccess(true)
        toast({ title: "確認成功！", description: "您的訂單已送達賣家，請稍候收割。" })
      } else {
        throw new Error("提交失敗，請稍後再試")
      }
    } catch (err: any) {
      toast({ title: "錯誤", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // 3. AI 圖片填單處理
  const handleAIPhotoFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    try {
      // 1. Convert to base64
      const reader = new FileReader()
      const base64Promise = new Promise((resolve) => {
        reader.onload = () => {
          const result = reader.result?.toString()
          if (result) resolve(result.split(',')[1])
        }
        reader.readAsDataURL(file)
      })
      const base64 = await base64Promise

      // 2. Call API
      const sig = searchParams.get("s")
      const res = await fetch(`${backendUrl}/api/checkout/${orderId}/ai_fill${sig ? `?s=${sig}` : ''}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 })
      })
      
      const result = await res.json()
      if (result.status === "success") {
        const { buyer_name, phone, shipping_info } = result.data
        setFormData(prev => ({
          ...prev,
          buyer_name: buyer_name || prev.buyer_name,
          phone: phone || prev.phone,
          shipping_info: shipping_info || prev.shipping_info
        }))
        toast({ title: "AI 解析成功！", description: "已自動填入收件資訊" })
      } else {
        throw new Error(result.message || "解析失敗")
      }
    } catch (err: any) {
      toast({ title: "解析異常", description: err.message, variant: "destructive" })
    } finally {
      setIsParsing(false)
    }
    // 清空 input 以便下次選擇同一張圖
    e.target.value = ""
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">正在載入訂單...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background px-6">
        <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">訂單連線失敗</h1>
        <p className="text-muted-foreground text-center mb-8 max-w-xs">
          {error === "找不到訂單或訂單已過期" 
            ? "抱歉，伺服器剛剛可能重啟了。賣家正在為您恢復資料，請點擊下方按鈕重試。" 
            : error || "找不到訂單資訊"}
        </p>
        <div className="flex flex-col w-full max-w-xs gap-3">
          <Button onClick={() => window.location.reload()} className="w-full py-6 font-bold shadow-lg">
            重新載入訂單
          </Button>
          <Button 
            variant="outline" 
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back()
              } else {
                window.location.href = "/" // Fallback to shop home
              }
            }}
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> 回到首頁
          </Button>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    const subtotal = order?.items?.reduce((sum: number, i: any) => sum + (i.price || 0) * i.quantity, 0) || 0
    // [LOGISTICS] 依照賣家要求，結帳頁面不預扣免運。
    // 免運統計將在「導出 Excel」時根據跨場次累計件數自動計算。
    const shippingFee = order?.shipping_fee ?? 38
    const totalAmount = subtotal + shippingFee

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-center">
        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {order?.status === "HARVESTED" ? "訂單已收割完成！" : "訂單已確認！"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {order?.status === "HARVESTED" 
            ? "賣家已處理您的訂單，感謝購買。若有疑問請聯絡粉專小幫手。"
            : "感謝您的配合。您的收件資訊已成功記錄。您可以關閉此頁面回到 FB 直播。"}
        </p>
        
        <Card className="w-full max-w-sm shadow-xl border-2 border-primary/20 overflow-hidden" id="qc-card">
          <div className="bg-primary/5 py-3 px-4 border-b border-primary/10 flex justify-between items-center">
            <span className="text-xs font-bold text-primary">QC 核對單據</span>
            <span className="text-[10px] text-muted-foreground">{new Date().toLocaleString()}</span>
          </div>
          <CardHeader className="pb-3 text-left">
            <CardTitle className="text-sm font-medium flex justify-between">
              <span>訂單編號: {orderId}</span>
              <span className="text-primary font-bold">NT$ {totalAmount}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-left text-sm space-y-3">
            <div className="space-y-1 pb-2 border-b border-dashed">
              <p className="flex justify-between"><strong>買家姓名:</strong> <span>{formData.buyer_name || order.buyer_name || order.fb_user_name}</span></p>
              <p className="flex justify-between"><strong>電話:</strong> <span>{formData.phone || order.phone}</span></p>
              <p className="flex justify-between"><strong>7-11 門市:</strong> <span className="text-xs">{formData.shipping_info || order.shipping_info}</span></p>
            </div>
            
            <div className="space-y-1">
              <p className="font-bold text-xs mb-1">訂購品項：</p>
              {order.items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.product_code} ({item.product_name}) x {item.quantity}</span>
                  <span>${(item.price || 0) * item.quantity}</span>
                </div>
              ))}
              
              {/* [SHIPPING HIDE] 依賣家要求，對外隱藏費用拆分細節 */}
              <div className="flex justify-between font-bold text-sm pt-1 border-t-2 border-double border-primary/20">
                <span>應付總額</span>
                <span className="text-primary">NT$ {totalAmount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 w-full max-w-sm space-y-3">
          <Button 
            className="w-full py-6 font-bold flex items-center gap-2 shadow-lg"
            onClick={() => window.print()} 
          >
            <Camera className="h-5 w-5" /> 📸 點我截圖/列印存證 (QC)
          </Button>
          <p className="text-[10px] text-muted-foreground">
            💡 建議手動截圖以上卡片，或點擊按鈕另存成 PDF 核對。
          </p>
        </div>
      </div>
    )
  }

  const subtotal = order?.items?.reduce((sum: number, i: any) => sum + (i.price || 0) * i.quantity, 0) || 0
  const shippingFee = order?.shipping_fee ?? 38
  const totalAmount = subtotal + shippingFee

  return (
    <div className="max-w-lg mx-auto min-h-screen p-4 py-8 space-y-6">
      <header className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
          <ShoppingCart className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">直播訂單確認</h1>
        <p className="text-muted-foreground">請確認您的喊單內容並填寫收件資訊</p>
      </header>

      {/* 訂單內容摘要 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">您的喊單清單</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0 border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center font-bold text-lg">
                    {item.product_code}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{item.product_name || `今日特選商品 ${item.product_code}`}</span>
                    <span className="text-xs text-muted-foreground">${item.price || 0} x {item.quantity}</span>
                  </div>
                </div>
                <div className="text-sm font-bold">${(item.price || 0) * item.quantity}</div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">商品小計</span>
              <span>${subtotal}</span>
            </div>
            
            {/* [SHIPPING HIDE] 依賣家要求，不揭露運費細節給買家 */}
            <div className="flex justify-between font-bold text-lg pt-2 border-t-2 border-double mt-2">
              <span>應付總額</span>
              <span className="text-primary">
                NT$ {totalAmount}
              </span>
            </div>
          </div>

          <div className="mt-4 text-[10px] text-muted-foreground text-center">
            訂單編號: <code className="bg-muted px-1 rounded">{orderId}</code>
          </div>
        </CardContent>
      </Card>

      {/* 填寫物流資訊 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                收件資訊
              </div>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  id="ai-image-upload" 
                  onChange={handleAIPhotoFill}
                  disabled={isParsing}
                />
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-bold transition-all px-3"
                  onClick={() => document.getElementById('ai-image-upload')?.click()}
                  disabled={isParsing}
                >
                  {isParsing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 mr-1" />
                  )}
                  📸 AI 拍照填單
                </Button>
              </div>
            </CardTitle>
            <CardDescription>目前支援 7-11 店到店或自行輸入地址</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buyer_name">買家姓名 / FB 名稱</Label>
              <Input 
                id="buyer_name" 
                placeholder="您的稱呼"
                value={formData.buyer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, buyer_name: e.target.value }))}
                required
              />
              <p className="text-[10px] text-muted-foreground">
                💡 已自動帶入您的 FB 名稱，如有需要可修改。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping">7-11 門市號碼/名稱 或 收件地址</Label>
              <div className="flex gap-2">
                <Input 
                  id="shipping" 
                  placeholder="例如: 123456 某某門市 或 台北市..."
                  value={formData.shipping_info}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipping_info: e.target.value }))}
                  required
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  className="shrink-0 flex items-center gap-1 h-10 px-3"
                  onClick={() => {
                    const sig = searchParams.get('s')
                    const callbackUrl = encodeURIComponent(`${window.location.origin}/api/checkout/emap-callback?order_id=${orderId}&backend=${backendUrl}${sig ? `&s=${sig}` : ''}`)
                    const emapUrl = `https://emap.presco.com.tw/c2cemap.ashx?eshopid=870&servicetype=1&url=${callbackUrl}`
                    window.location.href = emapUrl
                  }}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  選取門市
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                💡 點擊「選取門市」可直接開啟地圖地圖，選完後會自動帶回。
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">手機號碼</Label>
              <Input 
                id="phone" 
                type="tel"
                placeholder="0912345678"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                required
                pattern="09\d{8}"
                title="請輸入 10 碼台灣手機號碼 (09xxxxxxxx)"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full py-6 text-lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              提交中...
            </>
          ) : (
            "確認並成立訂單"
          )}
        </Button>
      </form>

      <footer className="text-center text-xs text-muted-foreground py-4">
        <p>您的個人資訊僅用於此次物流寄送，系統不保留刷卡或敏感金鑰資料。</p>
      </footer>
    </div>
  )
}
