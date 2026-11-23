import type { GeoPoint, WeatherDay } from '../types';
import { mulberry32, seedFrom } from './rng';

export const FORECAST_DAYS = 14;
export const HORIZON_DAYS = 90;

/**
 * 天气服务接口: 返回从今天起 `days` 天的逐日天气。
 * 前 FORECAST_DAYS 天视为预报, 之后为气候估算。
 * 后续可接 Open-Meteo (免费, 无需 key) 而不改动调用方。
 */
export interface WeatherProvider {
  getDaily(loc: GeoPoint, days: number): Promise<WeatherDay[]>;
}

export const mockWeather: WeatherProvider = {
  async getDaily(loc, days) {
    await new Promise((r) => setTimeout(r, 300));
    const rand = mulberry32(seedFrom(loc.lat, loc.lon, 99));
    const start = new Date();
    const out: WeatherDay[] = [];
    // 简化气候: 纬度越高越冷, 北半球 7 月最热
    const baseAnnual = 27 - Math.abs(loc.lat) * 0.45;
    const amp = 4 + Math.abs(loc.lat) * 0.2;
    let wet = rand() < 0.4; // 简单马尔可夫降雨
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
      const phase = Math.cos(((doy - 200) / 365) * Math.PI * 2) * (loc.lat >= 0 ? 1 : -1);
      const mean = baseAnnual + amp * phase + (rand() - 0.5) * 4;
      wet = wet ? rand() < 0.55 : rand() < 0.25;
      const rain = wet ? Math.round(rand() * rand() * 30 * 10) / 10 : 0;
      const range = 6 + rand() * 4 - (wet ? 2 : 0);
      out.push({
        day: i + 1,
        date: d.toISOString().slice(0, 10),
        tMin: Math.round((mean - range / 2) * 10) / 10,
        tMax: Math.round((mean + range / 2) * 10) / 10,
        rain,
        sunHours: Math.round((wet ? 2 + rand() * 4 : 6 + rand() * 6) * 10) / 10,
        forecast: i < FORECAST_DAYS,
      });
    }
    return out;
  },
};
