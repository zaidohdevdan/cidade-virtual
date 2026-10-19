// apps/web-client/src/vehicles/vehicle-agent.ts
import * as THREE from 'three';
import { ObstacleCollider, TrafficLightRef } from '../scenes/city-scene';

export type VehicleType = 'sedan' | 'suv' | 'hatch' | 'coupe';

export type VehicleBehaviorState =
  | 'CRUISING'
  | 'APPROACHING_INTERSECTION'
  | 'WAITING_SIGNAL'
  | 'TURNING'
  | 'OBSTACLE_BRAKING'
  | 'U_TURN_MANEUVER'
  | 'PARKING_MANEUVER'
  | 'PARKED'
  | 'UNPARKING_MANEUVER';

export interface VehicleConfig {
  id: string;
  name: string;
  modelName: string;
  type: VehicleType;
  color: number;
  cruiseSpeed: number; // m/s (~6.5 a 9.0 m/s = 23 a 32 km/h)
  startPosition: THREE.Vector3;
  startRotationY: number;
  routeAxis: 'NS' | 'EW'; // Eixo principal de circulação
  routeDirection: 1 | -1; // 1 = sentido positivo (+Z ou +X), -1 = sentido negativo (-Z ou -X)
  canPark?: boolean; // Pode estacionar junto ao meio-fio
}

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRIA VIÁRIA (mão direita conforme CTB)
// ─────────────────────────────────────────────────────────────────────────────
// Avenida Central (eixo Z):  sentido Norte (-Z) em x = +3.5 | sentido Sul (+Z) em x = -3.5
// Rua Transversal (eixo X):  sentido Leste (+X) em z = +3.5 | sentido Oeste (-X) em z = -3.5
const LANE_OFFSET = 3.5;
const CURB_PARK_OFFSET = 2.5; // deslocamento da faixa até a vaga junto ao meio-fio (x/z = ±6.0)
const INTERSECTION_HALF = 8.0; // caixa de conflito do cruzamento
const STOP_CENTER_DIST = 15.0; // centro do carro quando o para-choque encosta na linha de retenção (12.5m)
const SIGNAL_LOOKAHEAD = 40.0;
const TURN_START_DIST = 9.5;
const TURN_EXIT_DIST = 9.0;
const CAR_HALF_LENGTH = 2.3;

// Limites de cada via (o Super Market ocupa z < -38.5 no extremo norte da Avenida Central)
const ROAD_END = {
  NS_NORTH: -30,
  NS_SOUTH: 44,
  EW: 44,
};

// Dinâmica longitudinal
const MAX_ACCEL = 2.2; // m/s²
const COMFORT_DECEL = 2.6; // m/s²
const MAX_DECEL = 6.5; // m/s² (frenagem de emergência)

type Axis = 'NS' | 'EW';
type Dir = 1 | -1;
type TurnIntent = 'STRAIGHT' | 'LEFT' | 'RIGHT';
type SignalLamp = 'OFF' | 'LEFT' | 'RIGHT' | 'HAZARD';
type ObstacleKind = 'none' | 'pedestrian' | 'player' | 'vehicle';

interface BezierPath {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  p3: THREE.Vector3;
  length: number;
  reverse: boolean;
}

interface Perception {
  kind: ObstacleKind;
  gap: number; // distância livre entre para-choque e obstáculo
  leaderSpeed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ÁUDIO SINTETIZADO NATIVO (BUZINA AUTOMOTIVA REALISTA VIA WEB AUDIO API)
// ─────────────────────────────────────────────────────────────────────────────
class VehicleAudioEngine {
  private static ctx: AudioContext | null = null;

  public static playHorn(gainVolume = 0.12): void {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gainVolume, now + 0.03);
      gainNode.gain.setValueAtTime(gainVolume, now + 0.22);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      gainNode.connect(this.ctx.destination);

      // Buzina bitonal típica de automóveis (435 Hz + 540 Hz)
      const freqs = [435, 540];
      for (const freq of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.28);
      }
    } catch {
      // Ignora silenciosamente se o browser restringir áudio antes do primeiro clique
    }
  }
}

function wrapAngle(a: number): number {
  return THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
}

function laneAngle(axis: Axis, dir: Dir): number {
  if (axis === 'NS') return dir === 1 ? 0 : Math.PI;
  return dir === 1 ? Math.PI / 2 : -Math.PI / 2;
}

