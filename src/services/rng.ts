/** 确定性随机数, 保证同一位置/照片得到可复现的 mock 结果 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedFrom = (lat: number, lon: number, extra = 0) =>
  Math.floor((lat + 90) * 1000) * 360001 + Math.floor((lon + 180) * 1000) + extra;
