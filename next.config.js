/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Image Optimization on cPanel (no sharp binary needed)
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'development'
        ? 'http://localhost:5000/api'
        : 'https://crm.chaloontour.com/api'),
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, '@': __dirname }
    return config
  },
}
module.exports = nextConfig
