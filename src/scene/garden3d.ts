import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PlantInstance, SiteAnalysis, Species } from '../types';
import { speciesById } from '../sim/species';

export const GARDEN_RADIUS = 12;

const withHealth = (base: number, health: number) => {
  const c = new THREE.Color(base);
  return c.lerp(new THREE.Color(0x7a5a2a), 1 - health); // 枯黄
};

function buildPlant(sp: Species): { group: THREE.Group; tint: (health: number) => void } {
  const g = new THREE.Group();
  const leafMat = new THREE.MeshStandardMaterial({ color: sp.leafColor, roughness: 0.9, flatShading: true });
  const bloomMat = new THREE.MeshStandardMaterial({ color: sp.bloomColor, roughness: 0.7, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
  const H = sp.height;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };

  switch (sp.kind) {
    case 'flower': {
      add(new THREE.CylinderGeometry(0.02, 0.03, H, 5), leafMat, 0, H / 2);
      add(new THREE.SphereGeometry(H * 0.14, 8, 6), bloomMat, 0, H);
      add(new THREE.ConeGeometry(H * 0.12, H * 0.2, 5), leafMat, 0.08, H * 0.3).rotation.z = -1;
      break;
    }
    case 'shrub': {
      add(new THREE.IcosahedronGeometry(H * 0.45, 0), leafMat, 0, H * 0.45);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(new THREE.SphereGeometry(H * 0.1, 6, 5), bloomMat, Math.cos(a) * H * 0.35, H * (0.5 + (i % 2) * 0.25), Math.sin(a) * H * 0.35);
      }
      break;
    }
    case 'tree': {
      add(new THREE.CylinderGeometry(H * 0.04, H * 0.07, H * 0.5, 6), trunkMat, 0, H * 0.25);
      add(new THREE.IcosahedronGeometry(H * 0.32, 1), sp.id === 'sakura' ? bloomMat : leafMat, 0, H * 0.7);
      add(new THREE.IcosahedronGeometry(H * 0.22, 1), sp.id === 'sakura' ? bloomMat : leafMat, H * 0.18, H * 0.55, H * 0.1);
      break;
    }
    case 'veg': {
      add(new THREE.CylinderGeometry(0.02, 0.03, H * 0.8, 5), trunkMat, 0, H * 0.4);
      add(new THREE.IcosahedronGeometry(H * 0.3, 0), leafMat, 0, H * 0.55);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        add(new THREE.SphereGeometry(0.06, 6, 5), bloomMat, Math.cos(a) * 0.2, H * 0.35, Math.sin(a) * 0.2);
      }
      break;
    }
    case 'grass': {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = 0.15 + (i % 3) * 0.1;
        add(new THREE.ConeGeometry(0.03, H * (0.8 + (i % 3) * 0.2), 4), leafMat, Math.cos(a) * r, H * 0.45, Math.sin(a) * r);
      }
      break;
    }
  }
  return {
    group: g,
    tint: (health) => {
      leafMat.color.copy(withHealth(sp.leafColor, health));
      bloomMat.color.copy(withHealth(sp.bloomColor, health));
    },
  };
}

interface PlantView {
  group: THREE.Group;
  tint: (h: number) => void;
  speciesId: string;
}

export class Garden3D {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private ground: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private dome: THREE.Mesh;
  private surroundGroup = new THREE.Group();
  private plantGroup = new THREE.Group();
  private views = new Map<number, PlantView>();
  private ray = new THREE.Raycaster();
  private ghost: THREE.Mesh;
  private baseSoil = new THREE.Color(0x6b4a32);
  private sun: THREE.DirectionalLight;

