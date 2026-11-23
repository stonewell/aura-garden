export interface GeoPoint {
  lat: number;
  lon: number;
}

export type PlantKind = 'flower' | 'shrub' | 'tree' | 'grass' | 'veg';

export interface Species {
  id: string;
  name: string;
  kind: PlantKind;
  bloomColor: number;
  leafColor: number;
  /** 适宜日均温 °C [min, max] */
  idealTemp: [number, number];
  /** 期望土壤湿度 0..1 */
  water: number;
  /** 需光程度 0..1 (1 = 全日照) */
  sun: number;
  /** 适宜土壤 pH */
  ph: [number, number];
  /** 成熟高度 (世界单位, 1 ≈ 1 米) */
  height: number;
  /** 理想条件下成熟所需天数 */
  growthDays: number;
}

export interface SoilAnalysis {
  type: string; // 砂土 / 壤土 / 黏土
  ph: number;
  moisture: number; // 0..1
  fertility: number; // 0..1
  sunHours: number; // 日均有效日照小时
  /** 土壤显示颜色 */
  color: number;
}

export interface Surrounding {
  speciesId: string;
  angle: number; // rad
  radius: number;
  scale: number;
}

export interface SiteAnalysis {
  location: GeoPoint;
  soil: SoilAnalysis;
  surroundings: Surrounding[];
  /** 全景贴图 (用户照片); 为空则使用程序化天空 */
  panorama?: HTMLImageElement;
  notes: string[];
}

export interface WeatherDay {
  day: number; // 0 = 今天
  date: string;
  tMin: number;
  tMax: number;
  rain: number; // mm
  sunHours: number;
  /** true = 真实预报, false = 气候估算 */
  forecast: boolean;
}

export interface PlantInstance {
  id: number;
  speciesId: string;
  x: number;
  z: number;
  /** 成熟度 0..1 */
  growth: number;
  /** 健康度 0..1 */
  health: number;
}

export interface Snapshot {
  day: number;
  moisture: number;
  weather: WeatherDay;
  plants: PlantInstance[];
  avgHealth: number;
}
