// Production APKs can use HTTPS or LAN HTTP backend with usesCleartextTraffic enabled.
const fs = require('fs');
const path = require('path');
const base = require('./app.json').expo;

module.exports = ({ config = {} } = {}) => {
  let api = process.env.EXPO_PUBLIC_API_BASE_URL || '';
  if (!api) {
    const envPath = path.resolve(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      const match = fs.readFileSync(envPath, 'utf8').match(/EXPO_PUBLIC_API_BASE_URL=["']?([^"'\r\n]+)/);
      if (match) api = match[1].trim();
    }
  }
  if (!api) {
    api = 'http://127.0.0.1:8002/api/v1';
  }
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
