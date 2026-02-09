/** @type {import('next').NextConfig} */
const supabaseHostFromEnv = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) return null
    return new URL(url).hostname
  } catch {
    return null
  }
})()

const nextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostFromEnv
        ? [
            {
              protocol: 'https',
              hostname: supabaseHostFromEnv,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
  },
}

export default nextConfig

