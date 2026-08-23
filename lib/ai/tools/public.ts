export async function getPublicProfile(
  identifier: string,
  supabase: any,
) {
  const clean = identifier.trim().slice(0, 50)
  if (!clean) return { error: 'Nenurodytas vartotojas' }

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, bio, location, working_hours, pro_radius_km, is_verified, created_at')

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)) {
    query = query.eq('id', clean)
  } else {
    query = query.eq('username', clean.toLowerCase())
  }

  const { data: profile, error } = await query.maybeSingle()
  if (error || !profile) {
    return { error: 'Viešas profilis nerastas' }
  }

  // Explicitly return only public fields, never private attributes
  return {
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    location: profile.location,
    isVerified: profile.is_verified,
    memberSince: profile.created_at,
  }
}
