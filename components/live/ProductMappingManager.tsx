import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Zap, Plus, Minus, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import { useTranslation } from "@/lib/i18n"

export const PricingHelper = ({ 
    currentRule, 
    onApply, 
    onSaveToInventory,
    baseCost 
}: { 
    currentRule: string; 
    onApply: (rule: string) => void; 
    onSaveToInventory?: (rule: string) => void;
    baseCost: number 
}) => {
    const { t } = useTranslation()
    const [tiers, setTiers] = useState<{ q: number; p: number }[]>([])
    
    useEffect(() => {
        if (currentRule && currentRule.includes(":")) {
            const parsed = currentRule.split(",").map(r => {
                const [q, p] = r.split(":").map(s => Number(s.trim()))
                return { q, p }
            })
            setTiers(parsed)
        } else {
            // Use currentRule as p1 if it's a number, otherwise calculate from cost
            const p1 = (currentRule && !isNaN(Number(currentRule))) 
                ? Number(currentRule) 
                : Math.round((baseCost + 90) / 5) * 5
                
            const p2 = Math.round((p1 * 2 * 0.9) / 5) * 5
            const p3 = Math.round((p1 * 3 * 0.8) / 5) * 5
            setTiers([
                { q: 1, p: p1 },
                { q: 2, p: p2 },
                { q: 3, p: p3 }
            ])
        }
    }, [currentRule, baseCost])

    const updateTier = (index: number, delta: number) => {
        const newTiers = [...tiers]
        newTiers[index].p += delta
        
        // If we adjust Tier 1 (1 piece), cascade the discount rules to Tiers 2 and 3
        if (index === 0) {
            const p1 = newTiers[0].p
            if (newTiers[1]) newTiers[1].p = Math.round((p1 * 2 * 0.9) / 5) * 5
            if (newTiers[2]) newTiers[2].p = Math.round((p1 * 3 * 0.8) / 5) * 5
            
            // For tiers beyond 3, use the unit price of tier 3 as base (if tier 3 exists)
            for (let i = 3; i < newTiers.length; i++) {
                const baseUnitPrice = newTiers[2] ? newTiers[2].p / 3 : p1
                newTiers[i].p = Math.round((baseUnitPrice * newTiers[i].q) / 5) * 5
            }
        } else {
            // User requested that adjusting 2 pieces should NOT move 3 pieces.
            // We stop automatic cascading for manual adjustments on higher tiers.
        }
        setTiers(newTiers)
    }

    const applyStandardMarkup = () => {
        const rawP1 = baseCost + 90
        const p1 = Math.round(rawP1 / 5) * 5
        const p2 = Math.round((p1 * 2 * 0.9) / 5) * 5
        const p3 = Math.round((p1 * 3 * 0.8) / 5) * 5
        setTiers([
            { q: 1, p: p1 },
            { q: 2, p: p2 },
            { q: 3, p: p3 }
        ])
    }

    return (
        <div className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground mb-1">
                {t("live.mapping.avg_cost", { price: Number.isFinite(baseCost) ? Math.round(baseCost) : 0 })}
            </div>
            {tiers.map((tier, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="text-sm font-medium">
                        {t("live.mapping.total_price", { count: tier.q })} <span className={`ml-1 text-[11px] font-bold ${tier.p - (baseCost * tier.q) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t("live.mapping.profit", { profit: Math.round(tier.p - (baseCost * tier.q)) })}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateTier(i, -5)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-16 text-center font-bold text-lg">${tier.p}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateTier(i, 5)}><Plus className="h-3 w-3" /></Button>
                    </div>
                </div>
            ))}
                <Button variant="outline" size="sm" className="w-full text-[10px] border-dashed h-8" 
                    onClick={() => setTiers([...tiers, { q: tiers.length + 1, p: Math.round((tiers[tiers.length-1].p / tiers[tiers.length-1].q) * (tiers.length + 1)) }])}>
                    {t("live.mapping.add_tiers")}
                </Button>
            <DialogFooter className="pt-2 flex flex-col gap-2">
                <DialogClose asChild>
                    <Button className="w-full font-bold" onClick={() => onApply(tiers.map(t => `${t.q}:${t.p}`).join(", "))}>{t("live.mapping.apply_price")}</Button>
                </DialogClose>
                {onSaveToInventory && (
                    <Button variant="ghost" size="sm" className="w-full text-[10px] text-muted-foreground h-6" onClick={() => onSaveToInventory(tiers.map(t => `${t.q}:${t.p}`).join(", "))}>
                        {t("live.mapping.save_to_inventory")}
                    </Button>
                )}
            </DialogFooter>
        </div>
    )
}

/**
 * 商品代號管理員 - 處理 A, B 代號與庫存關聯
 */
export const ProductMappingManager = ({
    mappings,
    onMappingChange,
    onAddMapping,
    onRemoveMapping,
    items,
    batches,
    activeBatchId,
    onActiveBatchChange,
    onSync,
    isSyncing,
    onAutoGenerate,
    onConsolidate,
    liveStats,
    onSaveProductPrice
}: {
    mappings: any[];
    onMappingChange: (index: number, field: string, value: any) => void;
    onAddMapping: () => void;
    onRemoveMapping: (index: number) => void;
    items: any[];
    batches: any[];
    activeBatchId: string;
    onActiveBatchChange: (id: string) => void;
    onSync: () => void;
    isSyncing: boolean;
    onAutoGenerate: () => void;
    onConsolidate: () => void;
    liveStats: Record<string, { pending: number; confirmed: number }>;
    onSaveProductPrice?: (productName: string, rule: string) => void;
}) => {
    const { t } = useTranslation()
    return (
        <Card className="border-primary/20 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" /> {t("live.mapping.title")}
                </CardTitle>
                <CardDescription>{t("live.mapping.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <Label className="text-[10px]">{t("live.mapping.batch_label")}</Label>
                    <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={activeBatchId}
                        onChange={e => onActiveBatchChange(e.target.value)}
                    >
                        <option value="">{t("live.mapping.batch_placeholder")}</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] text-muted-foreground">{t("live.mapping.desc")}</p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1" onClick={onAutoGenerate}>{t("live.mapping.auto_gen")}</Button>
                            <Button variant="secondary" size="sm" className="h-7 text-[10px] flex-1 font-bold border-primary/20" onClick={onConsolidate}>{t("live.mapping.consolidate")}</Button>
                        </div>
                    </div>

                    {mappings.map((mapping, index) => {
                        const stats = liveStats[mapping.code.toUpperCase()] || { pending: 0, confirmed: 0 }
                        const product = items.find(it => it.id === mapping.productId)
                        const totalQty = items.filter(it => it.name.trim() === product?.name.trim()).reduce((sum, it) => sum + it.quantity, 0)
                        
                        return (
                            <div key={index} className="relative p-3 rounded-xl border bg-card/50 shadow-sm transition-all hover:shadow-md">
                                <div className="flex flex-col gap-3">
                                    {/* Top Row: Code and Price Button */}
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="w-16 relative">
                                            <Input
                                                placeholder={t("live.mapping.code_placeholder")}
                                                value={mapping.code}
                                                onChange={(e) => onMappingChange(index, 'code', e.target.value.toUpperCase())}
                                                className="font-black text-center text-lg h-10 border-primary/20 bg-background"
                                            />
                                            {(stats.pending > 0 || stats.confirmed > 0) && (
                                                <div className="absolute -top-3 -right-3 flex gap-1 z-10 scale-90">
                                                    {stats.pending > 0 && <Badge variant="secondary" className="bg-amber-400 text-amber-950 font-bold px-1.5 h-5 border-amber-500/20">{stats.pending}</Badge>}
                                                    {stats.confirmed > 0 && <Badge variant="default" className="bg-emerald-600 font-bold px-1.5 h-5 border-emerald-700/20">{stats.confirmed}</Badge>}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-10 px-3 w-full justify-between rounded-lg border-primary/20 bg-background/50 ring-offset-background transition-colors hover:bg-primary/5">
                                                        <div className="flex flex-col items-start leading-tight">
                                                            <span className="text-[9px] text-muted-foreground font-bold">{t("live.mapping.price_label")}</span>
                                                            <span className="text-sm font-black text-primary flex gap-2">
                                                                {mapping.priceRule ? (
                                                                    mapping.priceRule.split(",").map((part: string, i: number) => {
                                                                        const [q, p] = part.split(":");
                                                                        return (
                                                                            <span key={i} className="flex items-center gap-0.5">
                                                                                <span className="text-[10px] opacity-70">{t("live.mapping.total_price", { count: q })}</span>
                                                                                <span>${p}</span>
                                                                            </span>
                                                                        );
                                                                    })
                                                                ) : "$0"}
                                                            </span>
                                                        </div>
                                                        <Zap className="h-4 w-4 text-amber-500 fill-amber-500 animate-pulse-slow" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[320px] rounded-3xl">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2">
                                                            <Zap className="h-4 w-4 text-amber-500" />
                                                            {t("live.mapping.helper_title")}
                                                        </DialogTitle>
                                                    </DialogHeader>
                                                    <PricingHelper 
                                                        currentRule={mapping.priceRule}
                                                        baseCost={(() => {
                                                            const p = items.find(it => it.id === mapping.productId)
                                                            if (!p) return 0
                                                            const cluster = items.filter(it => it.name.trim() === p.name.trim())
                                                            const sumQty = cluster.reduce((sum, it) => sum + it.quantity, 0)
                                                            const sumCost = cluster.reduce((sum, it) => sum + (it.localCostLanded * it.quantity), 0)
                                                            return sumQty > 0 ? sumCost / sumQty : p.localCostLanded
                                                        })()}
                                                        onApply={(rule) => onMappingChange(index, 'priceRule', rule)}
                                                        onSaveToInventory={(rule) => {
                                                            const p = items.find(it => it.id === mapping.productId);
                                                            if (p && onSaveProductPrice) {
                                                                onSaveProductPrice(p.name, rule);
                                                            }
                                                        }}
                                                    />
                                                </DialogContent>
                                            </Dialog>
                                        </div>

                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10" onClick={() => onRemoveMapping(index)} disabled={mappings.length === 1}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* Bottom Row: Product Select and Stock */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <select
                                                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm appearance-none focus:ring-1 focus:ring-primary"
                                                value={mapping.productId}
                                                onChange={(e) => {
                                                    const pId = e.target.value
                                                    onMappingChange(index, 'productId', pId)
                                                    const p = items.find(it => it.id === pId)
                                                    if (p) {
                                                        let rule = p.suggestedPrice || ""
                                                        if (rule && !rule.includes(":")) {
                                                            const p1 = Number(rule)
                                                            const p2 = Math.round((p1 * 2 * 0.9) / 5) * 5
                                                            const p3 = Math.round((p1 * 3 * 0.8) / 5) * 5
                                                            rule = `1:${p1}, 2:${p2}, 3:${p3}`
                                                        } else if (!rule) {
                                                            const p1 = Math.round((p.localCostLanded + 90) / 5) * 5
                                                            const p2 = Math.round((p1 * 2 * 0.9) / 5) * 5
                                                            const p3 = Math.round((p1 * 3 * 0.8) / 5) * 5
                                                            rule = `1:${p1}, 2:${p2}, 3:${p3}`
                                                        }
                                                        onMappingChange(index, 'priceRule', rule)
                                                    }
                                                }}
                                            >
                                                <option value="">{t("live.mapping.product_placeholder")}</option>
                                                {(() => {
                                                    const unique: Record<string, any> = {}
                                                    items.forEach(it => {
                                                        const name = it.name.trim()
                                                        if (!unique[name]) unique[name] = { id: it.id, name, total: 0 }
                                                        unique[name].total += it.quantity
                                                    })
                                                    return Object.values(unique)
                                                        .sort((a,b) => b.total - a.total)
                                                        .map(u => <option key={u.id} value={u.id}>{u.name} ({t("live.mapping.stock_count", { count: u.total })})</option>)
                                                })()}
                                            </select>
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-50">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                        {mapping.productId && (
                                            <div className={cn(
                                                "whitespace-nowrap rounded-lg px-2 py-1.5 text-[10px] font-black border tracking-tighter",
                                                totalQty <= 5 ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            )}>
                                                {t("live.mapping.stock_count", { count: totalQty })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={onAddMapping}>
                    <Plus className="h-3 w-3 mr-1" /> {t("live.mapping.add_code")}
                </Button>
                <Button className="w-full mt-4" onClick={onSync} disabled={isSyncing}>
                    {isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {t("live.mapping.sync_btn")}
                </Button>
            </CardContent>
        </Card>
    )
}
