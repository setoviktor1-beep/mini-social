export async function getMyProfile(userId: string, supabase: any) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, location, working_hours, pro_radius_km, is_verified, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile) {
    return { error: 'Profilis nerastas' }
  }

  return {
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    location: profile.location,
    workingHours: profile.working_hours,
    proRadiusKm: profile.pro_radius_km,
  }
}
