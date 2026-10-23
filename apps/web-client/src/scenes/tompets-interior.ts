import * as THREE from 'three';
import { ObstacleCollider } from './city-scene';

/**
 * Carrega textura de imagem de forma segura tanto no navegador quanto no ambiente de testes (Vitest/Node).
 */
export function loadTextureSafely(url: string, fallbackColorHex: number = 0x0f2c59): THREE.Texture {
  if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
    try {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    } catch {
      // fallback gracioso
    }
  }

  // Fallback para Node.js / JSDOM mock
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#' + fallbackColorHex.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

export interface InteriorProductData {
  id: string;
  name: string;
  shortName: string;
  category: string;
  condition: 'new' | 'used';
  priceCents: number;
  stockQuantity: number;
  shelfId: string;
  shelfSlot: number;
  position: THREE.Vector3;
}

export type InteriorInteractiveTarget =
  | { type: 'product'; data: InteriorProductData }
  | { type: 'seller'; id: string; name: string; role: string }
  | { type: 'exit' };

/**
 * Catálogo canônico da loja TomPets presente nas gôndolas físicas.
 * Preços estritamente em centavos inteiros (priceCents).
 */
export const TOMPETS_INTERIOR_PRODUCTS: InteriorProductData[] = [
  // ════════════════════ SETOR GATOS (ALA FELINA - PAREDE LATERAL ESQUERDA) ════════════════════
  // Prateleira de Parede 3: Areias Sanitárias & Higiene Felina (x: -9.2, z: 0.5)
  {
    id: 'prod-viva-verde-4kg',
    name: 'Areia Higiênica para Gatos Viva Verde Limpeza Plena 4kg',
    shortName: 'Viva Verde 4kg',
    category: 'gatos',
    condition: 'new',
    priceCents: 6890,
    stockQuantity: 25,
    shelfId: 'parede-gatos-higiene',
    shelfSlot: 1,
    position: new THREE.Vector3(-9.2, 1.85, 0.5),
  },
  {
    id: 'prod-pipicat-classic-4kg',
    name: 'Areia Higiênica Pipicat Classic para Gatos 4kg',
    shortName: 'Pipicat Classic 4kg',
    category: 'gatos',
    condition: 'new',
    priceCents: 1890,
    stockQuantity: 50,
    shelfId: 'parede-gatos-higiene',
    shelfSlot: 2,
    position: new THREE.Vector3(-9.2, 1.05, 0.5),
  },

  // Prateleira de Parede 4: Hidratação, Fontes & Semi-Novos (x: -9.2, z: 3.0)
  {
    id: 'prod-fonte-porcelana-csg',
    name: 'Bebedouro Fonte de Porcelana Cansei de Ser Gato Bivolt',
    shortName: 'Fonte Porcelana [NOVA]',
    category: 'gatos',
    condition: 'new',
    priceCents: 19990,
    stockQuantity: 12,
    shelfId: 'parede-gatos-fontes',
    shelfSlot: 1,
    position: new THREE.Vector3(-9.2, 1.85, 3.0),
  },
  {
    id: 'prod-fonte-porcelana-csg-usada',
    name: 'Bebedouro Fonte de Porcelana Cansei de Ser Gato [SEMI-NOVO]',
    shortName: '[SEMI-NOVO] Fonte CSG',
    category: 'gatos',
    condition: 'used',
    priceCents: 9900,
    stockQuantity: 1,
    shelfId: 'parede-gatos-fontes',
    shelfSlot: 2,
    position: new THREE.Vector3(-9.2, 1.05, 3.0),
  },

  // ════════════════════ SETOR CÃES (ALA CANINA - PAREDE LATERAL DIREITA) ════════════════════
  // Prateleira de Parede 1: Rações Secas Super Premium & Clínicas 15kg/10kg (x: 9.2, z: -5.0)
  {
    id: 'prod-formula-natural-15kg',
    name: 'Ração Fórmula Natural Fresh Meat Cães Adultos Raças Médias e Grandes 15kg',
    shortName: 'Fórmula Natural 15kg',
    category: 'caes',
    condition: 'new',
    priceCents: 34990,
    stockQuantity: 15,
    shelfId: 'parede-caes-seca-premium',
    shelfSlot: 1,
    position: new THREE.Vector3(9.2, 1.85, -5.0),
  },
  {
    id: 'prod-premier-hipoalergenico-10kg',
    name: 'Ração PremieR Nutrição Clínica Hipoalergênico Cães Médio e Grande Porte 10,1kg',
    shortName: 'PremieR Hipoalergênico',
    category: 'caes',
    condition: 'new',
    priceCents: 38990,
    stockQuantity: 8,
    shelfId: 'parede-caes-seca-premium',
    shelfSlot: 2,
    position: new THREE.Vector3(9.2, 1.05, -5.0),
  },

  // Prateleira de Parede 2: Rações Secas Diárias & Mini Bits (x: 9.2, z: -2.2)
  {
    id: 'prod-golden-mini-bits',
    name: 'Ração Golden Formula Mini Bits Cães Adultos Pequeno Porte Carne e Arroz',
    shortName: 'Golden Mini Bits',
    category: 'caes',
    condition: 'new',
    priceCents: 17490,
    stockQuantity: 20,
    shelfId: 'parede-caes-seca-diaria',
    shelfSlot: 1,
    position: new THREE.Vector3(9.2, 1.85, -2.2),
  },
  {
    id: 'prod-granplus-gourmet-ovelha-15kg',
    name: 'Ração GranPlus Gourmet Cães Adultos Médio e Grande Porte Sabor Ovelha e Arroz 15kg',
    shortName: 'GranPlus Gourmet 15kg',
    category: 'caes',
    condition: 'new',
    priceCents: 18990,
    stockQuantity: 18,
    shelfId: 'parede-caes-seca-diaria',
    shelfSlot: 2,
    position: new THREE.Vector3(9.2, 1.05, -2.2),
  },
];

/**
 * Formata centavos em BRL com segurança (zero float rounding drift).
 */
export function formatBRLFromCents(priceCents: number): string {
  const reais = Math.floor(priceCents / 100);
  const centavos = Math.abs(priceCents % 100).toString().padStart(2, '0');
  return `R$ ${reais.toLocaleString('pt-BR')},${centavos}`;
}

export class TomPetsInteriorScene {
  public scene: THREE.Scene;
  public colliders: ObstacleCollider[] = [];
  public interactiveMeshes: THREE.Object3D[] = [];
  public sellerMesh!: THREE.Group;
  public exitThresholdMesh!: THREE.Mesh;

