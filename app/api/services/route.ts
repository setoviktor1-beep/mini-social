import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const category = searchParams.get('category') || 'restaurant';
  const radius = Math.min(parseInt(searchParams.get('radius') || '5000'), 5000); // max 5km

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Lokacija nenustatyta' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Trūksta Google Maps API rakto' }, { status: 500 });
  }

  try {
    // Naudojame Google Places Text Search arba Nearby Search
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${category}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(data.error_message || 'Google API klaida');
    }

    // Suformatuojame duomenis, kad tiktų mūsų UI
    const results = data.results.map((place: any) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      rating: place.rating || 0,
      isOpen: place.opening_hours?.open_now ?? true,
      category: category,
      distance: 'Skaičiuojama...', // Galima pridėti tikslesnį skaičiavimą vėliau
      icon: category === 'restaurant' ? 'Utensils' : 'Store'
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Services API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
