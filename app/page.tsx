"use client"

import { useState } from "react"

import { BottomNav, type TabId } from "@/components/bottom-nav"
import { DashboardPage } from "@/components/pages/dashboard"
import { DigitizePage } from "@/components/pages/digitize"
import { BatchPage } from "@/components/pages/batch"
import { ShipmentsPage } from "@/components/pages/shipments"
import { InventoryPage } from "@/components/pages/inventory"
import { SalesPage } from "@/components/pages/sales"
import { SettingsPage } from "@/components/pages/settings"
import { Toaster } from "@/components/ui/toaster"

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard")

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Main Content Area */}
      <main className="pb-24 pt-4 px-4 max-w-lg mx-auto h-full min-h-[100dvh]">
        {activeTab === "dashboard" && <DashboardPage />}
        {activeTab === "batch" && <BatchPage />}
        {activeTab === "shipments" && <ShipmentsPage />}
        {activeTab === "digitize" && <DigitizePage />}
        {activeTab === "inventory" && <InventoryPage />}
        {activeTab === "sales" && <SalesPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}

export default function Home() {
  return (
    <AppContent />
  )
}
