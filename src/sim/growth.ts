import type { PlantInstance, Snapshot, SoilAnalysis, WeatherDay } from '../types';
import { speciesById } from './species';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** 值落在 [lo, hi] 内为 1, 越界后线性衰减, 超出 tol 为 0 */
function rangeFactor(v: number, lo: number, hi: number, tol: number): number {
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  return clamp(1 - d / tol);
}

export interface StressFactors {
  temp: number;
  water: number;
  light: number;
  ph: number;
}

export function stressFactors(
  speciesId: string,
  soil: SoilAnalysis,
  moisture: number,
  w: WeatherDay,
): StressFactors {
  const sp = speciesById(speciesId);
  const avgT = (w.tMin + w.tMax) / 2;
  const temp = Math.min(
    rangeFactor(avgT, sp.idealTemp[0], sp.idealTemp[1], 12),
    // 极端低温/高温额外惩罚
    w.tMin < 0 ? 0.3 : 1,
    w.tMax > 38 ? 0.4 : 1,
  );
  const dry = Math.max(0, sp.water - moisture);
  const wet = Math.max(0, moisture - sp.water - 0.35);
  const water = clamp(1 - dry * 2.5 - wet * 2);
  const light = clamp(w.sunHours / 10 / sp.sun);
  const ph = rangeFactor(soil.ph, sp.ph[0], sp.ph[1], 2);
  return { temp, water, light: Math.min(1, light), ph };
}

/** 单日土壤水分更新 (降雨补充, 蒸散消耗) */
function nextMoisture(m: number, w: WeatherDay, plantCount: number): number {
  const et = 0.04 + 0.003 * Math.max(0, w.tMax - 15) + 0.0015 * w.sunHours;
  const uptake = 0.0008 * plantCount;
  return clamp(m + w.rain / 25 - et - uptake, 0.05, 1);
}

function stepPlant(p: PlantInstance, soil: SoilAnalysis, moisture: number, w: WeatherDay): PlantInstance {
  const sp = speciesById(p.speciesId);
  const f = stressFactors(p.speciesId, soil, moisture, w);
  const limiting = Math.min(f.temp, f.water, f.light, f.ph);
  const rate = (1 / sp.growthDays) * limiting * (0.6 + 0.4 * soil.fertility);
  return {
    ...p,
    growth: clamp(p.growth + rate),
    health: clamp(p.health + (limiting - p.health) * 0.25),
  };
}

const avg = (ps: PlantInstance[]) => (ps.length ? ps.reduce((s, p) => s + p.health, 0) / ps.length : 1);

/**
 * 纯函数: 从当前花园状态出发, 按天气序列逐日推演, 返回每日快照。
 * snapshots[0] 为初始状态 (今天, 尚未推演)。
 */
export function simulate(
  plants: PlantInstance[],
  soil: SoilAnalysis,
  weather: WeatherDay[],
): Snapshot[] {
  const out: Snapshot[] = [];
  let cur = plants.map((p) => ({ ...p }));
  let moisture = soil.moisture;
  out.push({ day: 0, moisture, weather: weather[0], plants: cur, avgHealth: avg(cur) });
  for (let i = 0; i < weather.length; i++) {
    const w = weather[i];
    moisture = nextMoisture(moisture, w, cur.length);
    cur = cur.map((p) => stepPlant(p, soil, moisture, w));
    out.push({ day: i + 1, moisture, weather: w, plants: cur, avgHealth: avg(cur) });
  }
  return out;
}
