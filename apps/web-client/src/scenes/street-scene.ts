// apps/web/src/scenes/street-scene.ts
import * as THREE from 'three';

export interface InteractiveObject {
  id: string;
  name: string;
  type: 'sign' | 'traffic_light' | 'crosswalk' | 'trash_bin' | 'building';
  position: THREE.Vector3;
  observationRadius: number;
  description: string;
  semanticRule: string;
  emotionalWeight: number;
}

export type TrafficLightState = 'red' | 'yellow' | 'green';

export class StreetScene {
  public scene: THREE.Scene;
  public interactiveObjects: InteractiveObject[] = [];
  public trafficLightState: TrafficLightState = 'red';
  
  // Luzes para controle de hora do dia
  private ambientLight: THREE.AmbientLight;
  private sunLight: THREE.DirectionalLight;
  private streetLights: THREE.PointLight[] = [];
  
  // Elementos do semáforo
  private redLampMaterial!: THREE.MeshStandardMaterial;
  private yellowLampMaterial!: THREE.MeshStandardMaterial;
  private greenLampMaterial!: THREE.MeshStandardMaterial;
  private trafficLightLight!: THREE.PointLight;
  
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Céu azul diurno
    this.scene.fog = new THREE.FogExp2(0xcce0ff, 0.015);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    this.sunLight.position.set(25, 40, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.scene.add(this.sunLight);

    this.buildGroundAndRoad();
    this.buildPedestrianCrosswalk();
    this.buildTrafficLight();
    this.buildNoLitteringSign();
    this.buildTrashBin();
    this.buildSidewalkProps();
    this.buildBuildings();
  }

  /**
   * Constrói o asfalto, calçadas e demarcações viárias
   */
  private buildGroundAndRoad(): void {
    // 1. Asfalto principal (Comprimento 120m, Largura 12m)
    const roadGeometry = new THREE.PlaneGeometry(12, 120);
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f2327,
      roughness: 0.85,
      metalness: 0.1,
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    this.scene.add(road);

    // Linha central amarela tracejada
    for (let z = -55; z <= 55; z += 4) {
      // Pula o trecho da faixa de pedestres (entre z = -3 e z = 3)
      if (Math.abs(z) < 3.5) continue;
      const stripeGeom = new THREE.PlaneGeometry(0.25, 2.2);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.01, z);
      this.scene.add(stripe);
    }

    // Linhas contínuas brancas laterais
    for (const x of [-5.5, 5.5]) {
      const lineGeom = new THREE.PlaneGeometry(0.2, 120);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
      const line = new THREE.Mesh(lineGeom, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, 0);
      this.scene.add(line);
    }

