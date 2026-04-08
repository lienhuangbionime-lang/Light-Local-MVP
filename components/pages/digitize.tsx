"use client"

import React, { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Upload, Plus, Trash2, Calculator, Check, Minus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"

interface ImportItem {
  id: string
  name: string
  foreignPrice: number
  quantity: number | ""
  description?: string
  material?: string
  sizes?: string
  colors?: string
  suggestedPrice?: string
}

export function DigitizePage() {
  const { addBatch, addItem: addStoreItem, addShipment, batches, geminiApiKey } = useAppStore()
  const { toast } = useToast()
  const { t } = useTranslation()

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [hasUploaded, setHasUploaded] = useState(false)
  const [shipmentName, setShipmentName] = useState("")
  const [exchangeRate, setExchangeRate] = useState("800")
  const [shippingCost, setShippingCost] = useState("1500")
  const [items, setItems] = useState<ImportItem[]>([
    { id: "1", name: "", foreignPrice: 0, quantity: 1, description: "", material: "", sizes: "", colors: "", suggestedPrice: "" },
  ])
  const [isListening, setIsListening] = useState(false)

  const handleUpload = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    if (!e || !e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    setIsUploading(true)

    try {
      const reader = new FileReader()
      const base64String = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read file"))
      })

      // 1. Detect Backend URL (preferring cloud if on Vercel)
      const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
      const searchParams = new URLSearchParams(window.location.search);
      const cloudBackend = searchParams.get('backend') || (isVercel ? "https://light-local-mvp.onrender.com" : "");
      
      const apiBase = cloudBackend || "";
      
      // 2. Start Async OCR Job
      const startRes = await fetch(`${apiBase}/api/digitize/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64String })
      })

      if (!startRes.ok) throw new Error("無法啟動辨識任務")
      const { job_id } = await startRes.json()

      // 3. Poll for result
      let attempts = 0
      const maxAttempts = 30 // 60 seconds total
      
      const poll = async (): Promise<any> => {
        if (attempts >= maxAttempts) throw new Error("辨識逾時，請重試")
        attempts++
        
        const statusRes = await fetch(`${apiBase}/api/digitize/${job_id}/status`)
        const statusData = await statusRes.json()
        
        if (statusData.ai_status === "done") return statusData.data
        if (statusData.ai_status === "failed") throw new Error(statusData.ai_error || "辨識失敗")
        
        await new Promise(r => setTimeout(r, 2000))
        return poll()
      }

      const extracted = await poll()

      if (extracted && extracted.items) {
        const mappedItems = extracted.items.map((item: any) => ({
          id: crypto.randomUUID(),
          name: item.name || t("digitize.unnamed_product"),
          foreignPrice: item.foreignPrice || 0,
          quantity: item.quantity || 1,
          description: "", material: "", sizes: "", colors: "", suggestedPrice: ""
        }))

        setItems(mappedItems)
        setShipmentName(t("digitize.shipment_name_template").replace("{date}", new Date().toLocaleDateString("zh-TW")))
        setHasUploaded(true)

        toast({
          title: t("digitize.toast_success_title"),
          description: t("digitize.toast_success_desc").replace("{count}", mappedItems.length.toString()),
        })
      }
    } catch (error: any) {
      console.error(error)
      toast({
        title: t("digitize.toast_error_title"),
        description: error.message || t("digitize.toast_error_desc"),
        variant: "destructive"
      })
    } finally {
      setIsUploading(false)
    }
  }

  const calculateTwdCost = (item: ImportItem) => {
    const rate = parseFloat(exchangeRate) || 800
    const baseTwd = item.foreignPrice * (1000 / rate)
    const qty = Number(item.quantity) || 0

    // Convert shipping from VND to TWD
    const shippingVnd = parseFloat(shippingCost) || 0
    const totalShippingTwd = shippingVnd * (1000 / rate)

    const validItems = items.filter(i => i.name.trim() && (Number(i.quantity) || 0) > 0)
    const totalQuantity = validItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)

    const shippingPerItemTwd = totalQuantity > 0 ? (totalShippingTwd / totalQuantity) : 0
    const itemShippingTwd = shippingPerItemTwd * (Number(item.quantity) || 0)

    return Math.round(baseTwd + (itemShippingTwd / (Number(item.quantity) || 1)))
  }

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), name: "", foreignPrice: 0, quantity: 1, description: "", material: "", sizes: "", colors: "", suggestedPrice: "" },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof ImportItem, value: string | number) => {
    const { items: storeItems } = useAppStore.getState();
    
    setItems(prevItems =>
      prevItems.map((item) => {
        if (item.id !== id) return item;
        
        let processedValue = value;
        // Allow empty string for numeric fields during editing
        if ((field === "quantity" || field === "foreignPrice") && value === "") {
          processedValue = "";
        }
        
        const newItem = { ...item, [field]: processedValue };
        
        if (field === "name" && typeof value === "string" && value.trim()) {
          const match = storeItems.find(si => si.name.toLowerCase().trim() === value.toLowerCase().trim());
          if (match) {
            newItem.material = newItem.material || match.material || "";
            newItem.sizes = newItem.sizes || match.sizes || "";
            newItem.colors = newItem.colors || match.colors || "";
            newItem.description = newItem.description || match.description || "";
            newItem.suggestedPrice = newItem.suggestedPrice || match.suggestedPrice || "";
          }
        }
        
        return newItem;
      })
    )
  }

  const splitItemBySizes = (id: string, breakdown: Record<string, number>) => {
    const itemToSplit = items.find(i => i.id === id);
    if (!itemToSplit) return;

    const newItems: ImportItem[] = [];
    Object.entries(breakdown).forEach(([size, qty]) => {
      if (qty > 0) {
        newItems.push({
          ...itemToSplit,
          id: crypto.randomUUID(),
          quantity: qty,
          sizes: size.trim()
        });
      }
    });

    if (newItems.length > 0) {
      setItems(prev => {
        const idx = prev.findIndex(p => p.id === id);
        const result = [...prev];
        result.splice(idx, 1, ...newItems);
        return result;
      });
    }
  }

  const handleSubmit = () => {
    if (!shipmentName.trim()) {
      toast({
        title: t("digitize.error_batch_name"),
        variant: "destructive",
      })
      return
    }

    const validItems = items.filter((item) => item.name.trim() && (Number(item.quantity) || 0) > 0)
    if (validItems.length === 0) {
      toast({
        title: t("digitize.error_no_items"),
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
        quantity: Number(item.quantity) || 1,
        batchId: tempBatchId,
        weightRatio: 1, // Default
        description: item.description,
        material: item.material,
        sizes: item.sizes,
        colors: item.colors,
        suggestedPrice: item.suggestedPrice
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
      title: t("digitize.toast_import_success_title"),
      description: t("digitize.toast_import_success_desc").replace("{count}", validItems.length.toString()),
    })

    // Reset form
    setHasUploaded(false)
    setShipmentName("")
    setItems([{ id: "1", name: "", foreignPrice: 0, quantity: 1, description: "", material: "", sizes: "", colors: "", suggestedPrice: "" }])
  }

  const handleVoiceInput = (transcript: string) => {
    // Basic parser for "Product Name Quantity"
    // e.g., "Apple 10", "蘋果 十", "Bánh 5"
    const match = transcript.match(/^(.+?)\s*(\d+)$/);
    if (match) {
      const name = match[1].trim();
      const qty = parseInt(match[2]);
      if (name) {
        setItems(prev => [
          ...prev.filter(i => i.name.trim() !== "" || i.foreignPrice !== 0), // Remove empty rows
          { id: crypto.randomUUID(), name, foreignPrice: 0, quantity: qty, description: "Voice Input", material: "", sizes: "", colors: "", suggestedPrice: "" }
        ]);
        toast({ title: t("digitize.voice_added") || "語音加入成功", description: `${name} x ${qty}` });
      }
    } else {
      // Fallback: just add the whole transcript as name
      setItems(prev => [
        ...prev.filter(i => i.name.trim() !== "" || i.foreignPrice !== 0),
        { id: crypto.randomUUID(), name: transcript, foreignPrice: 0, quantity: 1, description: "Voice Input", material: "", sizes: "", colors: "", suggestedPrice: "" }
      ]);
      toast({ title: t("digitize.voice_added") || "語音加入成功", description: transcript });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">{t("digitize.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("digitize.subtitle")}</p>
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
                  {isUploading ? t("digitize.uploading") : t("digitize.upload_prompt")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("digitize.upload_desc")}
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
                  {t("digitize.camera_btn")}
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("digitize.upload_btn")}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHasUploaded(true)}
                className="text-muted-foreground"
              >
                {t("digitize.manual_input_btn")}
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
                {t("digitize.batch_info")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="shipmentName">{t("digitize.batch_name")}</Label>
                <Input
                  id="shipmentName"
                  value={shipmentName}
                  onChange={(e) => setShipmentName(e.target.value)}
                  placeholder={t("digitize.batch_name_placeholder")}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="exchangeRate">{t("digitize.exchange_rate")}</Label>
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
                  <Label htmlFor="shippingCost">{t("digitize.shipping_cost")}</Label>
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
              <CardTitle className="text-base">{t("digitize.items_list")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-muted/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t("digitize.item_label").replace("{index}", (index + 1).toString())}</span>
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
                    placeholder={t("digitize.product_name")}
                    value={item.name}
                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">{t("digitize.foreign_price")}</Label>
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
                      <Label className="text-xs text-muted-foreground">{t("digitize.quantity")}</Label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, "quantity", e.target.value === "" ? "" : (parseInt(e.target.value) || ""))
                          }
                          onBlur={(e) => {
                            if (e.target.value === "" || parseInt(e.target.value) < 1) {
                              updateItem(item.id, "quantity", 1)
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          className="h-9"
                        />
                        {item.sizes && item.sizes.includes(",") && (
                          <SizeSplitter 
                            total={Number(item.quantity) || 0} 
                            sizeString={item.sizes} 
                            onConfirm={(breakdown) => splitItemBySizes(item.id, breakdown)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border/50 pt-3 mt-1">
                    <div className="grid grid-cols-3 gap-2">
                       <div>
                        <Label className="text-[10px] text-muted-foreground">{t("digitize.material")}</Label>
                        <Input
                          placeholder={t("digitize.material_placeholder")}
                          value={item.material}
                          onChange={(e) => updateItem(item.id, "material", e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t("digitize.size")}</Label>
                        <Input
                          placeholder={t("digitize.size_placeholder")}
                          value={item.sizes}
                          onChange={(e) => updateItem(item.id, "sizes", e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">{t("digitize.color")}</Label>
                        <Input
                          placeholder={t("digitize.color_placeholder")}
                          value={item.colors}
                          onChange={(e) => updateItem(item.id, "colors", e.target.value)}
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">{t("digitize.ai_desc")}</Label>
                      <textarea
                        className="w-full min-h-[60px] p-2 text-xs rounded-md border border-input bg-background"
                        placeholder={t("digitize.ai_desc_placeholder")}
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      />
                    </div>
                  </div>
                  {item.foreignPrice > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm text-muted-foreground">{t("digitize.est_twd_cost")}</span>
                      <span className="font-semibold text-primary">
                        ${calculateTwdCost(item).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={addItem}
                  className="flex-1 border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("digitize.add_item_btn")}
                </Button>
                <VoiceButton onTranscript={handleVoiceInput} language={useAppStore.getState().language} />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button onClick={handleSubmit} className="w-full h-12 text-base">
            <Check className="h-5 w-5 mr-2" />
            {t("digitize.submit_btn")}
          </Button>
        </>
      )}
    </div>
  )
}

function SizeSplitter({ total, sizeString, onConfirm }: { total: number, sizeString: string, onConfirm: (breakdown: Record<string, number>) => void }) {
  const { t } = useTranslation()
  const sizes = sizeString.split(",").map(s => s.trim()).filter(Boolean);
  const [breakdown, setBreakdown] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    sizes.forEach(s => initial[s] = 0);
    if (sizes.length > 0) initial[sizes[0]] = total;
    return initial;
  });

  const [isOpen, setIsOpen] = useState(false);

  const adjust = (size: string, delta: number) => {
    const mainSize = sizes[0];
    if (size === mainSize) return; // Main size holds the remainder
    
    if (breakdown[mainSize] - delta < 0) return; // No more pieces to move
    if (breakdown[size] + delta < 0) return; // Can't go negative

    setBreakdown(prev => ({
      ...prev,
      [mainSize]: prev[mainSize] - delta,
      [size]: prev[size] + delta
    }));
  };

  if (!isOpen) {
    return (
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-primary border-primary/20" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle className="text-sm">{t("digitize.size_splitter_title").replace("{total}", total.toString())}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {sizes.map((s, i) => (
            <div key={s} className="flex items-center justify-between bg-muted/30 p-2 rounded border">
              <span className="text-xs font-bold">{s}</span>
              <div className="flex items-center gap-2">
                {i > 0 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => adjust(s, -1)} disabled={breakdown[s] <= 0}>
                    <Minus className="h-3 w-3" />
                  </Button>
                )}
                <span className="text-sm font-mono w-6 text-center">{breakdown[s]}</span>
                {i > 0 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => adjust(s, 1)} disabled={breakdown[sizes[0]] <= 0}>
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="sm:justify-start">
          <Button className="w-full text-xs" onClick={() => { onConfirm(breakdown); setIsOpen(false); }}>{t("digitize.size_splitter_confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VoiceButton({ onTranscript, language }: { onTranscript: (t: string) => void, language: string }) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "不支援語音", description: "您的瀏覽器不支援 Web Speech API", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "vi" ? "vi-VN" : "zh-TW";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("[SPEECH ERROR]", event.error);
      setIsListening(false);
      
      let errorMsg = "語音辨識發生錯誤";
      let errorDesc = event.error;

      if (event.error === "not-allowed") {
        errorMsg = "權限被拒絕";
        errorDesc = "請檢查瀏覽器設定，確保已允許麥克風權限。\n若是在區域網路環境，請使用 localhost 或 HTTPS 存取。";
      } else if (event.error === "no-speech") {
        errorMsg = "未偵測到聲音";
        errorDesc = "請再試一次，並確保麥克風收音正常。";
      } else if (event.error === "network") {
        errorMsg = "網路連線錯誤";
        errorDesc = "Google 語音辨識需要網際網路連線。";
      }

      toast({ 
        title: errorMsg, 
        description: errorDesc, 
        variant: "destructive" 
      });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };

    recognition.start();
  };

  return (
    <Button 
      variant={isListening ? "default" : "outline"} 
      onClick={startListening}
      className={isListening ? "animate-pulse border-primary bg-primary text-primary-foreground" : "border-primary/30 text-primary"}
    >
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
        <span className="text-xs">{isListening ? "聆聽中..." : "語音輸入"}</span>
      </div>
    </Button>
  );
}
