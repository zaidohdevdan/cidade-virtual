// apps/web-client/src/vehicles/vehicle-agent.ts
import * as THREE from 'three';
import { TrafficLightRef } from '../scenes/city-scene';

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
  canPark?: boolean;
  parkingSpot?: THREE.Vector3;
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

// ─────────────────────────────────────────────────────────────────────────────
// AGENTE DE VEÍCULO AUTÔNOMO HIPER-REALISTA
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

  // Dinâmica de Suspensão (Pitch, Roll e Heave amortecidos)
  private currentPitch: number = 0;
  private targetPitch: number = 0;
  private currentRoll: number = 0;
  private targetRoll: number = 0;
  private steeringAngle: number = 0;
  private targetSteeringAngle: number = 0;

  // Lógica de trânsito e navegação
  private currentAxis: 'NS' | 'EW';
  private currentDirection: 1 | -1;
  private targetSpeed: number = 0;
  private obstacleTimer: number = 0;
  private honkedAtObstacle: boolean = false;
  private uTurnStep: number = 0;
  private uTurnTimer: number = 0;
  private parkTimer: number = 0;

  // Trajetória Bézier Cúbica para curvas naturais de 90°
  private bezierProgress: number = 0;
  private bezierP0 = new THREE.Vector3();
  private bezierP1 = new THREE.Vector3();
  private bezierP2 = new THREE.Vector3();
  private bezierP3 = new THREE.Vector3();
  private bezierDuration: number = 3.2;

  // Controle de Setas e Pisca-Alerta
  private turnSignalState: 'OFF' | 'LEFT' | 'RIGHT' | 'HAZARD' = 'OFF';
  private blinkTimer: number = 0;

  // Distância entre eixos para modelo cinemático Ackermann (~2.7m)
  private readonly wheelbase = 2.7;

  constructor(config: VehicleConfig) {
    this.config = config;
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.position.copy(config.startPosition);
    this.rotationY = config.startRotationY;
    this.mesh.rotation.y = this.rotationY;

    this.currentAxis = config.routeAxis;
    this.currentDirection = config.routeDirection;
    this.targetSpeed = config.cruiseSpeed;
    this.speed = config.cruiseSpeed * 0.4;

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
    // Lado esquerdo (+X local se frente for +Z):
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

  // ──────────────────── LOOP PRINCIPAL DE FÍSICA E ATUALIZAÇÃO ────────────────────
  public update(
    delta: number,
    trafficLights: TrafficLightRef[],
    pedestrianPositions: THREE.Vector3[],
    playerPos: THREE.Vector3,
    otherVehicles: VehicleAgent[]
  ): void {
    // 1. Checagem de Obstáculos com modelo IDM (Intelligent Driver Model)
    const { obstacleAhead, obstacleDist, relativeSpeed } = this.checkObstacleAhead(playerPos, pedestrianPositions, otherVehicles);

    // 2. Avaliação Semafórica
    const signalState = this.checkTrafficSignalAhead(trafficLights);

    // 3. Máquina de Estados e Decisão de Trânsito
    this.updateStateMachine(delta, obstacleAhead, signalState, obstacleDist, relativeSpeed);

    // 4. Integração Cinemática Ackermann & Atualização de Trajetória
    this.integrateMotion(delta);

    // 5. Dinâmica de Suspensão com Amortecimento (Pitch, Roll e Esterçamento)
    this.updateSuspensionPhysics(delta);

    // 6. Rotação das Rodas no Eixo X (Rolagem proporcional à velocidade)
    const wheelCircumference = Math.PI * 2 * 0.36;
    const wheelRotSpeed = (this.speed / wheelCircumference) * Math.PI * 2;
    for (const wheel of this.rollingWheels) {
      wheel.rotation.x += wheelRotSpeed * delta;
    }

    // 7. Atualização das Luzes de Freio, Ré e Pisca-Alerta/Setas
    this.updateVehicleLighting(delta);
  }

  // ──────────────────── DETECÇÃO DE OBSTÁCULOS & DISTÂNCIA ────────────────────
  private checkObstacleAhead(
    playerPos: THREE.Vector3,
    pedestrians: THREE.Vector3[],
    otherVehicles: VehicleAgent[]
  ): { obstacleAhead: boolean; obstacleDist: number; relativeSpeed: number } {
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const maxCheckDist = 9.0;
    const laneHalfWidth = 1.45;
    let closestDist = maxCheckDist;
    let closestRelSpeed = 0;
    let found = false;

    // Jogador Daniel
    const toPlayer = playerPos.clone().sub(this.position);
    const playerDist = toPlayer.dot(forward);
    if (playerDist > 0.6 && playerDist < maxCheckDist) {
      const lateralDist = Math.abs(toPlayer.x * forward.z - toPlayer.z * forward.x);
      if (lateralDist < laneHalfWidth) {
        found = true;
        closestDist = Math.min(closestDist, playerDist);
      }
    }

    // 7 Cidadãos Pedestres
    for (const ped of pedestrians) {
      const toPed = ped.clone().sub(this.position);
      const pedDist = toPed.dot(forward);
      if (pedDist > 0.6 && pedDist < maxCheckDist) {
        const lateralDist = Math.abs(toPed.x * forward.z - toPed.z * forward.x);
        if (lateralDist < laneHalfWidth) {
          found = true;
          closestDist = Math.min(closestDist, pedDist);
        }
      }
    }

    // Outros Carros
    for (const other of otherVehicles) {
      if (other.config.id === this.config.id) continue;
      const toOther = other.position.clone().sub(this.position);
      const otherDist = toOther.dot(forward);
      if (otherDist > 1.2 && otherDist < maxCheckDist + 1.5) {
        const lateralDist = Math.abs(toOther.x * forward.z - toOther.z * forward.x);
        if (lateralDist < laneHalfWidth + 0.4) {
          found = true;
          if (otherDist < closestDist) {
            closestDist = otherDist;
            closestRelSpeed = this.speed - other.speed;
          }
        }
      }
    }

    return { obstacleAhead: found, obstacleDist: closestDist, relativeSpeed: closestRelSpeed };
  }

  // ──────────────────── AVALIAÇÃO DO SEMÁFORO ────────────────────
  private checkTrafficSignalAhead(trafficLights: TrafficLightRef[]): 'GREEN' | 'STOP' | 'NONE' {
    const distToCenter = this.currentAxis === 'NS' ? Math.abs(this.position.z) : Math.abs(this.position.x);
    const isApproaching = distToCenter > 12.8 && distToCenter < 21.0;

    const isHeadingTowardCenter =
      (this.currentAxis === 'NS' && ((this.position.z > 0 && this.currentDirection === -1) || (this.position.z < 0 && this.currentDirection === 1))) ||
      (this.currentAxis === 'EW' && ((this.position.x > 0 && this.currentDirection === -1) || (this.position.x < 0 && this.currentDirection === 1)));

    if (!isApproaching || !isHeadingTowardCenter) return 'NONE';

    let targetLightId = '';
    if (this.currentAxis === 'NS') {
      targetLightId = this.position.z > 0 ? 'tl-sul' : 'tl-norte';
    } else {
      targetLightId = this.position.x > 0 ? 'tl-leste' : 'tl-oeste';
    }

    const tl = trafficLights.find((t) => t.id === targetLightId);
    if (!tl) return 'NONE';

    return tl.state === 'red' || tl.state === 'yellow' ? 'STOP' : 'GREEN';
  }

  // ──────────────────── MÁQUINA DE ESTADOS & TOMADA DE DECISÃO ────────────────────
  private updateStateMachine(
    delta: number,
    obstacleAhead: boolean,
    signalState: 'GREEN' | 'STOP' | 'NONE',
    obstacleDist: number,
    relativeSpeed: number
  ): void {
    switch (this.state) {
      case 'CRUISING': {
        if (obstacleAhead) {
          this.state = 'OBSTACLE_BRAKING';
          this.obstacleTimer = 0;
          this.honkedAtObstacle = false;
          this.turnSignalState = 'HAZARD';
          return;
        }

        if (signalState === 'STOP') {
          this.state = 'WAITING_SIGNAL';
          this.turnSignalState = 'OFF';
          return;
        }

        this.targetSpeed = this.config.cruiseSpeed;
        this.targetSteeringAngle = 0;
        this.turnSignalState = 'OFF';

        // Avaliar oportunidade de conversão Bézier de 90° ao ingressar no cruzamento
        this.evaluateTurnDecision();

        // Oportunidade de estacionar na vaga do mercado
        if (this.config.canPark && this.config.parkingSpot) {
          const distToPark = this.position.distanceTo(this.config.parkingSpot);
          if (distToPark < 14 && Math.random() < 0.005) {
            this.state = 'PARKING_MANEUVER';
            this.parkTimer = 0;
            this.turnSignalState = 'LEFT';
            return;
          }
        }
        break;
      }

      case 'WAITING_SIGNAL': {
        this.targetSpeed = 0;
        this.targetSteeringAngle = 0;
        this.turnSignalState = 'OFF';
        if (signalState === 'GREEN' || signalState === 'NONE') {
          this.state = 'CRUISING';
        }
        break;
      }

      case 'OBSTACLE_BRAKING': {
        // Modelo IDM para desaceleração progressiva e suave
        const safeDistance = 3.0;
        if (obstacleDist < safeDistance) {
          this.targetSpeed = 0;
        } else {
          // Desaceleração proporcional à proximidade e velocidade relativa
          const idmTarget = Math.max(0, (obstacleDist - safeDistance) * 1.5 - relativeSpeed * 0.5);
          this.targetSpeed = Math.min(this.config.cruiseSpeed * 0.4, idmTarget);
        }

        this.obstacleTimer += delta;

        // Se o obstáculo persistir por 2.0s, toca buzina automotiva de advertência!
        if (this.obstacleTimer > 2.0 && !this.honkedAtObstacle) {
          VehicleAudioEngine.playHorn(0.14);
          this.honkedAtObstacle = true;
        }

        // Se o caminho for liberado, retoma viagem
        if (!obstacleAhead) {
          this.state = 'CRUISING';
          this.obstacleTimer = 0;
          this.turnSignalState = 'OFF';
          return;
        }

        // Se permanecer bloqueado por mais de 3.5 segundos, executa manobra de retorno em U (U-Turn)!
        if (this.obstacleTimer > 3.5) {
          this.state = 'U_TURN_MANEUVER';
          this.uTurnStep = 1;
          this.uTurnTimer = 0;
          this.turnSignalState = 'HAZARD';
        }
        break;
      }

      case 'U_TURN_MANEUVER': {
        this.uTurnTimer += delta;
        this.turnSignalState = 'HAZARD';

        if (this.uTurnStep === 1) {
          // Passo 1: Ré com volante totalmente esterçado
          this.targetSpeed = -2.2;
          this.targetSteeringAngle = -0.55; // Esterça rodas em marcha a ré
          this.rotationY += delta * 0.5;
          this.mesh.rotation.y = this.rotationY;

          if (this.uTurnTimer > 1.8) {
            this.uTurnStep = 2;
            this.uTurnTimer = 0;
          }
        } else if (this.uTurnStep === 2) {
          // Passo 2: Acelera virando para a faixa contrária desimpedida
          this.targetSpeed = 3.0;
          this.targetSteeringAngle = 0.55;
          const targetRot = (this.rotationY + Math.PI) % (Math.PI * 2);
          this.rotationY = THREE.MathUtils.lerp(this.rotationY, targetRot, delta * 2.5);
          this.mesh.rotation.y = this.rotationY;

          if (this.uTurnTimer > 2.0) {
            this.currentDirection = this.currentDirection === 1 ? -1 : 1;
            if (this.currentAxis === 'NS') {
              this.position.x = this.currentDirection === 1 ? 3.5 : -3.5;
            } else {
              this.position.z = this.currentDirection === 1 ? -3.5 : 3.5;
            }
            this.rotationY = this.calculateLaneAngle();
            this.mesh.rotation.y = this.rotationY;
            this.targetSteeringAngle = 0;
            this.state = 'CRUISING';
            this.turnSignalState = 'OFF';
            this.obstacleTimer = 0;
          }
        }
        break;
      }

      case 'TURNING': {
        // Trajetória em Curva de Bézier Cúbica
        this.bezierProgress += delta / this.bezierDuration;
        this.targetSpeed = 3.4; // Velocidade confortável e realista de conversão

        if (this.bezierProgress >= 1.0) {
          this.position.copy(this.bezierP3);
          this.rotationY = this.calculateLaneAngle();
          this.mesh.rotation.y = this.rotationY;
          this.targetSteeringAngle = 0;
          this.turnSignalState = 'OFF';
          this.state = 'CRUISING';
          this.bezierProgress = 0;
        } else {
          const t = this.bezierProgress;
          // Equação de Bézier Cúbica: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
          const invT = 1 - t;
          const pos = new THREE.Vector3()
            .addScaledVector(this.bezierP0, invT * invT * invT)
            .addScaledVector(this.bezierP1, 3 * invT * invT * t)
            .addScaledVector(this.bezierP2, 3 * invT * t * t)
            .addScaledVector(this.bezierP3, t * t * t);
          this.position.copy(pos);

          // Vetor tangente dB/dt para calcular o ângulo natural da carroceria
          const tangent = new THREE.Vector3()
            .addScaledVector(this.bezierP1.clone().sub(this.bezierP0), 3 * invT * invT)
            .addScaledVector(this.bezierP2.clone().sub(this.bezierP1), 6 * invT * t)
            .addScaledVector(this.bezierP3.clone().sub(this.bezierP2), 3 * t * t);

          if (tangent.lengthSq() > 0.001) {
            const desiredHeading = Math.atan2(tangent.x, tangent.z);
            const headingDiff = THREE.MathUtils.euclideanModulo(desiredHeading - this.rotationY + Math.PI, Math.PI * 2) - Math.PI;
            this.rotationY += headingDiff * delta * 8.0;
            this.mesh.rotation.y = this.rotationY;

            // Esterçamento dinâmico proporcional à curvatura
            this.targetSteeringAngle = THREE.MathUtils.clamp(headingDiff * 2.5, -0.55, 0.55);
          }
        }
        break;
      }

      case 'PARKING_MANEUVER': {
        if (!this.config.parkingSpot) {
          this.state = 'CRUISING';
          return;
        }
        this.targetSpeed = 1.8;
        this.targetSteeringAngle = 0.4;
        this.turnSignalState = 'RIGHT';

        const dirToSpot = this.config.parkingSpot.clone().sub(this.position);
        const dist = dirToSpot.length();

        if (dist < 0.5) {
          this.position.copy(this.config.parkingSpot);
          this.rotationY = 0;
          this.mesh.rotation.y = 0;
          this.speed = 0;
          this.targetSpeed = 0;
          this.targetSteeringAngle = 0;
          this.turnSignalState = 'OFF';
          this.state = 'PARKED';
          this.parkTimer = 0;
        } else {
          this.position.lerp(this.config.parkingSpot, delta * 1.6);
        }
        break;
      }

      case 'PARKED': {
        this.targetSpeed = 0;
        this.targetSteeringAngle = 0;
        this.turnSignalState = 'OFF';
        this.parkTimer += delta;

        // Estacionado por 12 segundos e depois inicia desestacionamento
        if (this.parkTimer > 12.0) {
          this.state = 'UNPARKING_MANEUVER';
          this.parkTimer = 0;
          this.turnSignalState = 'HAZARD';
        }
        break;
      }

      case 'UNPARKING_MANEUVER': {
        this.parkTimer += delta;
        this.targetSpeed = -2.0;
        this.targetSteeringAngle = -0.45;
        this.turnSignalState = 'HAZARD';

        const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
        this.position.addScaledVector(forward, this.targetSpeed * delta);

        if (this.parkTimer > 2.6) {
          this.currentAxis = 'NS';
          this.currentDirection = -1;
          this.position.x = -3.5;
          this.rotationY = Math.PI;
          this.mesh.rotation.y = this.rotationY;
          this.targetSteeringAngle = 0;
          this.turnSignalState = 'OFF';
          this.state = 'CRUISING';
          this.parkTimer = 0;
        }
        break;
      }
    }
  }

  // ──────────────────── AVALIAR DECISÃO DE CURVA BÉZIER ────────────────────
  private evaluateTurnDecision(): void {
    const atEntry =
      (this.currentAxis === 'NS' && Math.abs(this.position.z) < 6.8 && Math.abs(this.position.z) > 4.8) ||
      (this.currentAxis === 'EW' && Math.abs(this.position.x) < 6.8 && Math.abs(this.position.x) > 4.8);

    if (atEntry && this.state === 'CRUISING' && Math.random() < 0.4) {
      this.initiateBezierTurn();
    }
  }

  private initiateBezierTurn(): void {
    this.state = 'TURNING';
    this.bezierProgress = 0;
    this.bezierP0.copy(this.position);

    // Vetor de entrada tangente
    const inForward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    this.bezierP1.copy(this.bezierP0).addScaledVector(inForward, 4.0);

    if (this.currentAxis === 'NS') {
      this.currentAxis = 'EW';
      this.currentDirection = this.position.x < 0 ? 1 : -1;
      this.bezierP3.set(
        this.currentDirection === 1 ? 8.5 : -8.5,
        this.position.y,
        this.currentDirection === 1 ? -3.5 : 3.5
      );
      this.turnSignalState = this.currentDirection === 1 ? 'LEFT' : 'RIGHT';
    } else {
      this.currentAxis = 'NS';
      this.currentDirection = this.position.z < 0 ? 1 : -1;
      this.bezierP3.set(
        this.currentDirection === 1 ? 3.5 : -3.5,
        this.position.y,
        this.currentDirection === 1 ? 8.5 : -8.5
      );
      this.turnSignalState = this.currentDirection === 1 ? 'RIGHT' : 'LEFT';
    }

    // Vetor de saída tangente
    const outAngle = this.calculateLaneAngle();
    const outForward = new THREE.Vector3(Math.sin(outAngle), 0, Math.cos(outAngle));
    this.bezierP2.copy(this.bezierP3).addScaledVector(outForward, -4.0);
  }

  // ──────────────────── INTEGRAÇÃO CINEMÁTICA ACKERMANN ────────────────────
  private integrateMotion(delta: number): void {
    const accelRate = this.targetSpeed > this.speed ? 4.0 : 7.0;
    this.speed = THREE.MathUtils.lerp(this.speed, this.targetSpeed, delta * accelRate);

    if (this.state === 'CRUISING') {
      // Modelo de bicicleta cinemática: rotação proporcional ao ângulo de esterçamento
      if (Math.abs(this.steeringAngle) > 0.01) {
        const turnRadius = this.wheelbase / Math.tan(this.steeringAngle);
        const angularVel = this.speed / turnRadius;
        this.rotationY += angularVel * delta;
        this.mesh.rotation.y = this.rotationY;
      }

      const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
      this.position.addScaledVector(forward, this.speed * delta);

      // Limites da cidade e retorno de pista
      const roadLimit = 46.0;
      if (this.currentAxis === 'NS') {
        if (this.position.z > roadLimit && this.currentDirection === 1) {
          this.currentDirection = -1;
          this.position.x = -3.5;
          this.rotationY = Math.PI;
          this.mesh.rotation.y = this.rotationY;
        } else if (this.position.z < -roadLimit && this.currentDirection === -1) {
          this.currentDirection = 1;
          this.position.x = 3.5;
          this.rotationY = 0;
          this.mesh.rotation.y = this.rotationY;
        }
      } else {
        if (this.position.x > roadLimit && this.currentDirection === 1) {
          this.currentDirection = -1;
          this.position.z = 3.5;
          this.rotationY = -Math.PI / 2;
          this.mesh.rotation.y = this.rotationY;
        } else if (this.position.x < -roadLimit && this.currentDirection === -1) {
          this.currentDirection = 1;
          this.position.z = -3.5;
          this.rotationY = Math.PI / 2;
          this.mesh.rotation.y = this.rotationY;
        }
      }
    }
  }

  // ──────────────────── DINÂMICA DE SUSPENSÃO (PITCH & ROLL) ────────────────────
  private updateSuspensionPhysics(delta: number): void {
    // 1. Esterçamento das Rodas Dianteiras
    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, this.targetSteeringAngle, delta * 6.5);
    for (const pivot of this.frontWheelPivots) {
      pivot.rotation.y = this.steeringAngle;
    }

    // 2. Pitch da Carroceria (Afundamento na frenagem / Empinamento na arrancada)
    const acceleration = (this.targetSpeed - this.speed) * 4.0;
    // Se estiver freando (acceleration < 0), pitch é negativo (mergulho frontal)
    this.targetPitch = THREE.MathUtils.clamp(-acceleration * 0.018, -0.05, 0.035);
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, this.targetPitch, delta * 8.0);
    this.bodyGroup.rotation.x = this.currentPitch;

    // 3. Roll da Carroceria (Inclinação lateral centrífuga em curvas)
    const lateralG = (this.speed * this.speed * Math.sin(this.steeringAngle)) / this.wheelbase;
    this.targetRoll = THREE.MathUtils.clamp(-lateralG * 0.008, -0.06, 0.06);
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, this.targetRoll, delta * 7.0);
    this.bodyGroup.rotation.z = this.currentRoll;
  }

  // ──────────────────── ILUMINAÇÃO & PISCAS ────────────────────
  private updateVehicleLighting(delta: number): void {
    // Luzes de freio reativas
    const isBraking =
      this.speed < this.targetSpeed * 0.6 ||
      this.state === 'WAITING_SIGNAL' ||
      this.state === 'OBSTACLE_BRAKING';
    this.brakeLightMat.emissiveIntensity = isBraking ? 2.6 : 0.4;
    this.brakeLightMat.color.setHex(isBraking ? 0xff0000 : 0x991111);

    // Luz de ré
    const isReversing = (this.state === 'U_TURN_MANEUVER' && this.uTurnStep === 1) || this.state === 'UNPARKING_MANEUVER';
    this.reverseLightMat.emissiveIntensity = isReversing ? 2.2 : 0;
    this.reverseLightMat.emissive.setHex(isReversing ? 0xffffff : 0x000000);

    // Pisca-pisca das setas de direção a 2 Hz (~0.25s ligado, ~0.25s desligado)
    this.blinkTimer += delta * 4.0;
    const isBlinkOn = Math.floor(this.blinkTimer) % 2 === 0;

    const leftActive = (this.turnSignalState === 'LEFT' || this.turnSignalState === 'HAZARD') && isBlinkOn;
    this.leftTurnSignalMat.emissiveIntensity = leftActive ? 2.5 : 0;
    this.leftTurnSignalMat.emissive.setHex(leftActive ? 0xff8800 : 0x000000);

    const rightActive = (this.turnSignalState === 'RIGHT' || this.turnSignalState === 'HAZARD') && isBlinkOn;
    this.rightTurnSignalMat.emissiveIntensity = rightActive ? 2.5 : 0;
    this.rightTurnSignalMat.emissive.setHex(rightActive ? 0xff8800 : 0x000000);
  }

  private calculateLaneAngle(): number {
    if (this.currentAxis === 'NS') {
      return this.currentDirection === 1 ? 0 : Math.PI;
    }
    return this.currentDirection === 1 ? Math.PI / 2 : -Math.PI / 2;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FROTA DE VEÍCULOS AUTÔNOMOS DA CIDADE VIRTUAL
// ─────────────────────────────────────────────────────────────────────────────
export const CITY_VEHICLES: VehicleConfig[] = [
  {
    id: 'veh-sedan-blue',
    name: 'Sedan Executivo',
    modelName: 'Synapse Sedan S1',
    type: 'sedan',
    color: 0x1565c0, // Azul Cobalto Metálico
    cruiseSpeed: 7.2, // ~26 km/h
    startPosition: new THREE.Vector3(-3.5, 0.19, 32.0),
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
    startPosition: new THREE.Vector3(3.5, 0.19, -30.0),
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
    startPosition: new THREE.Vector3(-32.0, 0.19, -3.5),
    startRotationY: Math.PI / 2, // Sentido Leste
    routeAxis: 'EW',
    routeDirection: 1,
    canPark: true,
    parkingSpot: new THREE.Vector3(-8.0, 0.19, -36.0), // Vaga no estacionamento do mercado
  },
  {
    id: 'veh-coupe-black',
    name: 'Coupe Esportivo',
    modelName: 'Veloce GT',
    type: 'coupe',
    color: 0x212121, // Grafite Ônix
    cruiseSpeed: 8.5, // ~30 km/h
    startPosition: new THREE.Vector3(30.0, 0.19, 3.5),
    startRotationY: -Math.PI / 2, // Sentido Oeste
    routeAxis: 'EW',
    routeDirection: -1,
  },
];
