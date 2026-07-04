"use client";

import { useState } from 'react';
import { ClipboardList, Tags, MessageSquare, Settings as SettingsIcon, CalendarDays, Sparkles, Bot, TrendingUp, Receipt } from 'lucide-react';
import RequestBoard from './RequestBoard';
import ServicesCatalog from './ServicesCatalog';
import QuickReplies from './QuickReplies';
import ProSettings from './ProSettings';
import ProCalendar from './ProCalendar';
import ProAIChat from './ProAIChat';
import ProAgent from './ProAgent';
import FinancialSummary from './FinancialSummary';
import ReceiptScanner from './ReceiptScanner';

type Tab = 'orders' | 'calendar' | 'catalog' | 'messages' | 'ai' | 'agent' | 'finance' | 'receipts' | 'settings';

export default function ProDashboardTabs({
  initialRequests,
  currentUserId,
  isEnterprise = false,
  isPro = false,
}: {
  initialRequests: any[],
  currentUserId: string,
  isEnterprise?: boolean,
  isPro?: boolean,
}) {
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const currentMonth = new Date().toISOString().slice(0, 7);

  const tabs = [
    { id: 'orders', label: 'Užsakymai', icon: ClipboardList },
    { id: 'calendar', label: 'Kalendorius', icon: CalendarDays },
    { id: 'catalog', label: 'Kainoraštis', icon: Tags },
    { id: 'messages', label: 'Greiti atsakymai', icon: MessageSquare },
    { id: 'ai', label: 'AI Asistentas', icon: Sparkles },
    { id: 'agent', label: 'Agentas', icon: Bot },
    { id: 'finance', label: 'Finansai', icon: TrendingUp },
    { id: 'receipts', label: 'Čekiai', icon: Receipt },
    { id: 'settings', label: 'Nustatymai', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-800/60 pb-px scrollbar-hide -mx-3 px-3 sm:-mx-0 sm:px-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-3 sm:px-6 py-3 sm:py-4 font-bold text-sm transition-all whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-900/30'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px] md:min-h-[500px]">
        {activeTab === 'orders' && (
          <div className="animate-in fade-in duration-300">
            <RequestBoard initialRequests={initialRequests} currentUserId={currentUserId} />
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="animate-in fade-in duration-300">
            <ProCalendar proId={currentUserId} />
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="animate-in fade-in duration-300">
            <ServicesCatalog proId={currentUserId} />
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="animate-in fade-in duration-300">
            <QuickReplies proId={currentUserId} />
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="animate-in fade-in duration-300">
            {isPro ? (
              <ProAIChat />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Sparkles size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-white font-bold text-lg">AI Asistentas — Pro funkcija</h3>
                <p className="text-gray-500 text-sm text-center max-w-xs">
                  AI pagalbininkas prieinamas Pro ir Enterprise planų vartotojams (nuo €29.99/mėn).
                </p>
                <a href="/pricing" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl transition-colors">
                  Atnaujinti į Pro
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="animate-in fade-in duration-300">
            <ProAgent isEnterprise={isEnterprise} />
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="animate-in fade-in duration-300">
            <FinancialSummary isPro={isPro ?? false} />
          </div>
        )}

        {activeTab === 'receipts' && (
          <div className="animate-in fade-in duration-300">
            <ReceiptScanner isEnterprise={isEnterprise ?? false} month={currentMonth} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in fade-in duration-300">
            <ProSettings proId={currentUserId} maxRadius={isEnterprise ? 50 : isPro ? 15 : 5} />
          </div>
        )}
      </div>
    </div>
  );
}
