"use client";

import { useState, useEffect } from "react";
import { MapPin, Store, Utensils, Scissors, Car, Heart, Camera, Loader2, Star, BadgeCheck, CheckCircle2, Send, X } from "lucide-react";
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

function getActiveProfileLocation(profile: any) {
  const useTravel =
    Boolean(profile?.travel_mode) &&
    profile?.travel_lat != null &&
    profile?.travel_lng != null;

  return {
    lat: useTravel ? profile.travel_lat : profile?.address_lat,
    lng: useTravel ? profile.travel_lng : profile?.address_lng,
    addressText: useTravel ? profile?.travel_address_text : profile?.address_text,
    usesTravel: useTravel,
  };
}

export default function ServicesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [activeCategory, setActiveCategory] = useState("Visi");
  const [localServices, setLocalServices] = useState<any[]>([]);
  const [homeLocalServices, setHomeLocalServices] = useState<any[]>([]);
  const [googleServices, setGoogleServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [userRadiusKm, setUserRadiusKm] = useState(5.0);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data } = await supabase
          .from("profiles")
          .select("*, address_lat, address_lng, user_radius_km, travel_mode, travel_lat, travel_lng, travel_address_text")
          .eq("id", user.id)
          .single();
        setProfile(data);
        const radius = data?.user_radius_km ?? 5.0;
        setUserRadiusKm(radius);
        const homeLat = data?.address_lat;
        const homeLng = data?.address_lng;
        const activeLocation = getActiveProfileLocation(data);
        const lat = activeLocation.lat;
        const lng = activeLocation.lng;
        if (homeLat && homeLng) {
          setHomeLat(homeLat);
          setHomeLng(homeLng);
        }
        if (lat && lng) {
          setUserLat(lat);
          setUserLng(lng);
          await fetchAll(lat, lng, radius, "Visi", activeLocation.usesTravel ? homeLat : null, activeLocation.usesTravel ? homeLng : null);
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
      const activeLocation = getActiveProfileLocation(profile);
      fetchAll(userLat, userLng, userRadiusKm, activeCategory, activeLocation.usesTravel ? homeLat : null, activeLocation.usesTravel ? homeLng : null);
    }
  }, [activeCategory, userLat, userLng, userRadiusKm, profile, homeLat, homeLng]);

  const fetchAll = async (lat: number, lng: number, radiusKm: number, category: string, hLat?: number | null, hLng?: number | null) => {
    setIsLoading(true);
    setError("");
    try {
      await Promise.all([
        fetchLocalServices(lat, lng, radiusKm, category),
        fetchGoogleServices(lat, lng, radiusKm, category),
        hLat && hLng ? fetchHomeLocalServices(hLat, hLng, radiusKm, category) : Promise.resolve(),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocalServices = async (lat: number, lng: number, radiusKm: number, category: string) => {
    // CB4: Fetch both pro_services rows AND profiles with business info directly
    const [{ data: proServicesData }, { data: profileServicesData }] = await Promise.all([
      supabase
        .from("pro_services")
        .select("*, profiles!pro_id(id, display_name, business_name, business_category, address_text, address_lat, address_lng, travel_mode, travel_address_text, travel_lat, travel_lng, avatar_path)")
        .eq("is_active", true),
      supabase
        .from("profiles")
        .select("id, display_name, business_name, business_category, business_description, address_text, address_lat, address_lng, travel_mode, travel_address_text, travel_lat, travel_lng, avatar_path")
        .in("role", ["master", "pro", "admin"])
        .not("business_name", "is", null),
    ]);

    // Collect pro_ids that already have pro_services rows to avoid duplicates
    const proIdsWithServices = new Set((proServicesData || []).map((s: any) => s.pro_id));

    const mapProService = (s: any) => {
      const p = s.profiles;
      const providerLocation = getActiveProfileLocation(p);
      const distKm = haversineKm(lat, lng, providerLocation.lat, providerLocation.lng);
      const distLabel = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
      return {
        id: s.id,
        name: s.name,
        description: s.description || p.business_name || "",
        address: providerLocation.addressText || p.address_text || "",
        rating: 0,
        isOpen: true,
        distance: distLabel,
        icon: categoryIcon(p.business_category || ""),
        providerName: p.business_name || p.display_name,
        price: s.price ? `€${s.price}` : null,
        priceType: s.price_type,
        isLocal: true,
        providerId: s.pro_id,
      };
    };

    const mapProfileService = (p: any) => {
      const providerLocation = getActiveProfileLocation(p);
      const distKm = haversineKm(lat, lng, providerLocation.lat, providerLocation.lng);
      const distLabel = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
      return {
        id: `profile-${p.id}`,
        name: p.business_name || p.display_name,
        description: p.business_description || "",
        address: providerLocation.addressText || p.address_text || "",
        rating: 0,
        isOpen: true,
        distance: distLabel,
        icon: categoryIcon(p.business_category || ""),
        providerName: p.business_name || p.display_name,
        price: null,
        priceType: null,
        isLocal: true,
        providerId: p.id,
      };
    };

    const filterByLocation = (providerLocation: { lat: any; lng: any }, businessCategory: string) => {
      if (providerLocation.lat == null || providerLocation.lng == null) return false;
      const distKm = haversineKm(lat, lng, providerLocation.lat, providerLocation.lng);
      if (distKm > radiusKm) return false;
      if (category === "Visi") return true;
      const cats = CATEGORY_MAP[category] || [];
      return cats.includes((businessCategory || "").toLowerCase());
    };

    const fromProServices = (proServicesData || [])
      .filter((s: any) => {
        const p = s.profiles;
        return filterByLocation(getActiveProfileLocation(p), p.business_category || "");
      })
      .map(mapProService);

    // CB4: Include profiles that have business info but no pro_services rows
    const fromProfiles = (profileServicesData || [])
      .filter((p: any) => {
        if (proIdsWithServices.has(p.id)) return false; // skip duplicates
        return filterByLocation(getActiveProfileLocation(p), p.business_category || "");
      })
      .map(mapProfileService);

    setLocalServices([...fromProServices, ...fromProfiles]);
  };

  const fetchHomeLocalServices = async (lat: number, lng: number, radiusKm: number, category: string) => {
    // CB4: Also fetch profiles with business info for home neighborhood
    const [{ data: proServicesData }, { data: profileServicesData }] = await Promise.all([
      supabase
        .from("pro_services")
        .select("*, profiles!pro_id(id, display_name, business_name, business_category, address_text, address_lat, address_lng, travel_mode, travel_address_text, travel_lat, travel_lng, avatar_path)")
        .eq("is_active", true),
      supabase
        .from("profiles")
        .select("id, display_name, business_name, business_category, business_description, address_text, address_lat, address_lng, travel_mode, travel_address_text, travel_lat, travel_lng, avatar_path")
        .in("role", ["master", "pro", "admin"])
        .not("business_name", "is", null),
    ]);

    const proIdsWithServices = new Set((proServicesData || []).map((s: any) => s.pro_id));

    const filterByLocation = (providerLocation: { lat: any; lng: any }, businessCategory: string) => {
      if (providerLocation.lat == null || providerLocation.lng == null) return false;
      const distKm = haversineKm(lat, lng, providerLocation.lat, providerLocation.lng);
      if (distKm > radiusKm) return false;
      if (category === "Visi") return true;
      const cats = CATEGORY_MAP[category] || [];
      return cats.includes((businessCategory || "").toLowerCase());
    };

    const fromProServices = (proServicesData || [])
      .filter((s: any) => {
        const p = s.profiles;
        return filterByLocation(getActiveProfileLocation(p), p.business_category || "");
      })
      .map((s: any) => {
        const p = s.profiles;
        const providerLocation = getActiveProfileLocation(p);
        const distKm = haversineKm(lat, lng, providerLocation.lat, providerLocation.lng);
        const distLabel = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
        return {
          id: s.id,
          name: s.name,
          description: s.description || p.business_name || "",
          address: providerLocation.addressText || p.address_text || "",
          rating: 0,
          isOpen: true,
          distance: distLabel,
          icon: categoryIcon(p.business_category || ""),
          providerName: p.business_name || p.display_name,
          price: s.price ? `€${s.price}` : null,
          priceType: s.price_type,
          isLocal: true,
          providerId: s.pro_id,
        };
      });

    const fromProfiles = (profileServicesData || [])
      .filter((p: any) => {
        if (proIdsWithServices.has(p.id)) return false;
        return filterByLocation(getActiveProfileLocation(p), p.business_category || "");
      })
      .map((p: any) => {
        const providerLocation = getActiveProfileLocation(p);
        const distKm = haversineKm(lat, lng, providerLocation.lat, providerLocation.lng);
        const distLabel = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
        return {
          id: `profile-${p.id}`,
          name: p.business_name || p.display_name,
          description: p.business_description || "",
          address: providerLocation.addressText || p.address_text || "",
          rating: 0,
          isOpen: true,
          distance: distLabel,
          icon: categoryIcon(p.business_category || ""),
          providerName: p.business_name || p.display_name,
          price: null,
          priceType: null,
          isLocal: true,
          providerId: p.id,
        };
      });

    setHomeLocalServices([...fromProServices, ...fromProfiles]);
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
        {profile?.travel_mode && profile?.travel_address_text && (
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium">
            <span>✈️</span>
            Kelionės režimas: <strong>{profile.travel_address_text}</strong>
          </div>
        )}
      </div>

      {!getActiveProfileLocation(profile).addressText ? (
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
      ) : getActiveProfileLocation(profile).lat == null || getActiveProfileLocation(profile).lng == null ? (
        <div className="text-center py-20 bg-amber-500/5 rounded-3xl border border-dashed border-amber-500/20">
          <MapPin className="mx-auto text-amber-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-white mb-2">Adreso koordinatės nerasta</h2>
          <p className="text-gray-400 mb-2 px-4">
            Adresas: <strong className="text-white">{getActiveProfileLocation(profile).addressText}</strong>
          </p>
          <p className="text-gray-400 mb-6 px-4 text-sm">
            Koordinatės nerasta — atnaujink aktyvią vietą Nustatymuose naudodamas automatinę paiešką.
          </p>
          <button
            onClick={() => router.push("/settings")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg"
          >
            Atnaujinti adresą Nustatymuose
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
                      <LocalServiceCard key={s.id} service={s} currentUserId={currentUserId} />
                    ))}
                  </div>
                </div>
              )}

              {/* Home neighborhood services (travel mode) */}
              {homeLocalServices.length > 0 && profile?.travel_mode && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <BadgeCheck className="text-amber-400" size={20} />
                    <h2 className="text-lg font-bold text-white">Tavo kaimynystės verslai</h2>
                    <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      🏠 Namai
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {homeLocalServices.map((s: any) => (
                      <LocalServiceCard key={`home-${s.id}`} service={s} currentUserId={currentUserId} />
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
                      <ServiceCard key={service.id} service={service} currentUserId={currentUserId} />
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

function LocalServiceCard({ service, currentUserId }: { service: any; currentUserId?: string }) {
  const supabase = createClient();
  const [showModal, setShowModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [message, setMessage] = useState(`Sveiki, norėčiau užsisakyti: ${service.name}`);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const isOwnService = currentUserId && service.providerId === currentUserId;

  const handleContact = () => {
    if (!currentUserId) {
      setNotLoggedIn(true);
      return;
    }
    setNotLoggedIn(false);
    setSendError('');
    setShowModal(true);
  };

  const handleSend = async () => {
    if (!currentUserId || !service.providerId) return;
    if (isOwnService) {
      setSendError('Tai jūsų pačių paslauga — negalite siųsti žinutės sau.');
      return;
    }
    setIsSending(true);
    setSendError('');
    try {
      const { data: conversationId, error: rpcError } = await supabase.rpc(
        'get_or_create_conversation',
        { other_user_id: service.providerId }
      );
      if (rpcError) throw new Error(rpcError.message);

      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: message,
      });
      if (msgError) throw new Error(msgError.message);

      setSent(true);
      setShowModal(false);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const msg = err?.message || '';
      if (msg.includes('yourself')) {
        setSendError('Tai jūsų pačių paslauga — negalite siųsti žinutės sau.');
      } else if (msg.includes('blocked')) {
        setSendError('Negalite susisiekti su šiuo teikėju.');
      } else {
        setSendError('Klaida siunčiant žinutę. Bandykite dar kartą.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
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

        <div className="pt-4 border-t border-gray-800/50 space-y-3">
          {service.price && (
            <span className="text-lg font-black text-white block">
              {service.price}
              {service.priceType === "hourly" && <span className="text-sm text-gray-400 font-normal">/val.</span>}
            </span>
          )}
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
              onClick={handleContact}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 text-sm"
            >
              Susisiekti
            </button>
          )}
        </div>
      </div>

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
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none mb-4"
            />

            {sendError && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-400">
                {sendError}
              </div>
            )}

            {isOwnService && (
              <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-sm text-amber-400">
                Tai jūsų pačių paslauga. Klientai galės susisiekti su jumis.
              </div>
            )}

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
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 text-sm"
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
