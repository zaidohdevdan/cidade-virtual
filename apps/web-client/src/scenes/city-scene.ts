// apps/web/src/scenes/city-scene.ts
import * as THREE from 'three';

export interface InteractiveObject {
  id: string;
  name: string;
  type: 'sign' | 'traffic_light' | 'crosswalk' | 'trash_bin' | 'building' | 'fountain' | 'bench' | 'vehicle';
  position: THREE.Vector3;
  observationRadius: number;
  description: string;
  semanticRule: string;
  emotionalWeight: number;
}

export type TrafficLightState = 'red' | 'yellow' | 'green';

export interface ObstacleCollider {
  type: 'box' | 'cylinder';
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  cx?: number;
  cz?: number;
  radius?: number;
  name?: string;
}

interface TrafficLightRef {
  id: string;
  redMat: THREE.MeshStandardMaterial;
  yellowMat: THREE.MeshStandardMaterial;
  greenMat: THREE.MeshStandardMaterial;
  pedRedMat: THREE.MeshStandardMaterial;
  pedGreenMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  state: TrafficLightState;
}

// ─────────────────────────────────────────────
// CITY SCENE — Synapse City
// Layout Urbano Realista:
//   - Cruzamento Central em (0, 0):
//       * Avenida Central (Norte-Sul, eixo Z)
//       * Rua Transversal (Leste-Oeste, eixo X)
//       * Faixas de pedestres e linhas de retenção
//   - 1 Único Semáforo na esquina da calçada do cruzamento
//   - Praça Central no Quadrante Sudoeste (SW) com fonte, bancos e flores
//   - Mercado no Quadrante Norte (NE/N)
//   - Café no Quadrante Leste (SE/E)
//   - Sistema completo de Colliders para física/colisão
// ─────────────────────────────────────────────
export class CityScene {
  public scene: THREE.Scene;
  public interactiveObjects: InteractiveObject[] = [];
  public trafficLights: TrafficLightRef[] = [];
  public colliders: ObstacleCollider[] = [];

  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private streetLights: THREE.PointLight[] = [];

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0xd4e8f7, 0.008);

    this.buildLighting();
    this.buildGround();
    this.buildRoads();
    this.buildCrosswalks();
    this.buildTrafficLights(); // Apenas 1 semáforo na esquina do cruzamento
    this.buildPraca();        // Praça de pedestres no quadrante SW
    this.buildMarket();       // Mercado no quadrante norte
    this.buildCafe();         // Café no quadrante leste
    this.buildBuildings();    // Edifícios nos quarteirões
    this.buildSigns();        // Placas de trânsito e proibido lixo
    this.buildTrees();        // Árvores urbanas
    this.buildStreetLamps();  // Postes de iluminação pública
    this.buildVehicles();     // Carros nas vias e estacionamento
    this.buildBusStop();      // Ponto de ônibus na calçada oeste
  }

  // ──────────────────── LIGHTING ────────────────────
  private buildLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0xfff5e6, 0.65);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffe8c0, 1.4);
    this.sunLight.position.set(40, 60, 30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 4096;
    this.sunLight.shadow.mapSize.height = 4096;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -70;
    this.sunLight.shadow.camera.right = 70;
    this.sunLight.shadow.camera.top = 70;
    this.sunLight.shadow.camera.bottom = -70;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.4);
    fillLight.position.set(-30, 20, -20);
    this.scene.add(fillLight);
  }

  // ──────────────────── GROUND ────────────────────
  private buildGround(): void {
    const grassGeom = new THREE.PlaneGeometry(200, 200);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x5a7c4a, roughness: 0.95 });
    const grass = new THREE.Mesh(grassGeom, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);
  }

  // ──────────────────── ROADS & INTERSECTION ────────────────────
  private buildRoads(): void {
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x242730, roughness: 0.88, metalness: 0.05 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xeeeecc });
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xb5babd, roughness: 0.92 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x7d8285 });

    const roadW = 14; // 14 metros de largura (2 faixas de 7m)
    const roadL = 100; // 100 metros de extensão

    // 1. Rua Norte-Sul (Avenida Central, eixo Z)
    this.addRoadSegment(0, roadW, roadL, 0, asphaltMat, sidewalkMat, curbMat, lineMat, yellowLineMat, false);
    // 2. Rua Leste-Oeste (Rua Transversal, eixo X)
    this.addRoadSegment(0, roadW, roadL, 0, asphaltMat, sidewalkMat, curbMat, lineMat, yellowLineMat, true);

    // 3. Cruzamento Central (0,0): quadrado de asfalto livre sem obstruções
    const crossGeom = new THREE.PlaneGeometry(roadW, roadW);
    const cross = new THREE.Mesh(crossGeom, asphaltMat);
    cross.rotation.x = -Math.PI / 2;
    cross.position.set(0, 0.022, 0);
    cross.receiveShadow = true;
    this.scene.add(cross);

    // 4. Linhas de Retenção (Stop Lines) para veículos antes das faixas de pedestre
    const stopLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stopPositions = [
      { x: 3.5, z: -11.5, w: 6.5, d: 0.5 }, // Pista Norte descendo
      { x: -3.5, z: 11.5, w: 6.5, d: 0.5 }, // Pista Sul subindo
      { x: -11.5, z: -3.5, w: 0.5, d: 6.5 }, // Pista Oeste
      { x: 11.5, z: 3.5, w: 0.5, d: 6.5 },  // Pista Leste
    ];
    for (const sl of stopPositions) {
      const g = new THREE.PlaneGeometry(sl.w, sl.d);
      const m = new THREE.Mesh(g, stopLineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(sl.x, 0.035, sl.z);
      this.scene.add(m);
    }
  }

  private addRoadSegment(
    cx: number, width: number, length: number, cz: number,
    asphaltMat: THREE.Material, sidewalkMat: THREE.Material, curbMat: THREE.Material,
    lineMat: THREE.Material, yellowLineMat: THREE.Material,
    isHorizontal: boolean
  ): void {
    const rot = isHorizontal ? Math.PI / 2 : 0;

    // Asfalto
    const roadGeom = new THREE.PlaneGeometry(width, length);
    const road = new THREE.Mesh(roadGeom, asphaltMat);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = rot;
    road.position.set(cx, 0.02, cz);
    road.receiveShadow = true;
    this.scene.add(road);

    // Linha amarela central dupla tracejada (não entra no miolo do cruzamento)
    const halfLen = length / 2;
    const skipZone = 9; // Deixa o cruzamento 18x18 livre de linhas
    for (let t = -halfLen + 2; t < halfLen; t += 4) {
      if (Math.abs(t) < skipZone) continue;
      const sg = new THREE.PlaneGeometry(0.24, 2.4);
      const s = new THREE.Mesh(sg, yellowLineMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(
        isHorizontal ? cx + t : cx,
        0.03,
        isHorizontal ? cz : cz + t
      );
      this.scene.add(s);
    }

    // Linhas brancas contínuas laterais
    for (const sign of [-1, 1]) {
      const offset = sign * (width / 2 - 0.4);
      const lg = new THREE.PlaneGeometry(0.18, length);
      const l = new THREE.Mesh(lg, lineMat);
      l.rotation.x = -Math.PI / 2;
      l.rotation.z = rot;
      l.position.set(
        isHorizontal ? cx : cx + offset,
        0.03,
        isHorizontal ? cz + offset : cz
      );
      this.scene.add(l);
    }

    // Calçadas de concreto nos lados da rua
    const swW = 6;
    for (const sign of [-1, 1]) {
      const swOffset = sign * (width / 2 + swW / 2);
      const swGeom = new THREE.BoxGeometry(
        isHorizontal ? length : swW,
        0.22,
        isHorizontal ? swW : length
      );
      const sw = new THREE.Mesh(swGeom, sidewalkMat);
      sw.position.set(
        isHorizontal ? cx : cx + swOffset,
        0.11,
        isHorizontal ? cz + swOffset : cz
      );
      sw.receiveShadow = true;
      this.scene.add(sw);

      // Meio-fio de granito
      const curbGeom = new THREE.BoxGeometry(
        isHorizontal ? length : 0.28,
        0.26,
        isHorizontal ? 0.28 : length
      );
      const curb = new THREE.Mesh(curbGeom, curbMat);
      curb.position.set(
        isHorizontal ? cx : cx + sign * (width / 2),
        0.13,
        isHorizontal ? cz + sign * (width / 2) : cz
      );
      this.scene.add(curb);
    }
  }

  // ──────────────────── CROSSWALKS ────────────────────
  private buildCrosswalks(): void {
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
    // Faixas posicionadas nas 4 aproximações do cruzamento central
    const positions = [
      { x: 0, z: -8.8, rot: 0, name: 'Faixa Norte' },
      { x: 0, z: 8.8, rot: 0, name: 'Faixa Sul' },
      { x: -8.8, z: 0, rot: Math.PI / 2, name: 'Faixa Oeste' },
      { x: 8.8, z: 0, rot: Math.PI / 2, name: 'Faixa Leste' },
    ];

    for (const pos of positions) {
      for (let i = 0; i < 9; i++) {
        const sg = new THREE.PlaneGeometry(0.7, 3.8);
        const s = new THREE.Mesh(sg, crossMat);
        s.rotation.x = -Math.PI / 2;
        const offset = -4.0 + i * 1.0;
        s.position.set(
          pos.rot !== 0 ? pos.x : pos.x + offset,
          0.04,
          pos.rot !== 0 ? pos.z + offset : pos.z
        );
        this.scene.add(s);
      }

      this.interactiveObjects.push({
        id: `crosswalk-${pos.name.toLowerCase().replace(' ', '-')}`,
        name: `Faixa de Pedestres (${pos.name})`,
        type: 'crosswalk',
        position: new THREE.Vector3(pos.x, 0, pos.z),
        observationRadius: 5.5,
        description: 'Faixa de pedestres com listras brancas refletivas para travessia segura.',
        semanticRule: 'Pedestres têm prioridade absoluta quando o semáforo estiver vermelho para veículos.',
        emotionalWeight: 0.6,
      });
    }
  }

  // ──────────────────── O ÚNICO SEMÁFORO DO CRUZAMENTO ────────────────────
  private buildTrafficLights(): void {
    // Apenas 1 semáforo posicionado na esquina da calçada do cruzamento
    // Local: esquina Sudeste (x = 8.5, z = 8.5), com visão privilegiada para a via e faixas
    const sx = 8.5;
    const sz = 8.5;
    const ref = this.buildSingleTrafficLight(sx, sz, 'tl-cruzamento');
    this.trafficLights.push(ref);

    // Registrar collider do poste do semáforo
    this.colliders.push({
      type: 'cylinder',
      cx: sx,
      cz: sz,
      radius: 0.45,
      name: 'Poste do Semáforo',
    });
  }

  private buildSingleTrafficLight(x: number, z: number, id: string): TrafficLightRef {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222629, metalness: 0.85, roughness: 0.25 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.3 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.4 });

    const group = new THREE.Group();

    // 1. Coluna vertical principal (base na calçada)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.2, 16), poleMat);
    pole.position.set(0, 3.1, 0);
    pole.castShadow = true;
    group.add(pole);

    // Flange da base
    const baseFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.25, 12), poleMat);
    baseFlange.position.set(0, 0.125, 0);
    group.add(baseFlange);

    // 2. Braço horizontal projetado sobre a via (estilo semáforo urbano moderno)
    const armLen = 3.6;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, armLen, 12), poleMat);
    arm.rotation.z = -Math.PI / 2;
    arm.position.set(-armLen / 2, 5.8, 0);
    arm.castShadow = true;
    group.add(arm);

    // Suporte diagonal de reforço
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), poleMat);
    brace.rotation.z = -Math.PI / 4;
    brace.position.set(-0.65, 5.15, 0);
    group.add(brace);

    // 3. Caixa do semáforo vehicular suspenso sobre a via
    const headX = -2.8;
    const headY = 5.2;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.45), boxMat);
    box.position.set(headX, headY, 0);
    box.castShadow = true;
    group.add(box);

    // Materiais luminosos das lâmpadas
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xff0000, emissiveIntensity: 2.2, roughness: 0.2 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.5 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.5 });

    // Focos do semáforo vehicular com pestanas/viseiras
    const lampGeom = new THREE.SphereGeometry(0.18, 12, 12);
    const visorGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 12, 1, true, 0, Math.PI);

    // Lâmpada Vermelha
    const red = new THREE.Mesh(lampGeom, redMat);
    red.position.set(headX, headY + 0.55, 0.22);
    group.add(red);
    const redVisor = new THREE.Mesh(visorGeom, visorMat);
    redVisor.rotation.x = Math.PI / 2;
    redVisor.position.set(headX, headY + 0.65, 0.24);
    group.add(redVisor);

    // Lâmpada Amarela
    const yellow = new THREE.Mesh(lampGeom, yellowMat);
    yellow.position.set(headX, headY, 0.22);
    group.add(yellow);
    const yelVisor = new THREE.Mesh(visorGeom, visorMat);
    yelVisor.rotation.x = Math.PI / 2;
    yelVisor.position.set(headX, headY + 0.1, 0.24);
    group.add(yelVisor);

    // Lâmpada Verde
    const green = new THREE.Mesh(lampGeom, greenMat);
    green.position.set(headX, headY - 0.55, 0.22);
    group.add(green);
    const grnVisor = new THREE.Mesh(visorGeom, visorMat);
    grnVisor.rotation.x = Math.PI / 2;
    grnVisor.position.set(headX, headY - 0.45, 0.24);
    group.add(grnVisor);

    // 4. Semáforo de Pedestres instalado na coluna vertical
    const pedBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.3), boxMat);
    pedBox.position.set(0, 2.4, 0.25);
    group.add(pedBox);

    const pedRedMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0x000000, emissiveIntensity: 0 });
    const pedGreenMat = new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00ff44, emissiveIntensity: 1.8 });

    const pedRed = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), pedRedMat);
    pedRed.position.set(0, 2.6, 0.4);
    group.add(pedRed);

    const pedGreen = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), pedGreenMat);
    pedGreen.position.set(0, 2.2, 0.4);
    group.add(pedGreen);

    // Luz dinâmica do semáforo iluminando o asfalto do cruzamento
    const light = new THREE.PointLight(0xff0000, 2.0, 16);
    light.position.set(headX, headY, 1.2);
    group.add(light);

    group.position.set(x, 0, z);
    this.scene.add(group);

    this.interactiveObjects.push({
      id,
      name: 'Semáforo do Cruzamento',
      type: 'traffic_light',
      position: new THREE.Vector3(x, 4.5, z),
      observationRadius: 10,
      description: 'Semáforo de trânsito regulando o cruzamento da Avenida Central com a Rua Transversal.',
      semanticRule: 'Vermelho: pare. Verde: siga com cautela. Pedestres atravessam na faixa quando liberado.',
      emotionalWeight: 0.9,
    });

    return { id, redMat, yellowMat, greenMat, pedRedMat, pedGreenMat, light, state: 'red' };
  }

  // ──────────────────── PRAÇA CENTRAL (QUADRANTE SUDOESTE) ────────────────────
  private buildPraca(): void {
    // Praça Municipal posicionada no Quadrante Sudoeste (SW), conectada à calçada
    const px = -22;
    const pz = 22;
    const pWidth = 24;
    const pDepth = 24;

    // Piso nobre da praça (pedras claras/travertino)
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b5, roughness: 0.85 });
    const plazaGeom = new THREE.BoxGeometry(pWidth, 0.22, pDepth);
    const plaza = new THREE.Mesh(plazaGeom, plazaMat);
    plaza.position.set(px, 0.11, pz);
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // Mureta decorativa baixa nos limites externos
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x9e978c, roughness: 0.9 });
    const lowWallGeom = new THREE.BoxGeometry(pWidth, 0.45, 0.6);
    const wallSouth = new THREE.Mesh(lowWallGeom, wallMat);
    wallSouth.position.set(px, 0.32, pz + pDepth / 2);
    wallSouth.castShadow = true;
    this.scene.add(wallSouth);

    this.colliders.push({
      type: 'box',
      minX: px - pWidth / 2,
      maxX: px + pWidth / 2,
      minZ: pz + pDepth / 2 - 0.4,
      maxZ: pz + pDepth / 2 + 0.4,
      name: 'Mureta Sul da Praça',
    });

    // 4 Canteiros de flores elevados nos cantos da praça
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x416d33, roughness: 0.92 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xeb3b72, roughness: 0.6, emissive: 0x551122, emissiveIntensity: 0.2 });
    const bedOffsets = [[-6, -6], [6, -6], [-6, 6], [6, 6]] as [number, number][];

    for (const [bx, bz] of bedOffsets) {
      const cx = px + bx;
      const cz = pz + bz;
      const bedGeom = new THREE.BoxGeometry(5.2, 0.4, 5.2);
      const bed = new THREE.Mesh(bedGeom, bedMat);
      bed.position.set(cx, 0.35, cz);
      bed.castShadow = true;
      bed.receiveShadow = true;
      this.scene.add(bed);

      this.colliders.push({
        type: 'box',
        minX: cx - 2.6,
        maxX: cx + 2.6,
        minZ: cz - 2.6,
        maxZ: cz + 2.6,
        name: 'Canteiro de Flores da Praça',
      });

      // Flores coloridas
      for (let f = 0; f < 9; f++) {
        const fx = cx + (Math.random() - 0.5) * 4.2;
        const fz = cz + (Math.random() - 0.5) * 4.2;
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 8, 8), flowerMat);
        flower.position.set(fx, 0.68, fz);
        flower.castShadow = true;
        this.scene.add(flower);
      }
    }

    // Fonte Ornamental Central da Praça
    this.buildFountain(px, pz);

    // Bancos de Madeira voltados para a fonte
    const benchPositions = [
      { x: px - 4.5, z: pz, ry: Math.PI / 2 },
      { x: px + 4.5, z: pz, ry: -Math.PI / 2 },
      { x: px, z: pz - 4.5, ry: 0 },
      { x: px, z: pz + 4.5, ry: Math.PI },
    ];
    for (const bp of benchPositions) {
      this.buildBench(bp.x, bp.z, bp.ry);
    }

    this.interactiveObjects.push({
      id: 'praca-central',
      name: 'Praça Municipal',
      type: 'fountain',
      position: new THREE.Vector3(px, 0.5, pz),
      observationRadius: 14,
      description: 'Praça pública arborizada com fonte monumental, canteiros floridos e bancos de descanso.',
      semanticRule: 'Espaço público de convivência e lazer. Mantenha limpo e respeite o patrimônio.',
      emotionalWeight: 0.9,
    });
  }

  private buildFountain(x: number, z: number): void {
    const basinMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.35, metalness: 0.4 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x29b6f6, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.85 });

    // Bacia de pedra
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.65, 32), basinMat);
    basin.position.set(x, 0.5, z);
    basin.castShadow = true;
    basin.receiveShadow = true;
    this.scene.add(basin);

    // Água
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.12, 32), waterMat);
    water.position.set(x, 0.78, z);
    this.scene.add(water);

    // Coluna central
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 16), basinMat);
    pillar.position.set(x, 1.25, z);
    pillar.castShadow = true;
    this.scene.add(pillar);

    // Taça superior
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.4, 0.35, 20), basinMat);
    bowl.position.set(x, 2.05, z);
    this.scene.add(bowl);

    const topSphere = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), basinMat);
    topSphere.position.set(x, 2.35, z);
    this.scene.add(topSphere);

    // Spray d'água
    const sprayMat = new THREE.MeshBasicMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.65 });
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const r = 0.6 + Math.random() * 0.9;
      const h = 1.2 + Math.random() * 0.9;
      const spray = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), sprayMat);
      spray.position.set(x + Math.cos(angle) * r, h, z + Math.sin(angle) * r);
      this.scene.add(spray);
    }

    // Collider circular da fonte (raio 2.75m)
    this.colliders.push({
      type: 'cylinder',
      cx: x,
      cz: z,
      radius: 2.75,
      name: 'Fonte Monumental',
    });
  }

  private buildBench(x: number, z: number, ry: number): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.25 });
    const g = new THREE.Group();

    // Assento
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.55), woodMat);
    seat.position.set(0, 0.48, 0);
    seat.castShadow = true;
    g.add(seat);

    // Encosto
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), woodMat);
    back.position.set(0, 0.76, -0.24);
    back.castShadow = true;
    g.add(back);

    // Pés de ferro
    for (const lx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.55), metalMat);
      leg.position.set(lx, 0.24, 0);
      leg.castShadow = true;
      g.add(leg);
    }

    g.position.set(x, 0.2, z);
    g.rotation.y = ry;
    this.scene.add(g);

    // Collider do banco
    this.colliders.push({
      type: 'box',
      minX: x - 1.0,
      maxX: x + 1.0,
      minZ: z - 0.7,
      maxZ: z + 0.7,
      name: 'Banco da Praça',
    });

    this.interactiveObjects.push({
      id: `bench-${x.toFixed(0)}-${z.toFixed(0)}`,
      name: 'Banco da Praça',
      type: 'bench',
      position: new THREE.Vector3(x, 0.5, z),
      observationRadius: 2.8,
      description: 'Banco público de madeira com suportes de ferro fundido.',
      semanticRule: 'Assento público. Ceda o lugar a quem mais precisa.',
      emotionalWeight: 0.4,
    });
  }

  // ──────────────────── MARKET (QUADRANTE NORTE) ────────────────────
  private buildMarket(): void {
    const mx = 0;
    const mz = -48;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.5, metalness: 0.6 });

    // Prédio do Mercado
    const body = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 18), wallMat);
    body.position.set(mx, 4.0, mz);
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(32, 0.8, 20), roofMat);
    roof.position.set(mx, 8.4, mz);
    this.scene.add(roof);

    const facade = new THREE.Mesh(new THREE.BoxGeometry(28, 5.5, 0.3), glassMat);
    facade.position.set(mx, 3.0, mz + 9);
    this.scene.add(facade);

    // Letreiro MARKET
    const marketCanvas = document.createElement('canvas');
    marketCanvas.width = 1024;
    marketCanvas.height = 256;
    const ctx = marketCanvas.getContext('2d')!;
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 170px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛒  SUPER MARKET', 512, 128);
    const signTex = new THREE.CanvasTexture(marketCanvas);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(14, 2.4, 0.2),
      new THREE.MeshStandardMaterial({ map: signTex })
    );
    sign.position.set(mx, 7.0, mz + 9.2);
    this.scene.add(sign);

    // Collider do Mercado
    this.colliders.push({
      type: 'box',
      minX: mx - 15.5,
      maxX: mx + 15.5,
      minZ: mz - 9.5,
      maxZ: mz + 9.5,
      name: 'Super Market',
    });

    this.interactiveObjects.push({
      id: 'market',
      name: 'Super Market',
      type: 'building',
      position: new THREE.Vector3(mx, 4.0, mz + 10),
      observationRadius: 16,
      description: 'Supermercado central com ampla oferta de mantimentos e estacionamento.',
      semanticRule: 'Área comercial movimentada. Respeite as faixas e o trânsito de veículos.',
      emotionalWeight: 0.7,
    });
  }

  // ──────────────────── CAFÉ (QUADRANTE LESTE) ────────────────────
  private buildCafe(): void {
    const cx = 32;
    const cz = -20;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xecdcc9, roughness: 0.75 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7 });
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.6 });

    // Estrutura do café
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 14), wallMat);
    body.position.set(cx, 3.0, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 0.6, 15), roofMat);
    roof.position.set(cx, 6.3, cz);
    this.scene.add(roof);

    // Toldo frontal
    const awning = new THREE.Mesh(new THREE.BoxGeometry(16, 0.15, 3.5), awningMat);
    awning.position.set(cx, 4.2, cz + 8.5);
    this.scene.add(awning);

    this.buildHUDSign('☕ CAFÉ BISTRO', cx, 4.8, cz + 7.2, 0x4e342e, 0xfff8e1);

    // Mesas ao ar livre
    const tablePositions = [
      [cx - 4, cz + 11],
      [cx, cz + 11],
      [cx + 4, cz + 11],
    ] as [number, number][];

    for (const [tx, tz] of tablePositions) {
      this.buildOutdoorTable(tx, tz);
      this.colliders.push({
        type: 'cylinder',
        cx: tx,
        cz: tz,
        radius: 1.1,
        name: 'Mesa do Café',
      });
    }

    this.colliders.push({
      type: 'box',
      minX: cx - 8.5,
      maxX: cx + 8.5,
      minZ: cz - 7.5,
      maxZ: cz + 7.5,
      name: 'Edifício do Café',
    });

    this.interactiveObjects.push({
      id: 'cafe',
      name: 'Café Bistro',
      type: 'building',
      position: new THREE.Vector3(cx, 2.5, cz + 10),
      observationRadius: 10,
      description: 'Cafeteria aconchegante com mesas externas e cardápio de cafés especiais.',
      semanticRule: 'Espaço de refeição e conversa. Bebidas e lanches servidos nas mesas.',
      emotionalWeight: 0.75,
    });
  }

  private buildOutdoorTable(x: number, z: number): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xbcaaa4, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 });
    const g = new THREE.Group();

    const tabletop = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.08, 16), woodMat);
    tabletop.position.set(0, 0.75, 0);
    g.add(tabletop);

    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.75, 8), metalMat);
    tableLeg.position.set(0, 0.38, 0);
    g.add(tableLeg);

    g.position.set(x, 0.15, z);
    this.scene.add(g);
  }

  // ──────────────────── SIGNS & NO LITTERING ────────────────────
  private buildSigns(): void {
    // Placa "ATENÇÃO: PROIBIDO JOGAR LIXO" na entrada da praça
    this.buildNoLitteringSign(-10, 10);

    // Placas de identificação das ruas
    this.buildStreetSign(0, -14, 'Avenida Central - Norte', 0);
    this.buildStreetSign(0, 14, 'Avenida Central - Sul', 0);
    this.buildStreetSign(-14, 0, 'Rua Transversal - Oeste', Math.PI / 2);
    this.buildStreetSign(14, 0, 'Rua Transversal - Leste', Math.PI / 2);

    // Billboards educativos na cidade
    this.buildBillboard(-36, 4, -18, '#1565c0', 'Cidade Conectada\nIAs em Harmonia', '🌐');
    this.buildBillboard(36, 4, 18, '#2e7d32', 'Preserve o Verde\ne os Espaços Públicos', '🌱');
  }

  private buildNoLitteringSign(x: number, z: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 680;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 680);
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#c62828';
    ctx.strokeRect(15, 15, 482, 650);

    // Faixa superior
    ctx.fillStyle = '#c62828';
    ctx.fillRect(35, 35, 442, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ATENÇÃO', 256, 80);

    // Símbolo de proibido
    ctx.beginPath();
    ctx.arc(256, 310, 125, 0, Math.PI * 2);
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#c62828';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(168, 222);
    ctx.lineTo(344, 398);
    ctx.stroke();

    // Texto de advertência
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PROIBIDO', 256, 480);
    ctx.fillText('JOGAR LIXO', 256, 550);
    ctx.fillStyle = '#666666';
    ctx.font = '34px sans-serif';
    ctx.fillText('SUJEITO A MULTA', 256, 625);

    const tex = new THREE.CanvasTexture(canvas);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.6, 0.06),
      new THREE.MeshStandardMaterial({ map: tex })
    );
    sign.position.set(x, 2.2, z);
    sign.rotation.y = Math.PI / 4;
    sign.castShadow = true;
    this.scene.add(sign);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6 })
    );
    pole.position.set(x, 1.1, z);
    pole.castShadow = true;
    this.scene.add(pole);

    // Lixeira pública de metal ao lado da placa
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 });
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.95, 14), binMat);
    bin.position.set(x + 1.2, 0.55, z);
    bin.castShadow = true;
    this.scene.add(bin);

    // Colliders da placa e da lixeira
    this.colliders.push({
      type: 'cylinder',
      cx: x,
      cz: z,
      radius: 0.45,
      name: 'Placa Proibido Jogar Lixo',
    });
    this.colliders.push({
      type: 'cylinder',
      cx: x + 1.2,
      cz: z,
      radius: 0.45,
      name: 'Lixeira Pública',
    });

    this.interactiveObjects.push({
      id: 'sign-no-littering',
      name: 'Placa: Proibido Jogar Lixo',
      type: 'sign',
      position: new THREE.Vector3(x, 2, z),
      observationRadius: 5.5,
      description: 'Placa oficial de sinalização proibindo expressamente o descarte de resíduos.',
      semanticRule: 'Descarte de lixo na via pública é infração. Utilize a lixeira verde ao lado.',
      emotionalWeight: 0.85,
    });
  }

  private buildStreetSign(x: number, z: number, text: string, ry: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1565c0';
    ctx.roundRect(0, 0, 512, 128, 16);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.6, 0.08),
      new THREE.MeshStandardMaterial({ map: tex })
    );
    sign.position.set(x, 3.2, z);
    sign.rotation.y = ry;
    this.scene.add(sign);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })
    );
    pole.position.set(x, 1.6, z);
    this.scene.add(pole);

    this.colliders.push({
      type: 'cylinder',
      cx: x,
      cz: z,
      radius: 0.35,
      name: `Poste de Rua (${text})`,
    });
  }

  private buildBillboard(x: number, y: number, z: number, bgColor: string, text: string, icon: string): void {
    const w = 512, h = 384;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, 256, 140 + i * 70));
    ctx.font = '72px sans-serif';
    ctx.fillText(icon, 256, 70);

    const tex = new THREE.CanvasTexture(canvas);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 4.0, 0.2),
      new THREE.MeshStandardMaterial({ map: tex })
    );
    board.position.set(x, y + 2, z);
    this.scene.add(board);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, y + 2, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7 })
    );
    pole.position.set(x, (y + 2) / 2, z);
    this.scene.add(pole);

    this.colliders.push({
      type: 'cylinder',
      cx: x,
      cz: z,
      radius: 0.6,
      name: 'Billboard',
    });
  }

  private buildHUDSign(text: string, x: number, y: number, z: number, bgHex: number, fgHex: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `#${bgHex.toString(16).padStart(6, '0')}`;
    ctx.roundRect(0, 0, 512, 128, 20);
    ctx.fill();
    ctx.fillStyle = `#${fgHex.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.8, 0.1),
      new THREE.MeshStandardMaterial({ map: tex })
    );
    sign.position.set(x, y, z);
    this.scene.add(sign);
  }

  // ──────────────────── TREES ────────────────────
  private buildTrees(): void {
    const positions = [
      // Ao longo das calçadas da Avenida Norte-Sul
      [-9.5, -35], [-9.5, -25], [-9.5, 25], [-9.5, 35],
      [9.5, -35], [9.5, -25], [9.5, 25], [9.5, 35],
      // Ao longo das calçadas da Rua Leste-Oeste
      [-35, -9.5], [-25, -9.5], [25, -9.5], [35, -9.5],
      [-35, 9.5], [-25, 9.5], [25, 9.5], [35, 9.5],
      // Ao redor da praça
      [-32, 12], [-32, 32], [-12, 32],
    ] as [number, number][];

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.95 });
    const foliageColors = [0x2e7d32, 0x388e3c, 0x1b5e20, 0x43a047];

    for (const [tx, tz] of positions) {
      const h = 4.0 + Math.random() * 1.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 10), trunkMat);
      trunk.position.set(tx, h / 2, tz);
      trunk.castShadow = true;
      this.scene.add(trunk);

      const fColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
      const fMat = new THREE.MeshStandardMaterial({ color: fColor, roughness: 0.85 });
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6 + Math.random() * 0.4, 1), fMat);
      foliage.position.set(tx, h + 0.9, tz);
      foliage.castShadow = true;
      this.scene.add(foliage);

      // Collider circular de cada tronco de árvore
      this.colliders.push({
        type: 'cylinder',
        cx: tx,
        cz: tz,
        radius: 0.6,
        name: 'Tronco de Árvore',
      });
    }
  }

  // ──────────────────── STREET LAMPS ────────────────────
  private buildStreetLamps(): void {
    const positions = [
      // Próximos às calçadas
      [-9.5, -18], [-9.5, 18], [9.5, -18], [9.5, 18],
      [-18, -9.5], [18, -9.5], [-18, 9.5], [18, 9.5],
    ] as [number, number][];

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2e31, metalness: 0.8, roughness: 0.3 });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: 0xffe680, emissiveIntensity: 1.4 });

    for (const [lx, lz] of positions) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 5.8, 12), poleMat);
      pole.position.set(lx, 2.9, lz);
      pole.castShadow = true;
      this.scene.add(pole);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), poleMat);
      arm.rotation.z = Math.PI / 2;
      const dir = lx < 0 ? 1 : -1;
      arm.position.set(lx + 0.8 * dir, 5.7, lz);
      this.scene.add(arm);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bulbMat);
      bulb.position.set(lx + 1.6 * dir, 5.5, lz);
      this.scene.add(bulb);

      const pLight = new THREE.PointLight(0xffecc4, 1.6, 22);
      pLight.position.set(lx + 1.6 * dir, 5.3, lz);
      pLight.castShadow = true;
      this.scene.add(pLight);
      this.streetLights.push(pLight);

      this.colliders.push({
        type: 'cylinder',
        cx: lx,
        cz: lz,
        radius: 0.4,
        name: 'Poste de Iluminação',
      });
    }
  }

  // ──────────────────── VEHICLES ────────────────────
  private buildVehicles(): void {
    // Carro parado antes da faixa sul do cruzamento
    this.buildCar(3.5, 16, 0x111144, Math.PI);
    // Carro parado antes da faixa norte descendo
    this.buildCar(-3.5, -16, 0xd32f2f, 0);
    // Carros no estacionamento do mercado
    this.buildCar(-8, -36, 0x37474f, 0);
    this.buildCar(8, -36, 0xeeeeee, 0);
  }

  public buildCar(x: number, z: number, color: number, ry: number = 0): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.6 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    const g = new THREE.Group();

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.6), bodyMat);
    chassis.position.y = 0.5;
    chassis.castShadow = true;
    g.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.6), bodyMat);
    cabin.position.set(0, 1.05, -0.1);
    cabin.castShadow = true;
    g.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.08), glassMat);
    windshield.position.set(0, 1.05, 1.22);
    g.add(windshield);

    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), glassMat);
    rearWindow.position.set(0, 1.05, -1.42);
    g.add(rearWindow);

    const wheelPositions = [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]] as [number, number][];
    for (const [wx, wz] of wheelPositions) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 14), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.34, wz);
      wheel.castShadow = true;
      g.add(wheel);
    }

    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.scene.add(g);

    // Collider do carro
    this.colliders.push({
      type: 'box',
      minX: x - 1.3,
      maxX: x + 1.3,
      minZ: z - 2.5,
      maxZ: z + 2.5,
      name: 'Veículo',
    });

    this.interactiveObjects.push({
      id: `vehicle-${x.toFixed(0)}-${z.toFixed(0)}`,
      name: 'Veículo Automotor',
      type: 'vehicle',
      position: new THREE.Vector3(x, 0.5, z),
      observationRadius: 4.5,
      description: 'Veículo automotor aguardando sinalização no cruzamento.',
      semanticRule: 'Mantenha distância de veículos em operação. Não atravesse fora da faixa.',
      emotionalWeight: 0.55,
    });
  }

  // ──────────────────── BUS STOP ────────────────────
  private buildBusStop(): void {
    const x = -11.5, z = -20;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, metalness: 0.7, roughness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.35 });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 3.0), frameMat);
    frame.position.set(x, 1.6, z);
    frame.castShadow = true;
    this.scene.add(frame);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 3.4), frameMat);
    roof.position.set(x - 0.8, 3.2, z);
    this.scene.add(roof);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 2.8), glassMat);
    glass.position.set(x, 1.5, z);
    this.scene.add(glass);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 2.2), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    bench.position.set(x - 0.5, 0.6, z);
    this.scene.add(bench);

    this.colliders.push({
      type: 'box',
      minX: x - 1.8,
      maxX: x + 0.3,
      minZ: z - 1.7,
      maxZ: z + 1.7,
      name: 'Ponto de Ônibus',
    });

    this.interactiveObjects.push({
      id: 'bus-stop',
      name: 'Ponto de Ônibus',
      type: 'building',
      position: new THREE.Vector3(x, 1.2, z),
      observationRadius: 5.0,
      description: 'Ponto de parada coberto para transporte coletivo municipal.',
      semanticRule: 'Área de espera de ônibus. Respeite a fila de embarque.',
      emotionalWeight: 0.6,
    });
  }

  // ──────────────────── BUILDINGS ────────────────────
  private buildBuildings(): void {
    const palette = [0x37474f, 0x455a64, 0x4e342e, 0x424242, 0x546e7a];
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x90caf9, emissive: 0x1565c0, emissiveIntensity: 0.35 });

    const positions = [
      // Quadrante Noroeste (NW)
      { x: -35, z: -35, w: 18, d: 18 },
      // Quadrante Nordeste (NE, ao lado do mercado)
      { x: 35, z: -40, w: 18, d: 18 },
      // Quadrante Sudeste (SE, ao lado do café)
      { x: 38, z: 32, w: 18, d: 18 },
      // Quadrante Sudoeste (atrás da praça)
      { x: -45, z: 35, w: 16, d: 16 },
    ];

    for (const pos of positions) {
      const h = 15 + Math.random() * 12;
      const color = palette[Math.floor(Math.random() * palette.length)];
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(pos.w, h, pos.d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
      );
      body.position.set(pos.x, h / 2, pos.z);
      body.castShadow = true;
      body.receiveShadow = true;
      this.scene.add(body);

      // Janelas iluminadas
      for (let floor = 0; floor < Math.floor(h / 3.2); floor++) {
        for (let col = 0; col < 3; col++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.1), windowMat);
          win.position.set(
            pos.x - 4.5 + col * 4.5,
            1.8 + floor * 3.2,
            pos.z + pos.d / 2 + 0.05
          );
          this.scene.add(win);
        }
      }

      this.colliders.push({
        type: 'box',
        minX: pos.x - pos.w / 2 - 0.3,
        maxX: pos.x + pos.w / 2 + 0.3,
        minZ: pos.z - pos.d / 2 - 0.3,
        maxZ: pos.z + pos.d / 2 + 0.3,
        name: 'Edifício Urbano',
      });
    }
  }

  // ──────────────────── TRAFFIC LIGHT STATE ────────────────────
  public setTrafficLightState(id: string, state: TrafficLightState): void {
    const ref = this.trafficLights.find((t) => t.id === id);
    if (!ref) return;
    ref.state = state;

    // Focos Veiculares
    ref.redMat.emissiveIntensity = state === 'red' ? 2.5 : 0;
    ref.redMat.emissive.setHex(state === 'red' ? 0xff0000 : 0x000000);
    ref.yellowMat.emissiveIntensity = state === 'yellow' ? 2.5 : 0;
    ref.yellowMat.emissive.setHex(state === 'yellow' ? 0xffbb00 : 0x000000);
    ref.greenMat.emissiveIntensity = state === 'green' ? 2.5 : 0;
    ref.greenMat.emissive.setHex(state === 'green' ? 0x00ff44 : 0x000000);

    // Focos de Pedestre (inverso: quando carro está vermelho, pedestre está verde)
    const pedCanWalk = state === 'red';
    ref.pedRedMat.emissiveIntensity = pedCanWalk ? 0 : 2.0;
    ref.pedRedMat.emissive.setHex(pedCanWalk ? 0x000000 : 0xff0000);
    ref.pedGreenMat.emissiveIntensity = pedCanWalk ? 2.0 : 0;
    ref.pedGreenMat.emissive.setHex(pedCanWalk ? 0x00ff44 : 0x000000);

    // Luz dinâmica da cena
    ref.light.color.setHex(state === 'red' ? 0xff0000 : state === 'yellow' ? 0xffbb00 : 0x00ff44);
  }

  public setAllTrafficLights(state: TrafficLightState): void {
    for (const t of this.trafficLights) {
      this.setTrafficLightState(t.id, state);
    }
  }

  // ──────────────────── TIME OF DAY ────────────────────
  public setTimeOfDay(time: 'day' | 'sunset' | 'night'): void {
    if (time === 'day') {
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog = new THREE.FogExp2(0xd4e8f7, 0.008);
      this.ambientLight.intensity = 0.65;
      this.sunLight.intensity = 1.4;
      this.sunLight.color.setHex(0xffe8c0);
      this.streetLights.forEach((l) => (l.intensity = 0.2));
    } else if (time === 'sunset') {
      this.scene.background = new THREE.Color(0xe07030);
      this.scene.fog = new THREE.FogExp2(0xd06030, 0.012);
      this.ambientLight.intensity = 0.4;
      this.sunLight.intensity = 0.7;
      this.sunLight.color.setHex(0xff5511);
      this.streetLights.forEach((l) => (l.intensity = 2.0));
    } else {
      this.scene.background = new THREE.Color(0x080b14);
      this.scene.fog = new THREE.FogExp2(0x080b14, 0.02);
      this.ambientLight.intensity = 0.1;
      this.sunLight.intensity = 0.05;
      this.sunLight.color.setHex(0x223355);
      this.streetLights.forEach((l) => (l.intensity = 3.0));
    }
  }
}
