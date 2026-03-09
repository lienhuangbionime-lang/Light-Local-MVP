"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ShoppingCart, MapPin, Phone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

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

  // 表單資料
  const [formData, setFormData] = useState({
    buyer_name: "",
    shipping_info: "",
    phone: ""
  })

  // 0. 從 URL 參數自動帶入門市 (回傳時)
  useEffect(() => {
    const storeId = searchParams.get('storeId')
    const storeName = searchParams.get('storeName')
    if (storeName) {
      setFormData(prev => ({
        ...prev,
        shipping_info: `${storeId ? storeId + ' ' : ''}${storeName}`
      }))
      toast({ title: "已自動帶入門市資訊", description: `${storeName} (${storeId})` })
    }
  }, [searchParams, toast])

  // 1. 獲取訂單詳情
  useEffect(() => {
    async function fetchOrder() {
      console.log(`[Checkout] Attempting fetch: ${backendUrl}/api/checkout/${orderId}`);
      try {
        const res = await fetch(`${backendUrl}/api/checkout/${orderId}`)
        if (!res.ok) throw new Error("找不到訂單或訂單已過期")
        const data = await res.json()
        
        if (data.status !== "PENDING") {
          setIsSuccess(true) // 如果已經不是 PENDING，通常代表已收割或已確認
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
      const res = await fetch(`${backendUrl}/api/checkout/${orderId}/confirm`, {
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">發生錯誤</h1>
        <p className="text-muted-foreground text-center mb-6">{error || "找不到訂單資訊"}</p>
        <Button onClick={() => window.location.reload()}>重新載入</Button>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-center">
        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">訂單已確認！</h1>
        <p className="text-muted-foreground mb-8">
          感謝您的配合。您的收件資訊已成功記錄。<br />
          您可以關閉此頁面回到 FB 直播。
        </p>
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3 text-left">
            <CardTitle className="text-sm font-medium">訂單編號: {orderId}</CardTitle>
          </CardHeader>
          <CardContent className="text-left text-sm space-y-1">
            <p><strong>買家姓名:</strong> {formData.buyer_name || order.buyer_name || order.fb_user_name}</p>
            <p><strong>門市/地址:</strong> {formData.shipping_info || order.shipping_info}</p>
            <p><strong>電話:</strong> {formData.phone || order.phone}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

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
                  <span className="font-medium text-sm">今日特選商品 {item.product_code}</span>
                </div>
                <div className="text-sm font-bold">x {item.quantity}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
            訂單編號: <code className="bg-muted px-1 rounded">{orderId}</code>
          </div>
        </CardContent>
      </Card>

      {/* 填寫物流資訊 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              收件資訊
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
                    const callbackUrl = encodeURIComponent(`${window.location.origin}/api/checkout/emap-callback?order_id=${orderId}&backend=${backendUrl}`)
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
