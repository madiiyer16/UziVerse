/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Vercel injects these at build time; short SHA lets the UI show which
    // deployment is live so stale-cache/wrong-domain confusion is obvious.
    NEXT_PUBLIC_DEPLOY_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV || 'local'
  }
};

export default nextConfig;
