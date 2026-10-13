// apps/web/src/avatars/daniel-avatar.ts
import * as THREE from 'three';

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

  // Parâmetros de física
  private readonly baseSpeed = 5.0; // m/s
  private readonly sprintMultiplier = 1.8;

  constructor() {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.position.set(-8.0, 0.25, 2.0); // Inicia na calçada próxima à faixa

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

    // Indicador circular de seleção aos pés (God Mode Halo)
    const ringGeom = new THREE.RingGeometry(0.4, 0.48, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.mesh.add(ring);
  }

  /**
   * Atualiza posição e animação com base nos inputs do usuário
   */
  public update(delta: number, input: MovementInput, cameraAngleY: number): void {
    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0);

    const isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
      // Calcula ângulo relativo à câmera
      const inputAngle = Math.atan2(moveX, moveZ);
      const targetAngle = cameraAngleY + inputAngle;

      // Rotação suave em direção ao movimento
      const diff = ((targetAngle - this.rotationY + Math.PI) % (Math.PI * 2)) - Math.PI;
      this.rotationY += diff * Math.min(1, delta * 12);
      this.mesh.rotation.y = this.rotationY;

      const currentMaxSpeed = input.sprint ? this.baseSpeed * this.sprintMultiplier : this.baseSpeed;
      this.speed = THREE.MathUtils.lerp(this.speed, currentMaxSpeed, delta * 10);

      // Desloca avatar
      const forwardDir = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
      this.position.addScaledVector(forwardDir, this.speed * delta);

      // Limites da rua (para não sair do mapa)
      this.position.x = THREE.MathUtils.clamp(this.position.x, -11.5, 11.5);
      this.position.z = THREE.MathUtils.clamp(this.position.z, -55, 55);

      // Animação dos membros
      this.walkCycleTime += delta * this.speed * 2.2;
      const legAngle = Math.sin(this.walkCycleTime) * 0.6;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;

      this.leftArm.rotation.x = -legAngle * 0.7;
      this.rightArm.rotation.x = legAngle * 0.7;

      // Bobbing sutil do corpo
      this.mesh.position.y = 0.125 + Math.abs(Math.sin(this.walkCycleTime * 2)) * 0.05;
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 12);
      // Retorna membros à pose neutra
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, delta * 10);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, delta * 10);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, delta * 10);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, delta * 10);
      this.mesh.position.y = 0.125;
    }
  }
}
