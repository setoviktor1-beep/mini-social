/** @type {import('next').NextConfig} */
const storageHostFromEnv = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_S3_PUBLIC_URL
    if (!url) return null
    return new URL(url).hostname
  } catch {
    return null
  }
})()

const nextConfig = {
  output: 'standalone',
  experimental: {
    // Next.js 16 defaults the proxy layer's request body cap to 10MB —
    // below lib/video-security.ts's MAX_VIDEO_BYTES (50MB). Without this,
    // any video upload over 10MB would be silently truncated by the
    // framework before it even reaches app/api/storage/upload/route.ts's
    // own validation, corrupting otherwise-valid uploads rather than
    // cleanly rejecting them. 60MB gives headroom above the 50MB app-level
    // limit for multipart/request overhead.
    proxyClientMaxBodySize: '60mb',
  },
  images: {
    remotePatterns: [
      ...(storageHostFromEnv
        ? [
            {
              protocol: 'https',
              hostname: storageHostFromEnv,
              pathname: '/**',
            },
          ]
        : []),
    ],
  },
}

export default nextConfig