/** Coordenada lateral do centro da faixa (mão direita). */
function laneLateral(axis: Axis, dir: Dir): number {
  return axis === 'NS' ? -dir * LANE_OFFSET : dir * LANE_OFFSET;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENTE DE VEÍCULO AUTÔNOMO
// ─────────────────────────────────────────────────────────────────────────────
export class VehicleAgent {
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public rotationY: number = 0;
  public speed: number = 0;
  public config: VehicleConfig;
  public state: VehicleBehaviorState = 'CRUISING';

  // Hierarquia visual com suspensão dinâmica desacoplada
  private bodyGroup: THREE.Group;
  private frontWheelPivots: THREE.Group[] = [];
  private rollingWheels: THREE.Mesh[] = [];

  // Materiais das lanternas reativas
  private brakeLightMat!: THREE.MeshStandardMaterial;
  private headlightMat!: THREE.MeshStandardMaterial;
  private reverseLightMat!: THREE.MeshStandardMaterial;
  private leftTurnSignalMat!: THREE.MeshStandardMaterial;
  private rightTurnSignalMat!: THREE.MeshStandardMaterial;

  // Dinâmica de suspensão
  private currentPitch: number = 0;
  private currentRoll: number = 0;
  private steeringAngle: number = 0;
  private targetSteeringAngle: number = 0;
  private prevSpeed: number = 0;
  private prevRotationY: number = 0;
  private measuredAccel: number = 0;
  private measuredYawRate: number = 0;

  // Navegação
  private currentAxis: Axis;
  private currentDirection: Dir;
  private targetSpeed: number = 0;

  // Intenções latched (sorteadas UMA vez por aproximação, nunca por frame)
  private turnIntent: TurnIntent = 'STRAIGHT';
  private turnIntentRolled = false;
  private parkIntent = false;
  private parkIntentRolled = false;
  private parkCooldown = 8;
  private yellowDecision: 'GO' | 'STOP' | null = null;

  // Manobras por trajetória Bézier parametrizada por comprimento de arco
  private path: BezierPath | null = null;
  private pathS = 0;
  private pathMaxSpeed = 3.5;
  private pendingAxis: Axis = 'NS';
  private pendingDir: Dir = 1;
  private uTurnReverseRemaining = 0;

  // Temporizadores
  private blockedTimer = 0;
  private honked = false;
  private parkTimer = 0;
  private parkDuration = 12;

  // Sinalização
  private turnSignalState: SignalLamp = 'OFF';
  private blinkTimer: number = 0;

  // Colisores dinâmicos para o avatar (3 círculos ao longo da carroceria)
  private readonly colliderCache: ObstacleCollider[] = [
    { type: 'cylinder', cx: 0, cz: 0, radius: 1.05, name: '' },
    { type: 'cylinder', cx: 0, cz: 0, radius: 1.05, name: '' },
    { type: 'cylinder', cx: 0, cz: 0, radius: 1.05, name: '' },
  ];

  private readonly wheelbase = 2.7;

  constructor(config: VehicleConfig) {
    this.config = config;
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.position.copy(config.startPosition);

    this.currentAxis = config.routeAxis;
    this.currentDirection = config.routeDirection;
    this.rotationY = laneAngle(this.currentAxis, this.currentDirection);
    this.mesh.rotation.y = this.rotationY;
    this.prevRotationY = this.rotationY;

    this.targetSpeed = config.cruiseSpeed;
    this.speed = config.cruiseSpeed * 0.4;
    this.prevSpeed = this.speed;

    for (const c of this.colliderCache) c.name = `Veículo (${config.name})`;

    this.bodyGroup = new THREE.Group();
    this.mesh.add(this.bodyGroup);

    this.buildVehicleModel();
    this.buildContactShadow();
  }

  // ──────────────────── CONSTRUÇÃO DO MODELO 3D DETALHADO ────────────────────
  private buildVehicleModel(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.config.color,
      roughness: 0.2,
      metalness: 0.75,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88bbdd,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.9,
    });
    const wheelRimMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.9,
      roughness: 0.25,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x161616,
      roughness: 0.9,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      metalness: 0.95,
      roughness: 0.08,
    });
    const blackTrimMat = new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.8,
    });

    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfff9e6,
      emissive: 0xffea88,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    this.brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff0000,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    this.reverseLightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    this.leftTurnSignalMat = new THREE.MeshStandardMaterial({
      color: 0xff9800,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
    });
    this.rightTurnSignalMat = new THREE.MeshStandardMaterial({
      color: 0xff9800,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
    });

    // Dimensões do veículo
    const carLength = 4.4;
    const carWidth = 2.0;

    // Chassi inferior montado no bodyGroup (permite roll & pitch)
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(carWidth, 0.42, carLength), bodyMat);
    chassis.position.y = 0.42;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.bodyGroup.add(chassis);

    // Para-choques aerodinâmicos
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(carWidth + 0.04, 0.26, 0.25), blackTrimMat);
    frontBumper.position.set(0, 0.32, carLength / 2 + 0.08);
    this.bodyGroup.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(carWidth + 0.04, 0.26, 0.25), blackTrimMat);
    rearBumper.position.set(0, 0.32, -carLength / 2 - 0.08);
    this.bodyGroup.add(rearBumper);

    // Grade dianteira cromada
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.08), chromeMat);
    grille.position.set(0, 0.46, carLength / 2 + 0.12);
    this.bodyGroup.add(grille);

    // Cabine e colunas
    const cabinLength = carLength * 0.58;
    const cabinWidth = carWidth * 0.88;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth, 0.62, cabinLength), bodyMat);
    cabin.position.set(0, 0.88, -0.15);
    cabin.castShadow = true;
    this.bodyGroup.add(cabin);

    // Para-brisa dianteiro
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth - 0.1, 0.52, 0.1), glassMat);
    windshield.position.set(0, 0.90, cabinLength / 2 - 0.1);
    windshield.rotation.x = -Math.PI / 6;
    this.bodyGroup.add(windshield);

    // Vidro traseiro
    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth - 0.1, 0.48, 0.1), glassMat);
    rearWindow.position.set(0, 0.90, -cabinLength / 2 - 0.2);
    rearWindow.rotation.x = Math.PI / 6;
    this.bodyGroup.add(rearWindow);

    // Vidros laterais e espelhos
    for (const side of [-1, 1]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, cabinLength - 0.3), glassMat);
      sideGlass.position.set(side * (cabinWidth / 2 + 0.02), 0.88, -0.15);
      this.bodyGroup.add(sideGlass);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), bodyMat);
      mirror.position.set(side * (carWidth / 2 + 0.12), 0.85, 0.65);
      this.bodyGroup.add(mirror);
    }

    // ──────────────────── FARÓIS & LANTERNAS ILUMINADAS ────────────────────
    // Faróis dianteiros duplos (+Z é frente)
    for (const side of [-1, 1]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.1), this.headlightMat);
      headlight.position.set(side * 0.72, 0.52, carLength / 2 + 0.06);
      this.bodyGroup.add(headlight);
    }

    // Lanternas traseiras duplas com freio e ré
    for (const side of [-1, 1]) {
      const brakeLight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.1), this.brakeLightMat);
      brakeLight.position.set(side * 0.72, 0.52, -carLength / 2 - 0.06);
      this.bodyGroup.add(brakeLight);

      const revLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.11), this.reverseLightMat);
      revLight.position.set(side * 0.42, 0.52, -carLength / 2 - 0.06);
      this.bodyGroup.add(revLight);
    }

    // Setas indicadoras de direção (dianteiras e traseiras nos cantos)
    // Lado esquerdo do motorista (+X local quando a frente é +Z):
    const frontLeftBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.08), this.leftTurnSignalMat);
    frontLeftBlinker.position.set(0.92, 0.52, carLength / 2 + 0.06);
    this.bodyGroup.add(frontLeftBlinker);

    const rearLeftBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.08), this.leftTurnSignalMat);
    rearLeftBlinker.position.set(0.92, 0.52, -carLength / 2 - 0.06);
    this.bodyGroup.add(rearLeftBlinker);

    // Lado direito (-X local):
    const frontRightBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.08), this.rightTurnSignalMat);
    frontRightBlinker.position.set(-0.92, 0.52, carLength / 2 + 0.06);
    this.bodyGroup.add(frontRightBlinker);

    const rearRightBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.08), this.rightTurnSignalMat);
    rearRightBlinker.position.set(-0.92, 0.52, -carLength / 2 - 0.06);
    this.bodyGroup.add(rearRightBlinker);

    // ──────────────────── RODAS COM SISTEMA DE ESTERÇAMENTO REAL ────────────────────
    const wheelRadius = 0.36;
    const wheelWidth = 0.26;
    const frontZ = carLength / 2 - 0.95;
    const rearZ = -carLength / 2 + 0.95;

    // Rodas dianteiras: montadas em pivôs com ângulo de esterçamento (steering knuckle)
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (carWidth / 2 + 0.04), wheelRadius, frontZ);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      pivot.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 12), wheelRimMat);
      rim.rotation.z = Math.PI / 2;
      pivot.add(rim);

      this.mesh.add(pivot);
      this.frontWheelPivots.push(pivot);
      this.rollingWheels.push(tire);
    }

    // Rodas traseiras: montadas fixas no chassi
    for (const side of [-1, 1]) {
      const rearGroup = new THREE.Group();
      rearGroup.position.set(side * (carWidth / 2 + 0.04), wheelRadius, rearZ);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      rearGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 12), wheelRimMat);
      rim.rotation.z = Math.PI / 2;
      rearGroup.add(rim);

      this.mesh.add(rearGroup);
      this.rollingWheels.push(tire);
    }
  }

  // ──────────────────── PLANO DE SOMBRA DE CONTATO SUAVE (AO BLOB) ────────────────────
  private buildContactShadow(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 15, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(2.6, 5.0);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.03; // Rente ao asfalto
    this.mesh.add(shadowMesh);
  }

  // ──────────────────── COLISORES DINÂMICOS (para o avatar) ────────────────────
  /** Três círculos ao longo do eixo do carro, atualizados com a pose atual. */
  public getColliders(): ObstacleCollider[] {
    const fx = Math.sin(this.rotationY);
    const fz = Math.cos(this.rotationY);
    const offsets = [-1.45, 0, 1.45];
    for (let i = 0; i < 3; i++) {
      const c = this.colliderCache[i];
      c.cx = this.position.x + fx * offsets[i];
      c.cz = this.position.z + fz * offsets[i];
    }
    return this.colliderCache;
  }

  // ──────────────────── LOOP PRINCIPAL ────────────────────
  public update(
    delta: number,
    trafficLights: TrafficLightRef[],
    pedestrianPositions: THREE.Vector3[],
    playerPos: THREE.Vector3,
    otherVehicles: VehicleAgent[]
  ): void {
    if (delta <= 0) return;
    this.parkCooldown = Math.max(0, this.parkCooldown - delta);

    const perception = this.perceive(playerPos, pedestrianPositions, otherVehicles);

    switch (this.state) {
      case 'CRUISING':
      case 'APPROACHING_INTERSECTION':
      case 'WAITING_SIGNAL':
      case 'OBSTACLE_BRAKING':
        this.updateLaneFollowing(delta, perception, trafficLights, otherVehicles);
        break;
      case 'TURNING':
      case 'PARKING_MANEUVER':
      case 'UNPARKING_MANEUVER':
      case 'U_TURN_MANEUVER':
        this.updateManeuver(delta, perception);
        break;
      case 'PARKED':
        this.updateParked(delta, otherVehicles);
        break;
    }

    this.integrateSpeed(delta, perception);
    this.applyMotion(delta);
    this.resolveVehicleCollisions(otherVehicles);
    this.resolvePedestrianCollisions(pedestrianPositions, playerPos);
    this.updateSuspensionPhysics(delta);

    const wheelCircumference = Math.PI * 2 * 0.36;
    const wheelRotSpeed = (this.speed / wheelCircumference) * Math.PI * 2;
    for (const wheel of this.rollingWheels) {
      wheel.rotation.x += wheelRotSpeed * delta;
    }

    this.updateVehicleLighting(delta);
  }

  // ──────────────────── HELPERS DE GEOMETRIA ────────────────────
  private forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
  }

  /** Vetor para o lado direito do motorista. */
  private rightVec(): THREE.Vector3 {
    return new THREE.Vector3(-Math.cos(this.rotationY), 0, Math.sin(this.rotationY));
  }

  private along(): number {
    return this.currentAxis === 'NS' ? this.position.z : this.position.x;
  }

  private headingTowardCenter(): boolean {
    return this.along() * this.currentDirection < 0;
  }

  private static inIntersection(p: THREE.Vector3): boolean {
    return Math.abs(p.x) < INTERSECTION_HALF && Math.abs(p.z) < INTERSECTION_HALF;
  }

  // ──────────────────── PERCEPÇÃO FRONTAL ────────────────────
  private perceive(playerPos: THREE.Vector3, pedestrians: THREE.Vector3[], others: VehicleAgent[]): Perception {
    const reversing = this.speed < -0.05 || (this.path?.reverse ?? false) || this.uTurnReverseRemaining > 0;
    const fwd = this.forward();
    if (reversing) fwd.negate();

    const result: Perception = { kind: 'none', gap: Infinity, leaderSpeed: 0 };
    const tmp = new THREE.Vector3();
    const tmpPoint = new THREE.Vector3();

    const test = (p: THREE.Vector3, radius: number, range: number): number | null => {
      tmp.set(p.x - this.position.x, 0, p.z - this.position.z);
      const lon = tmp.dot(fwd);
      // Ignora apenas o que está totalmente atrás do veículo (atrás do para-choque traseiro) ou além do alcance
      if (lon < -CAR_HALF_LENGTH || lon > range) return null;
      const lat = Math.abs(tmp.x * fwd.z - tmp.z * fwd.x);
      if (lat > 1.15 + radius) return null;
      // Retorna distância livre até o para-choque dianteiro (se já estiver em contato/sobreposto, retorna 0)
      return Math.max(0, lon - CAR_HALF_LENGTH - radius);
    };

    const gp = test(playerPos, 0.45, 14);
    if (gp !== null && gp < result.gap) {
      result.kind = 'player';
      result.gap = gp;
      result.leaderSpeed = 0;
    }

    for (const ped of pedestrians) {
      const g = test(ped, 0.4, 14);
      if (g !== null && g < result.gap) {
        result.kind = 'pedestrian';
        result.gap = g;
        result.leaderSpeed = 0;
      }
    }

    const meInBox = VehicleAgent.inIntersection(this.position);
    for (const other of others) {
      if (other === this) continue;
      const otherFwd = new THREE.Vector3(Math.sin(other.rotationY), 0, Math.cos(other.rotationY));
      const alignment = fwd.dot(otherFwd);

      // Prioridade no cruzamento para fluxos perpendiculares (evita travamento mútuo):
      // quem já está dentro da caixa tem preferência; empate resolvido por id determinístico.
      if (Math.abs(alignment) < 0.5) {
        const otherInBox = VehicleAgent.inIntersection(other.position);
        const distToOther = this.position.distanceTo(other.position);
        if (distToOther > 4.5) {
          if (meInBox && !otherInBox) continue;
          if (meInBox && otherInBox && this.config.id < other.config.id) continue;
        }
      }

      // Testa os 3 círculos de colisão do outro veículo (cobre toda a extensão de 4.6m da carroceria)
      for (const c of other.getColliders()) {
        tmpPoint.set(c.cx ?? other.position.x, this.position.y, c.cz ?? other.position.z);
        const g = test(tmpPoint, c.radius ?? 1.05, 18);
        if (g !== null && g < result.gap) {
          result.kind = 'vehicle';
          result.gap = g;
          result.leaderSpeed = Math.max(0, other.speed * Math.max(0, alignment));
        }
      }
    }

    return result;
  }

  /**
   * Resolução física anti-penetração entre veículos.
   * Impede fisicamente que veículos se sobreponham ou atravessem um ao outro.
   */
  private resolveVehicleCollisions(otherVehicles: VehicleAgent[]): void {
    if (this.state === 'PARKED') return;
    const myColliders = this.getColliders();

    for (const other of otherVehicles) {
      if (other === this) continue;
      const otherColliders = other.getColliders();

      for (let i = 0; i < myColliders.length; i++) {
        const c1 = myColliders[i];
        for (let j = 0; j < otherColliders.length; j++) {
          const c2 = otherColliders[j];
          const dx = (c1.cx ?? this.position.x) - (c2.cx ?? other.position.x);
          const dz = (c1.cz ?? this.position.z) - (c2.cz ?? other.position.z);
          const distSq = dx * dx + dz * dz;
          const r1 = c1.radius ?? 1.05;
          const r2 = c2.radius ?? 1.05;
          const minDist = r1 + r2;

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dist > 1e-4 ? dx / dist : Math.sin(this.rotationY + Math.PI / 2);
            const nz = dist > 1e-4 ? dz / dist : Math.cos(this.rotationY + Math.PI / 2);

            if (other.state === 'PARKED') {
              this.position.x += nx * overlap;
              this.position.z += nz * overlap;
            } else {
              this.position.x += nx * (overlap * 0.5);
              this.position.z += nz * (overlap * 0.5);
              other.position.x -= nx * (overlap * 0.5);
              other.position.z -= nz * (overlap * 0.5);
              other.mesh.position.copy(other.position);
              other.speed = Math.min(other.speed, 0);
              other.targetSpeed = 0;
            }

            this.mesh.position.copy(this.position);
            this.speed = Math.min(this.speed, 0);
            this.targetSpeed = 0;
            this.state = 'OBSTACLE_BRAKING';
            this.getColliders();
            return;
          }
        }
      }
    }
  }

  /**
   * Empurra pedestres ou o avatar para fora da carroceria do veículo se houver contato físico.
   */
  private resolvePedestrianCollisions(pedestrians: THREE.Vector3[], playerPos: THREE.Vector3): void {
    const colliders = this.getColliders();
    const targets = [...pedestrians, playerPos];

    for (const target of targets) {
      for (const c of colliders) {
        const cx = c.cx ?? this.position.x;
        const cz = c.cz ?? this.position.z;
        const dx = target.x - cx;
        const dz = target.z - cz;
        const distSq = dx * dx + dz * dz;
        const rVeh = c.radius ?? 1.05;
        const rPed = 0.45;
        const minDist = rVeh + rPed;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dist > 1e-4 ? dx / dist : Math.sin(this.rotationY + Math.PI / 2);
          const nz = dist > 1e-4 ? dz / dist : Math.cos(this.rotationY + Math.PI / 2);

          target.x += nx * overlap;
          target.z += nz * overlap;

          this.speed = Math.min(this.speed, 0);
          this.targetSpeed = 0;
          this.state = 'OBSTACLE_BRAKING';
        }
      }
    }
  }

  /** Velocidade máxima segura para não colidir com o obstáculo percebido. */
  private obstacleSpeedLimit(p: Perception): number {
    if (p.kind === 'none') return Infinity;
    const minGap = p.kind === 'vehicle' ? 2.0 : 1.6;
    const free = Math.max(0, p.gap - minGap);
    const brakingEnvelope = Math.sqrt(2 * COMFORT_DECEL * free);
    const follow = p.leaderSpeed * THREE.MathUtils.clamp(free / 4, 0, 1);
    return brakingEnvelope + follow;
  }

  // ──────────────────── SINALIZAÇÃO SEMAFÓRICA ────────────────────
  private signalSpeedLimit(trafficLights: TrafficLightRef[]): number {
    if (!this.headingTowardCenter()) {
      this.yellowDecision = null;
      return Infinity;
    }
    const dist = Math.abs(this.along());
    // Já passou da linha de retenção: segue (não para dentro do cruzamento)
    if (dist < STOP_CENTER_DIST - 0.6 || dist > SIGNAL_LOOKAHEAD) {
      this.yellowDecision = null;
      return Infinity;
    }

    let id: string;
    if (this.currentAxis === 'NS') id = this.position.z > 0 ? 'tl-sul' : 'tl-norte';
    else id = this.position.x > 0 ? 'tl-leste' : 'tl-oeste';

    const tl = trafficLights.find((t) => t.id === id);
    if (!tl || tl.state === 'green') {
      this.yellowDecision = null;
      return Infinity;
    }

    const distToLine = Math.max(0, dist - STOP_CENTER_DIST);

    if (tl.state === 'yellow') {
      // Zona de dilema: decide UMA vez se consegue parar com conforto; senão atravessa
      if (this.yellowDecision === null) {
        const v = Math.max(0, this.speed);
        const stoppingDist = (v * v) / (2 * COMFORT_DECEL * 1.3);
        this.yellowDecision = stoppingDist > distToLine + 0.5 ? 'GO' : 'STOP';
      }
      if (this.yellowDecision === 'GO') return Infinity;
    } else {
      this.yellowDecision = null;
    }

    return Math.sqrt(2 * COMFORT_DECEL * distToLine);
  }

  // ──────────────────── SEGUIMENTO DE FAIXA ────────────────────
  private updateLaneFollowing(
    delta: number,
    perception: Perception,
    trafficLights: TrafficLightRef[],
    others: VehicleAgent[]
  ): void {
    const along = this.along();
    const dist = Math.abs(along);
    const toward = this.headingTowardCenter();
    const cruise = this.config.cruiseSpeed;

    // 1. Intenção de conversão sorteada UMA vez ao entrar na zona de aproximação
    if (toward && dist < 32 && !this.turnIntentRolled) {
      this.turnIntentRolled = true;
      const r = Math.random();
      this.turnIntent = r < 0.2 ? 'RIGHT' : r < 0.35 ? 'LEFT' : 'STRAIGHT';
    }
    if (!toward && dist > TURN_EXIT_DIST + 1) {
      this.turnIntentRolled = false;
      this.turnIntent = 'STRAIGHT';
    }

    // 2. Intenção de estacionar sorteada UMA vez ao sair do cruzamento
    if (!toward && dist > 12 && dist < 16 && !this.parkIntentRolled) {
      this.parkIntentRolled = true;
      this.parkIntent = !!this.config.canPark && this.parkCooldown <= 0 && Math.random() < 0.6;
    }
    if (toward) this.parkIntentRolled = false;

    // 3. Velocidade alvo = mínimo entre limites (cruzeiro, curva, semáforo, obstáculo)
    let limit = cruise;
    if (toward && this.turnIntent !== 'STRAIGHT' && dist < 26) {
      limit = Math.min(limit, this.turnIntent === 'RIGHT' ? 3.2 : 4.2);
    }
    const signalLimit = this.signalSpeedLimit(trafficLights);
    const obstacleLimit = this.obstacleSpeedLimit(perception);
    this.targetSpeed = Math.min(limit, signalLimit, obstacleLimit);

    // 4. Setas: acionadas com antecedência antes da conversão
    this.turnSignalState = toward && this.turnIntent !== 'STRAIGHT' && dist < 32 ? this.turnIntent : 'OFF';

    // 5. Rótulo de estado (derivado continuamente — não há transições bruscas)
    const stopped = this.speed < 0.3;
    if (obstacleLimit < Math.min(limit, signalLimit) && perception.kind !== 'none') {
      this.state = 'OBSTACLE_BRAKING';
    } else if (signalLimit < limit) {
      this.state = 'WAITING_SIGNAL';
    } else if (toward && dist < 32) {
      this.state = 'APPROACHING_INTERSECTION';
    } else {
      this.state = 'CRUISING';
    }

    // 6. Bloqueio persistente por pedestre/avatar → buzina e, se insistir, retorno em U.
    //    Veículos parados à frente (fila) NUNCA disparam retorno: o carro apenas aguarda.
    const blockedByPerson =
      this.state === 'OBSTACLE_BRAKING' && stopped && (perception.kind === 'pedestrian' || perception.kind === 'player');
    if (blockedByPerson) {
      this.blockedTimer += delta;
    } else {
      this.blockedTimer = Math.max(0, this.blockedTimer - delta * 2); // decaimento (robusto a oscilações)
      if (this.blockedTimer === 0) this.honked = false;
    }
    if (this.blockedTimer > 2.0 && !this.honked) {
      VehicleAudioEngine.playHorn(0.14);
      this.honked = true;
    }
    const nearIntersection = dist < 18;
    if (this.blockedTimer > 6.0 && !nearIntersection && this.oppositeLaneClear(others)) {
      this.startUTurn(true);
      return;
    }

    // 7. Conversão no cruzamento
    if (toward && this.turnIntent !== 'STRAIGHT' && dist <= TURN_START_DIST && dist > TURN_START_DIST - 2.5) {
      this.startTurn(this.turnIntent);
      return;
    }

    // 8. Estacionamento junto ao meio-fio
    if (this.parkIntent && !toward && dist >= 18 && dist <= 22 && this.roomToParkAhead() && this.curbSpotFree(others)) {
      this.startParking();
      return;
    }

    // 9. Fim da via → retorno em U (sem teletransporte)
    if (this.reachedRoadEnd()) {
      this.targetSpeed = Math.min(this.targetSpeed, 2.5);
      this.turnSignalState = 'LEFT';
      if (this.oppositeLaneClear(others)) {
        this.startUTurn(false);
      } else {
        this.targetSpeed = 0;
      }
    }
  }

  private reachedRoadEnd(): boolean {
    const a = this.along();
    if (this.currentAxis === 'NS') {
      return (this.currentDirection === -1 && a <= ROAD_END.NS_NORTH) || (this.currentDirection === 1 && a >= ROAD_END.NS_SOUTH);
    }
    return a * this.currentDirection >= ROAD_END.EW;
  }

  /** Entrada (9m) + saída da vaga (9m) precisam caber antes do fim da via. */
  private roomToParkAhead(): boolean {
    const finalAlong = this.along() + this.currentDirection * 19;
    if (this.currentAxis === 'NS') {
      return finalAlong > ROAD_END.NS_NORTH && finalAlong < ROAD_END.NS_SOUTH;
    }
    return Math.abs(finalAlong) < ROAD_END.EW;
  }

  private oppositeLaneClear(others: VehicleAgent[]): boolean {
    const oppDir: Dir = this.currentDirection === 1 ? -1 : 1;
    const oppLat = laneLateral(this.currentAxis, oppDir);
    const myAlong = this.along();
    for (const o of others) {
      if (o === this) continue;
      const lat = this.currentAxis === 'NS' ? o.position.x : o.position.z;
      const al = this.currentAxis === 'NS' ? o.position.z : o.position.x;
      if (Math.abs(lat - oppLat) < 2.5 && Math.abs(al - myAlong) < 16) return false;
    }
    return true;
  }

  private curbSpotFree(others: VehicleAgent[]): boolean {
    const target = this.position.clone().addScaledVector(this.forward(), 9).addScaledVector(this.rightVec(), CURB_PARK_OFFSET);
    return others.every((o) => o === this || o.position.distanceTo(target) > 6);
  }

  // ──────────────────── CONSTRUÇÃO DE MANOBRAS ────────────────────
  private buildPath(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, reverse: boolean): BezierPath {
    let length = 0;
    const prev = p0.clone();
    const cur = new THREE.Vector3();
    for (let i = 1; i <= 24; i++) {
      this.bezierPoint(p0, p1, p2, p3, i / 24, cur);
      length += cur.distanceTo(prev);
      prev.copy(cur);
    }
    return { p0, p1, p2, p3, length: Math.max(length, 0.01), reverse };
  }

  private bezierPoint(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
    const u = 1 - t;
    return out
      .set(0, 0, 0)
      .addScaledVector(p0, u * u * u)
      .addScaledVector(p1, 3 * u * u * t)
      .addScaledVector(p2, 3 * u * t * t)
      .addScaledVector(p3, t * t * t);
  }

  private bezierTangent(p: BezierPath, t: number, out: THREE.Vector3): THREE.Vector3 {
    const u = 1 - t;
    return out
      .set(0, 0, 0)
      .addScaledVector(p.p1.clone().sub(p.p0), 3 * u * u)
      .addScaledVector(p.p2.clone().sub(p.p1), 6 * u * t)
      .addScaledVector(p.p3.clone().sub(p.p2), 3 * t * t);
  }

  private beginPath(path: BezierPath, maxSpeed: number, state: VehicleBehaviorState, axis: Axis, dir: Dir): void {
    this.path = path;
    this.pathS = 0;
    this.pathMaxSpeed = maxSpeed;
    this.pendingAxis = axis;
    this.pendingDir = dir;
    this.state = state;
  }

  private startTurn(intent: TurnIntent): void {
    const d = this.currentDirection;
    let newAxis: Axis;
    let newDir: Dir;
    if (this.currentAxis === 'NS') {
      newAxis = 'EW';
      newDir = (intent === 'RIGHT' ? -d : d) as Dir;
    } else {
      newAxis = 'NS';
      newDir = (intent === 'RIGHT' ? d : -d) as Dir;
    }

    const p0 = this.position.clone();
    const exitLat = laneLateral(newAxis, newDir);
    const exitAlong = newDir * TURN_EXIT_DIST;
    const p3 = newAxis === 'NS' ? new THREE.Vector3(exitLat, p0.y, exitAlong) : new THREE.Vector3(exitAlong, p0.y, exitLat);

    const handle = 0.39 * p0.distanceTo(p3); // corda = R·√2 → alça ≈ 0.552·R (arco de 90°)
    const inF = this.forward();
    const outAng = laneAngle(newAxis, newDir);
    const outF = new THREE.Vector3(Math.sin(outAng), 0, Math.cos(outAng));
    const p1 = p0.clone().addScaledVector(inF, handle);
    const p2 = p3.clone().addScaledVector(outF, -handle);

    this.turnSignalState = intent === 'LEFT' ? 'LEFT' : 'RIGHT';
    this.beginPath(this.buildPath(p0, p1, p2, p3, false), intent === 'RIGHT' ? 3.2 : 4.2, 'TURNING', newAxis, newDir);
  }

  /** Retorno em U para a faixa oposta. withReverse = dá ré antes (obstáculo à frente). */
  private startUTurn(withReverse: boolean): void {
    this.state = 'U_TURN_MANEUVER';
    this.path = null;
    this.uTurnReverseRemaining = withReverse ? 3.5 : 0;
    if (!withReverse) this.buildUTurnArc();
  }

  private buildUTurnArc(): void {
    const oppDir: Dir = this.currentDirection === 1 ? -1 : 1;
    const p0 = this.position.clone();
    const f = this.forward();
    const oppLat = laneLateral(this.currentAxis, oppDir);
    const p3 = this.currentAxis === 'NS' ? new THREE.Vector3(oppLat, p0.y, p0.z) : new THREE.Vector3(p0.x, p0.y, oppLat);
    const p1 = p0.clone().addScaledVector(f, 4.0);
    const p2 = p3.clone().addScaledVector(f, 4.0);
    this.turnSignalState = 'LEFT';
    this.beginPath(this.buildPath(p0, p1, p2, p3, false), 2.8, 'U_TURN_MANEUVER', this.currentAxis, oppDir);
  }

  private startParking(): void {
    const f = this.forward();
    const r = this.rightVec();
    const p0 = this.position.clone();
    const p3 = p0.clone().addScaledVector(f, 9).addScaledVector(r, CURB_PARK_OFFSET);
    const p1 = p0.clone().addScaledVector(f, 3.5);
    const p2 = p3.clone().addScaledVector(f, -3.5);
    this.turnSignalState = 'RIGHT';
    this.parkIntent = false;
    this.beginPath(this.buildPath(p0, p1, p2, p3, false), 2.4, 'PARKING_MANEUVER', this.currentAxis, this.currentDirection);
  }

  private startUnparking(): void {
    const f = this.forward();
    const r = this.rightVec();
    const p0 = this.position.clone();
    const p3 = p0.clone().addScaledVector(f, 9).addScaledVector(r, -CURB_PARK_OFFSET);
    const p1 = p0.clone().addScaledVector(f, 3.5);
    const p2 = p3.clone().addScaledVector(f, -3.5);
    this.turnSignalState = 'LEFT';
    this.beginPath(this.buildPath(p0, p1, p2, p3, false), 3.0, 'UNPARKING_MANEUVER', this.currentAxis, this.currentDirection);
  }

  // ──────────────────── EXECUÇÃO DE MANOBRAS ────────────────────
  private updateManeuver(_delta: number, perception: Perception): void {
    // Fase de ré do retorno em U
    if (this.state === 'U_TURN_MANEUVER' && this.uTurnReverseRemaining > 0) {
      this.turnSignalState = 'HAZARD';
      // Perfil de ré que desacelera até zero exatamente ao fim do recuo
      this.targetSpeed = -Math.min(1.8, Math.sqrt(2 * COMFORT_DECEL * this.uTurnReverseRemaining));
      return;
    }

    if (!this.path) {
      this.finishManeuver();
      return;
    }

    // Mesmo em manobra, respeita obstáculos (pedestre cruzando a curva, etc.)
    this.targetSpeed = Math.min(this.pathMaxSpeed, this.obstacleSpeedLimit(perception));
  }

  private finishManeuver(): void {
    const endState = this.state;
    if (this.path) this.position.copy(this.path.p3);
    this.path = null;
    this.pathS = 0;
    this.currentAxis = this.pendingAxis;
    this.currentDirection = this.pendingDir;
    this.rotationY = laneAngle(this.currentAxis, this.currentDirection);
    this.mesh.rotation.y = this.rotationY;
    this.targetSteeringAngle = 0;
    this.turnSignalState = 'OFF';
    this.blockedTimer = 0;
    this.honked = false;

    if (endState === 'PARKING_MANEUVER') {
      this.state = 'PARKED';
      this.parkTimer = 0;
      this.parkDuration = 10 + Math.random() * 8;
      this.targetSpeed = 0;
      this.speed = 0;
      return;
    }
    if (endState === 'UNPARKING_MANEUVER') {
      this.parkCooldown = 30;
    }
    this.turnIntentRolled = false;
    this.turnIntent = 'STRAIGHT';
    this.state = 'CRUISING';
  }

  private updateParked(delta: number, others: VehicleAgent[]): void {
    this.targetSpeed = 0;
    this.targetSteeringAngle = 0;
    this.parkTimer += delta;
    this.turnSignalState = this.parkTimer > this.parkDuration - 2.5 ? 'LEFT' : 'OFF';

    if (this.parkTimer > this.parkDuration && this.laneBehindClear(others)) {
      this.startUnparking();
    }
  }

  /** Antes de sair da vaga, confere o retrovisor: nenhum carro se aproximando na faixa. */
  private laneBehindClear(others: VehicleAgent[]): boolean {
    const lat = laneLateral(this.currentAxis, this.currentDirection);
    const myAlong = this.along();
    for (const o of others) {
      if (o === this) continue;
      const oLat = this.currentAxis === 'NS' ? o.position.x : o.position.z;
      const oAlong = this.currentAxis === 'NS' ? o.position.z : o.position.x;
      const rel = (oAlong - myAlong) * this.currentDirection; // >0 à frente, <0 atrás
      if (Math.abs(oLat - lat) < 2.2 && rel > -18 && rel < 10) return false;
    }
    return true;
  }

  // ──────────────────── DINÂMICA LONGITUDINAL ────────────────────
  private integrateSpeed(delta: number, perception: Perception): void {
    const diff = this.targetSpeed - this.speed;
    const emergency = perception.kind !== 'none' && perception.gap < 2.5 && this.speed > 0.5;
    const decel = emergency ? MAX_DECEL : COMFORT_DECEL * 1.6;
    const step = THREE.MathUtils.clamp(diff, -decel * delta, MAX_ACCEL * delta);
    this.speed += step;
    if (Math.abs(this.speed) < 0.02 && Math.abs(this.targetSpeed) < 0.02) this.speed = 0;
  }

  private applyMotion(delta: number): void {
    // Ré do retorno em U (em linha reta pela faixa)
    if (this.state === 'U_TURN_MANEUVER' && this.uTurnReverseRemaining > 0) {
      const ds = this.speed * delta; // negativo
      this.position.addScaledVector(this.forward(), ds);
      // Piso mínimo mantém a fase ativa até o carro parar de fato antes de engatar a frente
      this.uTurnReverseRemaining = Math.max(0.001, this.uTurnReverseRemaining - Math.abs(ds));
      this.targetSteeringAngle = 0;
      if (this.uTurnReverseRemaining < 0.05 && Math.abs(this.speed) < 0.15) {
        this.uTurnReverseRemaining = 0;
        this.speed = 0;
        this.buildUTurnArc();
      }
      return;
    }

    if (this.path) {
      this.advanceAlongPath(delta);
      return;
    }

    if (this.state === 'PARKED') return;

    // Seguimento de faixa: avança e corrige suavemente qualquer desvio lateral residual
    const ds = Math.max(0, this.speed) * delta;
    const heading = laneAngle(this.currentAxis, this.currentDirection);
    this.position.x += Math.sin(heading) * ds;
    this.position.z += Math.cos(heading) * ds;

    const lat = laneLateral(this.currentAxis, this.currentDirection);
    const k = Math.min(1, delta * 2.5);
    let lateralError: number;
    if (this.currentAxis === 'NS') {
      lateralError = lat - this.position.x;
      this.position.x += lateralError * k;
    } else {
      lateralError = lat - this.position.z;
      this.position.z += lateralError * k;
    }
    this.rotationY = heading;
    this.mesh.rotation.y = heading;
    this.targetSteeringAngle = THREE.MathUtils.clamp(lateralError * 0.15, -0.2, 0.2);
  }

  private advanceAlongPath(delta: number): void {
    const path = this.path!;
    const ds = Math.abs(this.speed) * delta;
    this.pathS += ds;
    const t = Math.min(1, this.pathS / path.length);

    const pos = this.bezierPoint(path.p0, path.p1, path.p2, path.p3, t, new THREE.Vector3());
    this.position.set(pos.x, this.position.y, pos.z);

    const tan = this.bezierTangent(path, t, new THREE.Vector3());
    if (tan.lengthSq() > 1e-6) {
      const heading = path.reverse ? Math.atan2(-tan.x, -tan.z) : Math.atan2(tan.x, tan.z);
      const dHeading = wrapAngle(heading - this.rotationY);
      // Ângulo de esterçamento coerente com a curvatura (modelo bicicleta: δ = atan(L·κ))
      if (ds > 1e-4) {
        const curvature = dHeading / ds;
        this.targetSteeringAngle = THREE.MathUtils.clamp(Math.atan(this.wheelbase * curvature), -0.6, 0.6);
      }
      this.rotationY = heading;
      this.mesh.rotation.y = heading;
    }

    if (t >= 1) this.finishManeuver();
  }

  // ──────────────────── DINÂMICA DE SUSPENSÃO (PITCH & ROLL) ────────────────────
  private updateSuspensionPhysics(delta: number): void {
    // Aceleração e taxa de guinada medidas (não estimadas a partir do alvo)
    const rawAccel = (this.speed - this.prevSpeed) / delta;
    const rawYaw = wrapAngle(this.rotationY - this.prevRotationY) / delta;
    this.measuredAccel = THREE.MathUtils.lerp(this.measuredAccel, rawAccel, Math.min(1, delta * 6));
    this.measuredYawRate = THREE.MathUtils.lerp(this.measuredYawRate, rawYaw, Math.min(1, delta * 6));
    this.prevSpeed = this.speed;
    this.prevRotationY = this.rotationY;

    // Esterçamento das rodas dianteiras
    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, this.targetSteeringAngle, Math.min(1, delta * 6.5));
    for (const pivot of this.frontWheelPivots) {
      pivot.rotation.y = this.steeringAngle;
    }

    // Pitch: frenagem (accel<0) afunda a dianteira; arrancada empina levemente
    const targetPitch = THREE.MathUtils.clamp(-this.measuredAccel * 0.012, -0.03, 0.045);
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, Math.min(1, delta * 8));
    this.bodyGroup.rotation.x = this.currentPitch;

    // Roll: aceleração lateral (v·ω) inclina a cabine para fora da curva
    const lateralAccel = this.speed * this.measuredYawRate;
    const targetRoll = THREE.MathUtils.clamp(lateralAccel * 0.02, -0.06, 0.06);
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, targetRoll, Math.min(1, delta * 7));
    this.bodyGroup.rotation.z = this.currentRoll;
  }

  // ──────────────────── ILUMINAÇÃO & PISCAS ────────────────────
  private updateVehicleLighting(delta: number): void {
    const parked = this.state === 'PARKED';
    const isBraking = !parked && (this.measuredAccel < -0.6 || (Math.abs(this.speed) < 0.3 && this.targetSpeed < 0.3));
    this.brakeLightMat.emissiveIntensity = isBraking ? 2.6 : parked ? 0.1 : 0.4;
    this.brakeLightMat.color.setHex(isBraking ? 0xff0000 : 0x991111);
    this.headlightMat.emissiveIntensity = parked ? 0.15 : 2.0;

    const isReversing = this.speed < -0.05;
    this.reverseLightMat.emissiveIntensity = isReversing ? 2.2 : 0;
    this.reverseLightMat.emissive.setHex(isReversing ? 0xffffff : 0x000000);

    // Pisca-pisca a ~2 Hz
    this.blinkTimer += delta * 4.0;
    const isBlinkOn = Math.floor(this.blinkTimer) % 2 === 0;

    const leftActive = (this.turnSignalState === 'LEFT' || this.turnSignalState === 'HAZARD') && isBlinkOn;
    this.leftTurnSignalMat.emissiveIntensity = leftActive ? 2.5 : 0;
    this.leftTurnSignalMat.emissive.setHex(leftActive ? 0xff8800 : 0x000000);

    const rightActive = (this.turnSignalState === 'RIGHT' || this.turnSignalState === 'HAZARD') && isBlinkOn;
    this.rightTurnSignalMat.emissiveIntensity = rightActive ? 2.5 : 0;
    this.rightTurnSignalMat.emissive.setHex(rightActive ? 0xff8800 : 0x000000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FROTA DE VEÍCULOS AUTÔNOMOS DA CIDADE VIRTUAL (mão direita — CTB)
// ─────────────────────────────────────────────────────────────────────────────
export const CITY_VEHICLES: VehicleConfig[] = [
  {
    id: 'veh-sedan-blue',
    name: 'Sedan Executivo',
    modelName: 'Synapse Sedan S1',
    type: 'sedan',
    color: 0x1565c0, // Azul Cobalto Metálico
    cruiseSpeed: 7.2, // ~26 km/h
    startPosition: new THREE.Vector3(3.5, 0.19, 32.0),
    startRotationY: Math.PI, // Sentido Norte
    routeAxis: 'NS',
    routeDirection: -1,
  },
  {
    id: 'veh-suv-red',
    name: 'SUV Urbano',
    modelName: 'Terra Explorer X',
    type: 'suv',
    color: 0xc62828, // Carmesim Metálico
    cruiseSpeed: 6.8, // ~24 km/h
    startPosition: new THREE.Vector3(-3.5, 0.19, -26.0),
    startRotationY: 0, // Sentido Sul
    routeAxis: 'NS',
    routeDirection: 1,
  },
  {
    id: 'veh-hatch-silver',
    name: 'Hatchback Prata',
    modelName: 'Pulse City Compact',
    type: 'hatch',
    color: 0xdcdcdc, // Prata Metálico
    cruiseSpeed: 6.5, // ~23 km/h
    startPosition: new THREE.Vector3(-32.0, 0.19, 3.5),
    startRotationY: Math.PI / 2, // Sentido Leste
    routeAxis: 'EW',
    routeDirection: 1,
    canPark: true,
  },
  {
    id: 'veh-coupe-black',
    name: 'Coupe Esportivo',
    modelName: 'Veloce GT',
    type: 'coupe',
    color: 0x212121, // Grafite Ônix
    cruiseSpeed: 8.5, // ~30 km/h
    startPosition: new THREE.Vector3(30.0, 0.19, -3.5),
    startRotationY: -Math.PI / 2, // Sentido Oeste
    routeAxis: 'EW',
    routeDirection: -1,
    canPark: true,
  },
];
