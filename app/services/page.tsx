"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Store, Utensils, Scissors, Car, Heart, ShoppingBag, Loader2 } from "lucide-react";
import ServiceCard from "@/components/services/ServiceCard";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ServicesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Visi");
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState("");

  // 1. Užkrauname vartotojo profilį ir lokaciją
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userRadiusKm, setUserRadiusKm] = useState(5.0);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*, address_lat, address_lng, user_radius_km')
          .eq('id', user.id)
          .single();
        setProfile(data);
        const radius = data?.user_radius_km ?? 5.0;
        setUserRadiusKm(radius);
        if (data?.address_lat && data?.address_lng) {
          setUserLat(data.address_lat);
          setUserLng(data.address_lng);
          fetchRealServices(data.address_lat, data.address_lng, radius);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // 2. Traukiame tikrus duomenis iš mūsų API
  const fetchRealServices = async (lat: number, lng: number, radiusKm?: number) => {
    setIsLoading(true);
    setError("");
    try {
      const googleType = activeCategory === "Maistas" ? "restaurant" :
                         activeCategory === "Grožis" ? "beauty_salon" : "store";
      const radius = (radiusKm ?? userRadiusKm) * 1000; // convert to meters
      const res = await fetch(`/api/services?lat=${lat}&lng=${lng}&category=${googleType}&radius=${radius}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setServices(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Perskaičiuojame, kai pasikeičia kategorija
  useEffect(() => {
    if (userLat && userLng) {
      fetchRealServices(userLat, userLng);
    }
  }, [activeCategory]);

  const categories = ["Visi", "Maistas", "Grožis", "Auto", "Sveikata", "Kita"];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-black text-white bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          Tikros paslaugos šalia tavęs
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto italic">
          Rodomi realūs duomenys iš Google Maps pagal tavo lokaciją.
        </p>
      </div>

      {!profile?.address_text ? (
        <div className="text-center py-20 bg-amber-500/5 rounded-3xl border border-dashed border-amber-500/20">
          <MapPin className="mx-auto text-amber-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Lokacija nenustatyta</h2>
          <p className="text-gray-400 mb-6 px-4">Kad matytumėte paslaugas savo spinduliu, turite nurodyti savo adresą.</p>
          <button 
            onClick={() => router.push("/settings")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg"
          >
            Nustatyti lokaciją
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-6 sticky top-20 z-30 bg-[#0a0a0f]/80 backdrop-blur-md py-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all border-2 ${
                    activeCategory === cat
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-gray-900 border-gray-800 text-gray-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
              <p className="text-gray-500 animate-pulse">Ieškoma paslaugų tavo apylinkėse...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-red-400 bg-red-500/5 rounded-2xl border border-red-500/20">
              {error === "Trūksta Google Maps API rakto" ? "⚠️ Reikia sukonfigūruoti Google API raktą" : error}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {services.map((service: any) => (
                // Pakeičiame ikonas dinamiškai
                <ServiceCard key={service.id} service={{...service, icon: service.category === 'restaurant' ? Utensils : Store}} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
