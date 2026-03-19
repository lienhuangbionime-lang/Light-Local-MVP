"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { LiveHeader } from "@/components/live/LiveHeader"
import { EmptyStateBanner } from "@/components/live/EmptyStateBanner"
import { SalesSummary } from "@/components/live/SalesSummary"
import { DiagnosticConsole } from "@/components/live/DiagnosticConsole"
import { ProductMappingManager } from "@/components/live/ProductMappingManager"
import { generateAdminSignature } from "@/lib/crypto"

export function LivePage() {
    const {
        items,
        batches,
        backendUrl,
        startNewLiveSession,
        sales,
        currentLiveSessionId,
        isLiveActive,
        setIsLiveActive,
        liveProductMappings,
        setLiveProductMappings,
        orderMirror,
        setOrderMirror,
        processedIdMirror,
        setProcessedIdMirror,
        adminSecret,
    } = useAppStore()
    const { toast } = useToast()
    const { t } = useTranslation()

    const [activeBatchId, setActiveBatchId] = useState<string>("")
    const [isSyncing, setIsSyncing] = useState(false)
    const [isTestingConn, setIsTestingConn] = useState(false)
    const [isSimulating, setIsSimulating] = useState(false)
    const [isSubscribing, setIsSubscribing] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [liveStats, setLiveStats] = useState<Record<string, { pending: number; confirmed: number }>>({})
    const [debugEvents, setDebugEvents] = useState<any[]>([])
    const [healthStatus, setHealthStatus] = useState<{ 
        token_configured?: string; 
        scopes?: string[]; 
        token_error?: string;
        page_name?: string;
        page_id?: string;
        instance_id?: string;
        version?: string;
    } | null>(null)
    const [showDebug, setShowDebug] = useState(false)
    const [connectionError, setConnectionError] = useState<string | null>(null)
    const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(3)

    // 0. 直播 x 銷售：本場直播的即時銷售摘要（整合 Sales 模組）
    const liveSalesForCurrentSession = useMemo(
        () =>
            sales.filter((s: any) =>
                currentLiveSessionId
                    ? s.source === "live" && s.liveSessionId === currentLiveSessionId
                    : s.source === "live"
            ),
        [sales, currentLiveSessionId]
    )

    const liveSalesStats = useMemo(() => {
        const totalRevenue = liveSalesForCurrentSession.reduce((sum: number, s: any) => sum + s.totalRevenue, 0)
        const totalProfit = liveSalesForCurrentSession.reduce((sum: number, s: any) => sum + s.profit, 0)
        return {
            count: liveSalesForCurrentSession.length,
            totalRevenue,
            totalProfit,
        }
    }, [liveSalesForCurrentSession])

    // --- 2. Internal Helpers ---
    const getCleanUrl = (url: string) => url.trim().replace(/\/+$/, "")

    // Use a ref to always have fresh mappings inside the polling interval
    // without adding liveProductMappings to useEffect deps (which would cause interval restarts)
    const liveMappingsRef = React.useRef(liveProductMappings)
    const lastHealedCountRef = React.useRef(0)
    useEffect(() => { liveMappingsRef.current = liveProductMappings }, [liveProductMappings])

    const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "connecting">("connecting")

    // [V0980]：初始化時與後端同步直播狀態

    // --- 3. Heartbeats and Polling ---
    useEffect(() => {
        if (!isLiveActive) return
        
        const cleanUrl = getCleanUrl(backendUrl)
        const fetchAll = async () => {
            try {
                setConnectionStatus("connecting")
                // Keep-alive ping & Health Check
                const healthRes = await fetch(`${cleanUrl}/api/health`)
                if (healthRes.ok) {
                    setHealthStatus(await healthRes.json())
                    setConnectionError(null)
                    setConnectionStatus("online")
                } else {
                    setConnectionStatus("offline")
                    setConnectionError(`HTTP ${healthRes.status}: ${healthRes.statusText}`)
                }
                
                // --- [AUTO-HARVEST] ---
                // If there are confirmed orders on cloud, pull them immediately
                const statsRes = await fetch(`${cleanUrl}/api/seller/stats`)
                if (statsRes.ok) {
                    const stats = await statsRes.json()
                    setLiveStats(stats)
                }
                
                // [UI MERGE] 直播頁僅負責設定與同步字典：
                // 收割/訂單清單已移至「銷售」頁，避免直播頁塞太多結算流程。

                // --- [PULL MODE] 主動拉取直播留言 (不靠 Webhook，Development 模式也能用) ---
                try {
                    const pullRes = await fetch(`${cleanUrl}/api/seller/pull_live_comments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            token: useAppStore.getState().fbPageToken || ""
                        })
                    })
                    if (pullRes.ok) {
                        const pullData = await pullRes.json()
                        if (pullData.new_orders > 0) {
                            console.log(`[PULL] 拉取到 ${pullData.new_orders} 筆新訂單`)
                            // [V0990]: 每次拉取到新訂單後，強制與雲端同步一次鏡像
                            setTimeout(async () => {
                                const mirrorRes = await fetch(`${cleanUrl}/api/seller/orders/all`)
                                if (mirrorRes.ok) {
                                    const mirrorData = await mirrorRes.json()
                                    setOrderMirror(mirrorData.orders || [])
                                }
                            }, 500)
                        }
                    }
                } catch (e) {
                    // silent fail - pull mode is best-effort
                }

                
                // Debug events fetch
                const evRes = await fetch(`${cleanUrl}/api/debug/events`)
                if (evRes.ok) setDebugEvents(await evRes.json())

                // --- [AUTO-RESTORE / MIRROR] ---
                // 1. 同步所有雲端訂單 (備份 Pending 訂單以防伺服器失憶)
                const allOrdersRes = await fetch(`${cleanUrl}/api/seller/orders/all`)
                if (allOrdersRes.ok) {
                    const allData = await allOrdersRes.json()
                    const cloudOrders = allData.orders || []
                    
                    // 2. 判斷是否需要自癒 (雲端變少或變空了)
                    const pendingInCloud = cloudOrders.filter((o: any) => o.status === "PENDING" || o.status === "CONFIRMED")
                    const pendingInMirror = orderMirror.filter((o: any) => o.status === "PENDING" || o.status === "CONFIRMED")

                    // [V0930 FIX]：檢查是否在「所有」雲端訂單中都找不到 (不分狀態)，避免把已收割的當成缺失
                    const missingInCloud = pendingInMirror.filter(
                        mo => !cloudOrders.some((co: any) => co.order_id === mo.order_id)
                    )

                    if (missingInCloud.length > 0) {
                        // [V0930 OPTIMIZE]：只有當缺失數量與上次不同時才跳通知，避免 5 秒一次的洗版
                        if (lastHealedCountRef.current !== missingInCloud.length) {
                            console.log(`[SELF-HEALING] 偵測到雲端缺失 ${missingInCloud.length} 筆訂單，正在嘗試恢復...`)
                            const res = await fetch(`${cleanUrl}/api/seller/orders/restore`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ orders: missingInCloud })
                            })
                            const data = await res.json()
                            if (data.restored > 0) {
                                toast({ title: t("live.diag.self_healing_title"), description: t("live.diag.self_healing_desc", { count: data.restored }) })
                            }
                            lastHealedCountRef.current = missingInCloud.length
                        }
                    } else {
                        // 雲端資料健全，同步回本地鏡像以備不時之需
                        setOrderMirror(pendingInCloud)
                        lastHealedCountRef.current = 0
                    }

                    // 3. 同步已處理的留言 ID 清單
                    const processedIds = allData.processed_comment_ids || []
                    if (processedIds.length > processedIdMirror.length) {
                        setProcessedIdMirror(processedIds)
                    } else if (processedIds.length < processedIdMirror.length && processedIdMirror.length > 0) {
                        // 雲端重啟後清單變少了，補回去
                        console.log(`[SELF-HEALING] 正在恢復 ${processedIdMirror.length} 筆已處理 ID 紀錄...`)
                        await fetch(`${cleanUrl}/api/seller/orders/restore`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ processed_comment_ids: processedIdMirror })
                        })
                    }
                }


                // --- [SELF-HEALING] AUTO-SYNC ---
                // If backend has no products but frontend has active mappings, auto-push them
                const prodRes = await fetch(`${cleanUrl}/api/debug/products`)
                if (prodRes.ok) {
                    const prodData = await prodRes.json()
                    const hasCloudMappings = prodData.product_count > 0 || Object.keys(prodData.active_products || {}).length > 0
                    const hasLocalMappings = liveMappingsRef.current.length > 0 && liveMappingsRef.current.some(m => m.code.trim() && m.productId.trim())
                    
                    if (!hasCloudMappings && hasLocalMappings && !isSyncing) {
                        console.log("[AUTO-SYNC] Detected empty cloud mappings, restoring from local store...")
                        handleSyncProducts()
                    }
                }
                
            } catch (e: any) {
                console.warn("[SILENT POLLING] Backend unreachable, retrying...", e)
                setConnectionStatus("offline")
                // Keep the last error message context but don't show alarming popups
                const errorMsg = e.message || t("live.conn_error_title")
                setConnectionError(errorMsg)
            }
        }

        fetchAll()
        const interval = setInterval(fetchAll, 5000)
        return () => clearInterval(interval)
    }, [isLiveActive, backendUrl])


    // --- 4. Event Handlers ---
    const handleSyncProducts = async () => {
        const validMappings = liveProductMappings.filter(m => m.code.trim() && m.productId.trim())
        if (validMappings.length === 0) {
            toast({ title: t("live.mapping.sync_failed"), description: t("live.mapping.sync_failed_desc"), variant: "destructive" })
            return
        }

        setIsSyncing(true)
        const cleanUrl = getCleanUrl(backendUrl)
        try {
            const dict: Record<string, any> = {}
            validMappings.forEach(m => {
                const codes = m.code.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
                const product = items.find(i => i.id === m.productId);
                const displayName = product ? product.name : t("live.unknown_product");
                codes.forEach(c => dict[c] = {
                    name: displayName,
                    price_rule: m.priceRule || ""
                });
            })

            const ts = Math.floor(Date.now() / 1000).toString()
            const sig = await generateAdminSignature(useAppStore.getState().adminSecret, ts)

            const res = await fetch(`${cleanUrl}/api/seller/sync_products`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Admin-Signature": sig,
                    "X-Admin-Timestamp": ts
                },
                body: JSON.stringify({ 
                    active_products: dict,
                    free_shipping_threshold: freeShippingThreshold,
                    shipping_fee: useAppStore.getState().shippingFee,
                    is_live: true
                })
            })

            // [V0980]：同時啟動後端的直播階段鎖定 (使用本地時間戳)
            const localTimestamp = Math.floor(Date.now() / 1000);
            
            await fetch(`${cleanUrl}/api/seller/live/status`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Admin-Signature": sig,
                    "X-Admin-Timestamp": ts
                },
                body: JSON.stringify({ 
                    is_live_active: true,
                    session_start_time: localTimestamp
                })
            })

            // Sync FB Token if available
            if (useAppStore.getState().fbPageToken) {
                await fetch(`${cleanUrl}/api/seller/config`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fb_page_token: useAppStore.getState().fbPageToken })
                })
            }

            if (res.ok) {
                startNewLiveSession()
                setIsLiveActive(true) // 確保前端狀態同步
                toast({ title: t("live.mapping.sync_success"), description: t("live.mapping.sync_success_desc") })
            } else {
                throw new Error(t("live.sync_backend_fail"))
            }
        } catch (error: any) {
            toast({ title: t("live.mapping.sync_error_title"), description: t("live.mapping.sync_error_desc"), variant: "destructive" })
        } finally {
            setIsSyncing(false)
        }
    }

    const handleEndLiveSession = async () => {
        const cleanUrl = getCleanUrl(backendUrl)
        try {
            // Try to notify backend but don't let it block local state update if it fails
            const ts = Math.floor(Date.now() / 1000).toString();
            const sig = await generateAdminSignature(adminSecret, ts);
            await fetch(`${cleanUrl}/api/seller/orders`, { 
                method: "DELETE",
                headers: {
                    "X-Admin-Signature": sig,
                    "X-Admin-Timestamp": ts
                }
            }).catch(e => console.warn("Orders clear failed", e))
            
            await fetch(`${cleanUrl}/api/seller/live/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_live_active: false })
            }).catch(e => console.warn("Live status sync failed", e))

            startNewLiveSession()
            setLiveStats({})
            setOrderMirror([]) 
            setIsLiveActive(false)
            setConnectionStatus("online") // Reset status back to neutral
            toast({ title: t("live.summary.session_ended"), description: t("live.summary.session_ended_desc") })
        } catch (e) {
            setIsLiveActive(false)
            toast({ title: t("live.summary.session_ended_local"), variant: "destructive" })
        }
    }

    // [UI SPLIT] 收割/入帳流程已移到「銷售」頁（SalesPage）。

    const handleSubscribePage = async () => {
        setIsSubscribing(true)
        try {
            const res = await fetch(`${getCleanUrl(backendUrl)}/api/seller/subscribe_page`, { method: 'POST' })
            const data = await res.json()
            if (data.success || data.page_name) {
                toast({ title: t("live.diag.subscribe_success"), description: t("live.diag.subscribe_success_desc", { name: data.page_name || "" }) })
            } else {
                toast({ title: t("live.diag.subscribe_failed"), description: data.message || t("live.diag.subscribe_failed_desc"), variant: "destructive" })
            }
        } catch (e) {
            toast({ title: t("live.conn_error_title"), variant: "destructive" })
        } finally {
            setIsSubscribing(false)
        }
    }

    const handleUpdateToken = async () => {
        const token = prompt(t("live.token_update_prompt"))
        if (!token) return
        
        try {
            const res = await fetch(`${getCleanUrl(backendUrl)}/api/seller/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fb_page_token: token })
            })
            if (res.ok) {
                toast({ title: t("live.diag.token_updated"), description: t("live.diag.token_updated_desc") })
                handleTestConnection() // 觸發重新檢查
            } else {
                throw new Error()
            }
        } catch (e) {
            toast({ title: t("live.diag.token_update_failed"), variant: "destructive" })
        }
    }

    const handleSimulateWebhook = async () => {
        setIsSimulating(true)
        try {
            const res = await fetch(`${getCleanUrl(backendUrl)}/api/debug/simulate_webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: "A", quantity: 6 })
            })
            if (res.ok) {
                toast({ title: t("live.diag.simulate_success"), description: t("live.diag.simulate_success_desc") })
            } else {
                throw new Error()
            }
        } catch (e) {
            toast({ title: t("live.diag.simulate_failed"), variant: "destructive" })
        } finally {
            setIsSimulating(false)
        }
    }

    const handleResetSystem = async (deep: boolean = false) => {
        setIsResetting(true)
        try {
            const ts = Math.floor(Date.now() / 1000).toString();
            const sig = await generateAdminSignature(adminSecret, ts);
            const res = await fetch(`${getCleanUrl(backendUrl)}/api/seller/reset_system`, { 
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Admin-Signature': sig,
                    'X-Admin-Timestamp': ts
                },
                body: JSON.stringify({ deep_reset: deep })
            })
            if (res.ok) {
                const data = await res.json()
                setLiveStats({})
                setDebugEvents([])
                setOrderMirror([])
                if (deep) setLiveProductMappings([]) // 同步清空本地代號表
                toast({ title: deep ? t("live.diag.reset_deep_success") : t("live.diag.reset_success"), description: data.message })
                handleTestConnection() // Refresh health/instance info
            } else {
                throw new Error()
            }
        } catch (e) {
            toast({ title: t("live.diag.reset_failed"), description: t("live.diag.reset_failed_desc"), variant: "destructive" })
        } finally {
            setIsResetting(false)
        }
    }

    const handleTestConnection = async () => {
        setIsTestingConn(true)
        try {
            const res = await fetch(`${getCleanUrl(backendUrl)}/api/health`)
            if (res.ok) {
                setHealthStatus(await res.json())
                toast({ title: t("live.diag.conn_status_ok") })
            } else {
                throw new Error()
            }
        } catch (error) {
            toast({ title: t("live.diag.conn_status_failed"), variant: "destructive" })
        } finally {
            setIsTestingConn(false)
        }
    }

    const handleConsolidateMappings = () => {
        const { mergeItemsByName } = useAppStore.getState();
        mergeItemsByName();
        const currentItems = useAppStore.getState().items;
        const nameToRecord: Record<string, { codes: string[], productId: string, priceRule: string }> = {};
        
        liveProductMappings.forEach((m: any) => {
            if (!m.productId) return;
            const product = currentItems.find((i: any) => i.id === m.productId);
            const name = product?.name.trim() || t("live.unknown_product");
            if (!nameToRecord[name]) {
                const codes = m.code.split(",").map((c: any) => c.trim().toUpperCase()).filter(Boolean);
                nameToRecord[name] = { 
                    codes: codes.slice(0, 1), 
                    productId: m.productId, 
                    priceRule: m.priceRule || product?.suggestedPrice || ""
                };
            }
        });

        const newMappings = Object.entries(nameToRecord).map(([name, data]) => ({
            code: data.codes.join(", "),
            productId: currentItems.find((i: any) => i.name.trim() === name)?.id || data.productId,
            priceRule: data.priceRule
        }));

        if (newMappings.length > 0) {
            setLiveProductMappings(newMappings);
            toast({ title: t("live.mapping.consolidate_done") });
        }
    }

    const handleAutoGenerateMappings = () => {
        const uniqueItems: Record<string, { id: string, name: string, price: string }> = {};
        
        items.forEach(it => {
            const name = it.name.trim();
            if (!uniqueItems[name]) {
                const basePrice = it.suggestedPrice ? Number(it.suggestedPrice) : 0;
                let priceRule = it.suggestedPrice || "";
                
                // If it's just a single number or empty, expand it to 3 tiers
                if (!priceRule.includes(":") && (basePrice > 0 || it.localCostLanded > 0)) {
                    const p1 = basePrice > 0 ? basePrice : Math.round((it.localCostLanded + 90) / 5) * 5;
                    const p2 = Math.round((p1 * 2 * 0.9) / 5) * 5;
                    const p3 = Math.round((p1 * 3 * 0.8) / 5) * 5;
                    priceRule = `1:${p1}, 2:${p2}, 3:${p3}`;
                }
                
                uniqueItems[name] = { 
                    id: it.id, 
                    name, 
                    price: priceRule
                };
            }
        });

        // 輔助函式：產生 Excel 風格代號 (0->A, 25->Z, 26->AA, 27->AB...)
        const getExcelCode = (idx: number): string => {
            let code = "";
            let i = idx;
            while (i >= 0) {
                code = String.fromCharCode(65 + (i % 26)) + code;
                i = Math.floor(i / 26) - 1;
            }
            return code;
        };

        // [V1000]: 支援無限量商品 (不再 .slice(0, 26))
        const sortedItems = Object.values(uniqueItems).sort((a, b) => a.name.localeCompare(b.name));
        const newMappings = sortedItems.map((data, i) => ({
            code: getExcelCode(i),
            productId: data.id,
            priceRule: data.price
        }));

        if (newMappings.length > 0) {
            setLiveProductMappings(newMappings);
            const lastCode = getExcelCode(newMappings.length - 1);
            toast({ title: t("live.mapping.auto_gen_success", { count: newMappings.length, last: lastCode }) });
        } else {
            toast({ title: t("live.mapping.no_stock_title"), description: t("live.mapping.no_stock_desc"), variant: "destructive" });
        }
    }

    const handleClearEvents = async () => {
        const cleanUrl = getCleanUrl(backendUrl)
        try {
            const res = await fetch(`${cleanUrl}/api/debug/events`, { method: "DELETE" })
            if (res.ok) {
                setDebugEvents([])
                toast({ title: t("live.diag.events_cleared") })
            }
        } catch (error) {
            console.error("Clear error:", error)
        }
    }

    return (
        <div className="space-y-4 pb-10">
            <LiveHeader 
                isActive={isLiveActive} 
                backendUrl={backendUrl}
                connectionError={connectionError}
            />

            {!isLiveActive && debugEvents.length === 0 && <EmptyStateBanner backendUrl={backendUrl} />}

            <ProductMappingManager
                mappings={liveProductMappings}
                onMappingChange={(index, field, value) => {
                    const newMappings = [...liveProductMappings]
                    newMappings[index][field as 'code' | 'productId' | 'priceRule'] = value
                    setLiveProductMappings(newMappings)
                }}
                onAddMapping={() => setLiveProductMappings([...liveProductMappings, { code: "", productId: "", priceRule: "" }])}
                onRemoveMapping={(index) => setLiveProductMappings(liveProductMappings.filter((_, i) => i !== index))}
                items={items}
                batches={batches}
                activeBatchId={activeBatchId}
                onActiveBatchChange={setActiveBatchId}
                onSync={handleSyncProducts}
                isSyncing={isSyncing}
                onAutoGenerate={handleAutoGenerateMappings}
                onConsolidate={handleConsolidateMappings}
                liveStats={liveStats}
                onSaveProductPrice={(name, rule) => {
                    useAppStore.getState().updateItemMetadata(name, { suggestedPrice: rule });
                    toast({ title: t("live.mapping.save_price_success"), description: t("live.mapping.save_price_desc", { name }) });
                }}
            />

            <SalesSummary 
                sales={liveSalesForCurrentSession} 
                stats={liveSalesStats} 
                onEndSession={handleEndLiveSession} 
                onRemoveSale={(id) => useAppStore.getState().removeSale(id)} 
                allOrders={orderMirror}
                shippingFee={useAppStore(state => state.shippingFee)}
                onChangeShippingFee={useAppStore.getState().setShippingFee}
            />

            {isLiveActive && (
                <div className="space-y-4">
                    {/* [V1740] Connection Status Indicator */}
                    <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/10 dark:border-white/10">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("live.status.label")}</span>
                            <div className={`flex items-center gap-1.5 transition-all text-sm font-bold`}>
                                <div className={`h-2.5 w-2.5 rounded-full ${
                                    connectionStatus === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                                    connectionStatus === "connecting" ? "bg-yellow-500 animate-pulse" :
                                    "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                                }`} />
                                <span className={
                                    connectionStatus === "online" ? "text-green-600 dark:text-green-400" :
                                    connectionStatus === "connecting" ? "text-yellow-600 dark:text-yellow-400" :
                                    "text-red-600 dark:text-red-400"
                                }>
                                    {connectionStatus === "online" ? t("live.status.online") : 
                                     connectionStatus === "connecting" ? t("live.status.connecting") : 
                                     t("live.status.offline")}
                                </span>
                            </div>
                        </div>
                        
                        <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block mb-1">{t("live.status.last_check")}</span>
                            <span className="text-xs font-mono">{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                    
                    <Card className="border-indigo-100 bg-indigo-50/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-700">
                                {t("live.shipping.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold">{t("live.shipping.threshold_label")}</Label>
                                    <p className="text-[10px] text-muted-foreground">{t("live.shipping.threshold_desc")}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        type="number" 
                                        min={1} 
                                        className="w-20 text-center font-bold"
                                        value={freeShippingThreshold}
                                        onChange={(e: any) => setFreeShippingThreshold(Number(e.target.value))}
                                    />
                                    <span className="text-sm font-medium">{t("live.shipping.unit")}</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-amber-600 font-medium">
                                {t("live.shipping.hint")}
                            </p>
                        </CardContent>
                    </Card>

                    <DiagnosticConsole 
                        debugEvents={debugEvents} 
                        healthStatus={healthStatus} 
                        backendUrl={backendUrl} 
                        onSimulate={handleSimulateWebhook} 
                        onSubscribePage={handleSubscribePage}
                        onUpdateToken={handleUpdateToken}
                        onTest={handleTestConnection}
                        isSimulating={isSimulating}
                        isLoadingSub={isSubscribing}
                        isLoadingTest={isTestingConn}
                        showDebug={showDebug}
                        onToggleDebug={() => setShowDebug(!showDebug)}
                        onReset={handleResetSystem}
                        isLoadingReset={isResetting}
                        onClearEvents={handleClearEvents}
                        connectionError={connectionError}
                    />
                </div>
            )}
        </div>
    )
}