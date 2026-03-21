"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, Wrench, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function RequestServicePage() {
  const router = useRouter();
  const supabase = createClient();
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    };
    getProfile();
  }, []);

  const handleEstimate = async () => {
    if (!description) return;
    setIsLoading(true);
    setError("");
    setEstimate(null);

    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();
      
      if (data.error) {
        if (data.error === "UNSUPPORTED_TOPIC") {
          setError("Atsiprašome, bet šis asistentas padeda tik su buities ar remonto darbais.");
        } else {
          setError("Įvyko klaida: " + data.error);
        }
      } else {
        setEstimate(data);
      }
    } catch (err: any) {
      setError("Klaida susisiekiant su serveriu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!estimate || !profile) return;
    setIsSubmitting(true);

    try {
      const { error: submitError } = await supabase
        .from('service_requests')
        .insert({
          client_id: profile.id,
          description: description,
          category: estimate.category,
          estimated_price: estimate.estimated_price_max, // Naudojame max kaip bazę
          materials: estimate.materials,
          address_text: profile.address_text || "Adresas nenurodytas",
          status: 'open'
        });

      if (submitError) throw submitError;

      alert("Užsakymas sėkmingai pateiktas! Meistrai jį pamatys savo darbalaukyje.");
      router.push("/");
    } catch (err: any) {
      setError("Nepavyko pateikti užsakymo: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-gray-900/40 border border-gray-800/60 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <Wrench className="text-blue-500" />
          Ieškau Meistro
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          Aprašykite problemą (pvz., &quot;Laša kranas vonioje&quot;, &quot;Reikia surinkti IKEA spintą&quot;) ir mūsų AI agentas iškart pateiks preliminarią sąmatą.
        </p>

        {!profile?.address_text && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-sm">
            Dėmesio: Tavo profilyje nenurodytas adresas. Meistrai nežinos, kur atvykti. 
            <button onClick={() => router.push("/settings")} className="ml-2 underline font-bold">Nustatyti adresą</button>
          </div>
        )}

        <div className="space-y-4">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Pvz.: Laba diena, sugedo skalbimo mašina, nesiurbia vandens. Modelis Bosch X123..."
            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            rows={4}
          />
          
          <button
            onClick={handleEstimate}
            disabled={isLoading || !description}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {isLoading ? "Skaičiuojama sąmata..." : "Gauti preliminarią kainą"}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            {error}
          </div>
        )}

        {estimate && !error && (
          <div className="mt-8 bg-blue-900/10 border border-blue-800/30 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle className="text-emerald-500 w-5 h-5" />
              Preliminari AI Sąmata
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800/50">
                <div className="text-xs text-gray-500 mb-1">Kategorija</div>
                <div className="font-semibold text-gray-200 capitalize">{estimate.category}</div>
              </div>
              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800/50">
                <div className="text-xs text-gray-500 mb-1">Preliminari Kaina</div>
                <div className="font-bold text-blue-400">{estimate.estimated_price_min}€ - {estimate.estimated_price_max}€</div>
              </div>
            </div>

            {estimate.materials && estimate.materials.length > 0 && (
              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800/50">
                <div className="text-xs text-gray-500 mb-2">Gali prireikti medžiagų:</div>
                <ul className="list-disc list-inside text-sm text-gray-300 pl-4 space-y-1">
                  {estimate.materials.map((m: string, i: number) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800/50 text-sm text-gray-300">
              <span className="text-gray-500 text-xs block mb-1">Santrauka meistrui:</span>
              {estimate.summary}
              <div className="mt-2 text-xs text-emerald-500">
                Trunka apie: {estimate.estimated_duration_hours} val.
              </div>
            </div>

            <button 
              onClick={handleSubmitRequest}
              disabled={isSubmitting}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {isSubmitting ? "Siunčiama..." : "Pateikti užsakymą meistrams"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

