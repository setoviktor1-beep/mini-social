"use client";

import { useState } from 'react';
import { ClipboardList, Tags, MessageSquare, Settings as SettingsIcon, CalendarDays, Sparkles, Bot } from 'lucide-react';
import RequestBoard from './RequestBoard';
import ServicesCatalog from './ServicesCatalog';
import QuickReplies from './QuickReplies';
import ProSettings from './ProSettings';
import ProCalendar from './ProCalendar';
import ProAIChat from './ProAIChat';
import ProAgent from './ProAgent';

type Tab = 'orders' | 'calendar' | 'catalog' | 'messages' | 'ai' | 'agent' | 'settings';

export default function ProDashboardTabs({
  initialRequests,
  currentUserId,
  isEnterprise = false,
}: {
  initialRequests: any[],
  currentUserId: string,
  isEnterprise?: boolean,
}) {
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  const tabs = [
    { id: 'orders', label: 'Užsakymai', icon: ClipboardList },
    { id: 'calendar', label: 'Kalendorius', icon: CalendarDays },
    { id: 'catalog', label: 'Kainoraštis', icon: Tags },
    { id: 'messages', label: 'Greiti atsakymai', icon: MessageSquare },
    { id: 'ai', label: 'AI Asistentas', icon: Sparkles },
    { id: 'agent', label: 'Agentas', icon: Bot },
    { id: 'settings', label: 'Nustatymai', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-800/60 pb-px scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all whitespace-nowrap border-b-2 ${
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
      <div className="min-h-[500px]">
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
            <ProAIChat />
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="animate-in fade-in duration-300">
            <ProAgent isEnterprise={isEnterprise} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in fade-in duration-300">
            <ProSettings proId={currentUserId} />
          </div>
        )}
      </div>
    </div>
  );
}
