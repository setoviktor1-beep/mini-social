"use client";

import { useState, useEffect } from "react";
import { MapPin, Store, Utensils, Scissors, Car, Heart, Camera, Loader2, Star, BadgeCheck } from "lucide-react";
import ServiceCard from "@/components/services/ServiceCard";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categoryIcon(cat: string) {
  if (cat === "maistas" || cat === "restaurant") return Utensils;
  if (cat === "grozis" || cat === "grožis" || cat === "beauty_salon") return Scissors;
  if (cat === "auto") return Car;
  if (cat === "sveikata" || cat === "health") return Heart;
  if (cat === "foto" || cat === "fotografas") return Camera;
  return Store;
}

const CATEGORY_MAP: Record<string, string[]> = {
  Maistas: ["maistas", "restaurant", "food"],
  Grožis: ["grozis", "grožis", "beauty_salon", "beauty"],
  Auto: ["auto"],
  Sveikata: ["sveikata", "health"],
  Kita: ["kita", "other", "foto", "fotografas"],
};

export default function ServicesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [activeCategory, setActiveCategory] = useState("Visi");
  const [localServices, setLocalServices] = useState<any[]>([]);
  const [googleServices, setGoogleServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userRadiusKm, setUserRadiusKm] = useState(5.0);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*, address_lat, address_lng, user_radius_km")
          .eq("id", user.id)
          .single();
        setProfile(data);
        const radius = data?.user_radius_km ?? 5.0;
        setUserRadiusKm(radius);
        if (data?.address_lat && data?.address_lng) {
          setUserLat(data.address_lat);
          setUserLng(data.address_lng);
          await fetchAll(data.address_lat, data.address_lng, radius, "Visi");
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (userLat && userLng) {
      fetchAll(userLat, userLng, userRadiusKm, activeCategory);
    }
  }, [activeCategory]);

  const fetchAll = async (lat: number, lng: number, radiusKm: number, category: string) => {
    setIsLoading(true);
    setError("");
    try {
      await Promise.all([
        fetchLocalServices(lat, lng, radiusKm, category),
        fetchGoogleServices(lat, lng, radiusKm, category),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocalServices = async (lat: number, lng: number, radiusKm: number, category: string) => {
    const { data } = await supabase
      .from("pro_services")
      .select("*, profiles!pro_id(display_name, business_name, business_category, address_text, address_lat, address_lng, avatar_path)")
      .eq("is_active", true);

    if (!data) return;

    const filtered = data
      .filter((s: any) => {
        const p = s.profiles;
        if (!p?.address_lat || !p?.address_lng) return false;
        const distKm = haversineKm(lat, lng, p.address_lat, p.address_lng);
        if (distKm > radiusKm) return false;
        if (category === "Visi") return true;
        const cats = CATEGORY_MAP[category] || [];
        return cats.includes((p.business_category || "").toLowerCase());
      })
      .map((s: any) => {
        const p = s.profiles;
        const distKm = haversineKm(lat, lng, p.address_lat, p.address_lng);
        const distLabel = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
        return {
          id: s.id,
          name: s.name,
          description: s.description || p.business_name || "",
          address: p.address_text || "",
          rating: 0,
          isOpen: true,
          distance: distLabel,
          icon: categoryIcon(p.business_category || ""),
          providerName: p.business_name || p.display_name,
          price: s.price ? `€${s.price}` : null,
          priceType: s.price_type,
          isLocal: true,
        };
      });

    setLocalServices(filtered);
  };

  const fetchGoogleServices = async (lat: number, lng: number, radiusKm: number, category: string) => {
    try {
      const googleType =
        category === "Maistas" ? "restaurant" :
        category === "Grožis" ? "beauty_salon" :
        category === "Auto" ? "car_repair" :
        category === "Sveikata" ? "pharmacy" : "store";
      const radius = Math.min(radiusKm * 1000, 5000);
      const res = await fetch(`/api/services?lat=${lat}&lng=${lng}&category=${googleType}&radius=${radius}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGoogleServices(data.map((s: any) => ({
        ...s,
        icon: s.category === "restaurant" ? Utensils : Store,
        isLocal: false,
      })));
    } catch {
      setGoogleServices([]);
    }
  };

  const categories = ["Visi", "Maistas", "Grožis", "Auto", "Sveikata", "Kita"];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          Tikros paslaugos šalia tavęs
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto italic">
          Vietiniai verslai ir Google Maps rezultatai pagal tavo lokaciją.
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
          <div className="sticky top-20 z-30 bg-[#0a0a0f]/80 backdrop-blur-md py-4">
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
          ) : (
            <div className="space-y-10">
              {/* Local services */}
              {localServices.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <BadgeCheck className="text-emerald-400" size={20} />
                    <h2 className="text-lg font-bold text-white">Vietiniai verslai</h2>
                    <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {localServices.length} rastas(-i)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {localServices.map((s: any) => (
                      <LocalServiceCard key={s.id} service={s} />
                    ))}
                  </div>
                </div>
              )}

              {/* Google Maps services */}
              {googleServices.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="text-blue-400" size={20} />
                    <h2 className="text-lg font-bold text-white">Iš Google Maps</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {googleServices.map((service: any) => (
                      <ServiceCard key={service.id} service={service} />
                    ))}
                  </div>
                </div>
              )}

              {localServices.length === 0 && googleServices.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  Nerasta paslaugų šioje kategorijoje tavo spinduliu.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LocalServiceCard({ service }: { service: any }) {
  return (
    <div className="group bg-gray-900/40 border border-emerald-500/20 rounded-3xl p-6 hover:border-emerald-500/50 transition-all hover:shadow-2xl hover:shadow-emerald-500/5 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-all" />

      <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
        <div className="p-3 bg-gray-950 rounded-2xl border border-emerald-500/20">
          <service.icon className="text-emerald-400" size={24} />
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
          <BadgeCheck size={12} /> Vietinis
        </span>
      </div>

      <div className="space-y-1 mb-4 relative z-10">
        <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
          {service.name}
        </h3>
        <p className="text-sm text-gray-400 font-medium">{service.providerName}</p>
        {service.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{service.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <MapPin size={13} className="text-gray-600" />
        {service.address} · <span className="text-emerald-400/80">{service.distance}</span>
      </div>

      <div className="pt-4 border-t border-gray-800/50 flex items-center justify-between gap-4">
        {service.price && (
          <span className="text-lg font-black text-white">
            {service.price}
            {service.priceType === "hourly" && <span className="text-sm text-gray-400 font-normal">/val.</span>}
          </span>
        )}
        <button className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 text-sm">
          Susisiekti
        </button>
      </div>
    </div>
  );
}
