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
    // ── MATERIAIS PBR REALISTAS DE ALTA FIDELIDADE ──
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5cfb3,
      roughness: 0.55,
      metalness: 0.05,
    });
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0x16325c, // Azul marinho técnico / safira nobre
      roughness: 0.42,
      metalness: 0.18,
    });
    const jacketTrimMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Detalhes e debruns ciano
      roughness: 0.35,
      metalness: 0.25,
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Camiseta interna cinza claro / off-white
      roughness: 0.82,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Calça jogger techwear grafite escuro
      roughness: 0.75,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x241c18, // Cabelo castanho escuro natural texturizado
      roughness: 0.85,
    });
    const shoeUpperMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Cabedal do tênis em couro escuro
      roughness: 0.38,
    });
    const shoeMidsoleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Entressola em espuma branca de alta densidade
      roughness: 0.32,
    });
    const shoeAccentMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb, // Detalhes esportivos azul elétrico
      roughness: 0.35,
    });
    const shoeSoleMat = new THREE.MeshStandardMaterial({
      color: 0x020617, // Solado de borracha aderente
      roughness: 0.92,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db, // Titânio escovado para fivela, zíperes e relógio
      metalness: 0.95,
      roughness: 0.12,
    });
    const glassesFrameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Armação de óculos preto fosco
      metalness: 0.85,
      roughness: 0.20,
    });
    const glassesLensMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Lentes com tratamento anti-reflexo azulado
      transparent: true,
      opacity: 0.65,
      roughness: 0.05,
      metalness: 0.95,
    });
    const cyberGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1 });

    // ──────────────────── 1. TRONCO, JAQUETA & VESTUÁRIO ────────────────────
    // Camiseta interna
    const innerShirt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.25), shirtMat);
    innerShirt.position.set(0, 1.16, 0.03);
    this.mesh.add(innerShirt);

    // Corpo principal da jaqueta com silhueta atlética ajustada
    const jacketBody = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.30), jacketMat);
    jacketBody.position.set(0, 1.18, 0);
    jacketBody.castShadow = true;
    jacketBody.receiveShadow = true;
    this.mesh.add(jacketBody);

    // Gola alta estilosa da jaqueta
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.12, 14, 1, true), jacketMat);
    collar.position.set(0, 1.50, 0.01);
    this.mesh.add(collar);

    const collarLining = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.11, 14, 1, true), jacketTrimMat);
    collarLining.position.set(0, 1.50, 0.01);
    this.mesh.add(collarLining);

    // Linha frontal do zíper da jaqueta
    const zipperLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.58, 0.02), jacketTrimMat);
    zipperLine.position.set(0, 1.18, 0.155);
    this.mesh.add(zipperLine);

    // Cursor metálico do zíper
    const zipperPull = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03), metalMat);
    zipperPull.position.set(0, 1.35, 0.165);
    this.mesh.add(zipperPull);

    // Barra elástica inferior da jaqueta
    const jacketHem = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.29), jacketMat);
    jacketHem.position.set(0, 0.88, 0);
    this.mesh.add(jacketHem);

    // Cinto tático com fivela de metal
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.26), pantsMat);
    belt.position.set(0, 0.83, 0);
    this.mesh.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.03), metalMat);
    buckle.position.set(0, 0.83, 0.135);
    this.mesh.add(buckle);

    // ──────────────────── 2. CABEÇA, ROSTO & ÓCULOS ────────────────────
    // Pescoço
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 12), skinMat);
    neck.position.set(0, 1.50, 0);
    neck.castShadow = true;
    this.mesh.add(neck);

    // Cabeça com queixo proporcional
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 20, 20), skinMat);
    head.position.set(0, 1.68, 0);
    head.castShadow = true;
    this.mesh.add(head);

    // Orelhas anatômicas
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.06), skinMat);
      ear.position.set(side * 0.20, 1.68, -0.01);
      this.mesh.add(ear);

      const earInner = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.03), hairMat);
      earInner.position.set(side * 0.21, 1.68, 0);
      this.mesh.add(earInner);
    }

    // Olhos Expressivos com brilho especular
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), eyeWhiteMat);
      eyeWhite.position.set(side * 0.068, 1.70, 0.18);
      this.mesh.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyePupilMat);
      pupil.position.set(side * 0.068, 1.70, 0.208);
      this.mesh.add(pupil);

      // Sobrancelha esculpida
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.03), hairMat);
      brow.position.set(side * 0.068, 1.745, 0.185);
      brow.rotation.z = side * -0.08;
      this.mesh.add(brow);
    }

    // Nariz 3D sutil
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.04), skinMat);
    nose.position.set(0, 1.67, 0.21);
    this.mesh.add(nose);

    // Linha dos lábios
    const lips = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), hairMat);
    lips.position.set(0, 1.61, 0.195);
    this.mesh.add(lips);

    // Cabelo moderno texturizado (Topete e degradê lateral)
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.13, 0.38), hairMat);
    hairTop.position.set(0, 1.83, 0.01);
    hairTop.castShadow = true;
    this.mesh.add(hairTop);

    const hairFringe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.12), hairMat);
    hairFringe.position.set(0, 1.78, 0.18);
    this.mesh.add(hairFringe);

    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.20, 0.34), hairMat);
    hairBack.position.set(0, 1.70, -0.06);
    this.mesh.add(hairBack);

    // Óculos de sol esportivos / Cyber Shades sofisticados
    for (const side of [-1, 1]) {
      // Aro dos óculos
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.007, 8, 16), glassesFrameMat);
      rim.position.set(side * 0.068, 1.705, 0.198);
      this.mesh.add(rim);

      // Lente polarizada translúcida
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 14), glassesLensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(side * 0.068, 1.705, 0.198);
      this.mesh.add(lens);

      // Haste lateral estendendo até a orelha
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.01, 0.18), glassesFrameMat);
      temple.position.set(side * 0.125, 1.705, 0.10);
      this.mesh.add(temple);
    }
    const glassesBridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.01), glassesFrameMat);
    glassesBridge.position.set(0, 1.71, 0.205);
    this.mesh.add(glassesBridge);

    // ──────────────────── 3. BRAÇOS, MÃOS & SMARTWATCH ────────────────────
    const armGeom = new THREE.BoxGeometry(0.15, 0.55, 0.15);
    armGeom.translate(0, -0.24, 0); // Pivô no ombro

    this.leftArm = new THREE.Mesh(armGeom, jacketMat);
    this.leftArm.position.set(-0.35, 1.44, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeom, jacketMat);
    this.rightArm.position.set(0.35, 1.44, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Ombros acolchoados (deltoides)
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 10), jacketMat);
      shoulder.position.set(side * 0.35, 1.44, 0);
      this.mesh.add(shoulder);
    }

    // Punhos das mangas e mãos anatômicas
    for (const arm of [this.leftArm, this.rightArm]) {
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), jacketTrimMat);
      cuff.position.set(0, -0.42, 0);
      arm.add(cuff);

      // Palma da mão
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.09), skinMat);
      palm.position.set(0, -0.50, 0);
      palm.castShadow = true;
      arm.add(palm);

      // Polegar anatômico
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.04), skinMat);
      thumb.position.set(0.04, -0.48, 0.035);
      thumb.rotation.z = -0.25;
      arm.add(thumb);

      // Dedos juntos em pose natural de caminhada
      const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.07), skinMat);
      fingers.position.set(0, -0.57, 0);
      arm.add(fingers);
    }

    // Smartwatch holográfico no pulso esquerdo de Daniel
    const watchBand = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.04, 0.165), pantsMat);
    watchBand.position.set(0, -0.40, 0);
    this.leftArm.add(watchBand);

    const watchBezel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.04), metalMat);
    watchBezel.position.set(0.08, -0.40, 0);
    this.leftArm.add(watchBezel);

    const watchScreen = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.045, 0.045), cyberGlowMat);
    watchScreen.position.set(0.105, -0.40, 0);
    this.leftArm.add(watchScreen);

    // ──────────────────── 4. PERNAS & TÊNIS STREETWEAR ────────────────────
    const legGeom = new THREE.BoxGeometry(0.18, 0.72, 0.18);
    legGeom.translate(0, -0.34, 0); // Pivô no quadril

    this.leftLeg = new THREE.Mesh(legGeom, pantsMat);
    this.leftLeg.position.set(-0.15, 0.80, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, pantsMat);
    this.rightLeg.position.set(0.15, 0.80, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    for (const leg of [this.leftLeg, this.rightLeg]) {
      // Joelheira / Recorte estilizado na calça
      const kneePatch = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.14, 0.04), jacketTrimMat);
      kneePatch.position.set(0, -0.32, 0.09);
      leg.add(kneePatch);

      // Barra elástica no tornozelo
      const ankleCuff = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.05, 0.185), pantsMat);
      ankleCuff.position.set(0, -0.66, 0);
      leg.add(ankleCuff);

      // Cabedal do tênis moderno
      const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.28), shoeUpperMat);
      shoeUpper.position.set(0, -0.72, 0.05);
      shoeUpper.castShadow = true;
      leg.add(shoeUpper);

      // Biqueira e detalhes esportivos
      const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.09), shoeAccentMat);
      toeCap.position.set(0, -0.73, 0.165);
      leg.add(toeCap);

      // Entressola espessa em EVA branco
      const midsole = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.05, 0.31), shoeMidsoleMat);
      midsole.position.set(0, -0.78, 0.05);
      leg.add(midsole);

      // Solado de borracha aderente
      const outsole = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.025, 0.32), shoeSoleMat);
      outsole.position.set(0, -0.81, 0.05);
      leg.add(outsole);

      // Faixa de destaque esportivo na lateral do tênis
      const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(0.208, 0.03, 0.14), shoeAccentMat);
      sideStripe.position.set(0, -0.72, 0.06);
      leg.add(sideStripe);
    }
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

      // Aplica limites do mapa urbano expandido (anel viário perimetral e calçadas até ±80m)
      this.position.x = THREE.MathUtils.clamp(nextX, -82, 82);
      this.position.z = THREE.MathUtils.clamp(nextZ, -82, 82);

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

    // Atualização do temporizador de fala do jogador
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
  }

  public speechBubble?: HTMLDivElement;
  public speechTimer: number = 0;

  /**
   * Emite uma fala do jogador visível em balão 3D estilizado.
   */
  public say(message: string, durationSeconds: number = 4.0): void {
    if (typeof document === 'undefined') return;
    this.speechTimer = durationSeconds;
    if (!this.speechBubble) {
      this.speechBubble = document.createElement('div');
      this.speechBubble.className = 'player-speech-bubble';
      this.speechBubble.style.cssText = `
        position: absolute;
        max-width: 240px;
        padding: 8px 12px;
        background: rgba(10, 25, 47, 0.92);
        border: 1.5px solid rgba(0, 229, 255, 0.6);
        border-radius: 12px;
        color: #e2f1ff;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 11.5px;
        line-height: 1.35;
        font-weight: 500;
        pointer-events: none;
        transform: translate(-50%, -100%);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 229, 255, 0.3);
        backdrop-filter: blur(10px);
        z-index: 106;
        text-align: center;
        transition: opacity 0.25s ease;
      `;
      document.body.appendChild(this.speechBubble);
    }

    this.speechBubble.innerHTML = `
      <div style="font-size: 9px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; color: #38bdf8;">
        👤 Daniel (Você)
      </div>
      <div>${message}</div>
    `;
    this.speechBubble.style.opacity = '1';
    this.speechBubble.style.display = 'block';
  }

  /**
   * Projeta a posição 3D do balão de fala do Daniel no plano 2D da tela.
   */
  public updateLabel(camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    if (!this.speechBubble) return;

    if (this.speechTimer > 0) {
      const bubblePos = this.position.clone().add(new THREE.Vector3(0, 2.7, 0));
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

  public dispose(): void {
    if (this.speechBubble?.parentNode) {
      this.speechBubble.parentNode.removeChild(this.speechBubble);
    }
  }
}
