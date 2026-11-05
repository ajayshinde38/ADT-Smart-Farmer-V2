// Production APKs can use HTTPS or LAN HTTP backend with usesCleartextTraffic enabled.
const base = require('./app.json').expo;
module.exports = ({ config = {} } = {}) => {
  const api = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  if (!/^https?:\/\/[^/]+\/api\/v1\/?$/.test(api)) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL=http(s)://YOUR-BACKEND/api/v1 before building APK.');
  }
  return {
    ...config,
    ...base,
    extra: {...base.extra, apiBaseUrl: api || base.extra?.apiBaseUrl, buildProfile: process.env.ADT_BUILD_PROFILE || 'production'},
    android: {
      ...base.android,
      usesCleartextTraffic: true,
    },
  };
};
