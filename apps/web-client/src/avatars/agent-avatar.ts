// apps/web/src/avatars/agent-avatar.ts
import * as THREE from 'three';
import { ObstacleCollider } from '../scenes/city-scene';
import { speechSynth } from '../audio/speech-synth';
import { VehicleAudioEngine, VehicleHornEvent } from '../vehicles/vehicle-agent';

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
  public speechText: string = '';
  public targetPosition: THREE.Vector3 | null = null;
  public isWaitingAtCrosswalk: boolean = false;
  public emotionState: string = 'calm';
  public isNearPlayer: boolean = false;
  public hasReceivedServerTarget: boolean = false;
  public isEvadingVehicle: boolean = false;
  public evasionTarget: THREE.Vector3 | null = null;
  public evasionTimer: number = 0;
  public lastColliders: ObstacleCollider[] = [];
  private unsubscribeHorn?: () => void;
  private proximityGreetingCooldown: number = 0;

  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private walkCycleTime: number = 0;
  private patrolIndex: number = 0;
  private waitTimer: number = 0;
  private blockedObstacleTimer: number = 0;

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
    this.unsubscribeHorn = VehicleAudioEngine.onHorn(this.handleVehicleHorn.bind(this));
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
    // Balões com nomes estáticos dos NPCs foram retirados para evitar poluição visual na cena 3D.
    // Instancia o elemento oculto em memória para compatibilidade sem anexá-lo ao DOM.
    this.label = document.createElement('div');
    this.label.className = 'agent-label';
    this.label.style.display = 'none';
  }

  /**
   * Emite uma fala ou pensamento visível em balão estilizado sobre o avatar (Task-026).
   * Os balões de conversa só são emitidos quando o avatar do jogador estiver próximo (<= 3.5m)
   * ou se forceShow for explicitamente verdadeiro (ex: diálogo interativo face a face).
   */
  public say(message: string, durationSeconds: number = 4.0, forceShow: boolean = false): void {
    const isAllowed = forceShow || this.isNearPlayer;
    if (!isAllowed) {
      return;
    }

    this.speechTimer = durationSeconds;
    this.speechText = message;
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

    // Dispara síntese de voz TTS apenas quando autorizado por proximidade
    try {
      speechSynth.speak(this.config.id, message).catch(() => {});
    } catch {
      // Ignora silenciosamente se o navegador bloquear autoplay
    }
  }

  /**
   * Define novo destino de navegação disparado pelo servidor via AgentAction API (Task-025/026).
   */
  public setTargetPosition(pos: { x: number; y?: number; z: number }): void {
    this.targetPosition = new THREE.Vector3(pos.x, pos.y ?? this.position.y, pos.z);
    this.hasReceivedServerTarget = true;
    this.waitTimer = 0; // Acorda de pausas locais para navegar ao destino
  }

  /**
   * Interrompe o movimento do agente imediatamente.
   */
  public stopMovement(): void {
    this.targetPosition = null;
    this.hasReceivedServerTarget = true;
    this.waitTimer = 1.0;
    this.speed = 0;
  }

  public updateLabel(camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    if (this.label) {
      this.label.style.display = 'none';
    }

    // Atualiza posição do balão de fala dinâmico apenas se estiver ativo e próximo
    if (this.speechBubble) {
      if (this.speechTimer > 0 && this.isNearPlayer) {
        const bubblePos = this.position.clone().add(new THREE.Vector3(0, 2.95, 0));
        bubblePos.project(camera);
        const w = renderer.domElement.clientWidth;
        const h = renderer.domElement.clientHeight;
        const bx = (bubblePos.x * 0.5 + 0.5) * w;
        const by = (-bubblePos.y * 0.5 + 0.5) * h;
        if (bubblePos.z < 1) {
          this.speechBubble.style.display = 'block';
          this.speechBubble.style.left = `${bx}px`;
          this.speechBubble.style.top = `${by}px`;
        } else {
          this.speechBubble.style.display = 'none';
        }
      } else {
        this.speechBubble.style.display = 'none';
      }
    }
  }

  /**
   * Checa se a posição desejada colide com algum obstáculo da cena ou veículo dinâmico.
   */
  public checkCollision(targetX: number, targetZ: number, colliders: ObstacleCollider[]): boolean {
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

  /**
   * Identifica se uma coordenada (x, z) recai sobre a malha asfáltica destinada a veículos.
   */
  public isRoadAsphalt(x: number, z: number): boolean {
    // Avenida Central (Norte-Sul): pista veicular entre x = -6.8 e x = 6.8
    if (Math.abs(x) < 6.8 && Math.abs(z) < 55) return true;
    // Rua Transversal (Leste-Oeste): pista veicular entre z = -6.8 e z = 6.8
    if (Math.abs(z) < 6.8 && Math.abs(x) < 55) return true;
    // Anel Viário Perimetral (faixas entre ±62m e ±76m)
    if ((Math.abs(x) >= 61 && Math.abs(x) <= 76) || (Math.abs(z) >= 61 && Math.abs(z) <= 76)) {
      return true;
    }
    return false;
  }

  /**
   * Encontra um ponto livre e aleatório fora das faixas veiculares para fuga/desvio seguro (Task-026).
   * Garante que o local escolhido não colida com nenhum obstáculo, não esteja no asfalto veicular
   * e mantenha distância segura da fonte da buzina.
   */
  public findFreeRandomLocation(
    vehiclePos?: THREE.Vector3,
    vehicleDir?: THREE.Vector3,
    colliders: ObstacleCollider[] = [],
  ): THREE.Vector3 {
    const vPos = vehiclePos || this.position;
    const vDir = vehicleDir ? vehicleDir.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const sideDir = new THREE.Vector3(-vDir.z, 0, vDir.x);

    // Vetor do veículo até o agente para saber de que lado da pista o agente já está
    const toAgent = this.position.clone().sub(vPos);
    const preferredSideSign = toAgent.dot(sideDir) >= 0 ? 1 : -1;

    const candidates: THREE.Vector3[] = [];

    // Testa 24 pontos candidatos no entorno do agente (entre 6m e 16m)
    for (let i = 0; i < 24; i++) {
      const sideBias = Math.random() < 0.75 ? preferredSideSign : -preferredSideSign;
      const angle = (Math.random() * 0.8 - 0.4) + (sideBias > 0 ? Math.PI / 2 : -Math.PI / 2);
      const dist = 6.0 + Math.random() * 9.0;

      const candX = this.position.x + Math.sin(angle) * dist;
      const candZ = this.position.z + Math.cos(angle) * dist;

      // 1. Deve estar dentro do perímetro urbano
      if (Math.abs(candX) > 80 || Math.abs(candZ) > 80) continue;

      // 2. Não deve ser pista asfáltica de circulação veicular
      if (this.isRoadAsphalt(candX, candZ)) continue;

      // 3. Deve manter distância segura do veículo que buzinou
      const distToVeh = Math.hypot(candX - vPos.x, candZ - vPos.z);
      if (distToVeh < 6.5) continue;

      // 4. Não deve colidir com obstáculos físicos (prédios, postes, bancos, etc.)
      if (this.checkCollision(candX, candZ, colliders)) continue;

      candidates.push(new THREE.Vector3(candX, 0.19, candZ));
    }

    if (candidates.length > 0) {
      // Retorna aleatoriamente um dos locais livres e seguros validados
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Fallback seguro em calçada lateral desobstruída
    const fallbackX = this.position.x + sideDir.x * (preferredSideSign * 9.0);
    const fallbackZ = this.position.z + sideDir.z * (preferredSideSign * 9.0);
    return new THREE.Vector3(fallbackX, 0.19, fallbackZ);
  }

  /**
   * Responde ao alerta acústico de buzina de automóvel.
   * Se o habitante estiver na trajetória do carro ou em proximidade perigosa na via,
   * sai da frente imediatamente e busca um ponto livre aleatório fora da pista.
   */
  public handleVehicleHorn(event: VehicleHornEvent): void {
    const dist = this.position.distanceTo(event.position);
    const maxRange = event.range || 24.0;
    if (dist > maxRange) return;

    // Vetor do veículo até o NPC
    const toNPC = this.position.clone().sub(event.position);
    toNPC.y = 0;
    const fwd = (event.direction || new THREE.Vector3(0, 0, 1)).clone().normalize();
    fwd.y = 0;
    const fwdDist = toNPC.dot(fwd);

    // Distância perpendicular em relação ao eixo de marcha do veículo
    const sideVector = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const latDist = Math.abs(toNPC.dot(sideVector));

    // Habitante está à frente do carro (-1.5m a 20m com desvio lateral < 6.5m) ou muito próximo (< 10m)
    const isInPath = fwdDist > -1.5 && fwdDist < 20.0 && latDist < 6.5;
    const isVeryClose = dist < 10.0;

    if (isInPath || isVeryClose) {
      this.evadeVehicle(event);
    }
  }

  /**
   * Executa a manobra de fuga/saída da frente do veículo em direção a um local livre aleatório.
   */
  public evadeVehicle(event: VehicleHornEvent): void {
    const safeSpot = this.findFreeRandomLocation(event.position, event.direction, this.lastColliders);
    this.evasionTarget = safeSpot;
    this.isEvadingVehicle = true;
    this.evasionTimer = 6.0;
    this.waitTimer = 0;
    this.isWaitingAtCrosswalk = false;
    this.speed = this.walkSpeed * 1.65; // Acelera o passo para desobstruir a via rapidamente

    // Exclamação vocal contextualizada
    const phrases = [
      'Opa! Buzina de carro, saindo da frente!',
      'Saindo da pista! Calçada é mais segura.',
      'Cuidado aí! Indo para um ponto livre.',
      'Eita! Liberando a passagem para o veículo.',
      'Indo para a calçada, buzina alta!',
    ];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    this.say(phrase, 3.5, true);
  }

  /**
   * Calcula a direção ideal de navegação com desvio ativo e preditivo de obstáculos.
   * Utiliza sensores em feixe (whiskers) de curto e médio alcance combinados com
   * campos repulsivos de proximidade para contornar suavemente muros, árvores,
   * veículos dinâmicos, outros cidadãos e obstáculos da cidade.
   */
  public computeAvoidanceSteering(dir: THREE.Vector3, colliders: ObstacleCollider[]): THREE.Vector3 {
    if (colliders.length === 0) return dir.clone();

    const currX = this.position.x;
    const currZ = this.position.z;
    const lookahead = Math.max(1.3, Math.min(2.8, this.speed * 1.25));

    // 1. Checa se o vetor direto à frente ou a meio caminho colide com obstáculo
    const fwdX = currX + dir.x * lookahead;
    const fwdZ = currZ + dir.z * lookahead;
    const midX = currX + dir.x * (lookahead * 0.5);
    const midZ = currZ + dir.z * (lookahead * 0.5);

    const isDirectBlocked = this.checkCollision(fwdX, fwdZ, colliders) || this.checkCollision(midX, midZ, colliders);

    let chosenDir = dir.clone();

    if (isDirectBlocked) {
      // 2. Sensores em leque (whiskers): testa ângulos alternativos laterais à esquerda e direita
      // Prioriza desvios de menor desvio angular (30°, 50°, 75°, 100°, 125°, 150°)
      const angles = [
        Math.PI * 0.17, -Math.PI * 0.17,
        Math.PI * 0.28, -Math.PI * 0.28,
        Math.PI * 0.42, -Math.PI * 0.42,
        Math.PI * 0.56, -Math.PI * 0.56,
        Math.PI * 0.70, -Math.PI * 0.70,
      ];

      let foundClear = false;
      for (const ang of angles) {
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const testX = dir.x * cosA - dir.z * sinA;
        const testZ = dir.x * sinA + dir.z * cosA;

        const pFwdX = currX + testX * lookahead;
        const pFwdZ = currZ + testZ * lookahead;
        const pMidX = currX + testX * (lookahead * 0.5);
        const pMidZ = currZ + testZ * (lookahead * 0.5);

        if (!this.checkCollision(pFwdX, pFwdZ, colliders) && !this.checkCollision(pMidX, pMidZ, colliders)) {
          chosenDir = new THREE.Vector3(testX, 0, testZ);
          foundClear = true;
          break;
        }
      }

      if (!foundClear) {
        chosenDir = new THREE.Vector3(-dir.z, 0, dir.x); // desvio perpendicular lateral de emergência
      }
    }

    // 3. Força repulsiva contínua de proximidade contra obstáculos que estejam muito perto (<= r + 0.65m)
    let repelX = 0;
    let repelZ = 0;
    const repelMargin = this.radius + 0.65;
    const repelMarginSq = repelMargin * repelMargin;

    for (const c of colliders) {
      if (c.type === 'box') {
        if (c.minX === undefined || c.maxX === undefined || c.minZ === undefined || c.maxZ === undefined) continue;
        const closestX = Math.max(c.minX, Math.min(currX, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(currZ, c.maxZ));
        const dx = currX - closestX;
        const dz = currZ - closestZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < repelMarginSq && distSq > 1e-4) {
          const d = Math.sqrt(distSq);
          const force = (repelMargin - d) / repelMargin;
          repelX += (dx / d) * force;
          repelZ += (dz / d) * force;
        }
      } else if (c.type === 'cylinder') {
        if (c.cx === undefined || c.cz === undefined || c.radius === undefined) continue;
        const dx = currX - c.cx;
        const dz = currZ - c.cz;
        const distSq = dx * dx + dz * dz;
        const combined = this.radius + c.radius + 0.45;
        if (distSq < combined * combined && distSq > 1e-4) {
          const d = Math.sqrt(distSq);
          const force = (combined - d) / combined;
          repelX += (dx / d) * force;
          repelZ += (dz / d) * force;
        }
      }
    }

    if (repelX !== 0 || repelZ !== 0) {
      chosenDir.x += repelX * 1.8;
      chosenDir.z += repelZ * 1.8;
      chosenDir.normalize();
    }

    return chosenDir;
  }

  public update(
    delta: number,
    colliders: ObstacleCollider[] = [],
    trafficLightState: string = 'green',
    playerPos?: THREE.Vector3,
  ): void {
    this.lastColliders = colliders;

    // Se estiver em fuga ativa de veículo, atualiza cronômetro de evasão
    if (this.isEvadingVehicle) {
      this.evasionTimer -= delta;
      if (this.evasionTimer <= 0) {
        this.isEvadingVehicle = false;
        this.evasionTarget = null;
      }
    }

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

    if (this.proximityGreetingCooldown > 0) {
      this.proximityGreetingCooldown -= delta;
    }

    // Interação e atenção com o avatar do jogador Daniel em proximidade (≤ 3.5m)
    // Se o habitante estiver em evasão de buzina, prioriza salvar-se e desobstruir a via
    if (playerPos && !this.isEvadingVehicle) {
      const distToPlayer = this.position.distanceTo(playerPos);
      if (distToPlayer <= 3.5) {
        this.isNearPlayer = true;
        // Gira suavemente o corpo para encarar o avatar Daniel
        const dirToPlayer = new THREE.Vector3().subVectors(playerPos, this.position);
        const targetAngle = Math.atan2(dirToPlayer.x, dirToPlayer.z);
        const angleDiff = ((targetAngle - this.rotationY + Math.PI) % (Math.PI * 2)) - Math.PI;
        this.rotationY += angleDiff * Math.min(1, delta * 5);
        this.mesh.rotation.y = this.rotationY;

        // Desacelera para permitir diálogo presencial
        this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 8);

        // Saudação espontânea de presença caso ainda não tenha recebido fala autoritativa do servidor
        if (this.proximityGreetingCooldown <= 0) {
          this.proximityGreetingCooldown = 25.0;
          if (!this.speechBubble || this.speechTimer <= 0) {
            this.say(`Olá Daniel! Sou ${this.config.name}. Que bom ver você caminhando pela cidade!`, 5.0);
          }
        }

        // Se estiver muito próximo (≤ 2.2m), para completamente para conversar
        if (distToPlayer <= 2.2) {
          this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
          this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
          this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 8);
          this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 8);
          this.mesh.position.y = 0.04;
          return;
        }
      } else {
        this.isNearPlayer = false;
        if (this.speechBubble && (this.speechTimer > 0 || this.speechBubble.style.display !== 'none')) {
          this.speechTimer = 0;
          this.speechBubble.style.opacity = '0';
          this.speechBubble.style.display = 'none';
          speechSynth.stop();
        }
      }
    } else {
      this.isNearPlayer = false;
      if (this.speechBubble && (this.speechTimer > 0 || this.speechBubble.style.display !== 'none') && !this.isEvadingVehicle) {
        this.speechTimer = 0;
        this.speechBubble.style.opacity = '0';
        this.speechBubble.style.display = 'none';
        speechSynth.stop();
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
    // A evasão de buzina possui prioridade vital sobre a espera na faixa
    const isNearCrosswalk = Math.abs(this.position.x) < 4.5 && Math.abs(this.position.z) < 6;
    if (!this.isEvadingVehicle && isNearCrosswalk && trafficLightState === 'green') {
      this.isWaitingAtCrosswalk = true;
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 8);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
      return;
    }
    this.isWaitingAtCrosswalk = false;

    // Se o agente estiver sob controle autoritativo do servidor e não possuir novo destino ativo,
    // ele permanece no local atual realizando sua atividade em repouso ao invés de ciclar rotas locais.
    if (!this.isEvadingVehicle && !this.targetPosition && this.hasReceivedServerTarget) {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 8);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 8);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 8);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 8);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 8);
      this.mesh.position.y = 0.04;
      return;
    }

    // Prioridade de destino:
    // 1. Evasão de buzina (sair da frente e buscar local livre)
    // 2. Destino recebido do servidor
    // 3. Rota de patrulha local
    let target: THREE.Vector3;
    let isServerTarget = false;
    let isEvasion = false;

    if (this.isEvadingVehicle && this.evasionTarget) {
      target = this.evasionTarget;
      isEvasion = true;
    } else if (this.targetPosition) {
      target = this.targetPosition;
      isServerTarget = true;
    } else {
      target = this.config.patrolPoints[this.patrolIndex];
    }

    const flat = new THREE.Vector3(target.x, this.position.y, target.z);
    const toTarget = flat.clone().sub(this.position);
    const distToTarget = toTarget.length();

    if (distToTarget < (isEvasion ? 0.9 : 0.5)) {
      if (isEvasion) {
        this.isEvadingVehicle = false;
        this.evasionTarget = null;
        this.waitTimer = 2.0; // Pausa no local livre seguro para respirar e observar
        return;
      }
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

    const dir = toTarget.clone().normalize();

    // Calcula direção com desvio ativo e preditivo de obstáculos
    const steerDir = this.computeAvoidanceSteering(dir, colliders);

    const targetAngle = Math.atan2(steerDir.x, steerDir.z);
    const angleDiff = ((targetAngle - this.rotationY + Math.PI) % (Math.PI * 2)) - Math.PI;
    this.rotationY += angleDiff * Math.min(1, delta * 7);
    this.mesh.rotation.y = this.rotationY;

    // Deslocamento dinâmico: velocidade elevada durante evasão
    const targetSpeed = isEvasion ? this.walkSpeed * 1.65 : this.walkSpeed;
    const step = this.speed * delta;
    const desiredDx = steerDir.x * step;
    const desiredDz = steerDir.z * step;

    // Resolução de colisão com deslizamento de superfície (wall-sliding) contra automóveis e obstáculos
    const currX = this.position.x;
    const currZ = this.position.z;

    let nextX = currX + desiredDx;
    let nextZ = currZ + desiredDz;

    if (this.checkCollision(nextX, nextZ, colliders)) {
      // Tenta deslizar no eixo X
      if (!this.checkCollision(nextX, currZ, colliders)) {
        nextZ = currZ;
      } else if (!this.checkCollision(currX, nextZ, colliders)) {
        // Tenta deslizar no eixo Z
        nextX = currX;
      } else {
        // Tenta deslizamento perpendicular tangencial
        const perpX1 = -steerDir.z * step;
        const perpZ1 = steerDir.x * step;
        const perpX2 = steerDir.z * step;
        const perpZ2 = -steerDir.x * step;

        if (!this.checkCollision(currX + perpX1, currZ + perpZ1, colliders)) {
          nextX = currX + perpX1;
          nextZ = currZ + perpZ1;
        } else if (!this.checkCollision(currX + perpX2, currZ + perpZ2, colliders)) {
          nextX = currX + perpX2;
          nextZ = currZ + perpZ2;
        } else {
          nextX = currX;
          nextZ = currZ;
        }
      }
    }

    const isBlocked = nextX === currX && nextZ === currZ && (desiredDx !== 0 || desiredDz !== 0);
    if (isBlocked) {
      this.blockedObstacleTimer += delta;
      if (this.blockedObstacleTimer > 0.4) {
        const perpX = -dir.z * step * 1.2;
        const perpZ = dir.x * step * 1.2;
        if (!this.checkCollision(currX + perpX, currZ + perpZ, colliders)) {
          this.position.x = currX + perpX;
          this.position.z = currZ + perpZ;
        } else if (!this.checkCollision(currX - perpX, currZ - perpZ, colliders)) {
          this.position.x = currX - perpX;
          this.position.z = currZ - perpZ;
        }
      }
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed * 0.4, delta * 6);
    } else {
      this.blockedObstacleTimer = 0;
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, delta * 6);
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    // Animação dinâmica de caminhada/corrida proporcional à velocidade real
    if (this.speed > 0.2) {
      const freq = isEvasion ? 2.8 : 2.0;
      this.walkCycleTime += delta * this.speed * freq;
      const legAngle = Math.sin(this.walkCycleTime) * (isEvasion ? 0.75 : 0.55);
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
    if (this.unsubscribeHorn) {
      this.unsubscribeHorn();
      this.unsubscribeHorn = undefined;
    }
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
      new THREE.Vector3(-25, 0.19, -5),
      new THREE.Vector3(-55.5, 0.19, 9.5),
      new THREE.Vector3(-75.5, 0.19, 0), // Banco Perimetral Oeste & Alameda Ecológica
      new THREE.Vector3(-55.5, 0.19, -9.5),
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
      new THREE.Vector3(14, 0.19, 14),
      new THREE.Vector3(9.5, 0.19, 55.5),  // Conector Sul
      new THREE.Vector3(0, 0.19, 75.5),    // Banco Perimetral Sul
      new THREE.Vector3(72, 0.19, 72),     // Mirante Panorâmico Sudeste
      new THREE.Vector3(55.5, 0.19, 9.5),  // Conector Leste
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
      new THREE.Vector3(20, 0.19, 8),
      new THREE.Vector3(55.5, 0.19, 9.5),
      new THREE.Vector3(75.5, 0.19, 0),    // Banco Perimetral Leste
      new THREE.Vector3(55.5, 0.19, -9.5),
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
      new THREE.Vector3(-10, 0.19, -20),
      new THREE.Vector3(-18.5, 0.19, -45), // Alameda Noroeste do Super Market
      new THREE.Vector3(0, 0.19, -75.5),   // Banco Perimetral Norte
      new THREE.Vector3(18.5, 0.19, -45),  // Alameda Nordeste do Super Market
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
      new THREE.Vector3(-9.5, 0.19, 52),
      new THREE.Vector3(0, 0.19, 72),
      new THREE.Vector3(10, 0.19, 14),
    ],
  },
];
