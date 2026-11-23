import type { GeoPoint, SiteAnalysis, Surrounding } from '../types';
import { mulberry32, seedFrom } from './rng';

/**
 * 场地分析接口。当前为 mock 实现 (GPS + 照片像素统计 → 确定性结果)。
 * 后续替换为视觉大模型 / 土壤数据 API 时, 只需实现同一签名。
 */
export interface SiteAnalyzer {
  analyze(loc: GeoPoint, photo?: HTMLImageElement): Promise<SiteAnalysis>;
}

interface PhotoStats {
  brightness: number; // 0..1
  green: number; // 0..1 绿色占比
  warm: number; // 0..1 偏红褐
  avgRGB: [number, number, number];
}

function samplePhoto(img: HTMLImageElement): PhotoStats {
  const w = 64;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  // 下半部分近似视为地面
  const d = ctx.getImageData(0, h / 2, w, h / 2).data;
  let r = 0, g = 0, b = 0, greenPx = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]; g += d[i + 1]; b += d[i + 2];
    if (d[i + 1] > d[i] && d[i + 1] > d[i + 2]) greenPx++;
  }
  r /= n; g /= n; b /= n;
  return {
    brightness: (r + g + b) / 765,
    green: greenPx / n,
    warm: Math.min(1, Math.max(0, (r - b) / 120)),
    avgRGB: [r, g, b],
  };
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const mockAnalyzer: SiteAnalyzer = {
  async analyze(loc, photo) {
    await new Promise((r) => setTimeout(r, 400)); // 模拟网络/推理延迟
    const stats = photo ? samplePhoto(photo) : undefined;
    const rand = mulberry32(seedFrom(loc.lat, loc.lon, photo ? 7 : 0));
    const notes: string[] = [];

    // 土壤: 照片越暗越湿, 越偏红褐越黏重; 无照片则由位置种子决定
    const moisture = clamp(stats ? 0.85 - stats.brightness * 0.9 : 0.25 + rand() * 0.4, 0.1, 0.9);
    const clay = stats ? stats.warm : rand();
    const type = clay > 0.66 ? '黏土' : clay > 0.33 ? '壤土' : '砂土';
    const ph = Math.round((5.4 + rand() * 2.4 + (type === '砂土' ? -0.3 : 0.2)) * 10) / 10;
    const fertility = clamp(0.35 + (stats ? stats.green * 0.5 : rand() * 0.5) + (type === '壤土' ? 0.1 : 0));
    const sunHours = Math.round((5 + rand() * 5) * 10) / 10;
    let color = 0x6b4a32;
    if (stats) {
      const [r, g, b] = stats.avgRGB.map((v) => Math.round(clamp(v / 255 * 0.8 + 0.1) * 255));
      color = (r << 16) | (g << 8) | b;
    } else {
      color = type === '砂土' ? 0xa98a62 : type === '黏土' ? 0x7a4a30 : 0x5e4330;
    }

    notes.push(`土壤类型判断为${type}, pH≈${ph}`);
    if (moisture < 0.3) notes.push('土壤偏干, 建议种植耐旱植物 (薰衣草等)');
    if (moisture > 0.7) notes.push('土壤偏湿, 注意排水');
    if (ph < 6) notes.push('土壤偏酸, 适合绣球类喜酸植物');

    // 周边植被 (背景环景)
    const ids = ['oak', 'sakura', 'lawn'];
    const count = 10 + Math.floor((stats ? stats.green : rand()) * 14);
    const surroundings: Surrounding[] = Array.from({ length: count }, () => ({
      speciesId: ids[Math.floor(rand() * 2)],
      angle: rand() * Math.PI * 2,
      radius: 16 + rand() * 14,
      scale: 0.7 + rand() * 0.8,
    }));

    return {
      location: loc,
      soil: { type, ph, moisture, fertility, sunHours, color },
      surroundings,
      panorama: photo,
      notes,
    };
  },
};
