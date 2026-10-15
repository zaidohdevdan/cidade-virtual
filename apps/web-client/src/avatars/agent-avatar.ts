// apps/web/src/avatars/agent-avatar.ts
import * as THREE from 'three';
import { MovementInput } from './daniel-avatar';

export interface AgentConfig {
  id: string;
  name: string;
  color: number;
  labelColor: string;
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

  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private walkCycleTime: number = 0;
  private patrolIndex: number = 0;
  private waitTimer: number = 0;

  private readonly walkSpeed = 2.2 + Math.random() * 1.5;

  constructor(config: AgentConfig) {
    this.config = config;
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.position.copy(config.startPosition);
    this.buildModel();
    this.buildLabel();
  }

  private buildModel(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.config.color, roughness: 0.5 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), bodyMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), skinMat);
    head.position.y = 1.65;
    head.castShadow = true;
    this.mesh.add(head);

    // Braços
    const armGeom = new THREE.BoxGeometry(0.13, 0.5, 0.13);
    armGeom.translate(0, -0.22, 0);
    this.leftArm = new THREE.Mesh(armGeom, bodyMat);
    this.leftArm.position.set(-0.33, 1.42, 0);
    this.mesh.add(this.leftArm);
    this.rightArm = new THREE.Mesh(armGeom, bodyMat);
    this.rightArm.position.set(0.33, 1.42, 0);
    this.mesh.add(this.rightArm);

    // Pernas
    const legGeom = new THREE.BoxGeometry(0.16, 0.7, 0.16);
    legGeom.translate(0, -0.32, 0);
    this.leftLeg = new THREE.Mesh(legGeom, pantsMat);
    this.leftLeg.position.set(-0.14, 0.78, 0);
    this.mesh.add(this.leftLeg);
    this.rightLeg = new THREE.Mesh(legGeom, pantsMat);
    this.rightLeg.position.set(0.14, 0.78, 0);
    this.mesh.add(this.rightLeg);

    // Sapatos
    for (const leg of [this.leftLeg, this.rightLeg]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.25), shoeMat);
      shoe.position.set(0, -0.67, 0.04);
      leg.add(shoe);
    }
  }

  private buildLabel(): void {
    this.label = document.createElement('div');
    this.label.className = 'agent-label';
    this.label.textContent = this.config.name;
    this.label.style.cssText = `
      position: absolute;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      color: #ffffff;
      background: ${this.config.labelColor};
      pointer-events: none;
      transform: translate(-50%, -100%);
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      border: 1.5px solid rgba(255,255,255,0.3);
      z-index: 100;
    `;
    document.body.appendChild(this.label);
  }

  public updateLabel(camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    const screenPos = this.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    screenPos.project(camera);

    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    const x = (screenPos.x * 0.5 + 0.5) * w;
    const y = (-screenPos.y * 0.5 + 0.5) * h;

    if (screenPos.z < 1) {
      this.label.style.display = 'block';
      this.label.style.left = `${x}px`;
      this.label.style.top = `${y}px`;
    } else {
      this.label.style.display = 'none';
    }
  }

  public update(delta: number): void {
    if (this.waitTimer > 0) {
      this.waitTimer -= delta;
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 10);
      return;
    }

    const target = this.config.patrolPoints[this.patrolIndex];
    const flat = new THREE.Vector3(target.x, this.position.y, target.z);
    const dir = flat.clone().sub(this.position);
    const dist = dir.length();

    if (dist < 0.5) {
      this.patrolIndex = (this.patrolIndex + 1) % this.config.patrolPoints.length;
      this.waitTimer = 1.5 + Math.random() * 2;
      return;
    }

    dir.normalize();
    const targetAngle = Math.atan2(dir.x, dir.z);
    const angleDiff = ((targetAngle - this.rotationY + Math.PI) % (Math.PI * 2)) - Math.PI;
    this.rotationY += angleDiff * Math.min(1, delta * 6);
    this.mesh.rotation.y = this.rotationY;

    this.speed = THREE.MathUtils.lerp(this.speed, this.walkSpeed, delta * 6);
    this.position.addScaledVector(dir, this.speed * delta);

    // Animação de caminhada
    this.walkCycleTime += delta * this.speed * 2;
    const legAngle = Math.sin(this.walkCycleTime) * 0.55;
    this.leftLeg.rotation.x = legAngle;
    this.rightLeg.rotation.x = -legAngle;
    this.leftArm.rotation.x = -legAngle * 0.65;
    this.rightArm.rotation.x = legAngle * 0.65;
    this.mesh.position.y = Math.abs(Math.sin(this.walkCycleTime * 2)) * 0.04;
  }

  public dispose(): void {
    if (this.label.parentNode) this.label.parentNode.removeChild(this.label);
  }
}

