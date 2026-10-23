// apps/web/src/avatars/daniel-avatar.ts
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { ObstacleCollider } from '../scenes/city-scene';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface AvatarCustomizationConfig {
  model?: string;
  primaryColor?: string;
  secondaryColor?: string;
  skinTone?: string;
  hairColor?: string;
  accessories?: string[];
}

/**
 * 5. PALETA FECHADA COM HEX FIXOS (Inspirada no avatar canônico de alta fidelidade)
 */
export const AVATAR_PALETTE = {
  SKIN: '#f8cdaa',          // Tom de pele anime pêssego suave
  HAIR: '#181a20',          // Cabelo preto carvão anime
  JACKET_BLUE: '#1e5bd8',   // Azul royal / cobalto vibrante (ombros, gola, mangas)
  JACKET_WHITE: '#f3f4f6',  // Branco off-white do corpo da jaqueta
  JACKET_TRIM: '#1e5bd8',   // Debrum azul dos bolsos
  ZIPPER_METAL: '#cbd5e1',  // Zíper metálico prateado
  PANTS_YELLOW: '#f2b705',  // Amarelo dourado vibrante da calça
  KNEE_PATCH: '#1e5bd8',    // Recortes azuis nas joelheiras
  SNEAKER_BODY: '#111827',  // Couro preto do tênis
  SNEAKER_BLUE: '#1e5bd8',  // Destaque azul do tênis
  SNEAKER_SOLE: '#ffffff',  // Entressola e cadarços brancos
  GLASSES_FRAME: '#111827', // Armação preta marcante
  GLASSES_LENS: '#38bdf8',  // Lente translúcida com reflexo ciano
  EYE_WHITE: '#ffffff',     // Esclera branca
  EYE_PUPIL: '#111827',     // Pupila escura
  EYE_HIGHLIGHT: '#ffffff', // Brilho de vida (MeshBasicMaterial)
} as const;

/**
 * 1. HELPER ROUNDEDBOX (DREI) — Elimina quinas duras de BoxGeometry com chanfros suaves
 */
export function createRoundedBox(
  w: number,
  h: number,
  d: number,
  radius = 0.03,
  segments = 2
): THREE.BufferGeometry {
  try {
    const safeRadius = Math.min(radius, w * 0.48, h * 0.48, d * 0.48);
    return new RoundedBoxGeometry(w, h, d, segments, safeRadius);
  } catch {
    return new THREE.BoxGeometry(w, h, d);
  }
}

/**
 * Gera textura procedural suave para a sombra de contato no piso
 */
function createContactShadowTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    if (typeof canvas.getContext !== 'function') return null;
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  } catch {
    return null;
  }
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

  // 2. MATERIAIS POR FUNÇÃO (Definidos uma vez, reutilizados em batching)
  private skinMat!: THREE.MeshStandardMaterial;
  private jacketMat!: THREE.MeshStandardMaterial;
  private jacketWhiteMat!: THREE.MeshStandardMaterial;
  private jacketTrimMat!: THREE.MeshStandardMaterial;
  private pantsMat!: THREE.MeshStandardMaterial;
  private kneePatchMat!: THREE.MeshStandardMaterial;
  private hairMat!: THREE.MeshStandardMaterial;
  private metalMat!: THREE.MeshStandardMaterial;
  private glassesFrameMat!: THREE.MeshStandardMaterial;
  private glassesLensMat!: THREE.MeshStandardMaterial;
  private eyeWhiteMat!: THREE.MeshStandardMaterial;
  private eyePupilMat!: THREE.MeshStandardMaterial;
  private eyeHighlightMat!: THREE.MeshBasicMaterial;
  private shoeUpperMat!: THREE.MeshStandardMaterial;
  private shoeBlueMat!: THREE.MeshStandardMaterial;
  private shoeSoleMat!: THREE.MeshStandardMaterial;
  private glassesGroup!: THREE.Group;
  public currentConfig: AvatarCustomizationConfig;

  // Parâmetros de física e colisão
  private readonly baseSpeed = 5.0; // m/s
  private readonly sprintMultiplier = 1.8;
  public readonly radius = 0.45; // Raio corporal de colisão (45 cm)

  constructor(initialConfig?: AvatarCustomizationConfig) {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    // Inicia na calçada da esquina sudeste do cruzamento, em frente à faixa
    this.position.set(8.5, 0.22, 12.0);

    this.currentConfig = {
      model: initialConfig?.model || 'casual_male_1',
      primaryColor: initialConfig?.primaryColor || AVATAR_PALETTE.JACKET_BLUE,
      secondaryColor: initialConfig?.secondaryColor || AVATAR_PALETTE.PANTS_YELLOW,
      skinTone: initialConfig?.skinTone || AVATAR_PALETTE.SKIN,
      hairColor: initialConfig?.hairColor || AVATAR_PALETTE.HAIR,
      accessories: initialConfig?.accessories || ['glasses'],
    };

    this.buildCharacterModel();
    this.applyConfig(this.currentConfig);
  }

  private buildCharacterModel(): void {
    // ── 2. MATERIAIS PBR POR FUNÇÃO (Definidos uma única vez para reaproveitamento e batching) ──
    this.skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.SKIN),
      roughness: 0.60,
      metalness: 0.0,
      emissive: new THREE.Color(AVATAR_PALETTE.SKIN).multiplyScalar(0.08),
    });
    this.hairMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.HAIR),
      roughness: 0.78,
      metalness: 0.05,
      emissive: new THREE.Color(AVATAR_PALETTE.HAIR).multiplyScalar(0.04),
    });
    this.jacketMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.JACKET_BLUE),
      roughness: 0.50,
      metalness: 0.05,
      emissive: new THREE.Color(AVATAR_PALETTE.JACKET_BLUE).multiplyScalar(0.08),
    });
    this.jacketWhiteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.JACKET_WHITE),
      roughness: 0.65,
      metalness: 0.0,
      emissive: new THREE.Color(AVATAR_PALETTE.JACKET_WHITE).multiplyScalar(0.06),
    });
    this.jacketTrimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.JACKET_TRIM),
      roughness: 0.45,
      metalness: 0.05,
      emissive: new THREE.Color(AVATAR_PALETTE.JACKET_TRIM).multiplyScalar(0.08),
    });
    this.pantsMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.PANTS_YELLOW),
      roughness: 0.65,
      metalness: 0.0,
      emissive: new THREE.Color(AVATAR_PALETTE.PANTS_YELLOW).multiplyScalar(0.08),
    });
    this.kneePatchMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.KNEE_PATCH),
      roughness: 0.50,
      metalness: 0.05,
      emissive: new THREE.Color(AVATAR_PALETTE.KNEE_PATCH).multiplyScalar(0.08),
    });
    this.metalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.ZIPPER_METAL),
      metalness: 0.85,
      roughness: 0.25,
    });
    this.glassesFrameMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.GLASSES_FRAME),
      roughness: 0.40,
      metalness: 0.10,
    });
    this.glassesLensMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.GLASSES_LENS),
      transparent: true,
      opacity: 0.35,
      roughness: 0.15,
      metalness: 0.25,
    });
    this.eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.EYE_WHITE),
      roughness: 0.25,
      emissive: new THREE.Color(0xffffff).multiplyScalar(0.12),
    });
    this.eyePupilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.EYE_PUPIL),
      roughness: 0.20,
    });
    this.eyeHighlightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(AVATAR_PALETTE.EYE_HIGHLIGHT),
    });
    this.shoeUpperMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.SNEAKER_BODY),
      roughness: 0.50,
      metalness: 0.05,
    });
    this.shoeBlueMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.SNEAKER_BLUE),
      roughness: 0.50,
      metalness: 0.05,
      emissive: new THREE.Color(AVATAR_PALETTE.SNEAKER_BLUE).multiplyScalar(0.08),
    });
    this.shoeSoleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(AVATAR_PALETTE.SNEAKER_SOLE),
      roughness: 0.45,
      metalness: 0.0,
      emissive: new THREE.Color(0xffffff).multiplyScalar(0.05),
    });

    // ── 4. SOMBRA DE CONTATO SUAVE NO PISO (Aterra o personagem firmemente ao chão) ──
    const shadowTex = createContactShadowTexture();
    const contactShadowMat = new THREE.MeshBasicMaterial({
      ...(shadowTex ? { map: shadowTex } : {}),
      color: 0x000000,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.005, 0.04);
    this.mesh.add(contactShadow);

    // ──────────────────── 1. TRONCO, JAQUETA & VESTUÁRIO ────────────────────
    // Base da jaqueta (ombros, laterais e costas em azul royal vibrante)
    const jacketBody = new THREE.Mesh(createRoundedBox(0.56, 0.68, 0.32, 0.05, 2), this.jacketMat);
    jacketBody.position.set(0, 1.18, 0);
    jacketBody.castShadow = true;
    jacketBody.receiveShadow = true;
    this.mesh.add(jacketBody);

    // Painel frontal branco da jaqueta (corpo central branco como em avatar.png)
    const jacketFrontPanel = new THREE.Mesh(createRoundedBox(0.38, 0.64, 0.04, 0.02, 2), this.jacketWhiteMat);
    jacketFrontPanel.position.set(0, 1.18, 0.155);
    this.mesh.add(jacketFrontPanel);

    // Linha vertical do zíper metálico central
    const zipperLine = new THREE.Mesh(createRoundedBox(0.024, 0.60, 0.015, 0.005, 1), this.metalMat);
    zipperLine.position.set(0, 1.18, 0.175);
    this.mesh.add(zipperLine);

    // Cursor / Puxador metálico robusto do zíper
    const zipperPull = new THREE.Mesh(createRoundedBox(0.045, 0.07, 0.025, 0.008, 1), this.metalMat);
    zipperPull.position.set(0, 1.36, 0.188);
    this.mesh.add(zipperPull);

    // Bolsos com debrum azul inclinados sobre o painel frontal branco
    for (const side of [-1, 1]) {
      const pocketTrim = new THREE.Mesh(createRoundedBox(0.025, 0.14, 0.015, 0.005, 1), this.jacketTrimMat);
      pocketTrim.position.set(side * 0.12, 1.06, 0.178);
      pocketTrim.rotation.z = side * -0.35;
      this.mesh.add(pocketTrim);
    }

    // Gola alta estilosa com lapelas abertas dobradas
    const collarBack = new THREE.Mesh(createRoundedBox(0.32, 0.13, 0.06, 0.02, 2), this.jacketMat);
    collarBack.position.set(0, 1.50, -0.09);
    this.mesh.add(collarBack);

    for (const side of [-1, 1]) {
      const collarLapel = new THREE.Mesh(createRoundedBox(0.06, 0.15, 0.22, 0.02, 2), this.jacketMat);
      collarLapel.position.set(side * 0.14, 1.50, 0.02);
      collarLapel.rotation.y = side * 0.12;
      this.mesh.add(collarLapel);
    }

    // Barra elástica inferior da jaqueta
    const jacketHem = new THREE.Mesh(createRoundedBox(0.53, 0.07, 0.30, 0.02, 2), this.jacketWhiteMat);
    jacketHem.position.set(0, 0.88, 0);
    this.mesh.add(jacketHem);

    // ──────────────────── 2. CABEÇA, ROSTO & ÓCULOS ────────────────────
    // Pescoço
    const neck = new THREE.Mesh(createRoundedBox(0.12, 0.16, 0.12, 0.04, 2), this.skinMat);
    neck.position.set(0, 1.48, 0);
    neck.castShadow = true;
    this.mesh.add(neck);

    // Cabeça estilizada anime com quinas arredondadas
    const head = new THREE.Mesh(createRoundedBox(0.38, 0.38, 0.35, 0.08, 3), this.skinMat);
    head.position.set(0, 1.68, 0);
    head.castShadow = true;
    this.mesh.add(head);

    // Orelhas
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(createRoundedBox(0.04, 0.08, 0.06, 0.015, 2), this.skinMat);
      ear.position.set(side * 0.20, 1.68, -0.01);
      this.mesh.add(ear);
    }

    // Olhos Expressivos com Highlight Vivo (Brilho branco de 1 draw call)
    for (const side of [-1, 1]) {
      // Esclera branca arredondada
      const eyeWhite = new THREE.Mesh(createRoundedBox(0.085, 0.10, 0.02, 0.03, 2), this.eyeWhiteMat);
      eyeWhite.position.set(side * 0.075, 1.695, 0.175);
      this.mesh.add(eyeWhite);

      // Pupila / Íris escura anime
      const pupil = new THREE.Mesh(createRoundedBox(0.055, 0.075, 0.022, 0.02, 2), this.eyePupilMat);
      pupil.position.set(side * 0.075, 1.695, 0.188);
      this.mesh.add(pupil);

      // ★ 3 & 4. O BRILHO BRANCO NO OLHO (MeshBasicMaterial esferinha branca que dá vida ao rosto) ★
      const eyeHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), this.eyeHighlightMat);
      eyeHighlight.position.set(side * 0.075 + 0.014, 1.715, 0.202);
      this.mesh.add(eyeHighlight);

      // Sobrancelha fina
      const brow = new THREE.Mesh(createRoundedBox(0.075, 0.018, 0.025, 0.006, 1), this.hairMat);
      brow.position.set(side * 0.075, 1.765, 0.188);
      brow.rotation.z = side * -0.06;
      this.mesh.add(brow);
    }

    // Nariz sutil anime
    const nose = new THREE.Mesh(createRoundedBox(0.025, 0.035, 0.03, 0.008, 1), this.skinMat);
    nose.position.set(0, 1.65, 0.19);
    this.mesh.add(nose);

    // Linha sutil da boca
    const lips = new THREE.Mesh(createRoundedBox(0.055, 0.012, 0.015, 0.004, 1), this.hairMat);
    lips.position.set(0, 1.60, 0.185);
    this.mesh.add(lips);

    // Cabelo preto anime em mechas anguladas e facetadas (Layered Cut)
    const hairTop = new THREE.Mesh(createRoundedBox(0.44, 0.20, 0.42, 0.06, 3), this.hairMat);
    hairTop.position.set(0, 1.84, -0.01);
    hairTop.castShadow = true;
    this.mesh.add(hairTop);

    // Mechas frontais sobre a testa
    const bangsCenter = new THREE.Mesh(createRoundedBox(0.10, 0.14, 0.08, 0.02, 2), this.hairMat);
    bangsCenter.position.set(0, 1.79, 0.18);
    this.mesh.add(bangsCenter);

    for (const side of [-1, 1]) {
      const bangsSide = new THREE.Mesh(createRoundedBox(0.09, 0.15, 0.08, 0.02, 2), this.hairMat);
      bangsSide.position.set(side * 0.11, 1.77, 0.17);
      bangsSide.rotation.z = side * 0.15;
      this.mesh.add(bangsSide);

      const hairTemple = new THREE.Mesh(createRoundedBox(0.07, 0.18, 0.14, 0.02, 2), this.hairMat);
      hairTemple.position.set(side * 0.21, 1.72, 0.08);
      this.mesh.add(hairTemple);
    }

    const hairBack = new THREE.Mesh(createRoundedBox(0.44, 0.28, 0.24, 0.05, 2), this.hairMat);
    hairBack.position.set(0, 1.68, -0.09);
    this.mesh.add(hairBack);

    // ── 3. ÓCULOS DE VERDADE (Aro marcante + Lente translúcida + Hastes) ──
    this.glassesGroup = new THREE.Group();
    for (const side of [-1, 1]) {
      // Aro arredondado marcante
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 8, 24), this.glassesFrameMat);
      rim.scale.set(1.15, 0.95, 1.0);
      rim.position.set(side * 0.075, 1.695, 0.205);
      this.glassesGroup.add(rim);

      // Lente translúcida com reflexo ciano
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.008, 24), this.glassesLensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(side * 0.075, 1.695, 0.205);
      this.glassesGroup.add(lens);

      // Haste lateral estendendo até a orelha
      const temple = new THREE.Mesh(createRoundedBox(0.012, 0.012, 0.22, 0.004, 1), this.glassesFrameMat);
      temple.position.set(side * 0.138, 1.70, 0.09);
      this.glassesGroup.add(temple);
    }

    // Ponte nasal dos óculos
    const bridge = new THREE.Mesh(createRoundedBox(0.042, 0.016, 0.015, 0.005, 1), this.glassesFrameMat);
    bridge.position.set(0, 1.70, 0.21);
    this.glassesGroup.add(bridge);
    this.mesh.add(this.glassesGroup);

    // ──────────────────── 3. BRAÇOS & MÃOS ────────────────────
    const armGeom = createRoundedBox(0.16, 0.54, 0.16, 0.035, 2);
    armGeom.translate(0, -0.24, 0); // Pivô no ombro

    this.leftArm = new THREE.Mesh(armGeom, this.jacketMat);
    this.leftArm.position.set(-0.35, 1.44, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeom, this.jacketMat);
    this.rightArm.position.set(0.35, 1.44, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Ombros arredondados
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(createRoundedBox(0.18, 0.18, 0.18, 0.05, 2), this.jacketMat);
      shoulder.position.set(side * 0.35, 1.44, 0);
      this.mesh.add(shoulder);
    }

    // Punhos das mangas e mãos anatômicas em RoundedBox
    for (const arm of [this.leftArm, this.rightArm]) {
      const cuff = new THREE.Mesh(createRoundedBox(0.18, 0.06, 0.18, 0.015, 2), this.jacketMat);
      cuff.position.set(0, -0.42, 0);
      arm.add(cuff);

      const palm = new THREE.Mesh(createRoundedBox(0.11, 0.11, 0.09, 0.025, 2), this.skinMat);
      palm.position.set(0, -0.50, 0);
      palm.castShadow = true;
      arm.add(palm);

      const thumb = new THREE.Mesh(createRoundedBox(0.035, 0.065, 0.04, 0.01, 1), this.skinMat);
      thumb.position.set(0.04, -0.48, 0.035);
      thumb.rotation.z = -0.25;
      arm.add(thumb);

      const fingers = new THREE.Mesh(createRoundedBox(0.095, 0.07, 0.075, 0.015, 1), this.skinMat);
      fingers.position.set(0, -0.57, 0);
      arm.add(fingers);
    }

    // ──────────────────── 4. PERNAS & TÊNIS STREETWEAR ────────────────────
    const legGeom = createRoundedBox(0.20, 0.72, 0.20, 0.04, 2);
    legGeom.translate(0, -0.34, 0); // Pivô no quadril

    this.leftLeg = new THREE.Mesh(legGeom, this.pantsMat);
    this.leftLeg.position.set(-0.15, 0.80, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, this.pantsMat);
    this.rightLeg.position.set(0.15, 0.80, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    for (const leg of [this.leftLeg, this.rightLeg]) {
      // Joelheira / Recorte estilizado azul royal em RoundedBox (identidade de avatar.png)
      const kneePatch = new THREE.Mesh(createRoundedBox(0.185, 0.17, 0.035, 0.018, 2), this.kneePatchMat);
      kneePatch.position.set(0, -0.34, 0.10);
      leg.add(kneePatch);

      // Barra elástica no tornozelo
      const ankleCuff = new THREE.Mesh(createRoundedBox(0.205, 0.06, 0.205, 0.02, 2), this.pantsMat);
      ankleCuff.position.set(0, -0.66, 0);
      leg.add(ankleCuff);

      // Cabedal principal do tênis (preto)
      const shoeUpper = new THREE.Mesh(createRoundedBox(0.21, 0.14, 0.30, 0.03, 2), this.shoeUpperMat);
      shoeUpper.position.set(0, -0.71, 0.04);
      shoeUpper.castShadow = true;
      leg.add(shoeUpper);

      // Detalhes laterais esportivos em azul royal
      const shoeBlueSide = new THREE.Mesh(createRoundedBox(0.216, 0.08, 0.18, 0.015, 2), this.shoeBlueMat);
      shoeBlueSide.position.set(0, -0.71, 0.04);
      leg.add(shoeBlueSide);

      // Biqueira esportiva azul
      const toeCap = new THREE.Mesh(createRoundedBox(0.19, 0.07, 0.10, 0.02, 2), this.shoeBlueMat);
      toeCap.position.set(0, -0.73, 0.165);
      leg.add(toeCap);

      // Cadarços brancos do tênis
      for (let i = 0; i < 3; i++) {
        const lace = new THREE.Mesh(createRoundedBox(0.12, 0.015, 0.03, 0.005, 1), this.shoeSoleMat);
        lace.position.set(0, -0.66 + i * 0.02, 0.08 + i * 0.035);
        leg.add(lace);
      }

      // Entressola espessa e solado em borracha branca de alta densidade
      const midsole = new THREE.Mesh(createRoundedBox(0.23, 0.07, 0.33, 0.025, 2), this.shoeSoleMat);
      midsole.position.set(0, -0.78, 0.04);
      leg.add(midsole);
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

    this.speechBubble.replaceChildren();

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = 'font-size: 9px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; color: #38bdf8;';
    titleDiv.textContent = '👤 Daniel (Você)';

    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;

    this.speechBubble.appendChild(titleDiv);
    this.speechBubble.appendChild(msgDiv);
    this.speechBubble.style.opacity = '1';
    this.speechBubble.style.display = 'block';
  }

  /**
   * Aplica configurações visuais customizadas (cores, materiais, acessórios).
   */
  public applyConfig(config: AvatarCustomizationConfig): void {
    this.currentConfig = { ...this.currentConfig, ...config };

    if (config.primaryColor && this.jacketMat) {
      this.jacketMat.color.set(config.primaryColor);
      this.jacketMat.emissive.set(config.primaryColor).multiplyScalar(0.08);
      if (this.kneePatchMat) {
        this.kneePatchMat.color.set(config.primaryColor);
        this.kneePatchMat.emissive.set(config.primaryColor).multiplyScalar(0.08);
      }
      if (this.shoeBlueMat) {
        this.shoeBlueMat.color.set(config.primaryColor);
        this.shoeBlueMat.emissive.set(config.primaryColor).multiplyScalar(0.08);
      }
      if (this.jacketTrimMat) {
        this.jacketTrimMat.color.set(config.primaryColor);
        this.jacketTrimMat.emissive.set(config.primaryColor).multiplyScalar(0.08);
      }
    }
    if (config.secondaryColor && this.pantsMat) {
      this.pantsMat.color.set(config.secondaryColor);
      this.pantsMat.emissive.set(config.secondaryColor).multiplyScalar(0.08);
    }
    if (config.skinTone && this.skinMat) {
      this.skinMat.color.set(config.skinTone);
      this.skinMat.emissive.set(config.skinTone).multiplyScalar(0.08);
    }
    if (config.hairColor && this.hairMat) {
      this.hairMat.color.set(config.hairColor);
      this.hairMat.emissive.set(config.hairColor).multiplyScalar(0.04);
    }
    if (config.accessories && this.glassesGroup) {
      this.glassesGroup.visible = config.accessories.includes('glasses');
    }
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

  public teleport(x: number, y: number, z: number, rotY?: number): void {
    this.position.set(x, y, z);
    this.speed = 0;
    if (rotY !== undefined) {
      this.rotationY = rotY;
      this.mesh.rotation.y = rotY;
    }
  }

  public dispose(): void {
    if (this.speechBubble?.parentNode) {
      this.speechBubble.parentNode.removeChild(this.speechBubble);
    }
  }
}

