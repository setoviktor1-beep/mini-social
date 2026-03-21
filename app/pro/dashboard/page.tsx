'use client';

import React, { useState } from 'react';
import { Calendar as CalendarIcon, Inbox, Settings, Check, X, Clock } from 'lucide-react';

export default function ProDashboard() {
  const [activeTab, setActiveTab] = useState('inbox');

  const mockOrders = [
    {
      id: 1,
      client: 'Jonas P.',
      distance: '800m',
      category: 'Santechnika',
      description: 'Varva virtuvės kranas, reikia pakeisti tarpinę.',
      estimate: { min: 35, max: 55 },
      status: 'pending'
    },
    {
      id: 2,
      client: 'Rasa M.',
      distance: '1.2km',
      category: 'Elektra',
      description: 'Nustojo veikti trys rozetės svetainėje.',
      estimate: { min: 50, max: 80 },
      status: 'pending'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white border-r p-4 flex flex-col gap-2">
        <h1 className="text-xl font-bold mb-6 text-blue-600">MiniSocial PRO</h1>
        <button 
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-3 p-3 rounded-lg ${activeTab === 'inbox' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
        >
          <Inbox size={20} /> Užklausos <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">2</span>
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-3 p-3 rounded-lg ${activeTab === 'calendar' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
        >
          <CalendarIcon size={20} /> Kalendorius
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-3 p-3 rounded-lg ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
        >
          <Settings size={20} /> Nustatymai
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8">
        {activeTab === 'inbox' && (
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold mb-6">Naujos kaimynų užklausos</h2>
            <div className="grid gap-6">
              {mockOrders.map((order) => (
                <div key={order.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                          {order.category}
                        </span>
                        <h3 className="text-lg font-bold mt-2">{order.client} ({order.distance})</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase font-bold">AI Sąmata</p>
                        <p className="text-2xl font-black text-green-600">{order.estimate.min}€ - {order.estimate.max}€</p>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-6">{order.description}</p>
                    <div className="flex gap-3">
                      <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition">
                        <Check size={20} /> Patvirtinti
                      </button>
                      <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition">
                        <X size={20} /> Atšaukti
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-6 py-3 border-t text-xs text-gray-500 flex items-center gap-2 uppercase font-bold">
                    <Clock size={14} /> Gauta prieš 15 min. • Be skambučio
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="max-w-4xl">
            <h2 className="text-2xl font-bold mb-6">Darbų kalendorius</h2>
            <div className="bg-white border rounded-xl p-6">
              <p className="text-gray-500 italic text-center py-20">Kalendorius kraunamas... Jūsų laiko tarpsniai bus matomi čia.</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold mb-6">Verslo nustatymai</h2>
            <div className="bg-white border rounded-xl p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Mano spindulys (km)</label>
                <input type="range" min="0.5" max="3" step="0.5" className="w-full" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0.5km</span>
                  <span className="text-blue-600 font-bold">Dabar: 2km</span>
                  <span>3km</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Kategorija</label>
                <select className="w-full p-3 border rounded-lg bg-white">
                  <option>Santechnika</option>
                  <option>Elektra</option>
                  <option>Apdaila</option>
                  <option>Valymas</option>
                </select>
              </div>
              <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">Išsaugoti pakeitimus</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
