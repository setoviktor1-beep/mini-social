"use client";

import { useState } from "react";
import { MapPin, Star, Clock, CheckCircle2, ShoppingCart, Loader2 } from "lucide-react";

export default function ServiceCard({ service }: { service: any }) {
  const [ordered, setOrdered] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  const handleOrder = () => {
    setIsOrdering(true);
    // Simuliuojame užsakymo procesą (be pay)
    setTimeout(() => {
      setIsOrdering(false);
      setOrdered(true);
    }, 1500);
  };

  return (
    <div className="group bg-gray-900/40 border border-gray-800 rounded-3xl p-6 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/5 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />

      <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
        <div className="p-3 bg-gray-950 rounded-2xl border border-gray-800 group-hover:border-blue-500/30 transition-colors">
          <service.icon className="text-blue-400" size={24} />
        </div>
        <div className="flex items-center gap-1 bg-gray-950 px-3 py-1 rounded-full border border-gray-800">
          <Star className="text-yellow-500 fill-yellow-500" size={14} />
          <span className="text-xs font-bold text-gray-300">{service.rating}</span>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
            {service.name}
          </h3>
          {!service.isOpen && (
            <span className="text-[10px] uppercase tracking-wider font-black px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md">
              Uždaryta
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
          {service.description}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <MapPin size={14} className="text-gray-600" />
          {service.address} · <span className="text-blue-400/80">{service.distance}</span>
        </div>
        
        {service.promo && (
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
            <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Dienos pasiūlymas</div>
            <div className="text-xs text-emerald-400 font-bold leading-tight">{service.promo}</div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-gray-800/50 flex items-center justify-between gap-4">
        {ordered ? (
          <div className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl font-bold animate-in zoom-in-95 duration-300">
            <CheckCircle2 size={18} />
            Užsakyta!
          </div>
        ) : (
          <button
            onClick={handleOrder}
            disabled={isOrdering || !service.isOpen}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            {isOrdering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ShoppingCart size={18} />
            )}
            {isOrdering ? "Siunčiama..." : "Užsisakyti"}
          </button>
        )}
      </div>
    </div>
  );
}
