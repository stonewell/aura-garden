import type { GeoPoint } from '../types';

export const DEFAULT_LOCATION: GeoPoint = { lat: 31.23, lon: 121.47 }; // 上海

export function getCurrentLocation(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('浏览器不支持定位'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.message || '定位失败')),
      { timeout: 8000 },
    );
  });
}
