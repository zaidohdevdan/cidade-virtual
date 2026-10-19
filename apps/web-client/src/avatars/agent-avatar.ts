// apps/web/src/avatars/agent-avatar.ts
import * as THREE from 'three';
import { ObstacleCollider } from '../scenes/city-scene';

export interface AgentConfig {
  id: string;
  name: string;
  starDesignation: string; // Designação astronômica da Constelação de Lira
  role: string; // Papel e especialidade na cidade
  color: number; // Cor primária do vestuário
  accentColor: number; // Cor secundária / detalhes e forros
  hairColor: number; // Cor do cabelo
  hairStyle: 'short' | 'long' | 'ponytail' | 'spiky' | 'curly' | 'beanie' | 'cap';
  skinColor: number; // Tom de pele natural
  pantsColor: number; // Cor da calça
  shoeColor: number; // Cor do calçado
  accessory: 'visor' | 'backpack' | 'headphones' | 'glasses' | 'satchel' | 'smartwatch' | 'cap_reverse';
  labelColor: string; // Gradiente da tag flutuante
  startPosition: THREE.Vector3;
  patrolPoints: THREE.Vector3[];
}

export class AgentAvatar {
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public rotationY: number = 0;
  public speed: number = 0;
  public config: AgentConfig;
  public label!: HTMLDivElement;
  public speechBubble?: HTMLDivElement;
  public speechTimer: number = 0;
  public targetPosition: THREE.Vector3 | null = null;
  public isWaitingAtCrosswalk: boolean = false;
  public emotionState: string = 'calm';

  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private walkCycleTime: number = 0;
  private patrolIndex: number = 0;
  private waitTimer: number = 0;

  private readonly walkSpeed = 2.2 + Math.random() * 1.5;
  public readonly radius = 0.4; // Raio corporal de colisão do pedestre (40 cm)

  constructor(config: AgentConfig) {
    this.config = config;
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.position.copy(config.startPosition);
    this.buildModel();
    if (typeof document !== 'undefined') {
      this.buildLabel();
    }
  }

