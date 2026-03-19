/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.EXPORT === 'true' ? 'export' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
