import { Garden3D, GARDEN_RADIUS } from './scene/garden3d';
import { mockAnalyzer, type SiteAnalyzer } from './services/analysis';
import { DEFAULT_LOCATION, getCurrentLocation } from './services/location';
import { HORIZON_DAYS, mockWeather, type WeatherProvider } from './services/weather';
import { mulberry32, seedFrom } from './services/rng';
import { simulate, stressFactors } from './sim/growth';
import { SPECIES, speciesById } from './sim/species';
import type { PlantInstance, SiteAnalysis, Snapshot, WeatherDay } from './types';

// 服务实例 —— 接入真实服务时只需在这里替换
const analyzer: SiteAnalyzer = mockAnalyzer;
const weatherProvider: WeatherProvider = mockWeather;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = new Garden3D($('canvas-host'));

const state = {
  site: null as SiteAnalysis | null,
  weather: [] as WeatherDay[],
  plants: [] as PlantInstance[], // 今天 (day 0) 的布局
  snaps: [] as Snapshot[],
  day: 0,
  nextId: 1,
  tool: 'place' as 'place' | 'remove',
  speciesId: 'lavender',
  playing: false,
  timer: 0 as unknown as number,
  photo: undefined as HTMLImageElement | undefined,
};

// ---------- 推演 ----------
function recompute() {
  if (!state.site) return;
  state.snaps = simulate(state.plants, state.site.soil, state.weather);
  render();
}

function render() {
  const snap = state.snaps[state.day];
  if (!snap) return;
  view.sync(snap.plants, snap.moisture);
  const w = snap.weather;
  $('slider').setAttribute('max', String(state.snaps.length - 1));
  ($('slider') as HTMLInputElement).value = String(state.day);
  const tag = state.day === 0 ? '今天' : w.forecast ? '<span class="fc">预报</span>' : '<span class="cl">气候估算</span>';
  $('wx').innerHTML =
    state.day === 0
      ? '第 0 天 · 今天 · 拖动或播放查看未来'
      : `第 ${state.day} 天 · ${w.date} · ${tag} · ${w.tMin}~${w.tMax}°C · 雨 ${w.rain}mm · 日照 ${w.sunHours}h`;
  const n = snap.plants.length;
  const mature = snap.plants.filter((p) => p.growth > 0.9).length;
  const sick = snap.plants.filter((p) => p.health < 0.5).length;
  $('hud').innerHTML =
    `植物 <b>${n}</b> · 成熟 <b>${mature}</b> · 状态不佳 <b style="color:${sick ? '#c0392b' : 'inherit'}">${sick}</b><br>` +
    `平均健康 <b>${Math.round(snap.avgHealth * 100)}%</b> · 土壤湿度 <b>${Math.round(snap.moisture * 100)}%</b>`;
}

// ---------- 初始布局 ----------
function suitability(speciesId: string): number {
  if (!state.site || !state.weather.length) return 0;
  const days = state.weather.filter((w) => w.forecast);
  const s = days.reduce((acc, w) => {
    const f = stressFactors(speciesId, state.site!.soil, state.site!.soil.moisture, w);
    return acc + Math.min(f.temp, f.water, f.light, f.ph);
  }, 0);
  return s / Math.max(1, days.length);
}

function autoLayout(site: SiteAnalysis): PlantInstance[] {
  const rand = mulberry32(seedFrom(site.location.lat, site.location.lon, 3));
  const ranked = SPECIES.filter((s) => s.kind !== 'tree')
    .map((s) => ({ s, score: suitability(s.id) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const trees = SPECIES.filter((s) => s.kind === 'tree')
    .map((s) => ({ s, score: suitability(s.id) }))
    .sort((a, b) => b.score - a.score);
  const picks = [...ranked.map((r) => r.s), trees[0].s];
  const out: PlantInstance[] = [];
  let tries = 0;
  while (out.length < 18 && tries++ < 400) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (GARDEN_RADIUS - 1.5);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const sp = picks[Math.floor(rand() * picks.length)];
    const gap = sp.kind === 'tree' ? 3 : 1.1;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(gap, spacing(p.speciesId)))) continue;
    out.push({ id: state.nextId++, speciesId: sp.id, x, z, growth: 0.25 + rand() * 0.4, health: 1 });
  }
  return out;
}

const spacing = (id: string) => (speciesById(id).kind === 'tree' ? 3 : 1.1);