  private ambientLight!: THREE.AmbientLight;
  private spotLights: THREE.SpotLight[] = [];

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827); // Fundo escuro aconchegante

    this.buildLighting();
    this.buildRoomArchitecture();
    this.buildBrandingAndSignage();
    this.buildSideWallShelves();
    this.buildServiceCounterAndSeller();
    this.buildExitZone();
  }

  // ──────────────────── ILUMINAÇÃO DE PET SHOP MODERNO ────────────────────
  private buildLighting(): void {
    // Iluminação ambiente quente e vívida de varejo moderno
    this.ambientLight = new THREE.AmbientLight(0xfff8ee, 1.35);
    this.scene.add(this.ambientLight);

    // Luz principal difusa de teto com preenchimento uniforme da sala ampla
    const ceilingFill = new THREE.DirectionalLight(0xffffff, 1.25);
    ceilingFill.position.set(0, 4.15, -2.0);
    this.scene.add(ceilingFill);

    // Spots focalizados de alta intensidade direcionados para as prateleiras de parede e balcão central
    const spotTargets = [
      { x: -9.0, z: -5.0 }, // Parede Esquerda: Rações Secas Felinas
      { x: -9.0, z: -2.2 }, // Parede Esquerda: Rações Úmidas & Sachês Felinos
      { x: -9.0, z: 0.5 },  // Parede Esquerda: Higiene & Areias Sanitárias
      { x: -9.0, z: 3.0 },  // Parede Esquerda: Fontes & Hidratação
      { x: 9.0, z: -5.0 },  // Parede Direita: Rações Secas Super Premium
      { x: 9.0, z: -2.2 },  // Parede Direita: Rações Secas Diárias
      { x: 9.0, z: 0.5 },   // Parede Direita: Rações Úmidas Caninas
      { x: 9.0, z: 3.0 },   // Parede Direita: Petiscos & Cuidados
      { x: 0.0, z: -6.2 },  // Balcão Central de Atendimento do Tom
      { x: 0.0, z: 4.0 },   // Porta de Entrada e Saída
    ];

    spotTargets.forEach((tgt) => {
      const spot = new THREE.SpotLight(0xfffaec, 3.8, 11.5, Math.PI / 3.0, 0.4, 0.9);
      spot.position.set(tgt.x, 4.1, tgt.z + 0.6);
      spot.target.position.set(tgt.x, 1.2, tgt.z);
      this.scene.add(spot);
      this.scene.add(spot.target);
      this.spotLights.push(spot);
    });

    // 10 Painéis Luminosos Troffers LED embutidos no teto (2 fileiras x 5 colunas)
    const trofferPositions = [
      { x: -6.0, z: -4.5 },
      { x: -3.0, z: -4.5 },
      { x: 0.0, z: -4.5 },
      { x: 3.0, z: -4.5 },
      { x: 6.0, z: -4.5 },
      { x: -6.0, z: 0.5 },
      { x: -3.0, z: 0.5 },
      { x: 0.0, z: 0.5 },
      { x: 3.0, z: 0.5 },
      { x: 6.0, z: 0.5 },
    ];

    const trofferMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const trofferFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });

    trofferPositions.forEach((pos) => {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.7), trofferMat);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(pos.x, 4.17, pos.z);
      this.scene.add(panel);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.04, 0.76), trofferFrameMat);
      frame.position.set(pos.x, 4.18, pos.z);
      this.scene.add(frame);
    });
  }

  // ──────────────────── ARQUITETURA DO BOX 04 AMPLIADA (20m x 4.2m x 13m) ────────────────────
  private buildRoomArchitecture(): void {
    const wallOffWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 });
    const wallRoyalBlue = new THREE.MeshStandardMaterial({ color: 0x004cbf, roughness: 0.45 });
    const navyTrim = new THREE.MeshStandardMaterial({ color: 0x0f2c59, roughness: 0.4 });
    const ceilingPanel = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });

    // 1. Piso porcelanato comercial claro de alta circulação (20m x 13m)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d')!;
    fCtx.fillStyle = '#f4efe6'; // Bege claro sofisticado
    fCtx.fillRect(0, 0, 512, 512);
    fCtx.strokeStyle = '#d6ccbc';
    fCtx.lineWidth = 4;
    fCtx.strokeRect(0, 0, 512, 512);
    fCtx.strokeRect(0, 0, 256, 256);
    fCtx.strokeRect(256, 256, 256, 256);

    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 6.5);

    const floorVinyl = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.18,
      metalness: 0.08,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 13), floorVinyl);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -2.0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. Teto acústico com sanca e iluminação embutida
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20, 13), ceilingPanel);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4.2, -2.0);
    this.scene.add(ceiling);

    // 3. Parede de Fundo (Back Wall - Z = -8.5): Azul Royal Petz (#004CBF) monumental
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 4.2, 0.2), wallRoyalBlue);
    backWall.position.set(0, 2.1, -8.5);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // 4. Paredes Laterais (X = -10.0 e X = +10.0, Profundidade 13m): Branco arquitetural
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.2, 13), wallOffWhite);
    leftWall.position.set(-10.0, 2.1, -2.0);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.2, 13), wallOffWhite);
    rightWall.position.set(10.0, 2.1, -2.0);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // 5. Rodapés protetores perimetrais em Azul Marinho Petz
    const baseL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 13), navyTrim);
    baseL.position.set(-9.9, 0.15, -2.0);
    this.scene.add(baseL);

    const baseR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 13), navyTrim);
    baseR.position.set(9.9, 0.15, -2.0);
    this.scene.add(baseR);

    const baseB = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 0.22), navyTrim);
    baseB.position.set(0, 0.15, -8.4);
    this.scene.add(baseB);

    const baseFL = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.3, 0.22), navyTrim);
    baseFL.position.set(-5.9, 0.15, 4.4);
    this.scene.add(baseFL);

    const baseFR = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.3, 0.22), navyTrim);
    baseFR.position.set(5.9, 0.15, 4.4);
    this.scene.add(baseFR);

    // 6. Parede Frontal (Entrada/Vitrine em Z = +4.5 com vão central livre de 3.6m para a porta)
    const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.2, 0.2), wallOffWhite);
    frontWallLeft.position.set(-5.9, 2.1, 4.5);
    this.scene.add(frontWallLeft);

    const frontWallRight = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.2, 0.2), wallOffWhite);
    frontWallRight.position.set(5.9, 2.1, 4.5);
    this.scene.add(frontWallRight);

    // Viga superior sobre o vão da porta
    const doorBeam = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.2), wallRoyalBlue);
    doorBeam.position.set(0, 3.7, 4.5);
    this.scene.add(doorBeam);

    // 7. Colliders físicos da sala ampliada (20m x 13m)
    this.colliders.push({ type: 'box', minX: -10.2, maxX: 10.2, minZ: -8.7, maxZ: -8.3, name: 'Parede Fundo' });
    this.colliders.push({ type: 'box', minX: -10.3, maxX: -9.7, minZ: -8.5, maxZ: 4.5, name: 'Parede Esquerda' });
    this.colliders.push({ type: 'box', minX: 9.7, maxX: 10.3, minZ: -8.5, maxZ: 4.5, name: 'Parede Direita' });
    this.colliders.push({ type: 'box', minX: -10.2, maxX: -1.8, minZ: 4.3, maxZ: 4.7, name: 'Fachada Esquerda' });
    this.colliders.push({ type: 'box', minX: 1.8, maxX: 10.2, minZ: 4.3, maxZ: 4.7, name: 'Fachada Direita' });
  }

  // ──────────────────── BRANDING PETZ E IDENTIDADE VISUAL ────────────────────
  private buildBrandingAndSignage(): void {
    // 1. Painel Luminoso Central Monumental "TOMPETS" na parede de fundo com Logomarca Oficial do Tom
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 2048;
    logoCanvas.height = 512;
    const ctx = logoCanvas.getContext('2d')!;

    ctx.fillStyle = '#0f2c59';
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(0, 0, 2048, 512, 36);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, 2048, 512);
    }

    ctx.lineWidth = 18;
    ctx.strokeStyle = '#ffd000';
    ctx.strokeRect(16, 16, 2016, 480);

    // Círculo decorativo de suporte na área esquerda reservada para o medalhão oficial 3D do Tom
    if (typeof ctx.save === 'function') ctx.save();
    if (typeof ctx.beginPath === 'function') ctx.beginPath();
    if (typeof ctx.arc === 'function') ctx.arc(337, 256, 160, 0, Math.PI * 2);
    ctx.fillStyle = '#081d3d';
    if (typeof ctx.fill === 'function') ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffd000';
    if (typeof ctx.stroke === 'function') ctx.stroke();
    if (typeof ctx.restore === 'function') ctx.restore();

    // Texto da marca com tipografia nobre centralizada no vão direito com espaçamento e legibilidade perfeitas
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 125px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TOMPETS', 1320, 160);

    ctx.fillStyle = '#ffd000';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('SETOR FELINO 🐱   |   ATENDIMENTO & CHECKOUT   |   🐶 SETOR CANINO', 1320, 285);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('ALAMEDA DAS NAÇÕES — BOX 04 • MASCOTE & LOGOMARCA OFICIAL: TOM 🐱', 1320, 390);

    const logoTex = new THREE.CanvasTexture(logoCanvas);

    const logoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 1.85, 0.08),
      new THREE.MeshStandardMaterial({
        map: logoTex,
        emissive: 0x002d72,
        emissiveIntensity: 0.45,
        roughness: 0.2,
      })
    );
    logoMesh.position.set(0, 2.9, -8.38);
    this.scene.add(logoMesh);

    // 2. Medalhão Físico 3D da Logomarca Oficial do Tom (posicionado no lado esquerdo da faixa, sem cobrir letras ou bordas)
    const tomLogoMedallion = new THREE.Group();
    tomLogoMedallion.position.set(-2.75, 2.9, -8.32);

    const goldBaseDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.04, 36),
      new THREE.MeshStandardMaterial({ color: 0xffd000, metalness: 0.85, roughness: 0.25 })
    );
    goldBaseDisc.rotation.x = Math.PI / 2;
    tomLogoMedallion.add(goldBaseDisc);

    const tomFaceCircle = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 36),
      new THREE.MeshStandardMaterial({
        map: loadTextureSafely('/tom-logo-badge.png', 0xffffff),
        roughness: 0.3,
      })
    );
    tomFaceCircle.position.set(0, 0, 0.025);
    tomLogoMedallion.add(tomFaceCircle);

    const goldBorderRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.53, 0.035, 16, 36),
      new THREE.MeshStandardMaterial({ color: 0xffd000, metalness: 0.95, roughness: 0.15 })
    );
    goldBorderRing.position.set(0, 0, 0.03);
    tomLogoMedallion.add(goldBorderRing);

    // Iluminação dedicada da logomarca oficial do Tom
    const logoLight = new THREE.PointLight(0xfffaea, 1.1, 4.0);
    logoLight.position.set(0, 0.1, 0.4);
    tomLogoMedallion.add(logoLight);

    this.scene.add(tomLogoMedallion);

    // Faixa amarela decorativa na parede de fundo
    const yellowStripe = new THREE.Mesh(
      new THREE.BoxGeometry(19.9, 0.1, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xffd000, emissive: 0xffd000, emissiveIntensity: 0.25 })
    );
    yellowStripe.position.set(0, 3.88, -8.39);
    this.scene.add(yellowStripe);

    // 3. Grandes Banners Monumentais de Gala (Tom & Nino) na parede de fundo
    this.buildGalaWallBanners();

    // 4. Banners Promocionais & Institucionais nas Paredes Laterais
    this.buildSideWallBanners();

    // 5. Totens Verticais Elegantes de Boas-Vindas na Entrada da Loja (Dupla Face)
    this.buildEntranceTotems();

    // 6. Placas aéreas setoriais suspensas do teto
    this.buildCeilingSectorSigns();

    // 7. Grande Banner Monumental da Luci na Parede Frontal da Ala Canina
    this.buildLuciWallBanner();
  }

  /**
   * Constrói os banners monumentais emoldurados de gala com fotos reais tratadas de Tom e Nino na parede de fundo.
   */
  private buildGalaWallBanners(): void {
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd000, metalness: 0.9, roughness: 0.2 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.5 });

    const createGalaBanner = (
      cx: number,
      imagePath: string,
      petName: string,
      title: string,
      subtitle: string,
      accentHex: number
    ) => {
      const bannerGroup = new THREE.Group();
      bannerGroup.position.set(cx, 2.3, -8.36);

      // Moldura exterior em madeira nobre escura
      const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.1, 0.06), darkWoodMat);
      bannerGroup.add(outerFrame);

      // Borda interna chanfrada em ouro polido
      const innerGoldBevel = new THREE.Mesh(new THREE.BoxGeometry(1.98, 2.98, 0.08), goldMat);
      bannerGroup.add(innerGoldBevel);

      // Painel principal com a foto em alta definição
      const photoPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.85, 2.35),
        new THREE.MeshStandardMaterial({
          map: loadTextureSafely(imagePath, accentHex),
          roughness: 0.25,
        })
      );
      photoPanel.position.set(0, 0.22, 0.045);
      bannerGroup.add(photoPanel);

      // Plaqueta inferior descritiva com tipografia dourada
      const plaqueCanvas = document.createElement('canvas');
      plaqueCanvas.width = 1024;
      plaqueCanvas.height = 256;
      const pCtx = plaqueCanvas.getContext('2d')!;

      pCtx.fillStyle = '#0f2c59';
      if (typeof pCtx.roundRect === 'function') {
        pCtx.roundRect(0, 0, 1024, 256, 16);
        pCtx.fill();
      } else {
        pCtx.fillRect(0, 0, 1024, 256);
      }

      pCtx.lineWidth = 10;
      pCtx.strokeStyle = '#ffd000';
      pCtx.strokeRect(6, 6, 1012, 244);

      pCtx.fillStyle = '#ffd000';
      pCtx.font = '900 52px sans-serif';
      pCtx.textAlign = 'center';
      pCtx.textBaseline = 'middle';
      pCtx.fillText(`🐾 ${petName.toUpperCase()} 🐾`, 512, 70);

      pCtx.fillStyle = '#ffffff';
      pCtx.font = 'bold 36px sans-serif';
      pCtx.fillText(title, 512, 140);

      pCtx.fillStyle = '#94a3b8';
      pCtx.font = 'bold 26px sans-serif';
      pCtx.fillText(subtitle, 512, 195);

      const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
      const plaqueMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.85, 0.45, 0.02),
        new THREE.MeshStandardMaterial({
          map: plaqueTex,
          roughness: 0.2,
          emissive: 0x002d72,
          emissiveIntensity: 0.2,
        })
      );
      plaqueMesh.position.set(0, -1.18, 0.05);
      bannerGroup.add(plaqueMesh);

      // Spot LED superior no topo da moldura iluminando o quadro
      const spotLight = new THREE.PointLight(0xfffaea, 0.85, 4.5);
      spotLight.position.set(0, 1.6, 0.4);
      bannerGroup.add(spotLight);

      this.scene.add(bannerGroup);
    };

    // Banner Monumental do TOM (à esquerda do balcão)
    createGalaBanner(
      -5.8,
      '/banner-gala-tom.png',
      'Tom',
      'Mascote Oficial & Fundador Felino',
      'Gato Persa • O Rosto e a Inspiração da TomPets',
      0x004cbf
    );

    // Banner Monumental do NINO (à direita do balcão)
    createGalaBanner(
      5.8,
      '/banner-gala-nino.png',
      'Nino',
      'Curador Chefe de Sabores & Nutrição',
      'Gato Siamês • Embaixador dos Pets & Olhos Azuis',
      0x004cbf
    );
  }

  /**
   * Constrói banners laterais panorâmicos e informativos acima das prateleiras comerciais.
   */
  private buildSideWallBanners(): void {
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd000, metalness: 0.8, roughness: 0.2 });

    const createSideBanner = (
      wallSide: 'left' | 'right',
      cz: number,
      width: number,
      height: number,
      imagePath: string,
      badgeTitle: string,
      heading: string,
      subheading: string,
      bgColorHex: number
    ) => {
      const isLeft = wallSide === 'left';
      const wallX = isLeft ? -9.9 : 9.9;
      const rotY = isLeft ? Math.PI / 2 : -Math.PI / 2;

      const bannerGroup = new THREE.Group();
      bannerGroup.position.set(wallX, 3.35, cz);
      bannerGroup.rotation.y = rotY;

      // Moldura exterior
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.04),
        goldMat
      );
      bannerGroup.add(frame);

      // Canvas gráfico de alta fidelidade
      const canvas = document.createElement('canvas');
      canvas.width = 1536;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = `#${bgColorHex.toString(16).padStart(6, '0')}`;
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(0, 0, 1536, 512, 24);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, 1536, 512);
      }

      ctx.lineWidth = 14;
      ctx.strokeStyle = '#ffd000';
      ctx.strokeRect(10, 10, 1516, 492);

      // Círculo placeholder da foto do mascote no banner
      if (typeof ctx.save === 'function') ctx.save();
      if (typeof ctx.beginPath === 'function') ctx.beginPath();
      if (typeof ctx.arc === 'function') ctx.arc(220, 256, 160, 0, Math.PI * 2);
      ctx.fillStyle = '#0a1d37';
      if (typeof ctx.fill === 'function') ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ffd000';
      if (typeof ctx.stroke === 'function') ctx.stroke();
      if (typeof ctx.restore === 'function') ctx.restore();

      ctx.fillStyle = '#ffd000';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(badgeTitle.toUpperCase(), 430, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px sans-serif';
      ctx.fillText(heading, 430, 230);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(subheading, 430, 335);

      const bannerTex = new THREE.CanvasTexture(canvas);

      if (typeof Image !== 'undefined') {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (typeof ctx.save === 'function') ctx.save();
            if (typeof ctx.beginPath === 'function') ctx.beginPath();
            if (typeof ctx.arc === 'function') ctx.arc(220, 256, 150, 0, Math.PI * 2);
            if (typeof ctx.closePath === 'function') ctx.closePath();
            if (typeof ctx.clip === 'function') ctx.clip();
            if (typeof ctx.drawImage === 'function') ctx.drawImage(img, 70, 106, 300, 300);
            if (typeof ctx.restore === 'function') ctx.restore();

            ctx.lineWidth = 10;
            ctx.strokeStyle = '#ffd000';
            if (typeof ctx.beginPath === 'function') ctx.beginPath();
            if (typeof ctx.arc === 'function') ctx.arc(220, 256, 150, 0, Math.PI * 2);
            if (typeof ctx.stroke === 'function') ctx.stroke();

            bannerTex.needsUpdate = true;
          };
          img.src = imagePath;
        } catch {
          // fallback gracioso
        }
      }

      const panelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
          map: bannerTex,
          roughness: 0.25,
          emissive: 0x001f4d,
          emissiveIntensity: 0.25,
        })
      );
      panelMesh.position.set(0, 0, 0.025);
      bannerGroup.add(panelMesh);

      // Medalhão físico 3D em relevo sobreposto ao banner lateral
      const badgeDisc = new THREE.Mesh(
        new THREE.CircleGeometry(height * 0.38, 32),
        new THREE.MeshStandardMaterial({
          map: loadTextureSafely(imagePath, 0xffffff),
          roughness: 0.3,
        })
      );
      badgeDisc.position.set(-width / 2 + height * 0.45, 0, 0.035);
      bannerGroup.add(badgeDisc);

      const badgeRing = new THREE.Mesh(
        new THREE.TorusGeometry(height * 0.38, 0.025, 16, 32),
        goldMat
      );
      badgeRing.position.set(-width / 2 + height * 0.45, 0, 0.04);
      bannerGroup.add(badgeRing);

      this.scene.add(bannerGroup);
    };

    // Parede Esquerda - Ala Felina: Banner 1 (Rações Secas & Úmidas)
    createSideBanner(
      'left',
      -3.6,
      4.2,
      1.15,
      '/tom-logo-badge.png',
      '🐾 Dica Nutricional do Tom',
      'RAÇÕES SUPER PREMIUM & PATÊS',
      'Ingredientes nobres selecionados para felinos exigentes',
      0x0f2c59
    );

    // Parede Esquerda - Ala Felina: Banner 2 (Sachês & Hidratação)
    createSideBanner(
      'left',
      1.75,
      4.2,
      1.15,
      '/nino-logo-badge.png',
      '🐾 Escolha Especial do Nino',
      'SACHÊS GOURMET & HIDRATAÇÃO',
      'Fontes de água corrente e patês ricos em nutrientes',
      0x044738
    );

    // Parede Direita - Ala Canina: Banner da Embaixadora Luci
    createSideBanner(
      'right',
      -1.1,
      5.4,
      1.15,
      '/luci-logo-badge.png',
      '🐾 Luci Recomenda • Ala Canina',
      'NUTRIÇÃO & SNACKS CANINOS',
      'PremieR, Royal Canin, Bifinhos Gourmet & Cuidados Especiais',
      0x0f2c59
    );
  }

  /**
   * Constrói totens verticais elegantes de boas-vindas com banners em AMBOS OS LADOS (dupla-face)
   * com fotos reais tratadas de Tom, Nino e Luci na entrada da loja.
   */
  private buildEntranceTotems(): void {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd000, metalness: 0.9, roughness: 0.2 });

    const createDoubleSidedTotem = (
      cx: number,
      cz: number,
      frontImg: string,
      frontPetName: string,
      frontTitle: string,
      frontSub: string,
      backImg: string,
      backPetName: string,
      backTitle: string,
      backSub: string
    ) => {
      const totemGroup = new THREE.Group();
      totemGroup.position.set(cx, 1.45, cz);

      // Base pesada chanfrada
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.6), metalMat);
      baseMesh.position.set(0, -1.39, 0);
      totemGroup.add(baseMesh);

      // Friso dourado na base
      const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.02, 0.62), goldMat);
      baseTrim.position.set(0, -1.33, 0);
      totemGroup.add(baseTrim);

      // Corpo principal do totem vertical (dimensões 1.05m x 2.45m x 0.12m)
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.45, 0.12), metalMat);
      totemGroup.add(bodyMesh);

      // Moldura dourada frontal e traseira
      const frontFrame = new THREE.Mesh(new THREE.BoxGeometry(0.98, 2.38, 0.01), goldMat);
      frontFrame.position.set(0, 0, 0.065);
      totemGroup.add(frontFrame);

      const backFrame = new THREE.Mesh(new THREE.BoxGeometry(0.98, 2.38, 0.01), goldMat);
      backFrame.position.set(0, 0, -0.065);
      totemGroup.add(backFrame);

      // Helper para renderizar cada face do totem (zOffset: +0.07 para frente, -0.07 para verso com rotY=Math.PI)
      const buildFace = (
        zOffset: number,
        rotY: number,
        imgPath: string,
        petName: string,
        title: string,
        sub: string
      ) => {
        // Painel com a foto tratada de estúdio em alta definição
        const photoPanel = new THREE.Mesh(
          new THREE.PlaneGeometry(0.88, 1.65),
          new THREE.MeshStandardMaterial({
            map: loadTextureSafely(imgPath, 0xffffff),
            roughness: 0.3,
          })
        );
        photoPanel.position.set(0, 0.22, zOffset);
        photoPanel.rotation.y = rotY;
        totemGroup.add(photoPanel);

        // Testeira superior luminosa do totem
        const topCanvas = document.createElement('canvas');
        topCanvas.width = 512;
        topCanvas.height = 128;
        const tCtx = topCanvas.getContext('2d')!;
        tCtx.fillStyle = '#0f2c59';
        tCtx.fillRect(0, 0, 512, 128);
        tCtx.lineWidth = 6;
        tCtx.strokeStyle = '#ffd000';
        tCtx.strokeRect(4, 4, 504, 120);
        tCtx.fillStyle = '#ffd000';
        tCtx.font = '900 34px sans-serif';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText(`🐾 ${petName.toUpperCase()} • TOMPETS`, 256, 64);

        const topTex = new THREE.CanvasTexture(topCanvas);
        const topBadge = new THREE.Mesh(
          new THREE.PlaneGeometry(0.88, 0.22),
          new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.2 })
        );
        topBadge.position.set(0, 1.08, zOffset);
        topBadge.rotation.y = rotY;
        totemGroup.add(topBadge);

        // Plaquinha inferior do totem com saudação/conteúdo
        const botCanvas = document.createElement('canvas');
        botCanvas.width = 512;
        botCanvas.height = 160;
        const bCtx = botCanvas.getContext('2d')!;
        bCtx.fillStyle = '#0f2c59';
        bCtx.fillRect(0, 0, 512, 160);
        bCtx.lineWidth = 6;
        bCtx.strokeStyle = '#ffd000';
        bCtx.strokeRect(4, 4, 504, 152);
        bCtx.fillStyle = '#ffd000';
        bCtx.font = 'bold 28px sans-serif';
        bCtx.textAlign = 'center';
        bCtx.fillText(title, 256, 50);
        bCtx.fillStyle = '#ffffff';
        bCtx.font = 'bold 22px sans-serif';
        bCtx.fillText(sub, 256, 105);

        const botTex = new THREE.CanvasTexture(botCanvas);
        const botBadge = new THREE.Mesh(
          new THREE.PlaneGeometry(0.88, 0.28),
          new THREE.MeshStandardMaterial({ map: botTex, roughness: 0.2 })
        );
        botBadge.position.set(0, -0.92, zOffset);
        botBadge.rotation.y = rotY;
        totemGroup.add(botBadge);
      };

      // Frente (voltada para a entrada da loja, +Z)
      buildFace(0.07, 0, frontImg, frontPetName, frontTitle, frontSub);

      // Verso (voltado para o interior da loja, -Z)
      buildFace(-0.07, Math.PI, backImg, backPetName, backTitle, backSub);

      this.scene.add(totemGroup);
    };

    // Totem de Entrada 1 - Ala Felina (lado esquerdo) - Dupla Face
    createDoubleSidedTotem(
      -3.2,
      2.4,
      '/totem-tom-front.png',
      'Tom',
      'SEJA BEM-VINDO!',
      'Mascote & Logomarca Oficial',
      '/totem-tom-back.png',
      'Guia Felino',
      'DICAS DO TOM',
      'Nutrição & Bem-Estar Felino'
    );
    this.colliders.push({
      type: 'box',
      minX: -3.8,
      maxX: -2.6,
      minZ: 2.1,
      maxZ: 2.7,
      name: 'Totem de Boas-Vindas Tom',
    });

    // Totem de Entrada 2 - Ala Canina / Gourmet (lado direito) - Dupla Face
    createDoubleSidedTotem(
      3.2,
      2.4,
      '/totem-nino-front.png',
      'Nino',
      'SABORES & DELÍCIAS',
      'Curadoria Gourmet de Sachês',
      '/totem-luci-back.png',
      'Ala Canina • Luci',
      'ESPECIAL PARA SEU CÃO',
      'Nutrição & Saúde para o seu Cão'
    );
    this.colliders.push({
      type: 'box',
      minX: 2.6,
      maxX: 3.8,
      minZ: 2.1,
      maxZ: 2.7,
      name: 'Totem de Boas-Vindas Nino',
    });
  }

  /**
   * Constrói o grande banner monumental emoldurado de gala da cadela LUCI (embaixadora da Ala Canina)
   * aplicado na parede frontal direita indicada pelo usuário (atrás do totem canino, Z = 4.38, X = 5.9).
   */
  private buildLuciWallBanner(): void {
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd000, metalness: 0.9, roughness: 0.2 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x111c2e, roughness: 0.45 });

    const bannerGroup = new THREE.Group();
    // Posição na parede frontal direita, voltada para dentro da loja (rotY = Math.PI)
    bannerGroup.position.set(5.9, 2.5, 4.38);
    bannerGroup.rotation.y = Math.PI;

    // Moldura exterior em madeira nobre escura/marinho
    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(5.3, 2.15, 0.06), darkWoodMat);
    bannerGroup.add(outerFrame);

    // Borda interna chanfrada em ouro nobre
    const innerGoldBevel = new THREE.Mesh(new THREE.BoxGeometry(5.22, 2.07, 0.08), goldMat);
    bannerGroup.add(innerGoldBevel);

    // Painel principal de alta fidelidade com a arte tratada da Luci
    const photoPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(5.12, 1.97),
      new THREE.MeshStandardMaterial({
        map: loadTextureSafely('/banner-luci-wall.png', 0x004cbf),
        roughness: 0.25,
        emissive: 0x002244,
        emissiveIntensity: 0.15,
      })
    );
    photoPanel.position.set(0, 0, 0.045);
    bannerGroup.add(photoPanel);

    // Iluminação spot dedicada sobre o banner monumental da Luci
    const spotLight = new THREE.PointLight(0xfffaea, 1.1, 5.0);
    spotLight.position.set(0, 1.2, 0.5);
    bannerGroup.add(spotLight);

    this.scene.add(bannerGroup);
  }

  /**
   * Placas aéreas suspensas do teto para orientação e navegação rápida na loja ampla.
   */
  private buildCeilingSectorSigns(): void {
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });

    const createCeilingSign = (
      cx: number,
      cz: number,
      title: string,
      subtitle: string,
      bgColorHex: number,
      accentColorHex: number
    ) => {
      const signGroup = new THREE.Group();

      // Cabos de aço descendo do teto (Y = 4.2) até a placa (Y = 3.82)
      const cable1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 8), cableMat);
      cable1.position.set(-1.4, 4.01, 0);
      signGroup.add(cable1);

      const cable2 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 8), cableMat);
      cable2.position.set(1.4, 4.01, 0);
      signGroup.add(cable2);

      // Canvas da placa aérea de setor (frente e verso iluminados)
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = `#${bgColorHex.toString(16).padStart(6, '0')}`;
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(0, 0, 1024, 256, 24);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, 1024, 256);
      }

      ctx.lineWidth = 14;
      ctx.strokeStyle = `#${accentColorHex.toString(16).padStart(6, '0')}`;
      ctx.strokeRect(8, 8, 1008, 240);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 58px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 512, 95);

      ctx.fillStyle = `#${accentColorHex.toString(16).padStart(6, '0')}`;
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(subtitle, 512, 185);

      const signTex = new THREE.CanvasTexture(canvas);
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.68, 0.06),
        new THREE.MeshStandardMaterial({
          map: signTex,
          emissive: 0xffffff,
          emissiveMap: signTex,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        })
      );
      signMesh.position.set(0, 3.82, 0);
      signGroup.add(signMesh);

      signGroup.position.set(cx, 0, cz);
      this.scene.add(signGroup);
    };

    // 1. Placa Aérea Setor Felino (Ala Esquerda)
    createCeilingSign(
      -3.8,
      0.5,
      '🐱 SETOR FELINO • GATOS',
      'Rações Secas • Rações Úmidas • Higiene • Fontes',
      0x004cbf,
      0xffd000
    );

    // 2. Placa Aérea Setor Canino (Ala Direita)
    createCeilingSign(
      3.8,
      0.5,
      '🐶 SETOR CANINO • CÃES',
      'Rações Secas • Rações Úmidas • Petiscos • Cuidados',
      0x0f2c59,
      0xff7a00
    );

    // 3. Placa Aérea Atendimento & Checkout (Nave Central / Fundo)
    createCeilingSign(
      0.0,
      -5.0,
      '💳 ATENDIMENTO & CHECKOUT',
      'Consulte Nosso Especialista Tom • Pagamentos & Dúvidas',
      0x047857,
      0xffd000
    );
  }

  // ──────────────────── PRATELEIRAS DE PAREDE E PRODUTOS 3D SETORIZADOS ────────────────────
  /**
   * Constrói prateleiras comerciais nas paredes laterais (esquerda = Gatos, direita = Cães),
   * com estantes dedicadas exclusivamente para ração seca, ração úmida, higiene e acessórios.
   */
  private buildSideWallShelves(): void {
    // ════════════════════ PAREDE LATERAL ESQUERDA: SETOR GATOS 🐱 ════════════════════
    // 1. Estante de Ração Seca Felina (z: -5.0)
    this.buildWallShelfBay('left', -5.0, 2.8, '🐱 RAÇÕES SECAS FELINAS', 0x004cbf);
    this.buildDryFoodProps('left', -5.0);

    // 2. Estante de Ração Úmida, Patês & Sachês Felinos (z: -2.2)
    this.buildWallShelfBay('left', -2.2, 2.6, '🐱 RAÇÕES ÚMIDAS & SACHÊS', 0x0284c7);
    this.buildWetFoodProps('left', -2.2);

    // 3. Estante de Areias Sanitárias & Higiene Felina (z: 0.5) — Contém Viva Verde e Pipicat
    this.buildWallShelfBay('left', 0.5, 2.6, '🐱 HIGIENE & AREIAS SANITÁRIAS', 0x15803d);

    // 4. Estante de Fontes de Porcelana & Hidratação (z: 3.0) — Contém Fontes CSG Nova e Usada
    this.buildWallShelfBay('left', 3.0, 2.2, '🐱 FONTES DE PORCELANA & ACESSÓRIOS', 0x0284c7);

    // ════════════════════ PAREDE LATERAL DIREITA: SETOR CÃES 🐶 ════════════════════
    // 1. Estante de Ração Seca Super Premium & Linha Clínica (z: -5.0) — Contém Fórmula Natural e PremieR
    this.buildWallShelfBay('right', -5.0, 2.8, '🐶 RAÇÕES SECAS SUPER PREMIUM', 0x004cbf);

    // 2. Estante de Ração Seca Diária & Mini Bits (z: -2.2) — Contém Golden Mini Bits e GranPlus
    this.buildWallShelfBay('right', -2.2, 2.6, '🐶 RAÇÕES SECAS DIÁRIAS & MINI BITS', 0xb45309);

    // 3. Estante de Ração Úmida Canina, Latas & Patês (z: 0.5)
    this.buildWallShelfBay('right', 0.5, 2.6, '🐶 RAÇÕES ÚMIDAS, LATAS & PATÊS', 0xc2410c);
    this.buildWetFoodProps('right', 0.5);

    // 4. Estante de Petiscos, Mordedores & Cuidados Caninos (z: 3.0)
    this.buildWallShelfBay('right', 3.0, 2.2, '🐶 PETISCOS & CUIDADOS CANINOS', 0x7c2d12);
    this.buildTreatsProps(9.2, 3.0);

    // Renderiza cada produto canônico com seu preço diegético em 3D
    TOMPETS_INTERIOR_PRODUCTS.forEach((prod) => {
      this.createProductMeshWithPriceTag(prod);
    });

    // Colliders físicos das prateleiras de parede para impedir travessia
    this.colliders.push({
      type: 'box',
      minX: -10.1,
      maxX: -8.8,
      minZ: -6.8,
      maxZ: 4.2,
      name: 'Prateleiras de Parede Ala Felina',
    });
    this.colliders.push({
      type: 'box',
      minX: 8.8,
      maxX: 10.1,
      minZ: -6.8,
      maxZ: 4.2,
      name: 'Prateleiras de Parede Ala Canina',
    });
  }

  /**
   * Constrói módulo de prateleira comercial fixada na parede lateral com prateleiras e testeira LED.
   */
  private buildWallShelfBay(
    wallSide: 'left' | 'right',
    cz: number,
    moduleWidth: number,
    categoryTitle: string,
    bannerColorHex: number
  ): void {
    const isLeft = wallSide === 'left';
    const wallX = isLeft ? -10.0 : 10.0;
    const shelfX = isLeft ? -9.55 : 9.55;
    const frontX = isLeft ? -9.1 : 9.1;
    const depth = 0.85;

    const shelfWood = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const metalFrame = new THREE.MeshStandardMaterial({ color: 0x0f2c59, roughness: 0.3, metalness: 0.7 });
    const backPanelMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });

    // Painel de fundo da estante encostado na parede lateral
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 3.2, moduleWidth), backPanelMat);
    backPanel.position.set(isLeft ? wallX + 0.04 : wallX - 0.04, 1.6, cz);
    this.scene.add(backPanel);

    // Prateleiras horizontais (base Y=0.2, nível 1 Y=0.95, nível 2 Y=1.75, topo Y=2.55)
    const shelfLevels = [0.2, 0.95, 1.75, 2.55];
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xfffaea });

    shelfLevels.forEach((sy) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(depth, 0.05, moduleWidth), shelfWood);
      shelf.position.set(shelfX, sy, cz);
      shelf.receiveShadow = true;
      this.scene.add(shelf);

      // Fita LED brilhante sob a borda frontal da prateleira
      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, moduleWidth - 0.08), ledMat);
      ledStrip.position.set(frontX, sy - 0.03, cz);
      this.scene.add(ledStrip);
    });

    // Pilares metálicos verticais frontais
    const pillarGeo = new THREE.BoxGeometry(0.05, 3.1, 0.05);
    const pFront1 = new THREE.Mesh(pillarGeo, metalFrame);
    pFront1.position.set(frontX, 1.55, cz - moduleWidth / 2 + 0.03);
    this.scene.add(pFront1);

    const pFront2 = new THREE.Mesh(pillarGeo, metalFrame);
    pFront2.position.set(frontX, 1.55, cz + moduleWidth / 2 - 0.03);
    this.scene.add(pFront2);

    // Testeira luminosa no topo da estante voltada para o corredor central
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 1024;
    bannerCanvas.height = 256;
    const bCtx = bannerCanvas.getContext('2d')!;

    bCtx.fillStyle = `#${bannerColorHex.toString(16).padStart(6, '0')}`;
    if (typeof bCtx.roundRect === 'function') {
      bCtx.roundRect(0, 0, 1024, 256, 24);
      bCtx.fill();
    } else {
      bCtx.fillRect(0, 0, 1024, 256);
    }

    bCtx.lineWidth = 14;
    bCtx.strokeStyle = '#ffd000';
    bCtx.strokeRect(8, 8, 1008, 240);

    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'bold 48px sans-serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText(categoryTitle, 512, 128);

    const bannerTex = new THREE.CanvasTexture(bannerCanvas);
    const bannerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(depth, 0.46, moduleWidth),
      new THREE.MeshStandardMaterial({
        map: bannerTex,
        roughness: 0.2,
        emissive: 0xffffff,
        emissiveMap: bannerTex,
        emissiveIntensity: 0.45,
      })
    );
    bannerMesh.position.set(shelfX, 2.85, cz);
    this.scene.add(bannerMesh);
  }

  /**
   * Elementos visuais 3D de ração úmida (latinhas de patê e sachês coloridos) para preencher a estante.
   */
  private buildWetFoodProps(wallSide: 'left' | 'right', cz: number): void {
    const isLeft = wallSide === 'left';
    const posX = isLeft ? -9.2 : 9.2;
    const canMat1 = new THREE.MeshStandardMaterial({ color: isLeft ? 0xd97706 : 0xdc2626, metalness: 0.8, roughness: 0.2 });
    const canMat2 = new THREE.MeshStandardMaterial({ color: isLeft ? 0x2563eb : 0x16a34a, metalness: 0.8, roughness: 0.2 });
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });

    // Fileira de latinhas de patê no nível intermediário (Y = 1.0)
    for (let offsetZ = -0.7; offsetZ <= 0.7; offsetZ += 0.35) {
      const canGroup = new THREE.Group();
      const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 16), offsetZ < 0 ? canMat1 : canMat2);
      canBody.position.set(0, 0.08, 0);
      canGroup.add(canBody);

      const canLid = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.01, 16), lidMat);
      canLid.position.set(0, 0.165, 0);
      canGroup.add(canLid);

      canGroup.position.set(posX, 0.98, cz + offsetZ);
      this.scene.add(canGroup);
    }

    // Displays de sachês úmidos no nível superior (Y = 1.8)
    const pouchMat1 = new THREE.MeshStandardMaterial({ color: isLeft ? 0x9333ea : 0xe11d48, roughness: 0.4 });
    const pouchMat2 = new THREE.MeshStandardMaterial({ color: isLeft ? 0x0891b2 : 0xf59e0b, roughness: 0.4 });

    for (let offsetZ = -0.6; offsetZ <= 0.6; offsetZ += 0.3) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.18), offsetZ < 0 ? pouchMat1 : pouchMat2);
      pouch.position.set(posX, 1.87, cz + offsetZ);
      this.scene.add(pouch);
    }
  }

  /**
   * Embalagens adicionais de ração seca para gatos.
   */
  private buildDryFoodProps(wallSide: 'left' | 'right', cz: number): void {
    const isLeft = wallSide === 'left';
    const posX = isLeft ? -9.2 : 9.2;
    const bagMat = new THREE.MeshStandardMaterial({ color: isLeft ? 0x1e3a8a : 0x047857, roughness: 0.4 });
    for (let offsetZ = -0.8; offsetZ <= 0.8; offsetZ += 0.5) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 0.36), bagMat);
      bag.position.set(posX, 1.99, cz + offsetZ);
      this.scene.add(bag);
    }
  }

  /**
   * Caixas e petiscos adicionais para estante canina.
   */
  private buildTreatsProps(posX: number, cz: number): void {
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 });
    for (let offsetZ = -0.6; offsetZ <= 0.6; offsetZ += 0.4) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.28), boxMat);
      box.position.set(posX, 1.91, cz + offsetZ);
      this.scene.add(box);
    }
  }

  /**
   * Constrói textura gráfica de embalagem em alta definição para sacos e embalagens.
   */
  private buildPackagingTexture(data: InteriorProductData): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    let mainColor = '#004cbf';
    let accentColor = '#ffd000';
    let brandTitle = 'PETZ CHOICE';
    let subTitle = data.shortName;
    let badgeText = data.category === 'gatos' ? '🐱 GATOS' : '🐶 CÃES';

    if (data.id.includes('viva-verde')) {
      mainColor = '#15803d';
      accentColor = '#86efac';
      brandTitle = 'VIVA VERDE!';
      subTitle = 'Limpeza Plena 4kg';
      badgeText = '🌿 100% NATURAL • BIODEGRADÁVEL';
    } else if (data.id.includes('pipicat')) {
      mainColor = '#c2410c';
      accentColor = '#fde047';
      brandTitle = 'PIPICAT';
      subTitle = 'Classic 4kg';
      badgeText = '✨ CONTROLE TOTAL DE ODOR';
    } else if (data.id.includes('premier')) {
      mainColor = '#0369a1';
      accentColor = '#e0f2fe';
      brandTitle = 'PremieR';
      subTitle = 'Nutrição Clínica 10,1kg';
      badgeText = '🩺 VETERINARY CLINICAL';
    } else if (data.id.includes('formula-natural')) {
      mainColor = '#14532d';
      accentColor = '#fbbf24';
      brandTitle = 'FÓRMULA NATURAL';
      subTitle = 'Fresh Meat 15kg';
      badgeText = '🥩 CARNE FRESCA & GRÃOS NOBRES';
    } else if (data.id.includes('golden')) {
      mainColor = '#ca8a04';
      accentColor = '#dc2626';
      brandTitle = 'GOLDEN FORMULA';
      subTitle = 'Mini Bits Carne e Arroz';
      badgeText = '⭐ ALTA PALATABILIDADE';
    } else if (data.id.includes('granplus')) {
      mainColor = '#6b21a8';
      accentColor = '#fef08a';
      brandTitle = 'GRANPLUS GOURMET';
      subTitle = 'Sabor Ovelha 15kg';
      badgeText = '👑 QUALIDADE SUPER PREMIUM';
    } else if (data.condition === 'used') {
      mainColor = '#ea580c';
      accentColor = '#ffffff';
      brandTitle = 'CANSEI DE SER GATO';
      subTitle = 'Fonte Porcelana Bivolt';
      badgeText = '🏷️ SEMI-NOVO REVISADO & TESTADO';
    }

    ctx.fillStyle = mainColor;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 512, 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(brandTitle, 256, 110);

    ctx.fillStyle = accentColor;
    ctx.fillRect(50, 160, 412, 6);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(subTitle, 256, 215);

    ctx.fillStyle = accentColor;
    ctx.font = '72px sans-serif';
    ctx.fillText(data.category === 'gatos' ? '🐱' : '🐶', 256, 305);

    ctx.fillStyle = '#0f2c59';
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(30, 380, 452, 70, 16);
      ctx.fill();
    } else {
      ctx.fillRect(30, 380, 452, 70);
    }

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(badgeText, 256, 415);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 500, 500);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Constrói o modelo 3D do produto e anexa a ETIQUETA DE PREÇO 3D (PriceTag3D).
   * O PREÇO É DIRETAMENTE VISÍVEL NO ESPAÇO 3D ANTES DO DETALHAMENTO DO PRODUTO!
   */
  private createProductMeshWithPriceTag(data: InteriorProductData): void {
    const productGroup = new THREE.Group();
    productGroup.position.copy(data.position);

    // Orienta a frente da embalagem e a etiqueta de preço 3D diretamente para o corredor onde o cliente transita
    const isLeft = data.position.x < 0;
    // Ala Felina (X < 0): aponta para +X (corredor central) com suave inclinação para a entrada
    // Ala Canina (X > 0): aponta para -X (corredor central) com suave inclinação para a entrada
    productGroup.rotation.y = isLeft ? Math.PI / 2 - 0.22 : -Math.PI / 2 + 0.22;

    // 1. Representação 3D do produto com embalagem realista em alta resolução
    let productMesh: THREE.Mesh;

    if (data.id.includes('fonte')) {
      // Bebedouro Fonte de Porcelana (cilindro esmaltado branco brilhante)
      const fountainMat = new THREE.MeshStandardMaterial({
        color: data.condition === 'used' ? 0xf1f5f9 : 0xffffff,
        roughness: 0.08,
        metalness: 0.2,
      });
      productMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.36, 24), fountainMat);
      productMesh.position.set(0, 0.18, 0);

      // Efeito de água cristalina iluminada no topo da fonte
      const waterMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, 0.02, 24),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          roughness: 0.02,
          metalness: 0.3,
          transparent: true,
          opacity: 0.9,
          emissive: 0x0284c7,
          emissiveIntensity: 0.35,
        })
      );
      waterMesh.position.set(0, 0.35, 0);
      productGroup.add(waterMesh);

      // Torneira / bica curva em metal cromado
      const spout = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.15, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 })
      );
      spout.position.set(0, 0.42, 0);
      productGroup.add(spout);
    } else {
      // Saco de ração ou areia sanitária com arte visual na face frontal
      const packTex = this.buildPackagingTexture(data);
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x243044, roughness: 0.5 });
      const frontMat = new THREE.MeshStandardMaterial({
        map: packTex,
        roughness: 0.25,
        emissive: 0xffffff,
        emissiveMap: packTex,
        emissiveIntensity: 0.25,
      });

      // Materiais dos 6 lados da caixa (lado 4 = Face Frontal voltada para a frente do produto / corredor)
      const boxMaterials = [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat];
      productMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.28), boxMaterials);
      productMesh.position.set(0, 0.29, 0);
    }

    productMesh.castShadow = true;
    productMesh.receiveShadow = true;
    productGroup.add(productMesh);

    // 2. ETIQUETA DE PREÇO 3D GIGANTE (PriceTag3D — 1024x512)
    // PREÇO EM DESTAQUE MÁXIMO VISÍVEL DE LONGE!
    const priceFormatted = formatBRLFromCents(data.priceCents);
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 1024;
    tagCanvas.height = 512;
    const tCtx = tagCanvas.getContext('2d')!;

    // Fundo da etiqueta: Amarelo Solar Petz (#FFD000) para novos, Laranja Vibrante para Usados
    tCtx.fillStyle = data.condition === 'used' ? '#ff7a00' : '#ffd000';
    if (typeof tCtx.roundRect === 'function') {
      tCtx.roundRect(0, 0, 1024, 512, 36);
      tCtx.fill();
    } else {
      tCtx.fillRect(0, 0, 1024, 512);
    }

    tCtx.lineWidth = 26;
    tCtx.strokeStyle = '#0f2c59';
    tCtx.strokeRect(13, 13, 998, 486);

    // Nome resumido
    tCtx.fillStyle = '#0f2c59';
    tCtx.font = 'bold 52px sans-serif';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.fillText(data.shortName, 512, 85);

    // PREÇO GIGANTE EM DESTAQUE MÁXIMO (135px bold)
    tCtx.fillStyle = data.condition === 'used' ? '#ffffff' : '#004cbf';
    tCtx.font = '900 135px sans-serif';
    tCtx.fillText(priceFormatted, 512, 245);

    // Badge de Condição / Estoque
    tCtx.fillStyle = '#0f2c59';
    tCtx.font = 'bold 38px sans-serif';
    const conditionTag =
      data.condition === 'used'
        ? '🏷️ ITEM SEMI-NOVO (REVISADO)'
        : `✓ EM ESTOQUE (${data.stockQuantity} un)`;
    tCtx.fillText(conditionTag, 512, 405);

    const tagTex = new THREE.CanvasTexture(tagCanvas);

    // Suporte físico da etiqueta de gôndola (estilo trilho de varejo)
    const tagBacking = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.40, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x0f2c59, roughness: 0.4 })
    );
    tagBacking.rotation.x = -0.30;
    tagBacking.position.set(0, -0.16, 0.27);
    productGroup.add(tagBacking);

    const priceTagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 0.38),
      new THREE.MeshStandardMaterial({
        map: tagTex,
        roughness: 0.2,
        emissive: 0xffffff,
        emissiveMap: tagTex,
        emissiveIntensity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    // Inclina a etiqueta para a leitura confortável na altura dos olhos
    priceTagMesh.rotation.x = -0.30;
    priceTagMesh.position.set(0, -0.16, 0.285);
    productGroup.add(priceTagMesh);

    // Metadados para raycasting e interação diegética
    productGroup.userData = {
      isInteractive: true,
      targetType: 'product',
      productData: data,
    };
    productMesh.userData = productGroup.userData;
    priceTagMesh.userData = {
      ...productGroup.userData,
      isPriceTag: true,
      priceDisplay: priceFormatted,
    };

    this.scene.add(productGroup);
    this.interactiveMeshes.push(productMesh);
    this.interactiveMeshes.push(priceTagMesh);
  }

  // ──────────────────── BALCÃO DE ATENDIMENTO E VENDEDOR TOM ────────────────────
  private buildServiceCounterAndSeller(): void {
    const counterGroup = new THREE.Group();
    const cx = 0.0;
    const cz = -6.2;

    const counterMat = new THREE.MeshStandardMaterial({ color: 0x0f2c59, roughness: 0.4 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    // Balcão de atendimento central monumental (4.0m de largura com acabamento premium)
    const mainDesk = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.05, 0.85), counterMat);
    mainDesk.position.set(cx, 0.525, cz);
    counterGroup.add(mainDesk);

    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.95), topMat);
    deskTop.position.set(cx, 1.05, cz);
    counterGroup.add(deskTop);

    // Friso decorativo Amarelo Petz na frente do balcão
    const deskTrim = new THREE.Mesh(
      new THREE.BoxGeometry(3.96, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xffd000, emissive: 0xffd000, emissiveIntensity: 0.3 })
    );
    deskTrim.position.set(cx, 0.55, cz + 0.435);
    counterGroup.add(deskTrim);

    // 2 Terminais PDV / Caixas registradores touchscreens na bancada
    const posPositions = [cx - 1.2, cx + 1.2];
    posPositions.forEach((posX) => {
      const posBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.12, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3 })
      );
      posBase.position.set(posX, 1.15, cz);
      counterGroup.add(posBase);

      const posScreen = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.22, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x004cbf, emissive: 0x004cbf, emissiveIntensity: 0.3 })
      );
      posScreen.position.set(posX, 1.3, cz - 0.08);
      posScreen.rotation.x = -0.3;
      counterGroup.add(posScreen);
    });

    // Plaquinha na bancada: "Fale com o Vendedor Tom"
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 160;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#004cbf';
    if (typeof sCtx.roundRect === 'function') {
      sCtx.roundRect(0, 0, 512, 160, 16);
      sCtx.fill();
    } else {
      sCtx.fillRect(0, 0, 512, 160);
    }
    sCtx.lineWidth = 8;
    sCtx.strokeStyle = '#ffd000';
    sCtx.strokeRect(5, 5, 502, 150);
    sCtx.fillStyle = '#ffffff';
    sCtx.font = 'bold 36px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText('💬 TOM • ESPECIALISTA PET', 256, 52);
    sCtx.fillStyle = '#ffd000';
    sCtx.font = 'bold 24px sans-serif';
    sCtx.fillText('Clique ou Pressione E para conversar', 256, 108);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.25, 0.04),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.3 })
    );
    signMesh.position.set(cx, 1.22, cz);
    signMesh.rotation.x = -0.2;
    counterGroup.add(signMesh);

    this.scene.add(counterGroup);

    // Collider do balcão central de atendimento
    this.colliders.push({
      type: 'box',
      minX: cx - 2.15,
      maxX: cx + 2.15,
      minZ: cz - 0.55,
      maxZ: cz + 0.55,
      name: 'Balcão de Atendimento Central Tom',
    });

    // 2. Avatar 3D do Vendedor Tom posicionado atrás do balcão (olhando para a frente +Z)
    this.sellerMesh = new THREE.Group();
    this.sellerMesh.position.set(cx, 0, cz - 0.7);

    // Uniforme Petz: camisa pólo azul royal (#004CBF) com gola amarela (#FFD000)
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x004cbf, roughness: 0.6 });
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xffd000, roughness: 0.4 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5cfb3, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f2c59, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });

    // Tronco
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.28), shirtMat);
    torso.position.set(0, 1.25, 0);
    this.sellerMesh.add(torso);

    // Gola da camisa
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), collarMat);
    collar.position.set(0, 1.62, 0);
    this.sellerMesh.add(collar);

    // Cabeça
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.3), skinMat);
    head.position.set(0, 1.85, 0);
    this.sellerMesh.add(head);

    // Cabelo estilizado
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.34), hairMat);
    hair.position.set(0, 2.05, 0);
    this.sellerMesh.add(hair);

    // Pernas
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.22), pantsMat);
    legL.position.set(-0.14, 0.45, 0);
    this.sellerMesh.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.22), pantsMat);
    legR.position.set(0.14, 0.45, 0);
    this.sellerMesh.add(legR);

    // Crachá "Tom • Pet Specialist" no peito
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xffd000, emissive: 0xffd000, emissiveIntensity: 0.3 })
    );
    badge.position.set(0.16, 1.45, 0.15);
    this.sellerMesh.add(badge);

    // Configuração interativa do Tom
    this.sellerMesh.userData = {
      isInteractive: true,
      targetType: 'seller',
      id: 'tom-agent',
      name: 'Tom',
      role: 'Vendedor Especialista em Nutrição e Cuidados Pet',
    };
    torso.userData = this.sellerMesh.userData;
    head.userData = this.sellerMesh.userData;

    this.scene.add(this.sellerMesh);
    this.interactiveMeshes.push(torso);
    this.interactiveMeshes.push(head);
  }

  // ──────────────────── ZONA DE SAÍDA E PORTA COMERCIAL AUTOMÁTICA ────────────────────
  private buildExitZone(): void {
    const doorGroup = new THREE.Group();

    const metalFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Alumínio anodizado grafite escuro
      metalness: 0.88,
      roughness: 0.22,
    });
    const yellowTrimMat = new THREE.MeshStandardMaterial({
      color: 0xffd000, // Amarelo Solar Petz
      metalness: 0.35,
      roughness: 0.3,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Aço inox escovado/cromado
      metalness: 0.95,
      roughness: 0.1,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd, // Vidro temperado translúcido azulado
      transparent: true,
      opacity: 0.38,
      roughness: 0.05,
      metalness: 0.9,
    });

    // 1. Portal Arquitetural (Batentes Laterais e Verga em Alumínio)
    const postGeo = new THREE.BoxGeometry(0.18, 3.1, 0.26);
    const leftPost = new THREE.Mesh(postGeo, metalFrameMat);
    leftPost.position.set(-1.75, 1.55, 4.45);
    leftPost.castShadow = true;
    doorGroup.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, metalFrameMat);
    rightPost.position.set(1.75, 1.55, 4.45);
    rightPost.castShadow = true;
    doorGroup.add(rightPost);

    // Verga superior estrutural
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.68, 0.25, 0.28), metalFrameMat);
    lintel.position.set(0, 3.0, 4.45);
    doorGroup.add(lintel);

    // Friso decorativo Amarelo Petz no topo do portal
    const lintelTrim = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.06, 0.3), yellowTrimMat);
    lintelTrim.position.set(0, 3.14, 4.45);
    doorGroup.add(lintelTrim);

    // 2. Trilho superior e Caixa do Sensor de Presença Automático
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.12), metalFrameMat);
    rail.position.set(0, 2.84, 4.38);
    doorGroup.add(rail);

    const sensorBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.1), metalFrameMat);
    sensorBox.position.set(0, 2.84, 4.32);
    doorGroup.add(sensorBox);

    const sensorLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.03, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x10b981 }) // LED verde de prontidão
    );
    sensorLed.position.set(0, 2.82, 4.26);
    doorGroup.add(sensorLed);

    // 3. Luminária de Emergência "SAÍDA / EXIT" (Auto-Iluminada em Verde Esmeralda)
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 160;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#047857'; // Verde esmeralda sinalização NBR
    if (typeof sCtx.roundRect === 'function') {
      sCtx.roundRect(0, 0, 512, 160, 16);
      sCtx.fill();
    } else {
      sCtx.fillRect(0, 0, 512, 160);
    }
    sCtx.lineWidth = 10;
    sCtx.strokeStyle = '#ffffff';
    sCtx.strokeRect(8, 8, 496, 144);
    sCtx.fillStyle = '#ffffff';
    sCtx.font = 'bold 52px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText('🏃 SAÍDA • EXIT', 256, 80);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const exitSignMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.4, 0.08),
      new THREE.MeshStandardMaterial({
        map: signTex,
        roughness: 0.2,
        emissive: 0x059669,
        emissiveMap: signTex,
        emissiveIntensity: 0.85,
      })
    );
    exitSignMesh.position.set(0, 3.32, 4.38);
    doorGroup.add(exitSignMesh);

    // 4. Folhas de Vidro Temperado Deslizantes (Semi-Abertas)
    const glassLeafGeo = new THREE.BoxGeometry(1.15, 2.7, 0.035);
    const glassLeft = new THREE.Mesh(glassLeafGeo, glassMat);
    glassLeft.position.set(-1.05, 1.4, 4.43);
    doorGroup.add(glassLeft);

    const fTopL = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.05), metalFrameMat);
    fTopL.position.set(-1.05, 2.73, 4.43);
    doorGroup.add(fTopL);
    const fBotL = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.05), metalFrameMat);
    fBotL.position.set(-1.05, 0.06, 4.43);
    doorGroup.add(fBotL);

    const glassRight = new THREE.Mesh(glassLeafGeo, glassMat);
    glassRight.position.set(1.05, 1.4, 4.43);
    doorGroup.add(glassRight);

    const fTopR = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, 0.05), metalFrameMat);
    fTopR.position.set(1.05, 2.73, 4.43);
    doorGroup.add(fTopR);
    const fBotR = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.05), metalFrameMat);
    fBotR.position.set(1.05, 0.06, 4.43);
    doorGroup.add(fBotR);

    // Puxadores Verticais em Aço Inox Tubular (Cilindros Cromados)
    const handleGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.25, 16);
    const hSupportGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.08, 12);

    const handleL = new THREE.Mesh(handleGeo, chromeMat);
    handleL.position.set(-0.55, 1.35, 4.36);
    doorGroup.add(handleL);

    const supL1 = new THREE.Mesh(hSupportGeo, chromeMat);
    supL1.rotation.x = Math.PI / 2;
    supL1.position.set(-0.55, 1.8, 4.4);
    doorGroup.add(supL1);
    const supL2 = new THREE.Mesh(hSupportGeo, chromeMat);
    supL2.rotation.x = Math.PI / 2;
    supL2.position.set(-0.55, 0.9, 4.4);
    doorGroup.add(supL2);

    const handleR = new THREE.Mesh(handleGeo, chromeMat);
    handleR.position.set(0.55, 1.35, 4.36);
    doorGroup.add(handleR);

    const supR1 = new THREE.Mesh(hSupportGeo, chromeMat);
    supR1.rotation.x = Math.PI / 2;
    supR1.position.set(0.55, 1.8, 4.4);
    doorGroup.add(supR1);
    const supR2 = new THREE.Mesh(hSupportGeo, chromeMat);
    supR2.rotation.x = Math.PI / 2;
    supR2.position.set(0.55, 0.9, 4.4);
    doorGroup.add(supR2);

    // 5. Faixa Jateada de Segurança nos Vidros (Patinhas de Pet e Logo)
    const decalCanvas = document.createElement('canvas');
    decalCanvas.width = 512;
    decalCanvas.height = 128;
    const dCtx = decalCanvas.getContext('2d')!;
    dCtx.fillStyle = 'rgba(255, 255, 255, 0.28)'; // Efeito jateado acetinado
    dCtx.fillRect(0, 0, 512, 128);
    dCtx.fillStyle = '#ffffff';
    dCtx.font = 'bold 36px sans-serif';
    dCtx.textAlign = 'center';
    dCtx.textBaseline = 'middle';
    dCtx.fillText('🐾  TOMPETS  🐾', 256, 64);

    const decalTex = new THREE.CanvasTexture(decalCanvas);
    const decalMat = new THREE.MeshBasicMaterial({
      map: decalTex,
      transparent: true,
      opacity: 0.75,
    });

    const decalLeft = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.25), decalMat);
    decalLeft.position.set(-1.05, 1.4, 4.41);
    doorGroup.add(decalLeft);

    const decalRight = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.25), decalMat);
    decalRight.position.set(1.05, 1.4, 4.41);
    doorGroup.add(decalRight);

    // 6. Vista Exterior da Rua (Street Backdrop através da Porta)
    const streetBackdropCanvas = document.createElement('canvas');
    streetBackdropCanvas.width = 1024;
    streetBackdropCanvas.height = 512;
    const bCtx = streetBackdropCanvas.getContext('2d')!;
    if (typeof bCtx.createLinearGradient === 'function') {
      const bgGrad = bCtx.createLinearGradient(0, 0, 0, 512);
      bgGrad.addColorStop(0, '#38bdf8'); // Céu diurno
      bgGrad.addColorStop(0.5, '#bae6fd');
      bgGrad.addColorStop(0.7, '#cbd5e1'); // Prédios distantes
      bgGrad.addColorStop(1, '#64748b'); // Calçada da Alameda
      bCtx.fillStyle = bgGrad;
    } else {
      bCtx.fillStyle = '#38bdf8';
    }
    bCtx.fillRect(0, 0, 1024, 512);

    bCtx.fillStyle = '#94a3b8';
    bCtx.fillRect(0, 360, 1024, 152);
    bCtx.fillStyle = '#cbd5e1';
    bCtx.font = 'bold 32px sans-serif';
    bCtx.textAlign = 'center';
    bCtx.fillText('🌳 ALAMEDA DAS NAÇÕES — SYNAPSE CITY 🌳', 512, 420);

    const streetTex = new THREE.CanvasTexture(streetBackdropCanvas);
    const streetBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 3.6),
      new THREE.MeshBasicMaterial({ map: streetTex })
    );
    streetBackdrop.position.set(0, 1.8, 4.8);
    doorGroup.add(streetBackdrop);

    // 7. Spot Luminoso de Teto focado na entrada
    const doorSpot = new THREE.SpotLight(0xfffaee, 2.6, 6.0, Math.PI / 4, 0.3, 1.0);
    doorSpot.position.set(0, 3.6, 3.8);
    doorSpot.target.position.set(0, 0, 4.2);
    this.scene.add(doorSpot);
    this.scene.add(doorSpot.target);

    // 8. Capacho Embutido com Moldura de Alumínio
    const matBezel = new THREE.Mesh(
      new THREE.BoxGeometry(2.72, 0.025, 1.62),
      metalFrameMat
    );
    matBezel.position.set(0, 0.012, 4.0);
    doorGroup.add(matBezel);

    const exitCanvas = document.createElement('canvas');
    exitCanvas.width = 1024;
    exitCanvas.height = 512;
    const ctx = exitCanvas.getContext('2d')!;

    ctx.fillStyle = '#0f2c59';
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(0, 0, 1024, 512, 28);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, 1024, 512);
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 4;
    for (let y = 16; y < 512; y += 14) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(1008, y);
      ctx.stroke();
    }

    ctx.lineWidth = 18;
    ctx.strokeStyle = '#ffd000';
    ctx.strokeRect(14, 14, 996, 484);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(28, 28, 968, 456);

    ctx.fillStyle = '#ffd000';
    ctx.font = 'bold 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐾 TOMPETS • BOX 04', 512, 110);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px sans-serif';
    ctx.fillText('🚪 SAÍDA PARA A CIDADE', 512, 255);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('ALAMEDA DAS NAÇÕES • CLIQUE OU CAMINHE PARA SAIR', 512, 390);

    const tex = new THREE.CanvasTexture(exitCanvas);
    this.exitThresholdMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.5),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        emissive: 0x0f2c59,
        emissiveMap: tex,
        emissiveIntensity: 0.35,
      })
    );
    this.exitThresholdMesh.rotation.x = -Math.PI / 2;
    this.exitThresholdMesh.position.set(0, 0.026, 4.0);
    this.exitThresholdMesh.receiveShadow = true;

    this.exitThresholdMesh.userData = {
      isInteractive: true,
      targetType: 'exit',
    };

    doorGroup.add(this.exitThresholdMesh);
    this.scene.add(doorGroup);
    this.interactiveMeshes.push(this.exitThresholdMesh);
  }

  /**
   * Raycast universal (mouse, touch ou ray de XR Controller) para interação diegética.
   */
  public raycast(raycaster: THREE.Raycaster): InteriorInteractiveTarget | null {
    const intersects = raycaster.intersectObjects(this.interactiveMeshes, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0].object;
    const data = hit.userData;
    if (!data?.isInteractive) return null;

    if (data.targetType === 'product') {
      return {
        type: 'product',
        data: data.productData,
      };
    }
    if (data.targetType === 'seller') {
      return {
        type: 'seller',
        id: data.id,
        name: data.name,
        role: data.role,
      };
    }
    if (data.targetType === 'exit') {
      return { type: 'exit' };
    }

    return null;
  }
}
