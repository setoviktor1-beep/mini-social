"use client";

import { useState } from 'react';
import { ClipboardList, Tags, MessageSquare, Settings as SettingsIcon } from 'lucide-react';
import RequestBoard from './RequestBoard';

type Tab = 'orders' | 'catalog' | 'messages' | 'settings';

export default function ProDashboardTabs({ 
  initialRequests, 
  currentUserId 
}: { 
  initialRequests: any[], 
  currentUserId: string 
}) {
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  const tabs = [
    { id: 'orders', label: 'Užsakymai', icon: ClipboardList },
    { id: 'catalog', label: 'Kainoraštis / Meniu', icon: Tags },
    { id: 'messages', label: 'Klientų Žinutės', icon: MessageSquare },
    { id: 'settings', label: 'Veiklos Nustatymai', icon: SettingsIcon },
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

        {activeTab === 'catalog' && (
          <div className="animate-in fade-in duration-300 bg-gray-900/40 border border-gray-800 rounded-3xl p-8 text-center">
            <Tags className="mx-auto text-gray-600 mb-4" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">Tavo teikiamos paslaugos</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Čia galėsi pridėti savo teikiamas paslaugas, prekes ar patiekalus, nustatyti jų kainas ir aprašymus, kad kaimynai galėtų užsisakyti tiesiogiai.
            </p>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-full transition-colors">
              + Pridėti naują paslaugą
            </button>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="animate-in fade-in duration-300 bg-gray-900/40 border border-gray-800 rounded-3xl p-8 text-center">
            <MessageSquare className="mx-auto text-gray-600 mb-4" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">Greitieji atsakymai</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Ši skiltis bus susieta su tavo asmeninėmis žinutėmis. Galėsi vienu paspaudimu išsiųsti šablonus kaip "Esu kelyje" arba "Užsakymas paruoštas".
            </p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-in fade-in duration-300 bg-gray-900/40 border border-gray-800 rounded-3xl p-8 text-center">
            <SettingsIcon className="mx-auto text-gray-600 mb-4" size={48} />
            <h2 className="text-xl font-bold text-white mb-2">Darbo laikas ir lokacija</h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Čia galėsi nustatyti, kuriomis valandomis priimi užsakymus ir kokiu spinduliu (km) teiki paslaugas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
