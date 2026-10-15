// apps/web/src/avatars/daniel-avatar.ts
import * as THREE from 'three';
import { ObstacleCollider } from '../scenes/city-scene';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export class DanielAvatar {
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public rotationY: number = 0;
  public speed: number = 0;

  // Membros para animação procedural de caminhada
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private walkCycleTime: number = 0;

  // Áurea Mística de Fogo Azul (Avatar Protagonista)
  private auraGroup!: THREE.Group;
  private innerFlameShell!: THREE.Mesh;
  private outerFlameShell!: THREE.Mesh;
  private flameCrownShell!: THREE.Mesh;
  private auraLight!: THREE.PointLight;
  private flameParticles: { mesh: THREE.Mesh; baseY: number; speedY: number; angle: number; radius: number }[] = [];
  private auraGroundRing!: THREE.Mesh;
  private auraGroundGlow!: THREE.Mesh;
  private auraTime: number = 0;

  // Parâmetros de física e colisão
  private readonly baseSpeed = 5.0; // m/s
  private readonly sprintMultiplier = 1.8;
  public readonly radius = 0.45; // Raio corporal de colisão (45 cm)

  constructor() {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    // Inicia na calçada da esquina sudeste do cruzamento, em frente à faixa
    this.position.set(8.5, 0.22, 12.0);

    this.buildCharacterModel();
  }

  private buildCharacterModel(): void {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.4, metalness: 0.2 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.6 });

    // 1. Tronco / Jaqueta
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), jacketMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.mesh.add(torso);

    // 2. Cabeça
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skinMat);
    head.position.y = 1.7;
    head.castShadow = true;
    this.mesh.add(head);

    // Visor futurista / AR Glasses
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), visorMat);
    visor.position.set(0, 1.72, 0.18);
    this.mesh.add(visor);

    // 3. Braços
    const armGeom = new THREE.BoxGeometry(0.14, 0.55, 0.14);
    armGeom.translate(0, -0.25, 0); // Pivô no ombro

    this.leftArm = new THREE.Mesh(armGeom, jacketMat);
    this.leftArm.position.set(-0.35, 1.45, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeom, jacketMat);
    this.rightArm.position.set(0.35, 1.45, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // 4. Pernas
    const legGeom = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    legGeom.translate(0, -0.35, 0); // Pivô no quadril

    this.leftLeg = new THREE.Mesh(legGeom, pantsMat);
    this.leftLeg.position.set(-0.16, 0.8, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, pantsMat);
    this.rightLeg.position.set(0.16, 0.8, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    // Sapatos
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.28), shoeMat);
    leftShoe.position.set(0, -0.72, 0.05);
    this.leftLeg.add(leftShoe);

    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.28), shoeMat);
    rightShoe.position.set(0, -0.72, 0.05);
    this.rightLeg.add(rightShoe);

    // Constrói a Áurea Mística de Fogo Azul
    this.buildBlueFlameAura();
  }

  /**
   * Constrói a Áurea de Fogo Azul Transparente ao redor do Avatar Protagonista
   */
  private buildBlueFlameAura(): void {
    this.auraGroup = new THREE.Group();
    this.mesh.add(this.auraGroup);

    // 1. Luz Mística de Fogo Azul no Centro do Avatar
    this.auraLight = new THREE.PointLight(0x00e5ff, 1.8, 5.5);
    this.auraLight.position.set(0, 1.1, 0);
    this.auraGroup.add(this.auraLight);

    // 2. Casca Interna da Chama (Ciano Elétrico com Additive Blending)
    const innerGeo = new THREE.CylinderGeometry(0.48, 0.65, 2.05, 18, 4, true);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.innerFlameShell = new THREE.Mesh(innerGeo, innerMat);
    this.innerFlameShell.position.set(0, 1.05, 0);
    this.auraGroup.add(this.innerFlameShell);

    // 3. Casca Externa da Chama (Azul Cobalto / Safira Eon)
    const outerGeo = new THREE.CylinderGeometry(0.60, 0.76, 2.25, 20, 4, true);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x2979ff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.outerFlameShell = new THREE.Mesh(outerGeo, outerMat);
    this.outerFlameShell.position.set(0, 1.15, 0);
    this.auraGroup.add(this.outerFlameShell);

    // 4. Coroa de Labaredas Superiores (Efeito chamas crepitando sobre a cabeça)
    const crownGeo = new THREE.ConeGeometry(0.55, 0.75, 16, 2, true);
    const crownMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.flameCrownShell = new THREE.Mesh(crownGeo, crownMat);
    this.flameCrownShell.position.set(0, 2.1, 0);
    this.flameCrownShell.rotation.x = Math.PI;
    this.auraGroup.add(this.flameCrownShell);

    // 5. Partículas / Wisps de Chamas Ascendentes Flutuantes (16 labaredas em espiral)
    const flameGeo = new THREE.ConeGeometry(0.06, 0.22, 6);
    flameGeo.rotateX(Math.PI);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x80d8ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 16; i++) {
      const p = new THREE.Mesh(flameGeo, flameMat);
      const angle = (i / 16) * Math.PI * 2;
      const radius = 0.42 + Math.random() * 0.22;
      const baseY = 0.2 + (i / 16) * 1.8;
      p.position.set(Math.cos(angle) * radius, baseY, Math.sin(angle) * radius);
      this.auraGroup.add(p);
      this.flameParticles.push({
        mesh: p,
        baseY,
        speedY: 1.2 + Math.random() * 0.8,
        angle,
        radius,
      });
    }

    // 6. Halo / Círculo Místico Pulsante nos Pés
    const ringGeo = new THREE.RingGeometry(0.42, 0.75, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.auraGroundRing = new THREE.Mesh(ringGeo, ringMat);
    this.auraGroundRing.rotation.x = -Math.PI / 2;
    this.auraGroundRing.position.y = 0.025;
    this.auraGroup.add(this.auraGroundRing);

    // Disco de Brilho Central no Solo
    const glowGeo = new THREE.CircleGeometry(0.85, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x0091ea,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.auraGroundGlow = new THREE.Mesh(glowGeo, glowMat);
    this.auraGroundGlow.rotation.x = -Math.PI / 2;
    this.auraGroundGlow.position.y = 0.02;
    this.auraGroup.add(this.auraGroundGlow);
  }

  /**
   * Animação procedural e crepitação contínua da Áurea de Fogo Azul
   */
  private updateBlueFlameAura(delta: number): void {
    this.auraTime += delta * 3.2;

    // Rotação turbilhonar oposta das cascas de chama
    this.innerFlameShell.rotation.y += delta * 1.8;
    this.outerFlameShell.rotation.y -= delta * 1.3;
    this.flameCrownShell.rotation.y += delta * 2.2;

    // Pulsação elástica simulando a tremulação e calor do fogo
    const flicker1 = Math.sin(this.auraTime * 4.5);
    const flicker2 = Math.cos(this.auraTime * 6.0);
    const pulseScaleY = 1.0 + flicker1 * 0.06;
    const pulseScaleXZ = 1.0 + flicker2 * 0.05;

    this.innerFlameShell.scale.set(pulseScaleXZ, pulseScaleY, pulseScaleXZ);
    this.outerFlameShell.scale.set(1.0 + flicker2 * 0.07, 1.0 + flicker1 * 0.08, 1.0 + flicker2 * 0.07);
    this.flameCrownShell.scale.set(1.0 + flicker1 * 0.12, 1.0 + flicker2 * 0.15, 1.0 + flicker1 * 0.12);

    // Pulsação da luz mística (flicker de fogo azul)
    this.auraLight.intensity = 1.6 + Math.sin(this.auraTime * 5.0) * 0.35 + (Math.random() - 0.5) * 0.15;

    // Animação ascendente das 16 partículas de labareda em espiral
    for (const p of this.flameParticles) {
      p.baseY += p.speedY * delta;
      p.angle += delta * 2.0;

      if (p.baseY > 2.25) {
        p.baseY = 0.15 + Math.random() * 0.2;
        p.radius = 0.38 + Math.random() * 0.24;
      }

      const currentX = Math.cos(p.angle) * p.radius;
      const currentZ = Math.sin(p.angle) * p.radius;
      p.mesh.position.set(currentX, p.baseY, currentZ);

      // Conforme sobe, reduz de tamanho simulando dissipação do fogo
      const lifeRatio = 1.0 - Math.min(1.0, (p.baseY - 0.2) / 2.05);
      const s = 0.5 + lifeRatio * 0.7;
      p.mesh.scale.set(s, s * 1.2, s);
    }

    // Halo no chão girando e pulsando suavemente
    this.auraGroundRing.rotation.z += delta * 0.6;
    const ringScale = 1.0 + Math.sin(this.auraTime * 2.5) * 0.08;
    this.auraGroundRing.scale.set(ringScale, ringScale, 1.0);
    this.auraGroundGlow.scale.set(ringScale * 0.95, ringScale * 0.95, 1.0);
  }

  /**
   * Checa se um ponto (x, z) com o raio corporal do avatar colide com algum obstáculo
   */
  private checkCollision(targetX: number, targetZ: number, colliders: ObstacleCollider[]): boolean {
    const r = this.radius;

    for (const c of colliders) {
      if (c.type === 'box') {
        if (c.minX === undefined || c.maxX === undefined || c.minZ === undefined || c.maxZ === undefined) continue;
        // Ponto mais próximo da AABB ao avatar
        const closestX = Math.max(c.minX, Math.min(targetX, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(targetZ, c.maxZ));
        const distX = targetX - closestX;
        const distZ = targetZ - closestZ;
        const distSq = distX * distX + distZ * distZ;

        if (distSq < r * r) {
          return true; // Colisão detectada com a caixa
        }
      } else if (c.type === 'cylinder') {
        if (c.cx === undefined || c.cz === undefined || c.radius === undefined) continue;
        const distX = targetX - c.cx;
        const distZ = targetZ - c.cz;
        const distSq = distX * distX + distZ * distZ;
        const combinedRadius = c.radius + r;

        if (distSq < combinedRadius * combinedRadius) {
          return true; // Colisão detectada com o cilindro
        }
      }
    }

    return false;
  }

  /**
   * Atualiza posição e animação com resposta de colisão física e deslizamento suave
   */
  public update(delta: number, input: MovementInput, cameraAngleY: number, colliders: ObstacleCollider[] = []): void {
    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0);

    const isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
      // Ângulo relativo à câmera
      const inputAngle = Math.atan2(moveX, moveZ);
      const targetAngle = cameraAngleY + inputAngle;

      // Rotação suave em direção ao movimento
      const diff = ((targetAngle - this.rotationY + Math.PI) % (Math.PI * 2)) - Math.PI;
      this.rotationY += diff * Math.min(1, delta * 14);
      this.mesh.rotation.y = this.rotationY;

      const currentMaxSpeed = input.sprint ? this.baseSpeed * this.sprintMultiplier : this.baseSpeed;
      this.speed = THREE.MathUtils.lerp(this.speed, currentMaxSpeed, delta * 10);

      // Deslocamento desejado
      const forwardDir = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
      const step = this.speed * delta;
      const desiredDx = forwardDir.x * step;
      const desiredDz = forwardDir.z * step;

      // ── Resolução de Colisão com Deslizamento (Wall Sliding) ──
      const currX = this.position.x;
      const currZ = this.position.z;

      // 1. Tenta mover no eixo X
      let nextX = currX + desiredDx;
      if (this.checkCollision(nextX, currZ, colliders)) {
        // Colisão em X: bloqueia X (desliza ao longo da superfície em Z)
        nextX = currX;
      }

      // 2. Tenta mover no eixo Z
      let nextZ = currZ + desiredDz;
      if (this.checkCollision(nextX, nextZ, colliders)) {
        // Colisão em Z: bloqueia Z
        nextZ = currZ;
      }

      // Aplica limites do mapa urbano
      this.position.x = THREE.MathUtils.clamp(nextX, -58, 58);
      this.position.z = THREE.MathUtils.clamp(nextZ, -58, 58);

      // Animação de caminhada
      this.walkCycleTime += delta * this.speed * 2.2;
      const legAngle = Math.sin(this.walkCycleTime) * 0.6;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;

      this.leftArm.rotation.x = -legAngle * 0.7;
      this.rightArm.rotation.x = legAngle * 0.7;

      // Bobbing sutil do corpo
      this.mesh.position.y = 0.12 + Math.abs(Math.sin(this.walkCycleTime * 2)) * 0.04;
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 12);
      // Retorna membros à pose neutra
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 10);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 10);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 10);
      this.mesh.position.y = 0.12;
    }

    // Animação Contínua da Áurea de Fogo Azul
    this.updateBlueFlameAura(delta);
  }
}
