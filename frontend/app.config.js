// Production APKs must use a real, publicly reachable HTTPS FastAPI backend.
// Pilot profile intentionally keeps LAN HTTP for local testing.
const base = require('./app.json').expo;
module.exports = ({ config = {} } = {}) => {
  const production = process.env.ADT_BUILD_PROFILE === 'production';
  const api = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  if (production && (!/^https:\/\/[^/]+\/api\/v1\/?$/.test(api))) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL=https://YOUR-BACKEND/api/v1 before production APK build.');
  }
  if (production) {
    const host = new URL(api).hostname;
    if (['localhost','127.0.0.1','10.0.2.2','::1'].includes(host)) throw new Error('Production APK requires a reachable HTTPS backend.');
  }
  return {
    ...config,
    ...base,
    extra: {...base.extra, apiBaseUrl: api || base.extra?.apiBaseUrl, buildProfile: process.env.ADT_BUILD_PROFILE || 'development'},
    android: {
      ...base.android,
      usesCleartextTraffic: !production,
    },
  };
};