// ---------- 生成花园 ----------
async function generate() {
  const lat = parseFloat(($('lat') as HTMLInputElement).value);
  const lon = parseFloat(($('lon') as HTMLInputElement).value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return setStatus('请先输入或获取经纬度');
  stop();
  setStatus('分析场地并获取天气…');
  try {
    const loc = { lat, lon };
    const [site, weather] = await Promise.all([
      analyzer.analyze(loc, state.photo),
      weatherProvider.getDaily(loc, HORIZON_DAYS),
    ]);
    state.site = site;
    state.weather = weather;
    view.setSite(site);
    showSite(site);
    renderPalette();
    state.plants = autoLayout(site);
    state.day = 0;
    recompute();
    setStatus('花园已生成 ✔  (AI 分析与天气目前为 mock 数据)');
  } catch (e) {
    setStatus('生成失败: ' + (e as Error).message);
  }
}

function showSite(site: SiteAnalysis) {
  const s = site.soil;
  $('soil').innerHTML =
    `<span>土壤 <b>${s.type}</b></span><span>pH <b>${s.ph}</b></span>` +
    `<span>湿度 <b>${Math.round(s.moisture * 100)}%</b></span><span>肥力 <b>${Math.round(s.fertility * 100)}%</b></span>` +
    `<span>日照 <b>${s.sunHours}h/天</b></span><span>周边植被 <b>${site.surroundings.length}</b> 处</span>`;
  $('notes').innerHTML = site.notes.map((n) => `<li>${n}</li>`).join('');
}

// ---------- 调色板与工具 ----------
function renderPalette() {
  const el = $('palette');
  el.innerHTML = '';
  for (const sp of SPECIES) {
    const suit = suitability(sp.id);
    const b = document.createElement('button');
    b.className = 'sp' + (sp.id === state.speciesId ? ' active' : '');
    b.innerHTML = `${sp.name}<div class="bar"><i style="width:${Math.round(suit * 100)}%"></i></div>`;
    b.title = `适宜度 ${Math.round(suit * 100)}% · 成熟约 ${sp.growthDays} 天`;
    b.onclick = () => {
      state.speciesId = sp.id;
      setTool('place');
      renderPalette();
    };
    el.appendChild(b);
  }
}

function setTool(t: 'place' | 'remove') {
  state.tool = t;
  $('tool-place').classList.toggle('active', t === 'place');
  $('tool-remove').classList.toggle('active', t === 'remove');
}

function backToToday() {
  stop();
  state.day = 0;
}

view.onGroundClick = (x, z) => {
  if (!state.site || state.tool !== 'place') return;
  if (Math.hypot(x, z) > GARDEN_RADIUS - 0.3) return;
  const gap = Math.min(spacing(state.speciesId), 0.6);
  if (state.plants.some((p) => Math.hypot(p.x - x, p.z - z) < gap)) return;
  backToToday();
  state.plants = [...state.plants, { id: state.nextId++, speciesId: state.speciesId, x, z, growth: 0.05, health: 1 }];
  recompute();
};

view.onPlantClick = (id) => {
  if (state.tool !== 'remove') return;
  backToToday();
  state.plants = state.plants.filter((p) => p.id !== id);
  recompute();
};

$('tool-place').onclick = () => setTool('place');
$('tool-remove').onclick = () => setTool('remove');
$('btn-clear').onclick = () => {
  backToToday();
  state.plants = [];
  recompute();
};

// ---------- 时间轴 ----------
function stop() {
  state.playing = false;
  clearInterval(state.timer);
  $('btn-play').textContent = '▶ 播放';
}

function play() {
  if (!state.snaps.length) return;
  if (state.day >= state.snaps.length - 1) state.day = 0;
  state.playing = true;
  $('btn-play').textContent = '⏸ 暂停';
  const ms = parseInt(($('speed') as HTMLSelectElement).value, 10);
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (state.day >= state.snaps.length - 1) return stop();
    state.day++;
    render();
  }, ms) as unknown as number;
}

$('btn-play').onclick = () => (state.playing ? stop() : play());
$('speed').onchange = () => state.playing && play();
$('slider').oninput = (e) => {
  state.day = parseInt((e.target as HTMLInputElement).value, 10);
  render();
};

// ---------- 定位 / 照片 ----------
function setStatus(s: string) {
  $('status').textContent = s;
}

$('btn-gps').onclick = async () => {
  setStatus('定位中…');
  try {
    const p = await getCurrentLocation();
    ($('lat') as HTMLInputElement).value = p.lat.toFixed(4);
    ($('lon') as HTMLInputElement).value = p.lon.toFixed(4);
    setStatus('已获取当前位置');
  } catch (e) {
    setStatus(`${(e as Error).message}, 请手动输入`);
  }
};

($('photo') as HTMLInputElement).onchange = (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) {
    state.photo = undefined;
    return;
  }
  const img = new Image();
  img.onload = () => {
    state.photo = img;
    setStatus('照片已载入, 点击“生成花园”');
  };
  img.src = URL.createObjectURL(f);
};

($('lat') as HTMLInputElement).value = DEFAULT_LOCATION.lat.toString();
($('lon') as HTMLInputElement).value = DEFAULT_LOCATION.lon.toString();
$('btn-gen').onclick = generate;
generate();
