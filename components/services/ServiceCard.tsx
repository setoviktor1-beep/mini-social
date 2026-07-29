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

        <div className="pt-4 border-t border-gray-800/50 space-y-3">
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
          <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Susisiekti su teikėju</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Jūsų žinutė paslaugos teikėjui
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 font-semibold transition-all text-sm"
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
