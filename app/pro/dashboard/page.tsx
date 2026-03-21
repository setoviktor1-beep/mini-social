'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Inbox, Settings, Check, X, Clock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client'; // Įsitikinkite, kad šis failas yra

export default function ProDashboard() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchOrders() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('pro_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setOrders(data);
      setLoading(false);
    }

    fetchOrders();
  }, [supabase]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    
    if (!error) {
      setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar - tas pats kaip anksčiau */}
      <div className="w-full md:w-64 bg-white border-r p-4 flex flex-col gap-2">
        <h1 className="text-xl font-bold mb-6 text-blue-600">MiniSocial PRO</h1>
        <button onClick={() => setActiveTab('inbox')} className={`flex items-center gap-3 p-3 rounded-lg ${activeTab === 'inbox' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}>
          <Inbox size={20} /> Užklausos <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">{orders.filter(o => o.status === 'pending').length}</span>
        </button>
        <button onClick={() => setActiveTab('calendar')} className={`flex items-center gap-3 p-3 rounded-lg ${activeTab === 'calendar' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}><CalendarIcon size={20} /> Kalendorius</button>
        <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 p-3 rounded-lg ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}><Settings size={20} /> Nustatymai</button>
      </div>

      <div className="flex-1 p-4 md:p-8">
        {activeTab === 'inbox' && (
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold mb-6">Kaimynų užklausos (be skambučių)</h2>
            {loading ? <p>Kraunama...</p> : (
              <div className="grid gap-6">
                {orders.length === 0 && <p className="text-gray-500">Kol kas užklausų nėra.</p>}
                {orders.map((order) => (
                  <div key={order.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold">Kaimynas #{order.client_id.slice(0, 5)}</h3>
                          <span className="text-xs text-gray-400">ID: {order.id.slice(0, 8)}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase font-bold">AI Sąmata</p>
                          <p className="text-2xl font-black text-green-600">{order.ai_estimate_min}€ - {order.ai_estimate_max}€</p>
                        </div>
                      </div>
                      <p className="text-gray-600 mb-6">{order.description}</p>
                      
                      {order.status === 'pending' ? (
                        <div className="flex gap-3">
                          <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"><Check size={20} /> Patvirtinti</button>
                          <button onClick={() => updateOrderStatus(order.id, 'rejected')} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"><X size={20} /> Atšaukti</button>
                        </div>
                      ) : (
                        <div className="py-2 px-4 bg-gray-100 rounded text-center font-bold uppercase text-gray-500 text-sm">Būsena: {order.status}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
