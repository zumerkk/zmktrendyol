/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.API_URL || 'http://localhost:4003'}/api/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
