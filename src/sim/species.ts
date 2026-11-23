import type { Species } from '../types';

export const SPECIES: Species[] = [
  { id: 'lavender', name: '薰衣草', kind: 'flower', bloomColor: 0x9b7fd1, leafColor: 0x7a9a6a, idealTemp: [15, 28], water: 0.3, sun: 1.0, ph: [6.5, 8.0], height: 0.6, growthDays: 45 },
  { id: 'sunflower', name: '向日葵', kind: 'flower', bloomColor: 0xf5c518, leafColor: 0x4f8a3a, idealTemp: [18, 32], water: 0.5, sun: 1.0, ph: [6.0, 7.5], height: 1.6, growthDays: 70 },
  { id: 'rose', name: '玫瑰', kind: 'shrub', bloomColor: 0xd9345a, leafColor: 0x3f7a3a, idealTemp: [14, 27], water: 0.55, sun: 0.8, ph: [6.0, 7.0], height: 1.0, growthDays: 80 },
  { id: 'hydrangea', name: '绣球', kind: 'shrub', bloomColor: 0x6a8ee8, leafColor: 0x4a8a48, idealTemp: [12, 25], water: 0.7, sun: 0.5, ph: [5.0, 6.5], height: 1.2, growthDays: 90 },
  { id: 'tomato', name: '番茄', kind: 'veg', bloomColor: 0xe0402a, leafColor: 0x5a9a3a, idealTemp: [18, 30], water: 0.6, sun: 0.9, ph: [6.0, 7.0], height: 0.9, growthDays: 60 },
  { id: 'lawn', name: '草坪', kind: 'grass', bloomColor: 0x8ac048, leafColor: 0x6aae3a, idealTemp: [10, 28], water: 0.5, sun: 0.6, ph: [5.5, 7.5], height: 0.15, growthDays: 25 },
  { id: 'oak', name: '橡树', kind: 'tree', bloomColor: 0x3f7a30, leafColor: 0x3b6e2c, idealTemp: [8, 26], water: 0.45, sun: 0.7, ph: [5.5, 7.5], height: 4.5, growthDays: 120 },
  { id: 'sakura', name: '樱花树', kind: 'tree', bloomColor: 0xf7b6c8, leafColor: 0x5d8a48, idealTemp: [8, 22], water: 0.55, sun: 0.8, ph: [5.5, 7.0], height: 3.5, growthDays: 110 },
];

export const speciesById = (id: string): Species => {
  const s = SPECIES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown species ${id}`);
  return s;
};