  /** 点击地面时回调 (世界坐标) */
  onGroundClick: (x: number, z: number) => void = () => {};
  /** 点击植物时回调 */
  onPlantClick: (id: number) => void = () => {};

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    this.camera.position.set(9, 7, 11);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.5, 0);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 30;
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b5a3a, 0.8));
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.8);
    this.sun.position.set(12, 20, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, far: 60 });
    this.scene.add(this.sun);

    this.groundMat = new THREE.MeshStandardMaterial({ color: this.baseSoil, roughness: 1 });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(GARDEN_RADIUS, 64), this.groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // 远景草地环
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(GARDEN_RADIUS, 80, 64),
      new THREE.MeshStandardMaterial({ color: 0x5f8f3f, roughness: 1 }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.01;
    outer.receiveShadow = true;
    this.scene.add(outer);

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(120, 48, 24), this.skyMaterial());
    this.scene.add(this.dome);

    this.ghost = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    this.ghost.rotation.x = -Math.PI / 2;
    this.ghost.position.y = 0.02;
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    this.scene.add(this.surroundGroup, this.plantGroup);

    this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private skyMaterial(): THREE.Material {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x4a86d8) }, bottom: { value: new THREE.Color(0xd8ecff) } },
      vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 p; uniform vec3 top; uniform vec3 bottom; void main(){ float t = clamp(normalize(p).y*1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }',
    });
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private ndc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private groundHit(e: PointerEvent): THREE.Vector3 | null {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    const hit = this.ray.intersectObject(this.ground)[0];
    return hit ? hit.point : null;
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointermove', (e) => {
      const p = this.groundHit(e);
      this.ghost.visible = !!p;
      if (p) this.ghost.position.set(p.x, 0.02, p.z);
    });
    el.addEventListener('pointerleave', () => (this.ghost.visible = false));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // 拖拽旋转, 非点击
      down = null;
      this.ray.setFromCamera(this.ndc(e), this.camera);
      const hits = this.ray.intersectObjects(this.plantGroup.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o && o.userData.plantId === undefined) o = o.parent;
        if (o) return this.onPlantClick(o.userData.plantId as number);
      }
      const p = this.groundHit(e);
      if (p) this.onGroundClick(p.x, p.z);
    });
  }

  /** 载入场地: 土壤颜色 / 全景照片 / 周边植被 */
  setSite(site: SiteAnalysis) {
    this.baseSoil.set(site.soil.color);
    this.groundMat.color.copy(this.baseSoil);

    const old = this.dome.material as THREE.Material;
    if (site.panorama) {
      const tex = new THREE.Texture(site.panorama);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      tex.wrapS = THREE.RepeatWrapping;
      this.dome.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
    } else {
      this.dome.material = this.skyMaterial();
    }
    old.dispose();

    this.surroundGroup.clear();
    for (const s of site.surroundings) {
      const sp = speciesById(s.speciesId);
      if (sp.kind === 'grass') continue;
      const { group } = buildPlant(sp);
      group.position.set(Math.cos(s.angle) * s.radius, 0, Math.sin(s.angle) * s.radius);
      group.scale.setScalar(s.scale);
      this.surroundGroup.add(group);
    }
  }

  /** 以快照同步植物 (增删 + 成熟度 + 健康度 + 土壤湿度) */
  sync(plants: PlantInstance[], moisture: number) {
    const seen = new Set<number>();
    for (const p of plants) {
      seen.add(p.id);
      let v = this.views.get(p.id);
      if (!v) {
        const b = buildPlant(speciesById(p.speciesId));
        b.group.userData.plantId = p.id;
        b.group.position.set(p.x, 0, p.z);
        b.group.rotation.y = (p.id * 2.399) % (Math.PI * 2);
        this.plantGroup.add(b.group);
        v = { ...b, speciesId: p.speciesId };
        this.views.set(p.id, v);
      }
      v.group.scale.setScalar(0.08 + 0.92 * p.growth);
      v.tint(p.health);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.plantGroup.remove(v.group);
        this.views.delete(id);
      }
    }
    // 土壤越湿越深
    this.groundMat.color.copy(this.baseSoil).multiplyScalar(1.25 - moisture * 0.55);
  }

  /** 当前相机朝向的鸟瞰/重置 */
  resetCamera() {
    this.camera.position.set(9, 7, 11);
    this.controls.target.set(0, 0.5, 0);
  }
}
