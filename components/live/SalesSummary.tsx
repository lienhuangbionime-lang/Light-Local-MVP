import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Radio, Trash2, Download, CheckCircle2, UserCheck, Truck } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
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
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/lib/i18n"

export const SalesSummary = ({ 
    sales, 
    stats, 
    onEndSession, 
    onRemoveSale,
    lastHarvestedOrders = [],
    allOrders = [],
    shippingFee = 38,
    onChangeShippingFee
}: { 
    sales: any[]; 
    stats: { totalRevenue: number; totalProfit: number }; 
    onEndSession: () => void; 
    onRemoveSale: (id: string) => void; 
    lastHarvestedOrders?: any[];
    allOrders?: any[];
    shippingFee?: number;
    onChangeShippingFee?: (fee: number) => void;
}) => {
    const { toast } = useToast()
    const { t } = useTranslation()
    const handleExportCSV = () => {
        if (allOrders.length === 0) return;
        const headers = t("sales.csv_headers", { returnObjects: true }) as unknown as string[]
        const rows = allOrders.map(o => [
            o.order_id,
            o.fb_user_name,
            o.phone ? `\t${o.phone}` : t("sales.csv_empty"),
            o.shipping_info || t("sales.csv_empty"),
            o.items.map((i: any) => `${i.product_code}${i.product_name ? ": " + i.product_name : ""} x${i.quantity}`).join("; "),
            o.status
        ])
        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n")
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `orders-summary-${new Date().toISOString().split("T")[0]}.csv`
        link.click()
    }

    const handleExport711Excel = async () => {
        const backendUrl = useAppStore.getState().backendUrl;
        const url = `${backendUrl}/api/seller/orders/export_xlsx?shipping_fee=${shippingFee}`;
        
        toast({
            title: t("live.summary.exporting_title"),
            description: t("live.summary.exporting_desc"),
        })

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Export failed");
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = `711_Batch_Import_${new Date().toISOString().slice(5, 16).replace(/[:T]/g, "_")}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast({
                title: t("live.summary.export_success_title"),
                description: t("live.summary.export_success_desc"),
            })
        } catch (error) {
            console.error("Excel Export Error:", error);
            toast({
                title: t("live.summary.export_failed_title"),
                description: t("live.summary.export_failed_desc"),
                variant: "destructive"
            })
        }
    };

    return (
    <Card>
        <CardHeader className="pb-3 border-b border-border/10 bg-muted/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Radio className="h-4 w-4 text-rose-500 animate-pulse" /> {t("live.summary.title")}
                    </CardTitle>
                    <Badge variant="outline" className="h-6 text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-1.5 flex items-center gap-1 shadow-sm">
                         <CheckCircle2 className="h-3 w-3" /> {t("live.summary.uv_pass")}
                    </Badge>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-white/50 border border-border/50 rounded-md px-2 py-1 h-8 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500">{t("live.summary.shipping_fee")}</span>
                        <input 
                            type="number" 
                            value={shippingFee}
                            onChange={(e) => onChangeShippingFee && onChangeShippingFee(Number(e.target.value))}
                            className="h-5 w-12 text-[10px] bg-transparent border-none focus:ring-0 p-0 text-center font-bold"
                        />
                        <span className="text-[10px] font-bold text-slate-400">TWD</span>
                    </div>

                    {allOrders.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[11px] gap-1 px-3 border-slate-200 text-slate-600 hover:bg-slate-50 font-medium whitespace-nowrap" 
                                onClick={handleExportCSV}
                            >
                                <Download className="h-3.5 w-3.5" /> {t("live.summary.reconciliation")}
                            </Button>
                            <Button 
                                variant="default" 
                                size="sm" 
                                className="h-8 text-[11px] gap-1 px-3 bg-emerald-600 hover:bg-emerald-700 shadow-sm font-bold whitespace-nowrap transition-transform active:scale-95" 
                                onClick={handleExport711Excel}
                            >
                                <Download className="h-3.5 w-3.5" /> {t("live.summary.export_711")}
                            </Button>
                        </div>
                    )}
                    
                    <div className="flex-1 sm:flex-none" />

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-[11px] text-destructive hover:bg-destructive/10 font-bold border border-destructive/20 ml-auto sm:ml-0">
                                {t("live.summary.end_session")}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="z-[100]">
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t("live.summary.end_confirm_title")}</AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div>{t("live.summary.end_confirm_desc")}</div>
                                        <ul className="list-disc list-inside">
                                            <li><b>{t("live.summary.end_action_clear")}</b>：{t("live.summary.end_action_clear_desc")}</li>
                                            <li><b>{t("live.summary.end_action_reset")}</b>：{t("live.summary.end_action_reset_desc")}</li>
                                            <li><b>{t("live.summary.end_action_close")}</b>：{t("live.summary.end_action_close_desc")}</li>
                                        </ul>
                                        <div className="text-destructive font-bold text-xs mt-2">{t("live.summary.end_warning")}</div>
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t("live.summary.cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={onEndSession} className="bg-destructive text-destructive-foreground">{t("live.summary.confirm_end")}</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
            <CardDescription className="text-xs">{t("live.summary.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
            {sales.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("live.summary.empty")}</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                            <p className="text-xs text-muted-foreground">{t("live.summary.total_revenue")}</p>
                            <p className="text-lg font-semibold">${Math.round(stats.totalRevenue).toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                            <p className="text-xs text-muted-foreground">{t("live.summary.total_profit")}</p>
                            <p className={`text-lg font-semibold ${stats.totalProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                {stats.totalProfit >= 0 ? "+" : ""}{Math.round(stats.totalProfit).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="border-t pt-2 mt-1">
                        <p className="text-xs text-muted-foreground mb-2">{t("live.summary.recent_sales")}</p>
                        <div className="space-y-1.5">
                            {sales.slice(-5).reverse().map((sale) => (
                                <div key={sale.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0 group">
                                    <div className="flex-1">
                                        <p className="font-medium">{sale.itemName}</p>
                                        <p className="text-[10px] text-muted-foreground flex flex-col">
                                            <span>
                                                {t("live.summary.buyer")}
                                                <span className="text-primary font-bold ml-1">
                                                    {sale.buyerName || sale.fbName || "Unknown"}
                                                </span>
                                            </span>
                                            {sale.phone && <span className="text-[9px] opacity-70">📞 {sale.phone}</span>}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">{t("live.summary.qty_x_price", { qty: sale.quantity, price: Math.round(sale.unitPrice) })}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div>
                                            <p className="font-semibold text-sm">${Math.round(sale.totalRevenue).toLocaleString()}</p>
                                            <p className={`text-[11px] ${sale.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                                {sale.profit >= 0 ? "+" : ""}{Math.round(sale.profit).toLocaleString()}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onRemoveSale(sale.id)}>
                                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </CardContent>
    </Card>
    );
}
