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
export type IntersectionPhase = 'NS_GREEN' | 'NS_YELLOW' | 'EW_GREEN' | 'EW_YELLOW' | 'ALL_RED';

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

export interface TrafficLightRef {
  id: string;
  axis: 'NS' | 'EW';
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
//   - 4 Semáforos nas 4 esquinas do cruzamento (Padrão DENATRAN / CONTRAN)
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
    this.buildTrafficLights(); // 4 Semáforos padrão DENATRAN/CONTRAN nas 4 esquinas do cruzamento
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
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.left = -90;
    this.sunLight.shadow.camera.right = 90;
    this.sunLight.shadow.camera.top = 90;
    this.sunLight.shadow.camera.bottom = -90;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.4);
    fillLight.position.set(-30, 20, -20);
    this.scene.add(fillLight);
  }

  // ──────────────────── GROUND ────────────────────
  private buildGround(): void {
    const grassGeom = new THREE.PlaneGeometry(220, 220);
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

    // 4. Linhas de Retenção (LRE - Padrão DENATRAN / CONTRAN) para veículos a 1,5m antes das faixas de pedestres
    // No Brasil (mão direita dominante / CTB):
    // - Pista Norte descendo para o Sul (+Z): faixa da direita em x = -3.5, linha de retenção em z = -12.5
    // - Pista Sul subindo para o Norte (-Z): faixa da direita em x = +3.5, linha de retenção em z = +12.5
    // - Pista Oeste indo para o Leste (+X): faixa da direita em z = +3.5, linha de retenção em x = -12.5
    // - Pista Leste indo para o Oeste (-X): faixa da direita em z = -3.5, linha de retenção em x = +12.5
    const stopLineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
    });
    const stopPositions = [
      { x: -3.5, z: -12.5, w: 6.6, d: 0.45 }, // Pista Norte descendo para o Sul (mão direita brasileira: x < 0)
      { x: 3.5, z: 12.5, w: 6.6, d: 0.45 },  // Pista Sul subindo para o Norte (mão direita brasileira: x > 0)
      { x: -12.5, z: 3.5, w: 0.45, d: 6.6 },  // Pista Oeste indo para o Leste (mão direita brasileira: z > 0)
      { x: 12.5, z: -3.5, w: 0.45, d: 6.6 }, // Pista Leste indo para o Oeste (mão direita brasileira: z < 0)
    ];
    for (const sl of stopPositions) {
      const g = new THREE.BoxGeometry(sl.w, 0.025, sl.d);
      const m = new THREE.Mesh(g, stopLineMat);
      m.position.set(sl.x, 0.035, sl.z);
      m.receiveShadow = true;
      this.scene.add(m);
    }

    // 5. Setas Indicativas de Sentido de Circulação (SIC 01 "Siga em Frente" — Padrão Oficial CONTRAN)
    // Pintadas no asfalto com malha sólida de polígono contínuo (THREE.ShapeGeometry),
    // proporcionando formato nítido, ponta triangular com aletas e haste uniforme sem emendas.
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const arrowPositions = [
      // Av. Central (Norte-Sul):
      { x: -3.5, z: -24, rotY: 0 },          // Pista Oeste: aproximação descendo para o Sul (+Z)
      { x: -3.5, z: 24, rotY: 0 },           // Pista Oeste: saída continuando para o Sul (+Z)
      { x: 3.5, z: 24, rotY: Math.PI },      // Pista Leste: aproximação subindo para o Norte (-Z)
      { x: 3.5, z: -24, rotY: Math.PI },     // Pista Leste: saída continuando para o Norte (-Z)
      // Rua Transversal (Leste-Oeste):
      { x: -24, z: 3.5, rotY: Math.PI / 2 },   // Pista Sul: aproximação indo para o Leste (+X)
      { x: 24, z: 3.5, rotY: Math.PI / 2 },    // Pista Sul: saída continuando para o Leste (+X)
      { x: 24, z: -3.5, rotY: -Math.PI / 2 },  // Pista Norte: aproximação indo para o Oeste (-X)
      { x: -24, z: -3.5, rotY: -Math.PI / 2 }, // Pista Norte: saída continuando para o Oeste (-X)
    ];
    for (const a of arrowPositions) {
      this.buildRoadDirectionalArrow(a.x, a.z, a.rotY, arrowMat);
    }

    // 6. Anel Viário Perimetral e Conexões com as Vias Centrais
    this.buildPerimeterRingRoad(asphaltMat, sidewalkMat, curbMat, lineMat, yellowLineMat, arrowMat);
  }

  /**
   * Constrói o Anel Viário Perimetral e suas vias de interligação às artérias centrais.
   * Cria uma malha rodoviária completa circundando os 4 quadrantes da cidade,
   * com entroncamentos em T e cruzamentos de canto no padrão regulamentar brasileiro (mão direita, CTB / CONTRAN).
   */
  private buildPerimeterRingRoad(
    asphaltMat: THREE.Material,
    sidewalkMat: THREE.Material,
    curbMat: THREE.Material,
    lineMat: THREE.Material,
    yellowLineMat: THREE.Material,
    arrowMat: THREE.Material,
  ): void {
    const roadW = 14; // Largura regulamentar de 14m (2 faixas de 7m)
    const ringCoord = 68; // Eixo das avenidas perimetrais a ±68m do centro
    const halfW = roadW / 2; // 7m
    const innerEdge = ringCoord - halfW; // 61m
    const swWidth = 5.0; // Calçadas largas com 5m de passeio

    // ─────────────────────────────────────────────────────────────
    // 1. ASFALTO: OS 4 RAMOS PERIMETRAIS (Norte, Sul, Leste, Oeste)
    // ─────────────────────────────────────────────────────────────
    const fullRingLen = ringCoord * 2 + roadW; // 68 * 2 + 14 = 150m

    // Ramo Sul (Avenida Perimetral Sul, z = +68)
    const southRoadGeom = new THREE.PlaneGeometry(fullRingLen, roadW);
    const southRoad = new THREE.Mesh(southRoadGeom, asphaltMat);
    southRoad.rotation.x = -Math.PI / 2;
    southRoad.position.set(0, 0.02, ringCoord);
    southRoad.receiveShadow = true;
    this.scene.add(southRoad);

    // Ramo Norte (Avenida Perimetral Norte, z = -68)
    const northRoadGeom = new THREE.PlaneGeometry(fullRingLen, roadW);
    const northRoad = new THREE.Mesh(northRoadGeom, asphaltMat);
    northRoad.rotation.x = -Math.PI / 2;
    northRoad.position.set(0, 0.02, -ringCoord);
    northRoad.receiveShadow = true;
    this.scene.add(northRoad);

    // Ramo Oeste (Avenida Perimetral Oeste, x = -68)
    const westRoadGeom = new THREE.PlaneGeometry(roadW, fullRingLen);
    const westRoad = new THREE.Mesh(westRoadGeom, asphaltMat);
    westRoad.rotation.x = -Math.PI / 2;
    westRoad.position.set(-ringCoord, 0.02, 0);
    westRoad.receiveShadow = true;
    this.scene.add(westRoad);

    // Ramo Leste (Avenida Perimetral Leste, x = +68)
    const eastRoadGeom = new THREE.PlaneGeometry(roadW, fullRingLen);
    const eastRoad = new THREE.Mesh(eastRoadGeom, asphaltMat);
    eastRoad.rotation.x = -Math.PI / 2;
    eastRoad.position.set(ringCoord, 0.02, 0);
    eastRoad.receiveShadow = true;
    this.scene.add(eastRoad);

    // ─────────────────────────────────────────────────────────────
    // 2. ASFALTO: VIAS DE INTERLIGAÇÃO (EXTENSÕES DAS ARTÉRIAS CENTRAIS)
    // ─────────────────────────────────────────────────────────────
    // Conector Sul: Liga o fim da Avenida Central (z = 50) à Perimetral Sul (z = 61)
    const southConnLen = innerEdge - 50; // 11m
    const southConnGeom = new THREE.PlaneGeometry(roadW, southConnLen);
    const southConn = new THREE.Mesh(southConnGeom, asphaltMat);
    southConn.rotation.x = -Math.PI / 2;
    southConn.position.set(0, 0.02, 50 + southConnLen / 2);
    southConn.receiveShadow = true;
    this.scene.add(southConn);

    // Conector Leste: Liga o fim da Rua Transversal (x = 50) à Perimetral Leste (x = 61)
    const eastConnLen = innerEdge - 50; // 11m
    const eastConnGeom = new THREE.PlaneGeometry(eastConnLen, roadW);
    const eastConn = new THREE.Mesh(eastConnGeom, asphaltMat);
    eastConn.rotation.x = -Math.PI / 2;
    eastConn.position.set(50 + eastConnLen / 2, 0.02, 0);
    eastConn.receiveShadow = true;
    this.scene.add(eastConn);

    // Conector Oeste: Liga o fim da Rua Transversal (x = -50) à Perimetral Oeste (x = -61)
    const westConnLen = innerEdge - 50; // 11m
    const westConnGeom = new THREE.PlaneGeometry(westConnLen, roadW);
    const westConn = new THREE.Mesh(westConnGeom, asphaltMat);
    westConn.rotation.x = -Math.PI / 2;
    westConn.position.set(-(50 + westConnLen / 2), 0.02, 0);
    westConn.receiveShadow = true;
    this.scene.add(westConn);

    // Conector Norte: Alameda de conexão e serviço nos fundos do Super Market
    const northConnLen = innerEdge - 57; // 4m
    const northConnGeom = new THREE.PlaneGeometry(roadW, northConnLen);
    const northConn = new THREE.Mesh(northConnGeom, asphaltMat);
    northConn.rotation.x = -Math.PI / 2;
    northConn.position.set(0, 0.02, -(57 + northConnLen / 2));
    northConn.receiveShadow = true;
    this.scene.add(northConn);

    // Alamedas de Contorno e Acesso do Super Market (ligação direta da Av. Central à Perimetral Norte)
    // Alameda Noroeste (x = -18.5, z de -38 a -61)
    const bypassLen = 23; // 61 - 38 = 23m
    const bypassWest = new THREE.Mesh(new THREE.PlaneGeometry(6, bypassLen), asphaltMat);
    bypassWest.rotation.x = -Math.PI / 2;
    bypassWest.position.set(-18.5, 0.02, -(38 + bypassLen / 2));
    bypassWest.receiveShadow = true;
    this.scene.add(bypassWest);

    // Alameda Nordeste (x = +18.5, z de -38 a -61)
    const bypassEast = new THREE.Mesh(new THREE.PlaneGeometry(6, bypassLen), asphaltMat);
    bypassEast.rotation.x = -Math.PI / 2;
    bypassEast.position.set(18.5, 0.02, -(38 + bypassLen / 2));
    bypassEast.receiveShadow = true;
    this.scene.add(bypassEast);

    // Pátio de manobra e ligação transversal nos fundos do mercado (z = -59, x de -21.5 a +21.5)
    const rearPlaza = new THREE.Mesh(new THREE.PlaneGeometry(43, 4), asphaltMat);
    rearPlaza.rotation.x = -Math.PI / 2;
    rearPlaza.position.set(0, 0.02, -59);
    rearPlaza.receiveShadow = true;
    this.scene.add(rearPlaza);

    // Calçadas de interligação dos Conectores (Sul, Leste, Oeste e Alamedas Norte)
    const addConnectorSidewalk = (cx: number, cz: number, w: number, d: number) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), sidewalkMat);
      sw.position.set(cx, 0.11, cz);
      sw.receiveShadow = true;
      this.scene.add(sw);
    };

    // Calçadas do Conector Sul (z = 50 a 61)
    addConnectorSidewalk(-9.5, 55.5, 5.0, southConnLen);
    addConnectorSidewalk(9.5, 55.5, 5.0, southConnLen);

    // Calçadas do Conector Leste (x = 50 a 61)
    addConnectorSidewalk(55.5, -9.5, eastConnLen, 5.0);
    addConnectorSidewalk(55.5, 9.5, eastConnLen, 5.0);

    // Calçadas do Conector Oeste (x = -61 a -50)
    addConnectorSidewalk(-55.5, -9.5, westConnLen, 5.0);
    addConnectorSidewalk(-55.5, 9.5, westConnLen, 5.0);

    // Calçadas das Alamedas do Super Market
    addConnectorSidewalk(-22.5, -(38 + bypassLen / 2), 2.5, bypassLen);
    addConnectorSidewalk(22.5, -(38 + bypassLen / 2), 2.5, bypassLen);

    // Faixas de travessia zebradas visuais nos 4 entroncamentos com o Anel Viário
    const addVisualCrosswalk = (cx: number, cz: number, isHoriz: boolean) => {
      const stripeW = 0.40;
      const stripeL = 3.60;
      const spacing = 0.80;
      const count = 15;
      const start = -((count - 1) * spacing) / 2;
      for (let i = 0; i < count; i++) {
        const off = start + i * spacing;
        const g = new THREE.BoxGeometry(isHoriz ? stripeL : stripeW, 0.025, isHoriz ? stripeW : stripeL);
        const m = new THREE.Mesh(g, lineMat);
        m.position.set(isHoriz ? cx : cx + off, 0.035, isHoriz ? cz + off : cz);
        m.receiveShadow = true;
        this.scene.add(m);
      }
    };

    addVisualCrosswalk(0, 60.5, false);  // Entroncamento Sul
    addVisualCrosswalk(60.5, 0, true);   // Entroncamento Leste
    addVisualCrosswalk(-60.5, 0, true);  // Entroncamento Oeste
    addVisualCrosswalk(0, -60.5, false); // Entroncamento Norte

    // ─────────────────────────────────────────────────────────────
    // 3. SINALIZAÇÃO HORIZONTAL: LINHAS AMARELAS CENTRAIS DUPLAS
    // ─────────────────────────────────────────────────────────────
    const addDashedYellowSegment = (
      x1: number, z1: number,
      x2: number, z2: number,
      isHorizontal: boolean
    ) => {
      const step = 4.0;
      const dashLen = 2.4;
      const dashWid = 0.24;
      if (isHorizontal) {
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        for (let x = startX + 2; x <= endX - 2; x += step) {
          const sg = new THREE.BoxGeometry(dashLen, 0.02, dashWid);
          const sm = new THREE.Mesh(sg, yellowLineMat);
          sm.position.set(x, 0.03, z1);
          this.scene.add(sm);
        }
      } else {
        const startZ = Math.min(z1, z2);
        const endZ = Math.max(z1, z2);
        for (let z = startZ + 2; z <= endZ - 2; z += step) {
          const sg = new THREE.BoxGeometry(dashWid, 0.02, dashLen);
          const sm = new THREE.Mesh(sg, yellowLineMat);
          sm.position.set(x1, 0.03, z);
          this.scene.add(sm);
        }
      }
    };

    // Ramos Sul e Norte (entre cantos e entroncamento central)
    addDashedYellowSegment(-61, ringCoord, -8, ringCoord, true);
    addDashedYellowSegment(8, ringCoord, 61, ringCoord, true);
    addDashedYellowSegment(-61, -ringCoord, -8, -ringCoord, true);
    addDashedYellowSegment(8, -ringCoord, 61, -ringCoord, true);

    // Ramos Oeste e Leste (entre cantos e entroncamento central)
    addDashedYellowSegment(-ringCoord, -61, -ringCoord, -8, false);
    addDashedYellowSegment(-ringCoord, 8, -ringCoord, 61, false);
    addDashedYellowSegment(ringCoord, -61, ringCoord, -8, false);
    addDashedYellowSegment(ringCoord, 8, ringCoord, 61, false);

    // Conectores das artérias centrais
    addDashedYellowSegment(0, 50, 0, 61, false);  // Sul
    addDashedYellowSegment(50, 0, 61, 0, true);   // Leste
    addDashedYellowSegment(-61, 0, -50, 0, true); // Oeste

    // ─────────────────────────────────────────────────────────────
    // 4. LINHAS BRANCAS CONTÍNUAS LATERAIS DE BORDO
    // ─────────────────────────────────────────────────────────────
    const addWhiteEdgeLine = (
      cx: number, cz: number,
      len: number,
      isHorizontal: boolean
    ) => {
      const lg = new THREE.PlaneGeometry(isHorizontal ? len : 0.18, isHorizontal ? 0.18 : len);
      const lm = new THREE.Mesh(lg, lineMat);
      lm.rotation.x = -Math.PI / 2;
      lm.position.set(cx, 0.03, cz);
      this.scene.add(lm);
    };

    const edgeOff = halfW - 0.4; // 6.6m
    addWhiteEdgeLine(0, ringCoord + edgeOff, fullRingLen, true);
    addWhiteEdgeLine(0, -ringCoord - edgeOff, fullRingLen, true);
    addWhiteEdgeLine(-ringCoord - edgeOff, 0, fullRingLen, false);
    addWhiteEdgeLine(ringCoord + edgeOff, 0, fullRingLen, false);

    // ─────────────────────────────────────────────────────────────
    // 5. CALÇADAS EXTERNAS E MEIO-FIO (PASSEIO PÚBLICO)
    // ─────────────────────────────────────────────────────────────
    const addSidewalkWithCurb = (
      cx: number, cz: number,
      lenX: number, lenZ: number,
      curbX: number, curbZ: number,
      curbLenX: number, curbLenZ: number
    ) => {
      const swGeom = new THREE.BoxGeometry(lenX, 0.22, lenZ);
      const sw = new THREE.Mesh(swGeom, sidewalkMat);
      sw.position.set(cx, 0.11, cz);
      sw.receiveShadow = true;
      this.scene.add(sw);

      const curbGeom = new THREE.BoxGeometry(curbLenX, 0.26, curbLenZ);
      const curb = new THREE.Mesh(curbGeom, curbMat);
      curb.position.set(curbX, 0.13, curbZ);
      this.scene.add(curb);
    };

    const outerSwDist = ringCoord + halfW + swWidth / 2; // 77.5m
    const outerCurbDist = ringCoord + halfW + 0.14; // 75.14m

    // Calçadas Externas Perimetrais
    addSidewalkWithCurb(0, outerSwDist, fullRingLen + swWidth * 2, swWidth, 0, outerCurbDist, fullRingLen + swWidth * 2, 0.28);
    addSidewalkWithCurb(0, -outerSwDist, fullRingLen + swWidth * 2, swWidth, 0, -outerCurbDist, fullRingLen + swWidth * 2, 0.28);
    addSidewalkWithCurb(-outerSwDist, 0, swWidth, fullRingLen + swWidth * 2, -outerCurbDist, 0, 0.28, fullRingLen + swWidth * 2);
    addSidewalkWithCurb(outerSwDist, 0, swWidth, fullRingLen + swWidth * 2, outerCurbDist, 0, 0.28, fullRingLen + swWidth * 2);

    // Calçadas internas nos 4 quarteirões
    addSidewalkWithCurb(-35.5, innerEdge - swWidth / 2, 51, swWidth, -35.5, innerEdge - 0.14, 51, 0.28);
    addSidewalkWithCurb(-innerEdge + swWidth / 2, 35.5, swWidth, 51, -innerEdge + 0.14, 35.5, 0.28, 51);

    addSidewalkWithCurb(35.5, innerEdge - swWidth / 2, 51, swWidth, 35.5, innerEdge - 0.14, 51, 0.28);
    addSidewalkWithCurb(innerEdge - swWidth / 2, 35.5, swWidth, 51, innerEdge - 0.14, 35.5, 0.28, 51);

    addSidewalkWithCurb(-35.5, -innerEdge + swWidth / 2, 51, swWidth, -35.5, -innerEdge + 0.14, 51, 0.28);
    addSidewalkWithCurb(-innerEdge + swWidth / 2, -35.5, swWidth, 51, -innerEdge + 0.14, -35.5, 0.28, 51);

    addSidewalkWithCurb(35.5, -innerEdge + swWidth / 2, 51, swWidth, 35.5, -innerEdge + 0.14, 51, 0.28);
    addSidewalkWithCurb(innerEdge - swWidth / 2, -35.5, swWidth, 51, innerEdge - 0.14, -35.5, 0.28, 51);

    // ─────────────────────────────────────────────────────────────
    // 6. SETAS DE CIRCULAÇÃO NOVO ANEL VIÁRIO (MÃO DIREITA — CTB)
    // ─────────────────────────────────────────────────────────────
    const ringArrows = [
      // Perimetral Sul (z = +68, mão direita CTB):
      // - Pista externa (z = +71.5): fluxo regulamentar para o LESTE (+X)
      { x: -35, z: ringCoord + 3.5, rotY: Math.PI / 2 },
      { x: 35, z: ringCoord + 3.5, rotY: Math.PI / 2 },
      // - Pista interna (z = +64.5): fluxo regulamentar para o OESTE (-X)
      { x: -35, z: ringCoord - 3.5, rotY: -Math.PI / 2 },
      { x: 35, z: ringCoord - 3.5, rotY: -Math.PI / 2 },

      // Perimetral Norte (z = -68, mão direita CTB):
      // - Pista externa (z = -71.5): fluxo regulamentar para o OESTE (-X)
      { x: -35, z: -ringCoord - 3.5, rotY: -Math.PI / 2 },
      { x: 35, z: -ringCoord - 3.5, rotY: -Math.PI / 2 },
      // - Pista interna (z = -64.5): fluxo regulamentar para o LESTE (+X)
      { x: -35, z: -ringCoord + 3.5, rotY: Math.PI / 2 },
      { x: 35, z: -ringCoord + 3.5, rotY: Math.PI / 2 },

      // Perimetral Oeste (x = -68, mão direita CTB):
      // - Pista externa (x = -71.5): fluxo regulamentar para o SUL (+Z)
      { x: -ringCoord - 3.5, z: -35, rotY: 0 },
      { x: -ringCoord - 3.5, z: 35, rotY: 0 },
      // - Pista interna (x = -64.5): fluxo regulamentar para o NORTE (-Z)
      { x: -ringCoord + 3.5, z: -35, rotY: Math.PI },
      { x: -ringCoord + 3.5, z: 35, rotY: Math.PI },

      // Perimetral Leste (x = +68, mão direita CTB):
      // - Pista externa (x = +71.5): fluxo regulamentar para o NORTE (-Z)
      { x: ringCoord + 3.5, z: -35, rotY: Math.PI },
      { x: ringCoord + 3.5, z: 35, rotY: Math.PI },
      // - Pista interna (x = +64.5): fluxo regulamentar para o SUL (+Z)
      { x: ringCoord - 3.5, z: -35, rotY: 0 },
      { x: ringCoord - 3.5, z: 35, rotY: 0 },

      // Conectores das Artérias Centrais (mão direita CTB):
      { x: 3.5, z: 55, rotY: Math.PI },         // Conector Sul: subindo para o Norte (-Z)
      { x: -3.5, z: 55, rotY: 0 },              // Conector Sul: descendo para o Sul (+Z)
      { x: 55, z: 3.5, rotY: Math.PI / 2 },     // Conector Leste: saindo para o Leste (+X)
      { x: 55, z: -3.5, rotY: -Math.PI / 2 },   // Conector Leste: retornando para o Oeste (-X)
      { x: -55, z: 3.5, rotY: Math.PI / 2 },    // Conector Oeste: retornando para o Leste (+X)
      { x: -55, z: -3.5, rotY: -Math.PI / 2 },  // Conector Oeste: saindo para o Oeste (-X)

      // Alamedas de Contorno do Super Market:
      { x: -18.5, z: -48, rotY: Math.PI },      // Alameda Noroeste: sentido Perimetral Norte (-Z)
      { x: 18.5, z: -48, rotY: 0 },             // Alameda Nordeste: sentido Centro (+Z)
    ];

    for (const a of ringArrows) {
      this.buildRoadDirectionalArrow(a.x, a.z, a.rotY, arrowMat);
    }

    // ─────────────────────────────────────────────────────────────
    // 7. PLACAS DE IDENTIFICAÇÃO DAS NOVAS AVENIDAS PERIMETRAIS
    // ─────────────────────────────────────────────────────────────
    this.buildStreetSign(12, ringCoord - 8.5, 'AV. PERIMETRAL SUL', 'Anel Viário • Setor Sul', 0);
    this.buildStreetSign(-12, -ringCoord + 8.5, 'AV. PERIMETRAL NORTE', 'Anel Viário • Setor Norte', 0);
    this.buildStreetSign(-ringCoord + 8.5, 12, 'AV. PERIMETRAL OESTE', 'Anel Viário • Setor Oeste', Math.PI / 2);
    this.buildStreetSign(ringCoord - 8.5, -12, 'AV. PERIMETRAL LESTE', 'Anel Viário • Setor Leste', Math.PI / 2);
  }

  /**
   * Constrói seta indicativa de sentido de circulação (SIC 01 - padrão CONTRAN) no asfalto.
   * Utiliza THREE.ShapeGeometry sólido com proporções regulamentares de trânsito:
   * ponta triangular nítida com aletas e haste retangular uniforme contínua.
   */
  private buildRoadDirectionalArrow(x: number, z: number, rotY: number, mat: THREE.Material): void {
    const shape = new THREE.Shape();
    // No plano 2D com rotação x = -Math.PI / 2:
    // -y se torna +z no mundo (frente local / Sul)
    // Coordenadas traçadas no sentido anti-horário:
    shape.moveTo(0, -1.8);       // Vértice pontiagudo frontal da seta
    shape.lineTo(0.60, -0.35);   // Aleta da asa direita
    shape.lineTo(0.20, -0.50);   // Rebaixo interno direito na haste
    shape.lineTo(0.20, 1.8);     // Canto base direito da haste
    shape.lineTo(-0.20, 1.8);    // Canto base esquerdo da haste
    shape.lineTo(-0.20, -0.50);  // Rebaixo interno esquerdo na haste
    shape.lineTo(-0.60, -0.35);  // Aleta da asa esquerda
    shape.closePath();

    const geom = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;

    const group = new THREE.Group();
    group.position.set(x, 0.035, z);
    group.rotation.y = rotY;
    group.add(mesh);

    this.scene.add(group);
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

    // Linha amarela central dupla tracejada (não entra na área de cruzamento nem nas faixas de pedestre)
    const halfLen = length / 2;
    const skipZone = 13.5; // Deixa o cruzamento e a zona de travessia (até 13m) livres de linhas amarelas
    for (let t = -halfLen + 2; t < halfLen; t += 4) {
      if (Math.abs(t) < skipZone) continue;
      const dashLen = 2.4;
      const dashWid = 0.24;
      const sg = new THREE.BoxGeometry(
        isHorizontal ? dashLen : dashWid,
        0.02,
        isHorizontal ? dashWid : dashLen
      );
      const s = new THREE.Mesh(sg, yellowLineMat);
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

    // Calçadas de concreto nos lados da rua (interrompidas no cruzamento entre -7 e +7)
    const swW = 6;
    const halfIntersection = width / 2; // 7m
    const segLen = length / 2 - halfIntersection; // 50 - 7 = 43m
    const segCenter = halfIntersection + segLen / 2; // 7 + 21.5 = 28.5m

    for (const sign of [-1, 1]) {
      const swOffset = sign * (width / 2 + swW / 2);
      const curbOffset = sign * (width / 2);

      // Cada calçada é dividida em dois segmentos (lado positivo e lado negativo da via),
      // deixando o cruzamento e as faixas de pedestres 100% livres e desobstruídos
      for (const dir of [-1, 1]) {
        const t = dir * segCenter;

        // Calçada de concreto
        const swGeom = new THREE.BoxGeometry(
          isHorizontal ? segLen : swW,
          0.22,
          isHorizontal ? swW : segLen
        );
        const sw = new THREE.Mesh(swGeom, sidewalkMat);
        sw.position.set(
          isHorizontal ? cx + t : cx + swOffset,
          0.11,
          isHorizontal ? cz + swOffset : cz + t
        );
        sw.receiveShadow = true;
        this.scene.add(sw);

        // Meio-fio de granito
        const curbGeom = new THREE.BoxGeometry(
          isHorizontal ? segLen : 0.28,
          0.26,
          isHorizontal ? 0.28 : segLen
        );
        const curb = new THREE.Mesh(curbGeom, curbMat);
        curb.position.set(
          isHorizontal ? cx + t : cx + curbOffset,
          0.13,
          isHorizontal ? cz + curbOffset : cz + t
        );
        this.scene.add(curb);
      }
    }
  }

  // ──────────────────── CROSSWALKS (FAIXAS DE PEDESTRES — PADRÃO DENATRAN/CONTRAN) ────────────────────
  private buildCrosswalks(): void {
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    // Especificações CONTRAN / DENATRAN (Manual de Sinalização Horizontal - Vol. IV):
    // - Faixa Zebrada: listras longitudinais paralelas ao fluxo dos veículos.
    // - Largura da listra: 0,40m.
    // - Espaçamento entre listras: 0,40m (relação 1:1).
    // - Comprimento da travessia (extensão longitudinal): 4,00m.
    // - Para pista de 14m de largura, 17 listras cobrem de -6,60m a +6,60m (folga de 0,40m de sarjeta).
    const stripeWidth = 0.40;
    const stripeLength = 4.00;
    const stripeSpacing = 0.80; // 0,40m de listra + 0,40m de vão livre
    const numStripes = 17;
    const startOffset = -((numStripes - 1) * stripeSpacing) / 2; // -6,40m a +6,40m

    // Centro das faixas posicionado em ±9,0m (estendendo-se de ±7,0m até ±11,0m em relação ao centro)
    const positions = [
      { x: 0, z: -9.0, isHorizontal: false, name: 'Faixa Norte' },
      { x: 0, z: 9.0, isHorizontal: false, name: 'Faixa Sul' },
      { x: -9.0, z: 0, isHorizontal: true, name: 'Faixa Oeste' },
      { x: 9.0, z: 0, isHorizontal: true, name: 'Faixa Leste' },
    ];

    for (const pos of positions) {
      for (let i = 0; i < numStripes; i++) {
        const offset = startOffset + i * stripeSpacing;

        // Padrão DENATRAN: listras SEMPRE paralelas ao fluxo veicular:
        // - Via horizontal (Leste/Oeste): comprimento 4.00m no eixo X, largura 0.40m no eixo Z.
        // - Via vertical (Norte/Sul): comprimento 4.00m no eixo Z, largura 0.40m no eixo X.
        // Utilizando BoxGeometry com altura de 2.5cm para garantir renderização volumétrica nítida sobre o asfalto
        const sg = new THREE.BoxGeometry(
          pos.isHorizontal ? stripeLength : stripeWidth,
          0.025,
          pos.isHorizontal ? stripeWidth : stripeLength
        );
        const s = new THREE.Mesh(sg, crossMat);
        s.position.set(
          pos.isHorizontal ? pos.x : pos.x + offset,
          0.035,
          pos.isHorizontal ? pos.z + offset : pos.z
        );
        s.receiveShadow = true;
        this.scene.add(s);
      }

      this.interactiveObjects.push({
        id: `crosswalk-${pos.name.toLowerCase().replace(' ', '-')}`,
        name: `Faixa de Pedestres (${pos.name})`,
        type: 'crosswalk',
        position: new THREE.Vector3(pos.x, 0, pos.z),
        observationRadius: 5.5,
        description: 'Faixa de travessia zebrada oficial (padrão DENATRAN: listras de 0,40m x 4,00m paralelas ao tráfego).',
        semanticRule: 'Pedestres têm prioridade absoluta quando o semáforo estiver vermelho para veículos.',
        emotionalWeight: 0.6,
      });
    }
  }

  // ──────────────────── SINALIZAÇÃO SEMAFÓRICA DO CRUZAMENTO (PADRÃO DENATRAN / CONTRAN) ────────────────────
  private buildTrafficLights(): void {
    // Conforme o Manual Brasileiro de Sinalização de Trânsito (Volume V - Sinalização Semafórica, CONTRAN/DENATRAN):
    // Em um cruzamento ortogonal de vias de mão dupla, todas as 4 aproximações devem possuir sinalização
    // semafórica visível antes da Linha de Retenção (LRE), posicionada à direita da via com braço projetado
    // sobre a pista de rolamento (altura de 5,20m) e foco para pedestres integrado na coluna vertical (altura de 2,40m).
    //
    // As 4 esquinas recebem 1 conjunto semafórico completo cada:
    // 1. Esquina Sudeste (SE: 8.5, 8.5) -> Aproximação Sul da Av. Central (sentido Norte, rotY = 0, eixo NS)
    // 2. Esquina Noroeste (NW: -8.5, -8.5) -> Aproximação Norte da Av. Central (sentido Sul, rotY = Math.PI, eixo NS)
    // 3. Esquina Sudoeste (SW: -8.5, 8.5) -> Aproximação Oeste da Rua Transversal (sentido Leste, rotY = -Math.PI / 2, eixo EW)
    // 4. Esquina Nordeste (NE: 8.5, -8.5) -> Aproximação Leste da Rua Transversal (sentido Oeste, rotY = Math.PI / 2, eixo EW)

    const configs = [
      {
        id: 'tl-sul',
        x: 8.5,
        z: 8.5,
        rotY: 0,
        axis: 'NS' as const,
        name: 'Semáforo Sul — Av. Central',
        desc: 'Semáforo veicular padrão DENATRAN regulando a aproximação Sul da Avenida Central (sentido Norte) e travessia de pedestres.',
        colliderName: 'Poste Semáforo Sul (Av. Central)',
      },
      {
        id: 'tl-norte',
        x: -8.5,
        z: -8.5,
        rotY: Math.PI,
        axis: 'NS' as const,
        name: 'Semáforo Norte — Av. Central',
        desc: 'Semáforo veicular padrão DENATRAN regulando a aproximação Norte da Avenida Central (sentido Sul) e travessia de pedestres.',
        colliderName: 'Poste Semáforo Norte (Av. Central)',
      },
      {
        id: 'tl-oeste',
        x: -8.5,
        z: 8.5,
        rotY: -Math.PI / 2,
        axis: 'EW' as const,
        name: 'Semáforo Oeste — Rua Transversal',
        desc: 'Semáforo veicular padrão DENATRAN regulando a aproximação Oeste da Rua Transversal (sentido Leste) e travessia de pedestres.',
        colliderName: 'Poste Semáforo Oeste (Rua Transversal)',
      },
      {
        id: 'tl-leste',
        x: 8.5,
        z: -8.5,
        rotY: Math.PI / 2,
        axis: 'EW' as const,
        name: 'Semáforo Leste — Rua Transversal',
        desc: 'Semáforo veicular padrão DENATRAN regulando a aproximação Leste da Rua Transversal (sentido Oeste) e travessia de pedestres.',
        colliderName: 'Poste Semáforo Leste (Rua Transversal)',
      },
    ];

    for (const cfg of configs) {
      const ref = this.buildSingleTrafficLight(
        cfg.x,
        cfg.z,
        cfg.rotY,
        cfg.id,
        cfg.name,
        cfg.desc,
        cfg.axis
      );
      this.trafficLights.push(ref);

      // Colisor físico do poste cilíndrico na calçada
      this.colliders.push({
        type: 'cylinder',
        cx: cfg.x,
        cz: cfg.z,
        radius: 0.45,
        name: cfg.colliderName,
      });
    }

    // Inicializa na Fase 1 do DENATRAN (Av. Central aberta, Transversal fechada)
    this.setTrafficPhase('NS_GREEN');
  }

  private buildSingleTrafficLight(
    x: number,
    z: number,
    rotY: number,
    id: string,
    name: string,
    desc: string,
    axis: 'NS' | 'EW'
  ): TrafficLightRef {
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

    // Posicionamento e rotação para orientar braço e lentes conforme a via
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.scene.add(group);

    this.interactiveObjects.push({
      id,
      name,
      type: 'traffic_light',
      position: new THREE.Vector3(x, 4.5, z),
      observationRadius: 10,
      description: desc,
      semanticRule: 'Vermelho: pare antes da faixa. Verde: siga com cautela. Pedestres atravessam na fase autorizada.',
      emotionalWeight: 0.9,
    });

    return { id, axis, redMat, yellowMat, greenMat, pedRedMat, pedGreenMat, light, state: 'red' };
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

    // Placas de identificação das ruas posicionadas exclusivamente NAS CALÇADAS (fora do asfalto)
    this.buildStreetSign(8.8, -14.5, 'AVENIDA CENTRAL', 'Sentido Norte • Bairro Centro', 0);
    this.buildStreetSign(8.8, 14.5, 'AVENIDA CENTRAL', 'Sentido Sul • Bairro Centro', 0);
    this.buildStreetSign(-14.5, 8.8, 'RUA TRANSVERSAL', 'Sentido Oeste • Bairro Centro', Math.PI / 2);
    this.buildStreetSign(14.5, -8.8, 'RUA TRANSVERSAL', 'Sentido Leste • Bairro Centro', Math.PI / 2);

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

  private buildStreetSign(x: number, z: number, mainText: string, subText: string, ry: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0d47a1'; // Azul oficial de placa toponímica urbana
    ctx.roundRect(0, 0, 600, 180, 20);
    ctx.fill();

    // Borda interna branca
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.roundRect(8, 8, 584, 164, 14);
    ctx.stroke();

    // Faixa divisória fina
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 115);
    ctx.lineTo(570, 115);
    ctx.stroke();

    // Nome do Logradouro
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mainText, 300, 65);

    // Subtexto (Sentido / Bairro / CEP)
    ctx.fillStyle = '#ffecb3';
    ctx.font = '500 24px sans-serif';
    ctx.fillText(subText, 300, 145);

    const tex = new THREE.CanvasTexture(canvas);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.78, 0.08),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
    );
    sign.position.set(x, 3.1, z);
    sign.rotation.y = ry;
    sign.castShadow = true;
    this.scene.add(sign);

    // Poste de sustentação na calçada
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x222629, metalness: 0.8, roughness: 0.3 })
    );
    pole.position.set(x, 1.55, z);
    pole.castShadow = true;
    this.scene.add(pole);

    this.colliders.push({
      type: 'cylinder',
      cx: x,
      cz: z,
      radius: 0.35,
      name: `Poste de Sinalização (${mainText})`,
    });

    this.interactiveObjects.push({
      id: `sign-street-${x.toFixed(0)}-${z.toFixed(0)}`,
      name: `Placa de Logradouro: ${mainText}`,
      type: 'sign',
      position: new THREE.Vector3(x, 2.5, z),
      observationRadius: 4.5,
      description: `Placa toponímica oficial na calçada identificando ${mainText} (${subText}).`,
      semanticRule: 'Sinalização urbana de orientação toponímica conforme padrão de vias públicas.',
      emotionalWeight: 0.3,
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

  // ──────────────────── TREES (INSTANCED MESH) ────────────────────
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
      // Ao longo das calçadas do Anel Viário Perimetral
      [-48, 77.5], [48, 77.5],
      [-48, -77.5], [48, -77.5],
      [-77.5, -48], [-77.5, 48],
      [77.5, -48], [77.5, 48],
    ] as [number, number][];

    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.32, 4.5, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.95 });
    const trunkInstances = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
    trunkInstances.castShadow = true;
    trunkInstances.receiveShadow = true;

    const foliageGeo = new THREE.DodecahedronGeometry(1.8, 1);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 });
    const foliageInstances = new THREE.InstancedMesh(foliageGeo, foliageMat, positions.length);
    foliageInstances.castShadow = true;
    foliageInstances.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      const [tx, tz] = positions[i];

      // Tronco instanciado
      dummy.position.set(tx, 2.25, tz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trunkInstances.setMatrixAt(i, dummy.matrix);

      // Copa instanciada
      dummy.position.set(tx, 5.0, tz);
      dummy.rotation.set(0, (i * Math.PI) / 4, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      foliageInstances.setMatrixAt(i, dummy.matrix);

      // Collider circular de cada tronco de árvore
      this.colliders.push({
        type: 'cylinder',
        cx: tx,
        cz: tz,
        radius: 0.6,
        name: 'Tronco de Árvore',
      });
    }

    trunkInstances.instanceMatrix.needsUpdate = true;
    foliageInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(trunkInstances);
    this.scene.add(foliageInstances);
  }

  // ──────────────────── STREET LAMPS (INSTANCED MESH) ────────────────────
  private buildStreetLamps(): void {
    const positions = [
      // Próximos às calçadas
      [-9.5, -18], [-9.5, 18], [9.5, -18], [9.5, 18],
      [-18, -9.5], [18, -9.5], [-18, 9.5], [18, 9.5],
      // Ao longo das calçadas do Anel Viário Perimetral
      [-40, 75.5], [40, 75.5],
      [-40, -75.5], [40, -75.5],
      [-75.5, -40], [-75.5, 40],
      [75.5, -40], [75.5, 40],
    ] as [number, number][];

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2e31, metalness: 0.8, roughness: 0.3 });
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.13, 5.8, 8);
    const poleInstances = new THREE.InstancedMesh(poleGeo, poleMat, positions.length);
    poleInstances.castShadow = true;

    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6);
    const armInstances = new THREE.InstancedMesh(armGeo, poleMat, positions.length);

    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: 0xffe680, emissiveIntensity: 1.4 });

    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i++) {
      const [lx, lz] = positions[i];
      const dir = lx < 0 ? 1 : -1;

      // Mastro do poste instanciado
      dummy.position.set(lx, 2.9, lz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      poleInstances.setMatrixAt(i, dummy.matrix);

      // Haste horizontal instanciada
      dummy.position.set(lx + 0.8 * dir, 5.7, lz);
      dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.updateMatrix();
      armInstances.setMatrixAt(i, dummy.matrix);

      // Lâmpada e ponto de luz
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), bulbMat);
      bulb.position.set(lx + 1.6 * dir, 5.5, lz);
      this.scene.add(bulb);

      const pLight = new THREE.PointLight(0xffecc4, 1.4, 20);
      pLight.position.set(lx + 1.6 * dir, 5.3, lz);
      // castShadow desativado para postes: apenas a luz solar projeta sombras direcionais,
      // evitando exceder o limite de unidades de textura (MAX_TEXTURE_IMAGE_UNITS = 16) no WebGL.
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

    poleInstances.instanceMatrix.needsUpdate = true;
    armInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(poleInstances);
    this.scene.add(armInstances);
  }

  // ──────────────────── VEHICLES (ESTACIONADOS EM VAGAS) ────────────────────
  private buildVehicles(): void {
    // Carro estacionado na vaga de compras do Super Market (fora da pista de rolamento)
    this.buildCar(8, -36, 0xeeeeee, 0);
  }

  public buildCar(x: number, z: number, color: number, ry: number = 0): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.82 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x16222f,
      transparent: true,
      opacity: 0.62,
      roughness: 0.05,
      metalness: 0.90,
    });
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.92, roughness: 0.18 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.98, roughness: 0.06 });
    const blackTrimMat = new THREE.MeshStandardMaterial({ color: 0x161618, roughness: 0.78, metalness: 0.15 });
    const interiorMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.85 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.32, metalness: 0.40 });
    const discMat = new THREE.MeshStandardMaterial({ color: 0x8e8e93, metalness: 0.92, roughness: 0.24 });
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfff9e6,
      emissive: 0xffea88,
      emissiveIntensity: 1.2,
      roughness: 0.15,
    });
    const brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });

    const g = new THREE.Group();
    const carLength = 4.45;
    const carWidth = 1.96;
    const bodyBaseY = 0.40;

    // Chassi inferior
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(carWidth - 0.08, 0.32, carLength - 0.15), bodyMat);
    chassis.position.y = bodyBaseY;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    g.add(chassis);

    // Saias laterais
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, carLength * 0.55), blackTrimMat);
      skirt.position.set(side * (carWidth / 2 - 0.02), bodyBaseY - 0.12, 0);
      g.add(skirt);
    }

    // Capô inclinado aerodinâmico
    const hoodLength = 1.35;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(carWidth - 0.14, 0.12, hoodLength), bodyMat);
    hood.position.set(0, bodyBaseY + 0.18, carLength / 2 - hoodLength / 2 - 0.12);
    hood.rotation.x = -0.06;
    hood.castShadow = true;
    g.add(hood);

    // Frente & Para-choque
    const frontZ = carLength / 2 + 0.06;
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(carWidth, 0.28, 0.26), bodyMat);
    frontBumper.position.set(0, bodyBaseY - 0.02, frontZ - 0.10);
    g.add(frontBumper);

    const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(carWidth + 0.04, 0.04, 0.22), blackTrimMat);
    frontSplitter.position.set(0, bodyBaseY - 0.16, frontZ - 0.06);
    g.add(frontSplitter);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.20, 0.06), blackTrimMat);
    grille.position.set(0, bodyBaseY + 0.12, frontZ);
    g.add(grille);

    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), chromeMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, bodyBaseY + 0.12, frontZ + 0.035);
    g.add(emblem);

    // Faróis dianteiros com projetores e DRL
    for (const side of [-1, 1]) {
      const headlightCover = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.15, 0.05), headlightMat);
      headlightCover.position.set(side * 0.72, bodyBaseY + 0.14, frontZ + 0.03);
      g.add(headlightCover);
    }

    // Cabine, Teto e Vidros
    const cabinLength = carLength * 0.58;
    const cabinWidth = carWidth * 0.86;
    const cabinHeight = 0.60;
    const cabinCenterY = bodyBaseY + 0.44;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth * 0.94, 0.06, cabinLength * 0.65), bodyMat);
    roof.position.set(0, cabinCenterY + cabinHeight / 2, -0.15);
    roof.castShadow = true;
    g.add(roof);

    const sharkFin = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 4), bodyMat);
    sharkFin.rotation.x = -Math.PI / 4;
    sharkFin.position.set(0, cabinCenterY + cabinHeight / 2 + 0.06, -0.15 - cabinLength * 0.26);
    g.add(sharkFin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth - 0.10, cabinHeight * 0.88, 0.06), glassMat);
    windshield.position.set(0, cabinCenterY + 0.02, cabinLength / 2 - 0.20);
    windshield.rotation.x = -Math.PI / 5.2;
    g.add(windshield);

    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth - 0.12, cabinHeight * 0.82, 0.06), glassMat);
    rearWindow.position.set(0, cabinCenterY + 0.02, -cabinLength / 2 - 0.12);
    rearWindow.rotation.x = Math.PI / 5.4;
    g.add(rearWindow);

    for (const side of [-1, 1]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, cabinHeight * 0.68, cabinLength * 0.62), glassMat);
      sideGlass.position.set(side * (cabinWidth / 2 + 0.01), cabinCenterY - 0.01, -0.14);
      g.add(sideGlass);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.10), bodyMat);
      mirror.position.set(side * (carWidth / 2 + 0.10), cabinCenterY - 0.13, 0.70);
      g.add(mirror);
    }

    // Interior (Painel, Volante e Bancos)
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth - 0.20, 0.16, 0.38), blackTrimMat);
    dashboard.position.set(0, bodyBaseY + 0.22, 0.75);
    g.add(dashboard);

    const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 16), blackTrimMat);
    steeringWheel.position.set(-0.36, bodyBaseY + 0.34, 0.52);
    steeringWheel.rotation.x = -Math.PI / 4;
    g.add(steeringWheel);

    for (const seatSide of [-1, 1]) {
      const seatX = seatSide * 0.38;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.40), interiorMat);
      cushion.position.set(seatX, bodyBaseY + 0.08, 0.15);
      g.add(cushion);

      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.12), interiorMat);
      backrest.position.set(seatX, bodyBaseY + 0.32, -0.05);
      backrest.rotation.x = -0.15;
      g.add(backrest);

      const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), interiorMat);
      headrest.position.set(seatX, bodyBaseY + 0.56, -0.10);
      g.add(headrest);
    }

    // Traseira & Lanterna LED
    const rearZ = -carLength / 2 - 0.06;
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(carWidth, 0.28, 0.24), bodyMat);
    rearBumper.position.set(0, bodyBaseY - 0.02, rearZ + 0.10);
    g.add(rearBumper);

    const lightbar = new THREE.Mesh(new THREE.BoxGeometry(carWidth - 0.22, 0.04, 0.05), brakeLightMat);
    lightbar.position.set(0, bodyBaseY + 0.22, rearZ);
    g.add(lightbar);

    for (const side of [-1, 1]) {
      const brakeBlock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.06), brakeLightMat);
      brakeBlock.position.set(side * 0.70, bodyBaseY + 0.18, rearZ);
      g.add(brakeBlock);

      const exhaustTip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12), chromeMat);
      exhaustTip.rotation.x = Math.PI / 2;
      exhaustTip.position.set(side * 0.62, bodyBaseY - 0.11, rearZ - 0.02);
      g.add(exhaustTip);
    }

    // Rodas esportivas com discos e pinças
    const wheelRadius = 0.36;
    const wheelWidth = 0.26;
    const wheelPositions: [number, number][] = [
      [-(carWidth / 2 + 0.04), carLength / 2 - 0.95],
      [carWidth / 2 + 0.04, carLength / 2 - 0.95],
      [-(carWidth / 2 + 0.04), -carLength / 2 + 0.95],
      [carWidth / 2 + 0.04, -carLength / 2 + 0.95],
    ];

    for (const [wx, wz] of wheelPositions) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, wheelRadius, wz);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.72, wheelRadius * 0.72, wheelWidth + 0.01, 14), wheelRimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.60, wheelRadius * 0.60, 0.02, 14), discMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.set(0, 0, -wheelWidth * 0.15);
      wheelGroup.add(rotor);

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.09), caliperMat);
      caliper.position.set(wx > 0 ? -0.04 : 0.04, wheelRadius * 0.40, 0);
      wheelGroup.add(caliper);

      g.add(wheelGroup);
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

  // ──────────────────── CONTROLE SEMAFÓRICO (PADRÃO DENATRAN EM 2 FASES) ────────────────────
  public currentPhase: IntersectionPhase = 'NS_GREEN';

  public setTrafficLightState(id: string, state: TrafficLightState): void {
    const refs = this.trafficLights.filter(
      (t) => t.id === id || (id === 'tl-cruzamento' && t.id === 'tl-sul')
    );
    for (const ref of refs) {
      ref.state = state;

      // Focos Veiculares (Vermelho, Amarelo, Verde)
      ref.redMat.emissiveIntensity = state === 'red' ? 2.5 : 0;
      ref.redMat.emissive.setHex(state === 'red' ? 0xff0000 : 0x000000);
      ref.yellowMat.emissiveIntensity = state === 'yellow' ? 2.5 : 0;
      ref.yellowMat.emissive.setHex(state === 'yellow' ? 0xffbb00 : 0x000000);
      ref.greenMat.emissiveIntensity = state === 'green' ? 2.5 : 0;
      ref.greenMat.emissive.setHex(state === 'green' ? 0x00ff44 : 0x000000);

      // Focos de Pedestre (Regra DENATRAN: pedestre atravessa com segurança quando o fluxo veicular desta via estiver parado)
      const pedCanWalk = state === 'red';
      ref.pedRedMat.emissiveIntensity = pedCanWalk ? 0 : 2.0;
      ref.pedRedMat.emissive.setHex(pedCanWalk ? 0x000000 : 0xff0000);
      ref.pedGreenMat.emissiveIntensity = pedCanWalk ? 2.0 : 0;
      ref.pedGreenMat.emissive.setHex(pedCanWalk ? 0x00ff44 : 0x000000);

      // Luz dinâmica da cena
      ref.light.color.setHex(state === 'red' ? 0xff0000 : state === 'yellow' ? 0xffbb00 : 0x00ff44);
    }
  }

  public setTrafficPhase(phase: IntersectionPhase): void {
    this.currentPhase = phase;
    switch (phase) {
      case 'NS_GREEN':
        this.setTrafficLightState('tl-sul', 'green');
        this.setTrafficLightState('tl-norte', 'green');
        this.setTrafficLightState('tl-leste', 'red');
        this.setTrafficLightState('tl-oeste', 'red');
        break;
      case 'NS_YELLOW':
        this.setTrafficLightState('tl-sul', 'yellow');
        this.setTrafficLightState('tl-norte', 'yellow');
        this.setTrafficLightState('tl-leste', 'red');
        this.setTrafficLightState('tl-oeste', 'red');
        break;
      case 'EW_GREEN':
        this.setTrafficLightState('tl-sul', 'red');
        this.setTrafficLightState('tl-norte', 'red');
        this.setTrafficLightState('tl-leste', 'green');
        this.setTrafficLightState('tl-oeste', 'green');
        break;
      case 'EW_YELLOW':
        this.setTrafficLightState('tl-sul', 'red');
        this.setTrafficLightState('tl-norte', 'red');
        this.setTrafficLightState('tl-leste', 'yellow');
        this.setTrafficLightState('tl-oeste', 'yellow');
        break;
      case 'ALL_RED':
        this.setTrafficLightState('tl-sul', 'red');
        this.setTrafficLightState('tl-norte', 'red');
        this.setTrafficLightState('tl-leste', 'red');
        this.setTrafficLightState('tl-oeste', 'red');
        break;
    }
  }

  public setAllTrafficLights(state: TrafficLightState): void {
    // Sincroniza o ciclo semafórico em 2 fases conforme a orientação principal (Avenida Central)
    if (state === 'green') {
      this.setTrafficPhase('NS_GREEN');
    } else if (state === 'yellow') {
      this.setTrafficPhase('NS_YELLOW');
    } else {
      this.setTrafficPhase('EW_GREEN');
    }
  }

  public setUniformTrafficLights(state: TrafficLightState): void {
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
