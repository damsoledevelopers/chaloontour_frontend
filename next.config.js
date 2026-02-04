/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api' },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, '@': __dirname }
    return config
  },
}
module.exports = nextConfig
