// apps/web/src/vehicles/vehicle-agent.ts
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

export class VehicleAgent {
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public rotationY: number = 0;
  public speed: number = 0;
  public config: VehicleConfig;
  public state: VehicleBehaviorState = 'CRUISING';

  // Componentes visuais reativos
  private wheels: THREE.Mesh[] = [];
  private brakeLightMat!: THREE.MeshStandardMaterial;
  private headlightMat!: THREE.MeshStandardMaterial;
  private reverseLightMat!: THREE.MeshStandardMaterial;

  // Lógica de trânsito e navegação
  private currentAxis: 'NS' | 'EW';
  private currentDirection: 1 | -1;
  private targetSpeed: number = 0;
  private obstacleTimer: number = 0;
  private uTurnStep: number = 0;
  private uTurnTimer: number = 0;
  private parkTimer: number = 0;
  private turnProgress: number = 0;
  private turnStartPos = new THREE.Vector3();
  private turnEndPos = new THREE.Vector3();
  private turnStartAngle: number = 0;
  private turnEndAngle: number = 0;

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
    this.speed = config.cruiseSpeed * 0.5;

    this.buildVehicleModel();
  }

  private buildVehicleModel(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.config.color,
      roughness: 0.25,
      metalness: 0.65,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88bbdd,
      transparent: true,
      opacity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
    });
    const wheelRimMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.9,
      roughness: 0.2,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.85,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.95,
      roughness: 0.1,
    });
    const blackTrimMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8,
    });

    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfff9e6,
      emissive: 0xffea88,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.brakeLightMat = new THREE.MeshStandardMaterial({
      color: 0xff1111,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    this.reverseLightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
    });

    // ──────────────────── CHASSI & CARROCERIA ────────────────────
    const carLength = 4.4;
    const carWidth = 2.0;
    const carHeight = 1.35;

    // Chassi inferior
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(carWidth, 0.42, carLength), bodyMat);
    chassis.position.y = 0.42;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.mesh.add(chassis);

    // Para-choques dianteiro e traseiro
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(carWidth + 0.04, 0.26, 0.25), blackTrimMat);
    frontBumper.position.set(0, 0.32, carLength / 2 + 0.08);
    this.mesh.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(carWidth + 0.04, 0.26, 0.25), blackTrimMat);
    rearBumper.position.set(0, 0.32, -carLength / 2 - 0.08);
    this.mesh.add(rearBumper);

    // Grade dianteira cromada
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.08), chromeMat);
    grille.position.set(0, 0.46, carLength / 2 + 0.12);
    this.mesh.add(grille);

    // Cabine e teto estilizado
    const cabinLength = carLength * 0.58;
    const cabinWidth = carWidth * 0.88;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth, 0.62, cabinLength), bodyMat);
    cabin.position.set(0, 0.88, -0.15);
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // Para-brisa dianteiro inclinado
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth - 0.1, 0.52, 0.1), glassMat);
    windshield.position.set(0, 0.90, cabinLength / 2 - 0.1);
    windshield.rotation.x = -Math.PI / 6;
    this.mesh.add(windshield);

    // Vidro traseiro inclinado
    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(cabinWidth - 0.1, 0.48, 0.1), glassMat);
    rearWindow.position.set(0, 0.90, -cabinLength / 2 - 0.2);
    rearWindow.rotation.x = Math.PI / 6;
    this.mesh.add(rearWindow);

    // Vidros laterais
    for (const side of [-1, 1]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, cabinLength - 0.3), glassMat);
      sideGlass.position.set(side * (cabinWidth / 2 + 0.02), 0.88, -0.15);
      this.mesh.add(sideGlass);

      // Espelho retrovisor
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), bodyMat);
      mirror.position.set(side * (carWidth / 2 + 0.12), 0.85, 0.65);
      this.mesh.add(mirror);
    }

    // ──────────────────── FARÓIS & LANTERNAS ILUMINADAS ────────────────────
    // Faróis dianteiros duplos (lado positivo de Z é a frente do veículo)
    for (const side of [-1, 1]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.1), this.headlightMat);
      headlight.position.set(side * 0.72, 0.52, carLength / 2 + 0.06);
      this.mesh.add(headlight);
    }

    // Lanternas traseiras duplas com freio e ré integrados (lado negativo de Z)
    for (const side of [-1, 1]) {
      const brakeLight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.1), this.brakeLightMat);
      brakeLight.position.set(side * 0.72, 0.52, -carLength / 2 - 0.06);
      this.mesh.add(brakeLight);

      const revLight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.11), this.reverseLightMat);
      revLight.position.set(side * 0.42, 0.52, -carLength / 2 - 0.06);
      this.mesh.add(revLight);
    }

    // ──────────────────── RODAS DE LIGA LEVE GIRATÓRIAS ────────────────────
    const wheelRadius = 0.36;
    const wheelWidth = 0.26;
    const wheelPositions = [
      [-carWidth / 2 - 0.04, carLength / 2 - 0.95],
      [carWidth / 2 + 0.04, carLength / 2 - 0.95],
      [-carWidth / 2 - 0.04, -carLength / 2 + 0.95],
      [carWidth / 2 + 0.04, -carLength / 2 + 0.95],
    ] as [number, number][];

    for (const [wx, wz] of wheelPositions) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, wheelRadius, wz);

      // Pneu de borracha
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      // Aro de liga leve
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 12), wheelRimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      this.mesh.add(wheelGroup);
      this.wheels.push(tire);
    }
  }

  // ──────────────────── CICLO DE ATUALIZAÇÃO E INTELIGÊNCIA ARTIFICIAL ────────────────────
  public update(
    delta: number,
    trafficLights: TrafficLightRef[],
    pedestrianPositions: THREE.Vector3[],
    playerPos: THREE.Vector3,
    otherVehicles: VehicleAgent[]
  ): void {
    // 1. Checagem de Obstáculos Frontais (Pedestres, Jogador e outros Veículos)
    const obstacleDetected = this.checkObstacleAhead(playerPos, pedestrianPositions, otherVehicles);

    // 2. Avaliação de Sinalização Semafórica do Cruzamento
    const signalState = this.checkTrafficSignalAhead(trafficLights);

    // 3. Máquina de Estados e Tomada de Decisão
    this.updateStateMachine(delta, obstacleDetected, signalState);

    // 4. Integração Física de Velocidade e Deslocamento
    this.integrateMotion(delta);

    // 5. Rotação das rodas proporcional à velocidade de rodagem
    const wheelCircumference = Math.PI * 2 * 0.36;
    const wheelRotSpeed = (this.speed / wheelCircumference) * Math.PI * 2;
    for (const wheel of this.wheels) {
      wheel.rotation.x += wheelRotSpeed * delta;
    }

    // 6. Atualização das Luzes Reativas (Freio e Ré)
    const isBraking =
      this.speed < this.targetSpeed * 0.5 ||
      this.state === 'WAITING_SIGNAL' ||
      this.state === 'OBSTACLE_BRAKING';
    this.brakeLightMat.emissiveIntensity = isBraking ? 2.6 : 0.4;
    this.brakeLightMat.color.setHex(isBraking ? 0xff0000 : 0xaa1111);

    const isReversing = this.state === 'U_TURN_MANEUVER' && this.uTurnStep === 1;
    this.reverseLightMat.emissiveIntensity = isReversing ? 2.0 : 0;
    this.reverseLightMat.emissive.setHex(isReversing ? 0xffffff : 0x000000);
  }

  private checkObstacleAhead(
    playerPos: THREE.Vector3,
    pedestrians: THREE.Vector3[],
    otherVehicles: VehicleAgent[]
  ): boolean {
    // Vetor frontal do veículo (orientação no plano XZ)
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));

    // Distância máxima de percepção frontal de segurança (7.5m)
    const maxCheckDist = 7.5;
    const laneHalfWidth = 1.4;

    // Checar jogador Daniel
    const toPlayer = playerPos.clone().sub(this.position);
    const playerDist = toPlayer.dot(forward);
    if (playerDist > 0.8 && playerDist < maxCheckDist) {
      const lateralDist = Math.abs(toPlayer.x * forward.z - toPlayer.z * forward.x);
      if (lateralDist < laneHalfWidth) {
        return true;
      }
    }

    // Checar pedestres (os 7 agentes)
    for (const ped of pedestrians) {
      const toPed = ped.clone().sub(this.position);
      const pedDist = toPed.dot(forward);
      if (pedDist > 0.8 && pedDist < maxCheckDist) {
        const lateralDist = Math.abs(toPed.x * forward.z - toPed.z * forward.x);
        if (lateralDist < laneHalfWidth) {
          return true;
        }
      }
    }

    // Checar outros veículos à frente
    for (const other of otherVehicles) {
      if (other.config.id === this.config.id) continue;
      const toOther = other.position.clone().sub(this.position);
      const otherDist = toOther.dot(forward);
      if (otherDist > 1.2 && otherDist < maxCheckDist + 1.5) {
        const lateralDist = Math.abs(toOther.x * forward.z - toOther.z * forward.x);
        if (lateralDist < laneHalfWidth + 0.5) {
          return true;
        }
      }
    }

    return false;
  }

  private checkTrafficSignalAhead(trafficLights: TrafficLightRef[]): 'GREEN' | 'STOP' | 'NONE' {
    // Verifica se está se aproximando do cruzamento central (0, 0)
    const distToCenter = this.currentAxis === 'NS' ? Math.abs(this.position.z) : Math.abs(this.position.x);

    // Zona de parada: entre 13.0m e 18.0m antes do centro
    const isApproachingIntersection = distToCenter > 12.8 && distToCenter < 19.5;

    // Verifica se está se movendo EM DIREÇÃO ao cruzamento
    const isHeadingTowardCenter =
      (this.currentAxis === 'NS' && ((this.position.z > 0 && this.currentDirection === -1) || (this.position.z < 0 && this.currentDirection === 1))) ||
      (this.currentAxis === 'EW' && ((this.position.x > 0 && this.currentDirection === -1) || (this.position.x < 0 && this.currentDirection === 1)));

    if (!isApproachingIntersection || !isHeadingTowardCenter) {
      return 'NONE';
    }

    // Determina o semáforo da aproximação
    let targetLightId = '';
    if (this.currentAxis === 'NS') {
      targetLightId = this.position.z > 0 ? 'tl-sul' : 'tl-norte';
    } else {
      targetLightId = this.position.x > 0 ? 'tl-leste' : 'tl-oeste';
    }

    const tl = trafficLights.find((t) => t.id === targetLightId);
    if (!tl) return 'NONE';

    if (tl.state === 'red' || tl.state === 'yellow') {
      return 'STOP';
    }
    return 'GREEN';
  }

  private updateStateMachine(delta: number, obstacleAhead: boolean, signalState: 'GREEN' | 'STOP' | 'NONE'): void {
    switch (this.state) {
      case 'CRUISING': {
        if (obstacleAhead) {
          this.state = 'OBSTACLE_BRAKING';
          this.obstacleTimer = 0;
          return;
        }

        if (signalState === 'STOP') {
          this.state = 'WAITING_SIGNAL';
          return;
        }

        this.targetSpeed = this.config.cruiseSpeed;

        // Decisão de conversão (curva) ao ingressar no cruzamento (|coord| < 6.0)
        this.evaluateTurnDecision();

        // Checar oportunidade de estacionar se o veículo tiver vaga atribuída
        if (this.config.canPark && this.config.parkingSpot) {
          const distToPark = this.position.distanceTo(this.config.parkingSpot);
          if (distToPark < 14 && Math.random() < 0.005) {
            this.state = 'PARKING_MANEUVER';
            this.parkTimer = 0;
            return;
          }
        }
        break;
      }

      case 'WAITING_SIGNAL': {
        this.targetSpeed = 0;
        if (signalState === 'GREEN' || signalState === 'NONE') {
          this.state = 'CRUISING';
        }
        break;
      }

      case 'OBSTACLE_BRAKING': {
        this.targetSpeed = 0;
        this.obstacleTimer += delta;

        // Se o obstáculo desobstruiu a via, retoma o movimento normal
        if (!obstacleAhead) {
          this.state = 'CRUISING';
          this.obstacleTimer = 0;
          return;
        }

        // Se o obstáculo persistir bloqueando a via por mais de 3.5 segundos, executa manobra de retorno (U-Turn)!
        if (this.obstacleTimer > 3.5) {
          this.state = 'U_TURN_MANEUVER';
          this.uTurnStep = 1;
          this.uTurnTimer = 0;
        }
        break;
      }

      case 'U_TURN_MANEUVER': {
        // Manobra de retorno de 180° para a faixa oposta desimpedida
        this.uTurnTimer += delta;

        if (this.uTurnStep === 1) {
          // Passo 1: Dá ré suave com volante esterçado
          this.targetSpeed = -2.2;
          this.rotationY += delta * 0.45;
          this.mesh.rotation.y = this.rotationY;

          if (this.uTurnTimer > 1.8) {
            this.uTurnStep = 2;
            this.uTurnTimer = 0;
          }
        } else if (this.uTurnStep === 2) {
          // Passo 2: Esterça e gira para a faixa contrária
          this.targetSpeed = 3.0;
          const targetRot = (this.rotationY + Math.PI) % (Math.PI * 2);
          this.rotationY = THREE.MathUtils.lerp(this.rotationY, targetRot, delta * 2.5);
          this.mesh.rotation.y = this.rotationY;

          if (this.uTurnTimer > 2.0) {
            // Inverte o sentido de tráfego e ajusta para a faixa oposta
            this.currentDirection = this.currentDirection === 1 ? -1 : 1;
            if (this.currentAxis === 'NS') {
              this.position.x = this.currentDirection === 1 ? 3.5 : -3.5;
            } else {
              this.position.z = this.currentDirection === 1 ? -3.5 : 3.5;
            }
            this.rotationY = this.calculateLaneAngle();
            this.mesh.rotation.y = this.rotationY;
            this.state = 'CRUISING';
            this.obstacleTimer = 0;
          }
        }
        break;
      }

      case 'TURNING': {
        // Executa arco de conversão no cruzamento com velocidade reduzida
        this.targetSpeed = 3.2;
        this.turnProgress += delta * 0.75;

        if (this.turnProgress >= 1.0) {
          this.position.copy(this.turnEndPos);
          this.rotationY = this.turnEndAngle;
          this.mesh.rotation.y = this.rotationY;
          this.state = 'CRUISING';
          this.turnProgress = 0;
        } else {
          // Interpolação suave ao longo da curva
          this.position.lerpVectors(this.turnStartPos, this.turnEndPos, this.turnProgress);
          this.rotationY = THREE.MathUtils.lerp(this.turnStartAngle, this.turnEndAngle, this.turnProgress);
          this.mesh.rotation.y = this.rotationY;
        }
        break;
      }

      case 'PARKING_MANEUVER': {
        if (!this.config.parkingSpot) {
          this.state = 'CRUISING';
          return;
        }
        this.targetSpeed = 2.0;
        const dirToSpot = this.config.parkingSpot.clone().sub(this.position);
        const dist = dirToSpot.length();

        if (dist < 0.6) {
          this.position.copy(this.config.parkingSpot);
          this.rotationY = 0;
          this.mesh.rotation.y = 0;
          this.speed = 0;
          this.targetSpeed = 0;
          this.state = 'PARKED';
          this.parkTimer = 0;
        } else {
          this.position.lerp(this.config.parkingSpot, delta * 1.5);
        }
        break;
      }

      case 'PARKED': {
        this.targetSpeed = 0;
        this.parkTimer += delta;
        // Permanece estacionado por 12 segundos e depois sai da vaga
        if (this.parkTimer > 12.0) {
          this.state = 'UNPARKING_MANEUVER';
          this.parkTimer = 0;
        }
        break;
      }

      case 'UNPARKING_MANEUVER': {
        this.parkTimer += delta;
        // Dá ré saindo da vaga para a pista
        this.targetSpeed = -2.2;
        const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
        this.position.addScaledVector(forward, this.targetSpeed * delta);

        if (this.parkTimer > 2.5) {
          // Reingressa na faixa de tráfego
          this.currentAxis = 'NS';
          this.currentDirection = -1;
          this.position.x = -3.5;
          this.rotationY = Math.PI;
          this.mesh.rotation.y = this.rotationY;
          this.state = 'CRUISING';
          this.parkTimer = 0;
        }
        break;
      }
    }
  }

  private evaluateTurnDecision(): void {
    // Se estiver exatamente ingressando no miolo do cruzamento
    const atIntersectionEntry =
      (this.currentAxis === 'NS' && Math.abs(this.position.z) < 6.5 && Math.abs(this.position.z) > 4.5) ||
      (this.currentAxis === 'EW' && Math.abs(this.position.x) < 6.5 && Math.abs(this.position.x) > 4.5);

    if (atIntersectionEntry && this.state === 'CRUISING' && Math.random() < 0.4) {
      // 40% de chance de realizar conversão para a outra via
      this.initiateTurn();
    }
  }

  private initiateTurn(): void {
    this.state = 'TURNING';
    this.turnProgress = 0;
    this.turnStartPos.copy(this.position);
    this.turnStartAngle = this.rotationY;

    if (this.currentAxis === 'NS') {
      // De Norte-Sul virando para Leste-Oeste
      this.currentAxis = 'EW';
      this.currentDirection = this.position.x < 0 ? 1 : -1; // Escolhe sentido Leste (+X) ou Oeste (-X)
      this.turnEndPos.set(
        this.currentDirection === 1 ? 7.5 : -7.5,
        this.position.y,
        this.currentDirection === 1 ? -3.5 : 3.5
      );
      this.turnEndAngle = this.currentDirection === 1 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      // De Leste-Oeste virando para Norte-Sul
      this.currentAxis = 'NS';
      this.currentDirection = this.position.z < 0 ? 1 : -1;
      this.turnEndPos.set(
        this.currentDirection === 1 ? 3.5 : -3.5,
        this.position.y,
        this.currentDirection === 1 ? 7.5 : -7.5
      );
      this.turnEndAngle = this.currentDirection === 1 ? 0 : Math.PI;
    }
  }

  private integrateMotion(delta: number): void {
    // Interpolação suave de aceleração e frenagem (comportamento de veículo realista)
    const accelRate = this.targetSpeed > this.speed ? 4.5 : 7.5;
    this.speed = THREE.MathUtils.lerp(this.speed, this.targetSpeed, delta * accelRate);

    if (this.state === 'CRUISING') {
      const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
      this.position.addScaledVector(forward, this.speed * delta);

      // Loop nos limites da cidade (retorno no final das vias)
      const roadLimit = 46.0;
      if (this.currentAxis === 'NS') {
        if (this.position.z > roadLimit && this.currentDirection === 1) {
          // Chegou ao fim da avenida sul: inverte para a pista norte
          this.currentDirection = -1;
          this.position.x = -3.5;
          this.rotationY = Math.PI;
          this.mesh.rotation.y = this.rotationY;
        } else if (this.position.z < -roadLimit && this.currentDirection === -1) {
          // Chegou ao fim da avenida norte: inverte para a pista sul
          this.currentDirection = 1;
          this.position.x = 3.5;
          this.rotationY = 0;
          this.mesh.rotation.y = this.rotationY;
        }
      } else {
        if (this.position.x > roadLimit && this.currentDirection === 1) {
          // Chegou ao fim da transversal leste: inverte para a pista oeste
          this.currentDirection = -1;
          this.position.z = 3.5;
          this.rotationY = -Math.PI / 2;
          this.mesh.rotation.y = this.rotationY;
        } else if (this.position.x < -roadLimit && this.currentDirection === -1) {
          // Chegou ao fim da transversal oeste: inverte para a pista leste
          this.currentDirection = 1;
          this.position.z = -3.5;
          this.rotationY = Math.PI / 2;
          this.mesh.rotation.y = this.rotationY;
        }
      }
    }
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
