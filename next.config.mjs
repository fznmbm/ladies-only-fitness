/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // A phone photo of a receipt is usually 1-4 MB.
      bodySizeLimit: "8mb",
    },
  },
};
export default nextConfig;
