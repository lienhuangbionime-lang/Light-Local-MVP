"use client"

import { useState } from "react"
import { useAppStore, Item } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Minus, Plus, Search, Package, AlertTriangle, Trash2, Edit2, RefreshCw, Split } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/lib/i18n"

export function InventoryPage() {
  const { items, removeItem, updateItemMetadata, renameItem } = useAppStore()
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  // Edit State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{
    name: string;
    originalName: string;
    description: string;
    material: string;
    sizes: string;
    colors: string;
    suggestedPrice: string;
  } | null>(null)

  const handleOpenEdit = (group: any) => {
    setEditingGroup({
      name: group.name,
      originalName: group.name, // Keep track of the name before editing
      description: group.items[0]?.description || "",
      material: group.items[0]?.material || "",
      sizes: group.items[0]?.sizes || "",
      colors: group.items[0]?.colors || "",
      suggestedPrice: group.items[0]?.suggestedPrice || "",
    })
    setIsEditDialogOpen(true)
  }

  const [syncSpecs, setSyncSpecs] = useState(false)

  const handleSaveEdit = () => {
    if (!editingGroup) return
    
    // Check if name has changed
    const nameChanged = editingGroup.name !== (editingGroup as any).originalName;
    const oldName = (editingGroup as any).originalName;
    const newName = editingGroup.name;

    if (nameChanged) {
      renameItem(oldName, newName);
    }

    const updatePayload: any = {
      description: editingGroup.description,
      material: editingGroup.material,
      suggestedPrice: editingGroup.suggestedPrice,
    };

    // Only sync sizes and colors if explicitly requested by the user
    // This protects batch-specific data (like splits) from being overwritten
    if (syncSpecs) {
      updatePayload.sizes = editingGroup.sizes;
      updatePayload.colors = editingGroup.colors;
    }

    // Use newName if name changed, otherwise oldName
    updateItemMetadata(newName, updatePayload)
    
    toast({ 
      title: nameChanged ? t("inventory.toast_update_title_1") : t("inventory.toast_update_title_2"), 
      description: syncSpecs 
        ? t("inventory.toast_update_desc_1").replace("{name}", newName) 
        : t("inventory.toast_update_desc_2").replace("{name}", newName) 
    })
    setIsEditDialogOpen(false)
  }

  // Group items by name for the UI
  const groupedItems = items.reduce((acc, item) => {
    const key = item.name.toLowerCase().trim();
    if (!acc[key]) {
      acc[key] = {
        name: item.name,
        totalQuantity: 0,
        totalValueLanded: 0,
        totalValueBase: 0,
        ids: [],
        items: []
      };
    }
    acc[key].totalQuantity += item.quantity;
    acc[key].totalValueLanded += item.localCostLanded * item.quantity;
    acc[key].totalValueBase += item.localCostBase * item.quantity;
    acc[key].ids.push(item.id);
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, {
    name: string;
    totalQuantity: number;
    totalValueLanded: number;
    totalValueBase: number;
    ids: string[];
    items: Item[];
  }>);

  const displayItems = Object.values(groupedItems).filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: t("inventory.status_out_of_stock"), className: "bg-destructive/10 text-destructive" }
    if (quantity <= 5) return { label: t("inventory.status_low_stock"), className: "bg-amber-500/10 text-amber-600" }
    return { label: t("inventory.status_normal"), className: "bg-emerald-500/10 text-emerald-600" }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl font-bold text-foreground">{t("inventory.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {(t("inventory.stats") || "共 {count} 款商品，總庫存 {total} 件")
            .replace("{count}", Object.keys(groupedItems).length.toString())
            .replace("{total}", items.reduce((sum, p) => sum + p.quantity, 0).toString())}
        </p>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("inventory.search_placeholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Item List */}
      {displayItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? t("inventory.no_items_found") : t("inventory.no_items")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayItems.map((group) => {
            const stockStatus = getStockStatus(group.totalQuantity);
            const avgLanded = group.totalQuantity > 0 ? group.totalValueLanded / group.totalQuantity : 0;
            const avgBase = group.totalQuantity > 0 ? group.totalValueBase / group.totalQuantity : 0;

            return (
              <Card key={group.name} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4">
                    {/* Item Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate pr-2 flex items-center gap-2">
                          {group.name}
                          <span className="text-[11px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">
                            {t("inventory.avg_landed")} ${Math.round(avgLanded).toLocaleString()}
                          </span>
                        </h3>
                        <p className={`text-sm mt-0.5 font-medium ${group.items[0].suggestedPrice ? "text-primary" : "text-muted-foreground"}`}>
                          {t("inventory.suggested_price")} {group.items[0].suggestedPrice || "未設定"}
                        </p>
                        {/* AI Metadata Display */}
                        {/* AI Metadata Display */}
                        {(group.items[0].material || group.items[0].sizes || group.items[0].colors) && (
                          <div className="flex flex-wrap gap-2 mt-2">
                             {group.items[0].material && <span className="text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded">{t("inventory.material")} {group.items[0].material}</span>}
                             {group.items[0].sizes && <span className="text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded">{t("inventory.size")} {group.items[0].sizes}</span>}
                             {group.items[0].colors && <span className="text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded">{t("inventory.color")} {group.items[0].colors}</span>}
                          </div>
                        )}
                        {group.items[0].description && (
                          <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 italic">
                            💡 {group.items[0].description}
                          </p>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[10px] mt-2 text-primary hover:bg-primary/5 px-1 px-2"
                          onClick={() => handleOpenEdit(group)}
                        >
                          <Edit2 className="h-3 w-3 mr-1" /> {t("inventory.edit_specs")}
                        </Button>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.className}`}>
                        {stockStatus.label}
                      </span>
                    </div>

                    {/* Quantity Info */}
                    <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2 px-3">
                      <span className="text-sm font-medium">{t("inventory.total_stock")}</span>
                      <div className="text-lg font-bold text-primary">
                        {group.totalQuantity} <span className="text-xs font-normal text-muted-foreground ml-1">{t("inventory.piece")}</span>
                      </div>
                    </div>

                    {/* Batch Details (Optional small text) */}
                    <div className="mt-3 pt-2 border-t border-border/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground underline decoration-primary/30">{t("inventory.batch_details")}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.filter(i => i.quantity > 0).map((item, idx) => {
                          const isOldStock = new Date().getTime() - new Date(item.createdAt).getTime() > 14 * 24 * 60 * 60 * 1000;
                          return (
                            <div key={item.id} className="flex flex-col bg-muted/30 p-1.5 rounded border border-border/40 min-w-[120px]">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-semibold text-primary">{t("inventory.batch")} {idx + 1}</span>
                                {isOldStock && (
                                  <span className="bg-amber-100 text-amber-700 px-1 rounded-[2px] leading-tight">{t("inventory.suggest_clearing")}</span>
                                )}
                              </div>
                              <div className="text-[10px] mt-0.5 flex flex-col gap-0.5">
                                <div className="flex justify-between">
                                  <span>{t("inventory.quantity")} {item.quantity}</span>
                                  <span className="text-muted-foreground ml-2">{t("inventory.landed_cost")} ${Math.round(item.localCostLanded)}</span>
                                </div>
                                {(item.sizes || item.colors) && (
                                  <div className="flex gap-1 text-[9px] text-primary/70 italic">
                                    {item.sizes && <span>[{item.sizes}]</span>}
                                    {item.colors && <span>({item.colors})</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Remove Action */}
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if (window.confirm(t("inventory.confirm_delete").replace("{name}", group.name))) {
                            group.ids.forEach(id => removeItem(id));
                            toast({ title: t("inventory.toast_delete_success"), description: `已移除 ${group.name}` })
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {t("inventory.remove_item")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("inventory.edit_title")}{editingGroup?.name}</DialogTitle>
            <DialogDescription>
              {t("inventory.edit_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Suggested Price Ref Table */}
            <div className="bg-primary/5 p-2 rounded-lg border border-primary/20 space-y-1">
              <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                {t("inventory.price_ref").replace("${cost}", (editingGroup ? Math.round(groupedItems[editingGroup.name.toLowerCase()]?.totalValueLanded / groupedItems[editingGroup.name.toLowerCase()]?.totalQuantity || 0) : 0).toString())}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-background rounded p-1 border border-border/40">
                  <p className="text-[9px] text-muted-foreground">{t("inventory.price_1")}</p>
                  <p className="text-xs font-bold">${editingGroup ? Math.round(((groupedItems[editingGroup.name.toLowerCase()]?.totalValueLanded / groupedItems[editingGroup.name.toLowerCase()]?.totalQuantity || 0) + 90) / 5) * 5 : 0}</p>
                </div>
                <div className="bg-background rounded p-1 border border-border/40">
                  <p className="text-[9px] text-muted-foreground">{t("inventory.price_2")}</p>
                  <p className="text-xs font-bold font-mono text-emerald-600">${editingGroup ? Math.round((((groupedItems[editingGroup.name.toLowerCase()]?.totalValueLanded / groupedItems[editingGroup.name.toLowerCase()]?.totalQuantity || 0) + 90) * 2 * 0.9) / 5 / 2) * 5 * 2 / 2 : 0}</p>
                </div>
                <div className="bg-background rounded p-1 border border-border/40">
                  <p className="text-[9px] text-muted-foreground">{t("inventory.price_3")}</p>
                  <p className="text-xs font-bold font-mono text-emerald-600">${editingGroup ? Math.round((((groupedItems[editingGroup.name.toLowerCase()]?.totalValueLanded / groupedItems[editingGroup.name.toLowerCase()]?.totalQuantity || 0) + 90) * 3 * 0.8) / 5 / 3) * 5 * 3 / 3 : 0}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-[10px] font-bold">{t("inventory.product_name")}</Label>
              <Input
                id="edit-name"
                value={editingGroup?.name || ""}
                onChange={(e) => setEditingGroup(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="h-8 text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold">{t("inventory.formal_price")}</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 px-1.5 text-[9px] text-primary hover:bg-primary/10"
                  onClick={() => {
                    if (!editingGroup) return;
                    const nameKey = editingGroup.name.toLowerCase();
                    const group = groupedItems[nameKey];
                    if (!group) return;
                    const cost = group.totalValueLanded / group.totalQuantity || 0;
                    const p1 = Math.round((cost + 90) / 5) * 5;
                    const p2 = Math.round((p1 * 2 * 0.9) / 5) * 5;
                    const p3 = Math.round((p1 * 3 * 0.8) / 5) * 5;
                    setEditingGroup({ ...editingGroup, suggestedPrice: `1:${p1}, 2:${p2}, 3:${p3}` });
                  }}
                >
                  {t("inventory.auto_fill_btn")}
                </Button>
              </div>
              <Input
                placeholder="例如: 1:490, 2:880, 3:1180"
                value={editingGroup?.suggestedPrice || ""}
                onChange={(e) => setEditingGroup(prev => prev ? { ...prev, suggestedPrice: e.target.value } : null)}
                className="h-8 text-xs border-primary/20 bg-background/50 font-mono"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-material" className="text-xs">{t("inventory.material_label")}</Label>
                <Input
                  id="edit-material"
                  value={editingGroup?.material}
                  onChange={(e) => setEditingGroup(prev => prev ? { ...prev, material: e.target.value } : null)}
                  placeholder="棉, 麻.."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-sizes" className="text-xs">{t("inventory.size_label")}</Label>
                <Input
                  id="edit-sizes"
                  value={editingGroup?.sizes}
                  onChange={(e) => setEditingGroup(prev => prev ? { ...prev, sizes: e.target.value } : null)}
                  placeholder="S, M, L.."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-colors" className="text-xs">{t("inventory.color_label")}</Label>
                <Input
                  id="edit-colors"
                  value={editingGroup?.colors}
                  onChange={(e) => setEditingGroup(prev => prev ? { ...prev, colors: e.target.value } : null)}
                  placeholder="紅白黑.."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Batch Sync Toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 text-primary" />
                  <Label className="text-[11px] font-bold">{t("inventory.sync_specs")}</Label>
                </div>
                <p className="text-[9px] text-muted-foreground">{t("inventory.sync_specs_desc")}</p>
              </div>
              <Switch 
                checked={syncSpecs}
                onCheckedChange={setSyncSpecs}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-description" className="text-xs">{t("inventory.ai_desc")}</Label>
              <Textarea
                id="edit-description"
                value={editingGroup?.description}
                onChange={(e) => setEditingGroup(prev => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="這款版型偏大，建議拿小一號..."
                className="min-h-[100px] text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t("inventory.cancel")}</Button>
            <Button onClick={handleSaveEdit}>{t("inventory.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