// ── Configuração dos 7 agentes da cidade ──
export const CITY_AGENTS: AgentConfig[] = [
  {
    id: 'agent-1',
    name: 'Agente 1',
    color: 0x1565c0,
    labelColor: '#1565c0',
    startPosition: new THREE.Vector3(-4, 0.19, -25),
    patrolPoints: [
      new THREE.Vector3(-4, 0.19, -38),
      new THREE.Vector3(-4, 0.19, -18),
      new THREE.Vector3(4, 0.19, -25),
    ],
  },
  {
    id: 'agent-2',
    name: 'Agente 2',
    color: 0x388e3c,
    labelColor: '#388e3c',
    startPosition: new THREE.Vector3(-25, 0.19, -5),
    patrolPoints: [
      new THREE.Vector3(-35, 0.19, -5),
      new THREE.Vector3(-16, 0.19, -5),
      new THREE.Vector3(-25, 0.19, 5),
    ],
  },
  {
    id: 'agent-3',
    name: 'Agente 3',
    color: 0xe65100,
    labelColor: '#e65100',
    startPosition: new THREE.Vector3(20, 0.19, -14),
    patrolPoints: [
      new THREE.Vector3(26, 0.19, -22),
      new THREE.Vector3(20, 0.19, -8),
      new THREE.Vector3(14, 0.19, -14),
    ],
  },
  {
    id: 'agent-4',
    name: 'Agente 4',
    color: 0x7b1fa2,
    labelColor: '#7b1fa2',
    startPosition: new THREE.Vector3(20, 0.19, 8),
    patrolPoints: [
      new THREE.Vector3(28, 0.19, 8),
      new THREE.Vector3(20, 0.19, 16),
      new THREE.Vector3(12, 0.19, 8),
    ],
  },
  {
    id: 'agent-5',
    name: 'Agente 5 (Praça)',
    color: 0xc62828,
    labelColor: '#c62828',
    startPosition: new THREE.Vector3(-16, 0.19, 16),
    patrolPoints: [
      new THREE.Vector3(-16, 0.19, 28),
      new THREE.Vector3(-28, 0.19, 28),
      new THREE.Vector3(-28, 0.19, 16),
      new THREE.Vector3(-16, 0.19, 16),
    ],
  },
  {
    id: 'agent-6',
    name: 'Agente 6',
    color: 0x00838f,
    labelColor: '#00695c',
    startPosition: new THREE.Vector3(-10, 0.19, -20),
    patrolPoints: [
      new THREE.Vector3(-10, 0.19, -32),
      new THREE.Vector3(-10, 0.19, -12),
      new THREE.Vector3(-10, 0.19, -20),
    ],
  },
  {
    id: 'agent-7',
    name: 'Agente 7 (Faixa)',
    color: 0xf9a825,
    labelColor: '#f57f17',
    startPosition: new THREE.Vector3(10, 0.19, 14),
    patrolPoints: [
      new THREE.Vector3(10, 0.19, 24),
      new THREE.Vector3(10, 0.19, 6),
      new THREE.Vector3(10, 0.19, 14),
    ],
  },
];
