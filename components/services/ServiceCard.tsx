"use client";

import { useState } from "react";
import { MapPin, Star, CheckCircle2, ShoppingCart, Loader2, X, Send } from "lucide-react";
import { createClient } from "@/lib/backend-client";

interface ServiceCardProps {
  service: any;
  currentUserId?: string;
}

export default function ServiceCard({ service, currentUserId }: ServiceCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(`Sveiki, norėčiau užsisakyti: ${service.name}`);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const handleOrder = () => {
    if (!currentUserId) {
      setNotLoggedIn(true);
      return;
    }
    setNotLoggedIn(false);
    setShowModal(true);
  };

  const handleSend = async () => {
    if (!currentUserId || !service.providerId) return;
    setIsSending(true);

    try {
      const supabase = createClient();

      // Get or create a conversation with the provider
      const { data: conversationId, error: rpcError } = await supabase.rpc(
        'get_or_create_conversation',
        { other_user_id: service.providerId }
      );

      if (rpcError) throw rpcError;

      // Insert the message
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: message,
      });

      if (msgError) throw msgError;

      setSent(true);
      setShowModal(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-lg">
        {/* Background Decor */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />

        <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 transition-colors group-hover:border-blue-200">
            <service.icon className="text-blue-600" size={24} />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <Star className="text-yellow-500 fill-yellow-500" size={14} />
            <span className="text-xs font-bold text-slate-700">{service.rating}</span>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 transition-colors group-hover:text-blue-700">
              {service.name}
            </h3>
            {!service.isOpen && (
              <span className="text-[10px] uppercase tracking-wider font-black px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md">
                Uždaryta
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">
            {service.description}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <MapPin size={14} className="text-slate-400" />
            {service.address} · <span className="text-blue-600">{service.distance}</span>
          </div>

          {service.promo && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
              <div className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">Dienos pasiūlymas</div>
              <div className="text-xs text-emerald-400 font-bold leading-tight">{service.promo}</div>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          {notLoggedIn && (
            <p className="text-xs text-amber-400 text-center bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              Prisijunkite norėdami užsisakyti
            </p>
          )}
          {sent ? (
            <div className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl font-bold animate-in zoom-in-95 duration-300">
              <CheckCircle2 size={18} />
              Žinutė išsiųsta! Patikrinkite savo žinutes.
            </div>
          ) : !service.providerId ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${service.name} ${service.address || ''}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white transition-all hover:bg-blue-700"
            >
              <MapPin size={18} />
              Atverti žemėlapyje
            </a>
          ) : (
            <button
              onClick={handleOrder}
              disabled={!service.isOpen}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <ShoppingCart size={18} />
              Užsisakyti
            </button>
          )}
        </div>
      </div>

      {/* Inline Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl duration-200 zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Susisiekti su teikėju</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-500">
              Jūsų žinutė paslaugos teikėjui
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mb-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                Atšaukti
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !message.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-sm"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {isSending ? "Siunčiama..." : "Siųsti"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
