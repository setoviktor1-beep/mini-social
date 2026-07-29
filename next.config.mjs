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
