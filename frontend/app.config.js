const base = require('./app.json').expo;
module.exports = () => {
  const endpoint = process.env.EXPO_PUBLIC_API_BASE_URL;
  const release = process.env.ADT_BUILD_PROFILE === 'pilot' || process.env.ADT_BUILD_PROFILE === 'production';
  if (release) {
    if (!endpoint) throw new Error('A reachable EXPO_PUBLIC_API_BASE_URL is required for standalone builds.');
    const url = new URL(endpoint);
    if (!['http:', 'https:'].includes(url.protocol) || ['localhost','127.0.0.1','10.0.2.2','::1'].includes(url.hostname)) {
      throw new Error('Standalone builds cannot use a loopback or emulator-only backend.');
    }
    if (process.env.ADT_BUILD_PROFILE === 'production' && url.protocol !== 'https:') throw new Error('Production requires HTTPS.');
  }
  return {...base, android:{...base.android,usesCleartextTraffic:process.env.ADT_BUILD_PROFILE !== 'production'},
    extra:{...base.extra,apiBaseUrl:endpoint || base.extra.apiBaseUrl,buildProfile:process.env.ADT_BUILD_PROFILE || 'development'}};
};