  private buildModel(): void {
    // Materiais especializados e harmonizados para cada agente
    const jacketMat = new THREE.MeshStandardMaterial({
      color: this.config.color,
      roughness: 0.45,
      metalness: 0.15,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: this.config.accentColor,
      roughness: 0.35,
      metalness: 0.2,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: this.config.skinColor,
      roughness: 0.6,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: this.config.hairColor,
      roughness: 0.65,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: this.config.pantsColor,
      roughness: 0.7,
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: this.config.shoeColor,
      roughness: 0.5,
    });
    const soleMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.85,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xdcdcdc,
      metalness: 0.85,
      roughness: 0.2,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
    });
    const eyePupilMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.1,
    });

    // ──────────────────── 1. TRONCO / VESTUÁRIO ────────────────────
    // Base da Jaqueta / Casaco estilizado
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.32), jacketMat);
    torso.position.y = 1.14;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.mesh.add(torso);

    // Faixa central com zíper metálico
    const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.64, 0.33), metalMat);
    zipper.position.set(0, 1.14, 0);
    this.mesh.add(zipper);

    // Gola / Lapela acolchoada contrastante
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.34), accentMat);
    collar.position.set(0, 1.44, 0.02);
    collar.castShadow = true;
    this.mesh.add(collar);

    // Faixas horizontais de destaque no peito
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.33), accentMat);
    stripe.position.set(0, 1.25, 0);
    this.mesh.add(stripe);

    // Cinto na cintura
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.33), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }));
    belt.position.set(0, 0.82, 0);
    this.mesh.add(belt);

    // Fivela cromada do cinto
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.35), metalMat);
    buckle.position.set(0, 0.82, 0);
    this.mesh.add(buckle);

    // ──────────────────── 2. CABEÇA, ROSTO & OLHOS ────────────────────
    // Pescoço
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 12), skinMat);
    neck.position.set(0, 1.50, 0);
    neck.castShadow = true;
    this.mesh.add(neck);

    // Cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 16), skinMat);
    head.position.set(0, 1.68, 0);
    head.castShadow = true;
    this.mesh.add(head);

    // Olhos Expressivos
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeWhiteMat);
      eyeWhite.position.set(side * 0.07, 1.70, 0.18);
      this.mesh.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyePupilMat);
      pupil.position.set(side * 0.07, 1.70, 0.21);
      this.mesh.add(pupil);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.03), hairMat);
      brow.position.set(side * 0.07, 1.75, 0.19);
      this.mesh.add(brow);
    }

    // ──────────────────── 3. CABELO PERSONALIZADO ────────────────────
    this.buildHairstyle(hairMat, accentMat, metalMat);

    // ──────────────────── 4. BRAÇOS & MÃOS ────────────────────
    const armGeom = new THREE.BoxGeometry(0.15, 0.55, 0.15);
    armGeom.translate(0, -0.24, 0); // Pivô de rotação no ombro

    this.leftArm = new THREE.Mesh(armGeom, jacketMat);
    this.leftArm.position.set(-0.35, 1.44, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeom, jacketMat);
    this.rightArm.position.set(0.35, 1.44, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Mãos nos braços
    for (const arm of [this.leftArm, this.rightArm]) {
      // Barra da manga
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), accentMat);
      cuff.position.set(0, -0.42, 0);
      arm.add(cuff);

      // Mão em tom de pele
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), skinMat);
      hand.position.set(0, -0.52, 0);
      hand.castShadow = true;
      arm.add(hand);
    }

    // ──────────────────── 5. PERNAS & CALÇADOS ────────────────────
    const legGeom = new THREE.BoxGeometry(0.18, 0.72, 0.18);
    legGeom.translate(0, -0.34, 0); // Pivô de rotação no quadril

    this.leftLeg = new THREE.Mesh(legGeom, pantsMat);
    this.leftLeg.position.set(-0.15, 0.80, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, pantsMat);
    this.rightLeg.position.set(0.15, 0.80, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    // Tênis / Sapatos com solado de borracha
    for (const leg of [this.leftLeg, this.rightLeg]) {
      // Dobra da calça
      const hem = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.05, 0.19), pantsMat);
      hem.position.set(0, -0.66, 0);
      leg.add(hem);

      // Cabedal do sapato
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.28), shoeMat);
      shoe.position.set(0, -0.72, 0.05);
      shoe.castShadow = true;
      leg.add(shoe);

      // Solado de borracha branca
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 0.30), soleMat);
      sole.position.set(0, -0.79, 0.05);
      leg.add(sole);

      // Faixa decorativa do tênis
      const shoeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.03, 0.12), accentMat);
      shoeStripe.position.set(0, -0.72, 0.06);
      leg.add(shoeStripe);
    }

    // ──────────────────── 6. ACESSÓRIOS EXCLUSIVOS ────────────────────
    this.buildAccessory(accentMat, metalMat);
  }

  private buildHairstyle(hairMat: THREE.Material, accentMat: THREE.Material, metalMat: THREE.Material): void {
    const style = this.config.hairStyle;

    if (style === 'short') {
      // Corte curto moderno com topete angular
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.12, 0.40), hairMat);
      top.position.set(0, 1.83, 0.02);
      this.mesh.add(top);

      const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.10), hairMat);
      fringe.position.set(0, 1.77, 0.18);
      this.mesh.add(fringe);

      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.32), hairMat);
      back.position.set(0, 1.70, -0.05);
      this.mesh.add(back);
    } else if (style === 'ponytail') {
      // Cabelo amarrado com rabo de cavalo elegante
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 12, 12), hairMat);
      cap.position.set(0, 1.70, -0.02);
      this.mesh.add(cap);

      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 12), metalMat);
      tie.position.set(0, 1.72, -0.22);
      this.mesh.add(tie);

      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.38, 8), hairMat);
      tail.position.set(0, 1.60, -0.26);
      tail.rotation.x = -Math.PI / 4;
      this.mesh.add(tail);
    } else if (style === 'spiky') {
      // Cabelo espetado energético
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.12, 0.40), hairMat);
      base.position.set(0, 1.80, 0);
      this.mesh.add(base);

      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), hairMat);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.11, 1.90, Math.sin(angle) * 0.11);
        spike.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
        this.mesh.add(spike);
      }
    } else if (style === 'long') {
      // Cabelo longo sofisticado
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.40), hairMat);
      top.position.set(0, 1.82, 0);
      this.mesh.add(top);

      const mane = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.34), hairMat);
      mane.position.set(0, 1.58, -0.06);
      this.mesh.add(mane);
    } else if (style === 'beanie') {
      // Gorro de lã moderno com dobra
      const beanie = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.18, 16), accentMat);
      beanie.position.set(0, 1.82, -0.02);
      this.mesh.add(beanie);

      const fold = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 16), accentMat);
      fold.rotation.x = Math.PI / 2;
      fold.position.set(0, 1.74, -0.02);
      this.mesh.add(fold);

      // Franja escura sob o gorro
      const bang = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.08), hairMat);
      bang.position.set(0, 1.75, 0.18);
      this.mesh.add(bang);
    } else if (style === 'curly') {
      // Cachos volumosos modelados
      for (let i = 0; i < 10; i++) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), hairMat);
        const theta = (i / 10) * Math.PI * 2;
        curl.position.set(Math.cos(theta) * 0.15, 1.78 + (i % 3) * 0.05, Math.sin(theta) * 0.15);
        this.mesh.add(curl);
      }
    } else if (style === 'cap') {
      // Boné com aba reverso
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
      crown.position.set(0, 1.74, 0);
      this.mesh.add(crown);

      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.18), accentMat);
      brim.position.set(0, 1.74, -0.22);
      brim.rotation.x = -0.15;
      this.mesh.add(brim);

      const frontHair = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.06, 0.08), hairMat);
      frontHair.position.set(0, 1.74, 0.18);
      this.mesh.add(frontHair);
    }
  }

  private buildAccessory(accentMat: THREE.Material, metalMat: THREE.Material): void {
    const acc = this.config.accessory;

    if (acc === 'visor') {
      // Visor AR holográfico futurista (Vega)
      const visorMat = new THREE.MeshStandardMaterial({
        color: 0x80d8ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.85,
        roughness: 0.1,
      });
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), visorMat);
      visor.position.set(0, 1.71, 0.18);
      this.mesh.add(visor);
    } else if (acc === 'backpack') {
      // Mochila urbana de pesquisa com bolsos e fivelas (Sulafat)
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.18), accentMat);
      pack.position.set(0, 1.15, -0.24);
      pack.castShadow = true;
      this.mesh.add(pack);

      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.06), accentMat);
      pocket.position.set(0, 1.05, -0.35);
      this.mesh.add(pocket);

      const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.03), accentMat);
      strapL.position.set(-0.16, 1.18, -0.14);
      this.mesh.add(strapL);

      const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.03), accentMat);
      strapR.position.set(0.16, 1.18, -0.14);
      this.mesh.add(strapR);
    } else if (acc === 'headphones') {
      // Fones de ouvido no pescoço (Sheliak)
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 16, Math.PI), metalMat);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 1.48, 0.02);
      this.mesh.add(band);

      const cupMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
      for (const side of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), cupMat);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.18, 1.48, 0.02);
        this.mesh.add(cup);
      }
    } else if (acc === 'glasses') {
      // Óculos intelectuais de armação fina dourada (Epsilon)
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.007, 6, 16), metalMat);
        rim.position.set(side * 0.07, 1.70, 0.20);
        this.mesh.add(rim);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.01), metalMat);
      bridge.position.set(0, 1.70, 0.20);
      this.mesh.add(bridge);
    } else if (acc === 'satchel') {
      // Bolsa transversal de couro (Aladfar)
      const bagMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.6 });
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.22, 0.26), bagMat);
      bag.position.set(0.32, 0.76, 0);
      bag.castShadow = true;
      this.mesh.add(bag);

      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.70, 0.35), bagMat);
      strap.position.set(0.08, 1.15, 0);
      strap.rotation.z = 0.42;
      this.mesh.add(strap);
    } else if (acc === 'smartwatch') {
      // Smartwatch holográfico (Xihe)
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 1.2,
      });
      const watch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.06), screenMat);
      watch.position.set(0.08, -0.42, 0);
      this.leftArm.add(watch);
    }
  }

  private buildLabel(): void {
    this.label = document.createElement('div');
    this.label.className = 'agent-label';
    this.label.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <span style="font-size: 13px; text-shadow: 0 0 6px rgba(255,255,255,0.9);">✦</span>
        <span style="letter-spacing: 0.6px; font-weight: 800;">${this.config.name.toUpperCase()}</span>
      </div>
      <div style="font-size: 9.5px; opacity: 0.92; font-weight: 500; margin-top: 1px; letter-spacing: 0.2px;">
        ${this.config.starDesignation}
      </div>
      <div style="font-size: 8.5px; opacity: 0.78; font-weight: 400; margin-top: 1px; font-style: italic;">
        ${this.config.role}
      </div>
    `;
    this.label.style.cssText = `
      position: absolute;
      padding: 4px 10px;
      border-radius: 9px;
      font-size: 11px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #ffffff;
      background: ${this.config.labelColor};
      pointer-events: none;
      transform: translate(-50%, -100%);
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 10px rgba(255,255,255,0.2);
      border: 1.5px solid rgba(255,255,255,0.45);
      backdrop-filter: blur(8px);
      z-index: 100;
      text-align: center;
      transition: transform 0.08s ease;
    `;
    document.body.appendChild(this.label);
  }

  /**
   * Emite uma fala ou pensamento visível em balão estilizado sobre o avatar (Task-026).
   */
  public say(message: string, durationSeconds: number = 4.0): void {
    this.speechTimer = durationSeconds;
    if (!this.speechBubble) {
      this.speechBubble = document.createElement('div');
      this.speechBubble.className = 'agent-speech-bubble';
      this.speechBubble.style.cssText = `
        position: absolute;
        max-width: 220px;
        padding: 8px 12px;
        background: rgba(15, 23, 42, 0.90);
        border: 1.5px solid rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        color: #f8fafc;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 11.5px;
        line-height: 1.35;
        font-weight: 500;
        pointer-events: none;
        transform: translate(-50%, -100%);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), 0 0 10px rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        z-index: 105;
        text-align: center;
        transition: opacity 0.25s ease;
      `;
      document.body.appendChild(this.speechBubble);
    }

    this.speechBubble.innerHTML = `
      <div style="font-size: 9px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; color: #94a3b8;">
        💬 ${this.config.name}
      </div>
      <div>${message}</div>
    `;
    this.speechBubble.style.opacity = '1';
    this.speechBubble.style.display = 'block';
  }

  /**
   * Define novo destino de navegação disparado pelo servidor via AgentAction API (Task-025/026).
   */
  public setTargetPosition(pos: { x: number; y?: number; z: number }): void {
    this.targetPosition = new THREE.Vector3(pos.x, pos.y ?? this.position.y, pos.z);
    this.waitTimer = 0; // Acorda de pausas locais para navegar ao destino
  }

  /**
   * Interrompe o movimento do agente imediatamente.
   */
  public stopMovement(): void {
    this.targetPosition = null;
    this.waitTimer = 1.0;
    this.speed = 0;
  }

  public updateLabel(camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    const screenPos = this.position.clone().add(new THREE.Vector3(0, 2.35, 0));
    screenPos.project(camera);

    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    const x = (screenPos.x * 0.5 + 0.5) * w;
    const y = (-screenPos.y * 0.5 + 0.5) * h;

    if (screenPos.z < 1) {
      this.label.style.display = 'block';
      this.label.style.left = `${x}px`;
      this.label.style.top = `${y}px`;

      // Atualiza posição do balão de fala se estiver ativo
      if (this.speechBubble && this.speechTimer > 0) {
        const bubblePos = this.position.clone().add(new THREE.Vector3(0, 2.95, 0));
        bubblePos.project(camera);
        const bx = (bubblePos.x * 0.5 + 0.5) * w;
        const by = (-bubblePos.y * 0.5 + 0.5) * h;
        if (bubblePos.z < 1) {
          this.speechBubble.style.display = 'block';
          this.speechBubble.style.left = `${bx}px`;
          this.speechBubble.style.top = `${by}px`;
        } else {
          this.speechBubble.style.display = 'none';
        }
      }
    } else {
      this.label.style.display = 'none';
      if (this.speechBubble) {
        this.speechBubble.style.display = 'none';
      }
    }
  }

  /**
   * Checa se a posição desejada colide com algum obstáculo da cena ou veículo dinâmico
   */
  private checkCollision(targetX: number, targetZ: number, colliders: ObstacleCollider[]): boolean {
    const r = this.radius;

    for (const c of colliders) {
      if (c.type === 'box') {
        if (c.minX === undefined || c.maxX === undefined || c.minZ === undefined || c.maxZ === undefined) continue;
        const closestX = Math.max(c.minX, Math.min(targetX, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(targetZ, c.maxZ));
        const distX = targetX - closestX;
        const distZ = targetZ - closestZ;
        const distSq = distX * distX + distZ * distZ;

        if (distSq < r * r) {
          return true;
        }
      } else if (c.type === 'cylinder') {
        if (c.cx === undefined || c.cz === undefined || c.radius === undefined) continue;
        const distX = targetX - c.cx;
        const distZ = targetZ - c.cz;
        const distSq = distX * distX + distZ * distZ;
        const combinedRadius = c.radius + r;

        if (distSq < combinedRadius * combinedRadius) {
          return true;
        }
      }
    }

    return false;
  }

  public update(delta: number, colliders: ObstacleCollider[] = [], trafficLightState: string = 'green'): void {
    // Atualiza temporizador do balão de fala
    if (this.speechTimer > 0) {
      this.speechTimer -= delta;
      if (this.speechTimer <= 0 && this.speechBubble) {
        this.speechBubble.style.opacity = '0';
        setTimeout(() => {
          if (this.speechTimer <= 0 && this.speechBubble) {
            this.speechBubble.style.display = 'none';
          }
        }, 250);
      }
    }

    if (this.waitTimer > 0) {
      this.waitTimer -= delta;
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 10);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 8);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 8);
      this.mesh.position.y = 0.04;
      return;
    }

    // Respeito ao semáforo nas imediações da faixa de pedestres central (|x| < 4.5 e |z| < 6)
    const isNearCrosswalk = Math.abs(this.position.x) < 4.5 && Math.abs(this.position.z) < 6;
    if (isNearCrosswalk && trafficLightState === 'green') {
      // Sinal veicular verde = pedestre aguarda na calçada
      this.isWaitingAtCrosswalk = true;
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 8);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
      return;
    }
    this.isWaitingAtCrosswalk = false;

    // Prioriza destino de navegação recebido do servidor; caso contrário, segue rota local
    let target: THREE.Vector3;
    let isServerTarget = false;

    if (this.targetPosition) {
      target = this.targetPosition;
      isServerTarget = true;
    } else {
      target = this.config.patrolPoints[this.patrolIndex];
    }

    const flat = new THREE.Vector3(target.x, this.position.y, target.z);
    const dir = flat.clone().sub(this.position);
    const dist = dir.length();

    if (dist < 0.5) {
      if (isServerTarget) {
        this.targetPosition = null;
        this.waitTimer = 1.0;
        return;
      } else {
        this.patrolIndex = (this.patrolIndex + 1) % this.config.patrolPoints.length;
        this.waitTimer = 1.5 + Math.random() * 2;
        return;
      }
    }

    dir.normalize();
    const targetAngle = Math.atan2(dir.x, dir.z);
    const angleDiff = ((targetAngle - this.rotationY + Math.PI) % (Math.PI * 2)) - Math.PI;
    this.rotationY += angleDiff * Math.min(1, delta * 6);
    this.mesh.rotation.y = this.rotationY;

    // Deslocamento desejado
    const step = this.speed * delta;
    const desiredDx = dir.x * step;
    const desiredDz = dir.z * step;

    // Resolução de colisão com deslizamento de superfície (wall-sliding) contra automóveis e obstáculos
    const currX = this.position.x;
    const currZ = this.position.z;

    let nextX = currX + desiredDx;
    if (this.checkCollision(nextX, currZ, colliders)) {
      nextX = currX;
    }

    let nextZ = currZ + desiredDz;
    if (this.checkCollision(nextX, nextZ, colliders)) {
      nextZ = currZ;
    }

    // Se o agente estiver totalmente obstruído por um veículo ou obstáculo à frente
    const isBlocked = nextX === currX && nextZ === currZ && (desiredDx !== 0 || desiredDz !== 0);
    if (isBlocked) {
      // Desacelera e aguarda o veículo desobstruir o caminho
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 10);
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, this.walkSpeed, delta * 6);
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    // Animação dinâmica de caminhada proporcional à velocidade real
    if (this.speed > 0.2) {
      this.walkCycleTime += delta * this.speed * 2;
      const legAngle = Math.sin(this.walkCycleTime) * 0.55;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;
      this.leftArm.rotation.x = -legAngle * 0.65;
      this.rightArm.rotation.x = legAngle * 0.65;
      this.mesh.position.y = Math.abs(Math.sin(this.walkCycleTime * 2)) * 0.04;
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 8);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 8);
      this.mesh.position.y = 0.04;
    }
  }

  public dispose(): void {
    if (this.label?.parentNode) this.label.parentNode.removeChild(this.label);
    if (this.speechBubble?.parentNode) this.speechBubble.parentNode.removeChild(this.speechBubble);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OS 7 CIDADÃOS ESTELARES DA CIDADE VIRTUAL
// Inspirados nas estrelas da Constelação de Lira:
//   1. Vega (Alpha Lyrae) — Estrela branco-azulada mais brilhante da Lira
//   2. Sulafat (Gamma Lyrae) — Segunda estrela mais brilhante
//   3. Sheliak (Beta Lyrae) — Famosa estrela binária eclipsante
//   4. Epsilon (Epsilon Lyrae) — Famoso sistema quádruplo "Dupla Dupla"
//   5. Aladfar (Delta Lyrae) — Estrela carmesim nobre da Lira
//   6. Xihe (Zeta Lyrae) — Deusa solar e estrela característica
//   7. Chasoň (Eta Lyrae) — Radiante estrela de energia jovem
// ─────────────────────────────────────────────────────────────────────────────
export const CITY_AGENTS: AgentConfig[] = [
  {
    id: 'agent-vega',
    name: 'Vega',
    starDesignation: 'Alpha Lyrae (α Lyr)',
    role: 'Pioneira & Navegadora',
    color: 0x1e88e5, // Azul safira vibrante
    accentColor: 0x80d8ff, // Azul celeste luminoso
    hairColor: 0x1a237e, // Cabelo azul meia-noite
    hairStyle: 'short',
    skinColor: 0xf5d0b5,
    pantsColor: 0x0d47a1,
    shoeColor: 0x1565c0,
    accessory: 'visor',
    labelColor: 'linear-gradient(135deg, rgba(21, 101, 192, 0.9), rgba(0, 176, 255, 0.9))',
    startPosition: new THREE.Vector3(-4, 0.19, -25),
    patrolPoints: [
      new THREE.Vector3(-4, 0.19, -38),
      new THREE.Vector3(-4, 0.19, -18),
      new THREE.Vector3(4, 0.19, -25),
    ],
  },
  {
    id: 'agent-sulafat',
    name: 'Sulafat',
    starDesignation: 'Gamma Lyrae (γ Lyr)',
    role: 'Cientista & Ecologista',
    color: 0x2e7d32, // Verde esmeralda nobre
    accentColor: 0xa5d6a7, // Verde menta
    hairColor: 0x4e342e, // Castanho escuro
    hairStyle: 'ponytail',
    skinColor: 0xd79a6b,
    pantsColor: 0x37474f,
    shoeColor: 0x3e2723,
    accessory: 'backpack',
    labelColor: 'linear-gradient(135deg, rgba(46, 125, 50, 0.9), rgba(67, 160, 71, 0.9))',
    startPosition: new THREE.Vector3(-25, 0.19, -5),
    patrolPoints: [
      new THREE.Vector3(-35, 0.19, -5),
      new THREE.Vector3(-16, 0.19, -5),
      new THREE.Vector3(-25, 0.19, 5),
    ],
  },
  {
    id: 'agent-sheliak',
    name: 'Sheliak',
    starDesignation: 'Beta Lyrae (β Lyr)',
    role: 'Engenheiro & Atleta',
    color: 0xe65100, // Laranja solar / cobre
    accentColor: 0xffb74d, // Âmbar radiante
    hairColor: 0x5d4037, // Cobre escuro
    hairStyle: 'spiky',
    skinColor: 0xe0a97c,
    pantsColor: 0x212121,
    shoeColor: 0xbf360c,
    accessory: 'headphones',
    labelColor: 'linear-gradient(135deg, rgba(230, 81, 0, 0.9), rgba(255, 152, 0, 0.9))',
    startPosition: new THREE.Vector3(20, 0.19, -14),
    patrolPoints: [
      new THREE.Vector3(26, 0.19, -22),
      new THREE.Vector3(20, 0.19, -8),
      new THREE.Vector3(14, 0.19, -14),
    ],
  },
  {
    id: 'agent-epsilon',
    name: 'Epsilon',
    starDesignation: 'Epsilon Lyrae (ε Lyr)',
    role: 'Filósofo & Analista',
    color: 0x5e35b1, // Violeta cósmico
    accentColor: 0xd1c4e9, // Lavanda suave
    hairColor: 0xdcdde1, // Prateado platinado
    hairStyle: 'long',
    skinColor: 0xffe0bd,
    pantsColor: 0x263238,
    shoeColor: 0x121212,
    accessory: 'glasses',
    labelColor: 'linear-gradient(135deg, rgba(81, 45, 168, 0.9), rgba(126, 87, 194, 0.9))',
    startPosition: new THREE.Vector3(20, 0.19, 8),
    patrolPoints: [
      new THREE.Vector3(28, 0.19, 8),
      new THREE.Vector3(20, 0.19, 16),
      new THREE.Vector3(12, 0.19, 8),
    ],
  },
  {
    id: 'agent-aladfar',
    name: 'Aladfar',
    starDesignation: 'Delta Lyrae (δ Lyr)',
    role: 'Artista & Designer',
    color: 0xad1457, // Carmesim rubi profundo
    accentColor: 0xf48fb1, // Rosa quartzo
    hairColor: 0x1a1a1a, // Preto ônix
    hairStyle: 'beanie',
    skinColor: 0x8d5524, // Negra nobre retinta
    pantsColor: 0x1e1e24,
    shoeColor: 0x4a148c,
    accessory: 'satchel',
    labelColor: 'linear-gradient(135deg, rgba(173, 20, 87, 0.9), rgba(233, 30, 99, 0.9))',
    startPosition: new THREE.Vector3(-16, 0.19, 16),
    patrolPoints: [
      new THREE.Vector3(-16, 0.19, 28),
      new THREE.Vector3(-28, 0.19, 28),
      new THREE.Vector3(-28, 0.19, 16),
      new THREE.Vector3(-16, 0.19, 16),
    ],
  },
  {
    id: 'agent-xihe',
    name: 'Xihe',
    starDesignation: 'Zeta Lyrae (ζ Lyr)',
    role: 'Arquiteta & Botânica',
    color: 0x00838f, // Turquesa petróleo
    accentColor: 0x80deea, // Ciano brilhante
    hairColor: 0x3e2723, // Castanho chocolate
    hairStyle: 'curly',
    skinColor: 0xc68642, // Parda quente
    pantsColor: 0x283593,
    shoeColor: 0x004d40,
    accessory: 'smartwatch',
    labelColor: 'linear-gradient(135deg, rgba(0, 131, 143, 0.9), rgba(0, 172, 193, 0.9))',
    startPosition: new THREE.Vector3(-10, 0.19, -20),
    patrolPoints: [
      new THREE.Vector3(-10, 0.19, -32),
      new THREE.Vector3(-10, 0.19, -12),
      new THREE.Vector3(-10, 0.19, -20),
    ],
  },
  {
    id: 'agent-chason',
    name: 'Chasoň',
    starDesignation: 'Eta Lyrae (η Lyr)',
    role: 'Mensageiro & Skatista',
    color: 0xf9a825, // Amarelo solar / ouro
    accentColor: 0xfff59d, // Amarelo pastel
    hairColor: 0xd4a373, // Louro caramelo
    hairStyle: 'cap',
    skinColor: 0xf1c27d, // Bronzeado natural
    pantsColor: 0x455a64,
    shoeColor: 0x263238,
    accessory: 'cap_reverse',
    labelColor: 'linear-gradient(135deg, rgba(245, 127, 23, 0.9), rgba(251, 192, 45, 0.9))',
    startPosition: new THREE.Vector3(10, 0.19, 14),
    patrolPoints: [
      new THREE.Vector3(10, 0.19, 24),
      new THREE.Vector3(10, 0.19, 6),
      new THREE.Vector3(10, 0.19, 14),
    ],
  },
];