    // 2. Calçadas (Esquerda x = -9, Direita x = 9)
    const sidewalkGeom = new THREE.BoxGeometry(6, 0.25, 120);
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x9fa4a6,
      roughness: 0.9,
    });

    const leftSidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    leftSidewalk.position.set(-9, 0.125, 0);
    leftSidewalk.receiveShadow = true;
    this.scene.add(leftSidewalk);

    const rightSidewalk = new THREE.Mesh(sidewalkGeom, sidewalkMat);
    rightSidewalk.position.set(9, 0.125, 0);
    rightSidewalk.receiveShadow = true;
    this.scene.add(rightSidewalk);

    // Meio-fio (Curbs)
    const curbGeom = new THREE.BoxGeometry(0.3, 0.28, 120);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x7a7e80 });

    const leftCurb = new THREE.Mesh(curbGeom, curbMat);
    leftCurb.position.set(-6.15, 0.14, 0);
    this.scene.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeom, curbMat);
    rightCurb.position.set(6.15, 0.14, 0);
    this.scene.add(rightCurb);
  }

  /**
   * Constrói a Faixa de Pedestres (Zebra Crossing)
   */
  private buildPedestrianCrosswalk(): void {
    const crosswalkZ = 0; // Localizada exatamente no centro do cruzamento
    const stripeCount = 10;
    const stripeWidth = 0.6;
    const stripeLength = 4.0;
    const spacing = 1.05;

    for (let i = 0; i < stripeCount; i++) {
      const x = -5.0 + i * spacing;
      const stripeGeom = new THREE.PlaneGeometry(stripeWidth, stripeLength);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.02, crosswalkZ);
      this.scene.add(stripe);
    }

    // Registra objeto interativo
    this.interactiveObjects.push({
      id: 'crosswalk-central',
      name: 'Faixa de Pedestres Central',
      type: 'crosswalk',
      position: new THREE.Vector3(0, 0, crosswalkZ),
      observationRadius: 4.5,
      description: 'Faixa de pedestres padrão com listras refletivas brancas.',
      semanticRule: 'Pedestres têm prioridade de travessia quando o semáforo de veículos está vermelho.',
      emotionalWeight: 0.6,
    });
  }

  /**
   * Constrói o Semáforo Funcional
   */
  private buildTrafficLight(): void {
    const poleX = -6.8;
    const poleZ = -3.0;

    // Poste vertical
    const poleGeom = new THREE.CylinderGeometry(0.12, 0.14, 5.5, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.set(poleX, 2.75, poleZ);
    pole.castShadow = true;
    this.scene.add(pole);

    // Braço horizontal estendido sobre a via
    const armGeom = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 16);
    const arm = new THREE.Mesh(armGeom, poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(poleX + 1.6, 5.2, poleZ);
    this.scene.add(arm);

    // Caixa do semáforo
    const boxGeom = new THREE.BoxGeometry(0.65, 1.8, 0.5);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const box = new THREE.Mesh(boxGeom, boxMat);
    box.position.set(poleX + 2.8, 4.4, poleZ);
    box.castShadow = true;
    this.scene.add(box);

    // Materiais das 3 lâmpadas
    this.redLampMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    this.yellowLampMaterial = new THREE.MeshStandardMaterial({
      color: 0x332200,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.5,
    });
    this.greenLampMaterial = new THREE.MeshStandardMaterial({
      color: 0x003300,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.5,
    });

    const lampGeom = new THREE.SphereGeometry(0.2, 16, 16);

    // Lâmpada Vermelha (topo)
    const redLamp = new THREE.Mesh(lampGeom, this.redLampMaterial);
    redLamp.position.set(poleX + 2.8, 5.0, poleZ + 0.25);
    this.scene.add(redLamp);

    // Lâmpada Amarela (meio)
    const yellowLamp = new THREE.Mesh(lampGeom, this.yellowLampMaterial);
    yellowLamp.position.set(poleX + 2.8, 4.4, poleZ + 0.25);
    this.scene.add(yellowLamp);

    // Lâmpada Verde (fundo)
    const greenLamp = new THREE.Mesh(lampGeom, this.greenLampMaterial);
    greenLamp.position.set(poleX + 2.8, 3.8, poleZ + 0.25);
    this.scene.add(greenLamp);

    // Visores (pestanas protetoras das lâmpadas)
    for (const y of [5.0, 4.4, 3.8]) {
      const visorGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 16, 1, true, 0, Math.PI);
      const visor = new THREE.Mesh(visorGeom, boxMat);
      visor.rotation.x = Math.PI / 2;
      visor.position.set(poleX + 2.8, y + 0.1, poleZ + 0.3);
      this.scene.add(visor);
    }

    // Luz pontual do semáforo iluminando o asfalto
    this.trafficLightLight = new THREE.PointLight(0xff0000, 2.0, 10);
    this.trafficLightLight.position.set(poleX + 2.8, 4.4, poleZ + 0.8);
    this.scene.add(this.trafficLightLight);

    // Registra objeto interativo
    this.interactiveObjects.push({
      id: 'traffic-light-1',
      name: 'Semáforo da Rua Central',
      type: 'traffic_light',
      position: new THREE.Vector3(poleX + 2.8, 4.4, poleZ),
      observationRadius: 7.0,
      description: 'Semáforo veicular e de travessia com luzes em ciclo dinâmico.',
      semanticRule: 'Parar na calçada quando vermelho; veículos param e pedestres atravessam.',
      emotionalWeight: 0.7,
    });
  }

  /**
   * Constrói a Placa de "PROIBIDO JOGAR LIXO" com textura procedural em alta definição
   */
  private buildNoLitteringSign(): void {
    const signX = -6.8;
    const signZ = 4.5; // Do lado da calçada próxima à faixa

    // 1. Haste metálica da placa
    const poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 2.8, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.set(signX, 1.4, signZ);
    pole.castShadow = true;
    this.scene.add(pole);

    // 2. Chapa da placa (fundo retangular com cantos chanfrados)
    const signBoardGeom = new THREE.BoxGeometry(1.3, 1.8, 0.05);

    // Gerador de textura procedural 2D Canvas em alta resolução (1024x1400)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d')!;

    // Fundo branco reflexivo com borda
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1024, 1400);

    // Borda vermelha de aviso
    ctx.lineWidth = 40;
    ctx.strokeStyle = '#d32f2f';
    ctx.strokeRect(30, 30, 964, 1340);

    // Faixa superior vermelha com aviso
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(50, 50, 924, 180);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 75px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ATENÇÃO', 512, 140);

    // Símbolo de proibido jogar lixo
    // Círculo vermelho com barra diagonal
    const cx = 512;
    const cy = 520;
    const radius = 220;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 36;
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();

    // Linha diagonal de proibição
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.707, cy - radius * 0.707);
    ctx.lineTo(cx + radius * 0.707, cy + radius * 0.707);
    ctx.lineWidth = 36;
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();

    // Silhueta da pessoa e lixeira (ícone minimalista dentro do círculo)
    ctx.fillStyle = '#222222';
    // Cabeça
    ctx.beginPath();
    ctx.arc(cx - 50, cy - 80, 28, 0, Math.PI * 2);
    ctx.fill();
    // Corpo
    ctx.fillRect(cx - 65, cy - 45, 30, 90);
    // Braço jogando papel
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#222222';
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy - 20);
    ctx.lineTo(cx + 10, cy - 10);
    ctx.stroke();
    // Papéis caindo
    ctx.fillStyle = '#555555';
    ctx.fillRect(cx + 25, cy + 10, 16, 16);
    ctx.fillRect(cx + 45, cy + 35, 14, 14);
    // Cesto de lixo
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#222222';
    ctx.strokeRect(cx + 50, cy + 50, 45, 60);

    // Texto Principal da Placa
    ctx.fillStyle = '#111111';
    ctx.font = '900 82px sans-serif';
    ctx.fillText('PROIBIDO', 512, 850);
    ctx.fillText('JOGAR LIXO', 512, 950);

    // Texto legal / Subtítulo
    ctx.fillStyle = '#444444';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('SUJEITO A MULTA', 512, 1080);
    ctx.font = 'normal 36px sans-serif';
    ctx.fillText('LEI MUNICIPAL Nº 12.305/10', 512, 1160);
    ctx.fillText('CIDADE LIMPA É DEVER DE TODOS', 512, 1220);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;

    const signFaceMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.3,
      metalness: 0.1,
    });
    const signBackMat = new THREE.MeshStandardMaterial({
      color: 0x999999,
      metalness: 0.5,
      roughness: 0.4,
    });

    const materials = [
      signBackMat, // direita
      signBackMat, // esquerda
      signBackMat, // topo
      signBackMat, // fundo
      signFaceMat, // frente (+Z)
      signBackMat, // trás (-Z)
    ];

    const signBoard = new THREE.Mesh(signBoardGeom, materials);
    signBoard.position.set(signX, 2.2, signZ);
    // Leve rotação voltada para a calçada e rua
    signBoard.rotation.y = -Math.PI / 6;
    signBoard.castShadow = true;
    this.scene.add(signBoard);

    // Registra objeto interativo
    this.interactiveObjects.push({
      id: 'sign-no-littering',
      name: 'Placa: Proibido Jogar Lixo',
      type: 'sign',
      position: new THREE.Vector3(signX, 2.2, signZ),
      observationRadius: 5.5,
      description: 'Placa oficial de sinalização vertical proibindo o descarte irregular de resíduos sob pena de multa.',
      semanticRule: 'Descarte de lixo na calçada ou via pública é proibido. Guardar o lixo até encontrar lixeira pública.',
      emotionalWeight: 0.85,
    });
  }

  /**
   * Constrói Lixeira Pública (contraste funcional com a placa)
   */
  private buildTrashBin(): void {
    const binX = -7.2;
    const binZ = 8.5; // Alguns metros após a placa de lixo

    const binGroup = new THREE.Group();

    // Corpo da lixeira (verde escuro urbano)
    const bodyGeom = new THREE.CylinderGeometry(0.35, 0.3, 0.9, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.4, metalness: 0.2 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    binGroup.add(body);

    // Suporte metálico da lixeira
    const postGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 12);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(0.38, 0.55, 0);
    binGroup.add(post);

    // Tampa com abertura
    const capGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 16);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0e3a12, roughness: 0.3 });
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.y = 1.05;
    binGroup.add(cap);

    binGroup.position.set(binX, 0.125, binZ);
    this.scene.add(binGroup);

    // Registra objeto interativo
    this.interactiveObjects.push({
      id: 'trash-bin-1',
      name: 'Lixeira Pública Municipal',
      type: 'trash_bin',
      position: new THREE.Vector3(binX, 0.6, binZ),
      observationRadius: 4.0,
      description: 'Lixeira urbana para descarte correto de resíduos sólidos.',
      semanticRule: 'Local adequado para depositar lixo respeitando a placa de sinalização.',
      emotionalWeight: 0.5,
    });
  }

  /**
   * Constrói postes de iluminação, árvores e bancos urbanos
   */
  private buildSidewalkProps(): void {
    // Postes de iluminação pública ao longo da rua
    const lampPositions = [
      { x: -6.8, z: -30 },
      { x: -6.8, z: 25 },
      { x: 6.8, z: -15 },
      { x: 6.8, z: 35 },
    ];

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3436, metalness: 0.8, roughness: 0.3 });
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: 0xffe6a3, emissiveIntensity: 1.2 });

    for (const pos of lampPositions) {
      // Haste vertical
      const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6.0, 16), poleMat);
      lampPole.position.set(pos.x, 3.0, pos.z);
      lampPole.castShadow = true;
      this.scene.add(lampPole);

      // Braço curvado em direção à rua
      const dir = pos.x < 0 ? 1 : -1;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 12), poleMat);
      arm.rotation.z = (Math.PI / 3) * dir;
      arm.position.set(pos.x + 0.8 * dir, 6.1, pos.z);
      this.scene.add(arm);

      // Cúpula da lâmpada
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 16), poleMat);
      head.position.set(pos.x + 1.5 * dir, 6.2, pos.z);
      this.scene.add(head);

      // Bulbo iluminado
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), bulbMat);
      bulb.position.set(pos.x + 1.5 * dir, 6.0, pos.z);
      this.scene.add(bulb);

      // Fonte de luz pontual
      const pLight = new THREE.PointLight(0xffecc4, 1.8, 18);
      pLight.position.set(pos.x + 1.5 * dir, 5.8, pos.z);
      pLight.castShadow = true;
      this.scene.add(pLight);
      this.streetLights.push(pLight);
    }

    // Árvores na calçada direita
    const treePositions = [-40, -20, 15, 45];
    for (const z of treePositions) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 3.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 })
      );
      trunk.position.set(8.5, 1.75, z);
      trunk.castShadow = true;
      this.scene.add(trunk);

      // Copa volumétrica
      const foliage = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.6, 1),
        new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 })
      );
      foliage.position.set(8.5, 4.2, z);
      foliage.castShadow = true;
      this.scene.add(foliage);
    }
  }

  /**
   * Constrói edifícios nas laterais para dar escala urbana e horizonte
   */
  private buildBuildings(): void {
    const buildingColors = [0x37474f, 0x455a64, 0x263238, 0x546e7a, 0x3e2723, 0x424242];

    // Lado esquerdo (x < -12)
    for (let z = -50; z <= 50; z += 22) {
      const height = 15 + Math.random() * 20;
      const width = 18;
      const depth = 16;
      const geom = new THREE.BoxGeometry(depth, height, width);
      const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const b = new THREE.Mesh(geom, mat);
      b.position.set(-20, height / 2, z);
      b.castShadow = true;
      b.receiveShadow = true;
      this.scene.add(b);
    }

    // Lado direito (x > 12)
    for (let z = -50; z <= 50; z += 22) {
      const height = 14 + Math.random() * 22;
      const width = 18;
      const depth = 16;
      const geom = new THREE.BoxGeometry(depth, height, width);
      const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const b = new THREE.Mesh(geom, mat);
      b.position.set(20, height / 2, z);
      b.castShadow = true;
      b.receiveShadow = true;
      this.scene.add(b);
    }
  }

  /**
   * Alterna estado do semáforo (vermelho, amarelo, verde)
   */
  public setTrafficLight(state: TrafficLightState): void {
    this.trafficLightState = state;

    if (state === 'red') {
      this.redLampMaterial.emissive.setHex(0xff0000);
      this.redLampMaterial.emissiveIntensity = 1.8;
      this.yellowLampMaterial.emissiveIntensity = 0;
      this.greenLampMaterial.emissiveIntensity = 0;
      this.trafficLightLight.color.setHex(0xff0000);
      this.trafficLightLight.intensity = 2.0;
    } else if (state === 'yellow') {
      this.redLampMaterial.emissiveIntensity = 0;
      this.yellowLampMaterial.emissive.setHex(0xffbb00);
      this.yellowLampMaterial.emissiveIntensity = 1.8;
      this.greenLampMaterial.emissiveIntensity = 0;
      this.trafficLightLight.color.setHex(0xffbb00);
      this.trafficLightLight.intensity = 1.8;
    } else {
      this.redLampMaterial.emissiveIntensity = 0;
      this.yellowLampMaterial.emissiveIntensity = 0;
      this.greenLampMaterial.emissive.setHex(0x00ff44);
      this.greenLampMaterial.emissiveIntensity = 1.8;
      this.trafficLightLight.color.setHex(0x00ff44);
      this.trafficLightLight.intensity = 2.0;
    }
  }

  /**
   * Ajusta ciclo de hora / iluminação (dia vs noite)
   */
  public setTimeOfDay(time: 'day' | 'sunset' | 'night'): void {
    if (time === 'day') {
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog = new THREE.FogExp2(0xcce0ff, 0.015);
      this.ambientLight.intensity = 0.7;
      this.sunLight.intensity = 1.2;
      this.sunLight.color.setHex(0xfff5e6);
      this.streetLights.forEach((l) => (l.intensity = 0.3));
    } else if (time === 'sunset') {
      this.scene.background = new THREE.Color(0xd97543);
      this.scene.fog = new THREE.FogExp2(0xd97543, 0.02);
      this.ambientLight.intensity = 0.45;
      this.sunLight.intensity = 0.8;
      this.sunLight.color.setHex(0xff6622);
      this.streetLights.forEach((l) => (l.intensity = 1.5));
    } else {
      this.scene.background = new THREE.Color(0x0a0d14);
      this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.03);
      this.ambientLight.intensity = 0.15;
      this.sunLight.intensity = 0.1;
      this.sunLight.color.setHex(0x334466);
      this.streetLights.forEach((l) => (l.intensity = 2.5));
    }
  }
}
