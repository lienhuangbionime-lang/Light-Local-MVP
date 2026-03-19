import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Zap, Plus, Radio, Trash2, Shield, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"

export const DiagnosticConsole = ({ 
    debugEvents, 
    healthStatus, 
    backendUrl, 
    onSimulate, 
    onSubscribePage,
    onUpdateToken,
    onTest,
    onReset,
    onClearEvents,
    isSimulating,
    isLoadingSub,
    isLoadingTest,
    isLoadingReset,
    showDebug,
    onToggleDebug,
    connectionError
}: { 
    debugEvents: any[]; 
    healthStatus: any; 
    backendUrl: string; 
    onSimulate: () => void; 
    onSubscribePage: () => void;
    onUpdateToken: () => void;
    onTest: () => void;
    onReset?: (deep: boolean) => void;
    isSimulating: boolean;
    isLoadingSub: boolean;
    isLoadingTest: boolean;
    isLoadingReset?: boolean;
    showDebug: boolean;
    onToggleDebug: () => void;
    onClearEvents: () => void;
    connectionError?: string | null;
}) => {
    const { t } = useTranslation()
    return (
    <div className="space-y-4">
        <div className="flex justify-center flex-col items-center gap-2">
            <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground hover:text-primary gap-1" onClick={onToggleDebug}>
                {showDebug ? t("live.diag.hide") : t("live.diag.show")}
            </Button>
            {showDebug && onReset && (
                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-[9px] text-destructive/60 hover:text-destructive hover:bg-destructive/5 h-6 px-2 border border-destructive/10" 
                        onClick={() => {
                            if (confirm(t("live.diag.reset_confirm"))) {
                                onReset(false);
                            }
                        }}
                        disabled={isLoadingReset}
                    >
                        {t("live.diag.reset_normal")}
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-[9px] text-red-600 hover:text-red-700 hover:bg-red-50 h-6 px-2 border border-red-200 font-bold" 
                        onClick={() => {
                            if (confirm(t("live.diag.reset_deep_confirm"))) {
                                onReset(true);
                            }
                        }}
                        disabled={isLoadingReset}
                    >
                        {t("live.diag.reset_deep")}
                    </Button>
                </div>
            )}
        </div>

        {showDebug && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <Card className="border-dashed bg-muted/20 overflow-hidden rounded-2xl">
                    <CardHeader className="py-2.5 px-4 flex flex-row items-center justify-between border-b border-border/10 bg-muted/30">
                        <CardTitle className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-amber-500" /> {t("live.diag.events_title")}
                        </CardTitle>
                        <div className="flex gap-1.5">
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1 hover:bg-destructive/10 hover:text-destructive border border-destructive/10" onClick={onClearEvents}>
                                <Trash2 className="h-2 w-2" /> 
                                {t("live.diag.clear_events")}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] gap-1 hover:bg-amber-100 hover:text-amber-800 border border-amber-200/50" onClick={onSimulate} disabled={isSimulating}>
                                <Plus className="h-2 w-2" /> {t("live.diag.simulate_test")}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 space-y-1.5 max-h-[180px] overflow-y-auto font-mono text-[9px]">
                        {Array.isArray(debugEvents) && debugEvents.length === 0 ? (
                            <div className="text-center py-6 opacity-60">
                                <p className="italic text-[10px]">{t("live.diag.no_events")}</p>
                                <p className="text-[8px] mt-1">{t("live.diag.target_api")} {backendUrl.replace("https://", "")}</p>
                            </div>
                        ) : Array.isArray(debugEvents) ? (
                            debugEvents.map((evt, i) => (
                                <div key={i} className="border-b border-border/20 last:border-0 pb-1.5 flex gap-2 items-start">
                                    <span className="text-blue-500 font-bold shrink-0">[{evt.time}]</span>
                                    <div className="flex-1 break-all leading-tight">
                                        {evt.time?.startsWith("SIM_") ? (
                                            <span className="text-amber-600 font-bold">{t("live.diag.event_sim", { content: evt.content || "測試訊息" })}</span>
                                        ) : evt.data?.entry?.[0]?.messaging?.[0]?.message?.text ? (
                                            <span className="text-emerald-600">{t("live.diag.event_msg", { text: evt.data.entry[0].messaging[0].message.text })}</span>
                                        ) : evt.data?.entry?.[0]?.changes?.[0]?.value?.message ? (
                                            <span className="text-primary font-bold">{t("live.diag.event_comment", { text: evt.data.entry[0].changes[0].value.message })}</span>
                                        ) : evt.content ? (
                                            <span className={cn(
                                                evt.time === "err" ? "text-destructive font-bold" : 
                                                evt.time === "warn" ? "text-amber-500 font-bold" :
                                                "text-muted-foreground italic"
                                            )}>
                                                {evt.content}
                                            </span>
                                        ) : (
                                            <span className="opacity-70">{t("live.diag.event_raw", { data: (JSON.stringify(evt.data) || "{}").slice(0, 300) })}...</span>
                                        )}
                                        {evt.rejection && (
                                            <div className={cn(
                                                "mt-1 font-bold flex items-center gap-1",
                                                evt.time === "warn" ? "text-amber-500" : "text-destructive"
                                            )}>
                                                <Radio className="h-2 w-2 animate-pulse" /> {t("live.diag.rejection", { reason: evt.rejection })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-4 text-destructive">{t("live.diag.parse_error")}</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-amber-200/30 shadow-none rounded-2xl overflow-hidden bg-amber-50/20">
                    <CardHeader className="py-2.5 px-4 bg-amber-50/50 border-b border-amber-100">
                        <CardTitle className="text-[11px] font-bold flex items-center justify-between">
                            <span className="flex items-center gap-2">{t("live.diag.report_title")}</span>
                            {healthStatus && (
                                <Badge 
                                    variant={healthStatus.token_configured === "SET" ? "outline" : "destructive"} 
                                    className={cn(
                                        "text-[9px] font-black h-5",
                                        healthStatus.token_configured === "SET" ? "border-emerald-200 text-emerald-600" : "bg-red-500 text-white"
                                    )}
                                >
                                    {healthStatus.token_configured === "SET" ? t("live.diag.token_ok") : t("live.diag.token_missing")}
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4 pt-2">
                        {connectionError && (
                            <div className="p-3 rounded-xl bg-red-600 text-white border border-red-700 shadow-lg animate-pulse">
                                <p className="text-xs font-black flex items-center gap-2">
                                    <Radio className="h-4 w-4" /> 嚴重：後端連線中斷
                                </p>
                                <p className="text-[10px] mt-1 opacity-90 font-mono break-all">
                                    原因: {connectionError}
                                </p>
                                <p className="text-[9px] mt-2 bg-black/20 p-1.5 rounded">
                                    請檢查 Render 後端是否休眠或網址設定錯誤。
                                </p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 pb-2">
                             <Button variant="outline" size="sm" className="h-8 text-[10px] border-primary/20 bg-white/50" onClick={onTest} disabled={isLoadingTest}>
                                 {isLoadingTest ? t("live.diag.connecting") : t("live.diag.refresh")}
                             </Button>
                             <Button variant="outline" size="sm" className="h-8 text-[10px] text-blue-600 border-blue-100 bg-white/50" onClick={onSubscribePage} disabled={isLoadingSub}>
                                 {isLoadingSub ? t("live.diag.subscribing") : t("live.diag.subscribe")}
                             </Button>
                             <Button variant="outline" size="sm" className="h-8 text-[10px] text-orange-600 border-orange-100 bg-white/50" onClick={onUpdateToken}>
                                 {t("live.diag.set_token")}
                             </Button>
                             <Button variant="secondary" size="sm" className="h-8 text-[10px] gap-1 font-bold shadow-sm" onClick={onSimulate} disabled={isSimulating}>
                                 <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {isSimulating ? t("live.diag.simulating") : t("live.diag.simulate")}
                             </Button>
                        </div>

                        {healthStatus?.page_name && (
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100/50 shadow-sm">
                                <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    {t("live.diag.identity", { name: healthStatus.page_name })}
                                </div>
                                 <div className="text-[8px] text-emerald-600 mt-0.5 opacity-80">ID: {healthStatus.page_id}</div>
                            </div>
                        )}

                        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 shadow-sm">
                            <div className="text-[10px] font-bold text-indigo-700 flex items-center gap-2 mb-1.5">
                                <span className="p-1 rounded bg-indigo-600 text-white text-[8px] uppercase tracking-tighter shadow-sm flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                    Active
                                </span>
                                {t("live.diag.ai_mode")}
                            </div>
                            <p className="text-[10px] text-indigo-600/80 leading-relaxed italic">
                                {t("live.diag.ai_desc")}
                            </p>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[11px] font-black tracking-tighter flex items-center gap-1.5">
                                    <Shield className="h-3.5 w-3.5 text-blue-400" /> {t("live.diag.security_shield")}
                                </p>
                                <Badge variant="secondary" className="text-[8px] h-4 bg-blue-500/20 text-blue-300 border-blue-400/30">V2.0 PROTECTED</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px]">
                                <div className="flex items-center gap-1.5 opacity-90">
                                    <CheckCircle2 className="h-3 w-3 text-green-400" /> {t("live.diag.hmac")}
                                </div>
                                <div className="flex items-center gap-1.5 opacity-90">
                                    <CheckCircle2 className="h-3 w-3 text-green-400" /> {t("live.diag.temporal")}
                                </div>
                                <div className="flex items-center gap-1.5 opacity-90">
                                    <CheckCircle2 className="h-3 w-3 text-green-400" /> {t("live.diag.webhook_lock")}
                                </div>
                                <div className="flex items-center gap-1.5 opacity-90">
                                    <CheckCircle2 className="h-3 w-3 text-green-400" /> {t("live.diag.semantic_dedup")}
                                </div>
                            </div>
                        </div>

                        {healthStatus?.scopes?.length > 0 && (
                            <div className="space-y-1.5">
                                 <p className="text-[9px] font-bold text-muted-foreground flex items-center gap-1">{t("live.diag.permissions")}</p>
                                 <div className="flex flex-wrap gap-1">
                                     {healthStatus.scopes.map((s: string) => (
                                        <span key={s} className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-100 text-[8px] font-medium">
                                            {s}
                                        </span>
                                     ))}
                                 </div>
                            </div>
                        )}

                        {healthStatus?.token_error && (
                            <div className="text-[9px] bg-red-50 text-red-700 p-3 rounded-xl border border-red-100 font-mono shadow-inner">
                                 <p className="font-black text-xs flex items-center gap-2 mb-1">
                                    {t("live.diag.order_error_title")}
                                 </p>
                                 <p className="break-all opacity-80 mb-2 leading-relaxed">
                                    {t("live.diag.error_details", { error: healthStatus.token_error })}
                                 </p>
                                 <div className="bg-white/50 p-2 rounded-lg text-red-800 font-sans border border-red-200">
                                    <p className="font-bold">{t("live.diag.solution_title")}</p>
                                    <p>{t("live.diag.solution_1")}</p>
                                    <p>{t("live.diag.solution_2")}</p>
                                 </div>
                            </div>
                        )}

                        {(healthStatus?.error || healthStatus?.identity_error || healthStatus?.perm_error) && (
                            <div className="text-[9px] bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 font-mono shadow-inner">
                                 <p className="font-black text-xs flex items-center gap-2 mb-1 text-rose-800">
                                    {t("live.diag.conn_error_title")}
                                 </p>
                                 <div className="space-y-1 opacity-90">
                                    {healthStatus.error && <p>{t("live.diag.conn_error", { error: healthStatus.error })}</p>}
                                    {healthStatus.identity_error && <p>{t("live.diag.identity_error", { error: healthStatus.identity_error })}</p>}
                                    {healthStatus.perm_error && <p>{t("live.diag.perm_error", { error: healthStatus.perm_error })}</p>}
                                 </div>
                            </div>
                        )}

                        <div className="p-2 rounded-xl bg-blue-50/50 border border-blue-100">
                            <p className="text-[10px] text-blue-700 font-bold flex items-center gap-1.5 mb-1">
                                <Radio className="h-3 w-3" /> {t("live.diag.how_to_check")}
                            </p>
                            <p className="text-[9px] text-blue-600 leading-relaxed">
                                {t("live.diag.how_to_check_desc")}
                            </p>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-amber-100/50 opacity-60 text-[8px] font-mono">
                            <span>{t("live.diag.version", { version: healthStatus?.version || 'Loading...' })}</span>
                            <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Radio className="w-2 h-2" /> {t("live.diag.instance", { id: healthStatus?.instance_id || 'Connecting...' })}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
    </div>
    )
}
