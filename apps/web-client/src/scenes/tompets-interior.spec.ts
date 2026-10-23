// apps/web-client/src/scenes/tompets-interior.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  TomPetsInteriorScene,
  TOMPETS_INTERIOR_PRODUCTS,
  formatBRLFromCents,
  InteriorProductData,
} from './tompets-interior';

describe('Task-046 — Experiência Imersiva XR e Loja TomPets (Box 04)', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 512,
            height: 256,
            getContext: () => ({
              fillStyle: '',
              fillRect: () => { },
              font: '',
              textAlign: '',
              textBaseline: '',
              fillText: () => { },
              strokeStyle: '',
              lineWidth: 0,
              strokeRect: () => { },
              roundRect: () => { },
              fill: () => { },
              stroke: () => { },
              beginPath: () => { },
              closePath: () => { },
              arc: () => { },
              moveTo: () => { },
              lineTo: () => { },
            }),
          };
        }
        return { style: {} };
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  describe('1. Formatação de Moeda Sem Ponto Flutuante (Regra de Ouro)', () => {
    it('deve formatar centavos inteiros em BRL corretamente sem drift de float', () => {
      expect(formatBRLFromCents(6890)).toBe('R$ 68,90');
      expect(formatBRLFromCents(1890)).toBe('R$ 18,90');
      expect(formatBRLFromCents(19990)).toBe('R$ 199,90');
      expect(formatBRLFromCents(34990)).toBe('R$ 349,90');
      expect(formatBRLFromCents(38990)).toBe('R$ 389,90');
      expect(formatBRLFromCents(17490)).toBe('R$ 174,90');
      expect(formatBRLFromCents(18990)).toBe('R$ 189,90');
      expect(formatBRLFromCents(9900)).toBe('R$ 99,00');
      expect(formatBRLFromCents(50)).toBe('R$ 0,50');
    });
  });

  describe('2. Catálogo Físico e Gôndolas da Loja', () => {
    it('deve conter exatamente os 8 produtos reais nas gôndolas físicas', () => {
      expect(TOMPETS_INTERIOR_PRODUCTS).toHaveLength(8);

      const newProducts = TOMPETS_INTERIOR_PRODUCTS.filter((p) => p.condition === 'new');
      expect(newProducts).toHaveLength(7);

      const usedProducts = TOMPETS_INTERIOR_PRODUCTS.filter((p) => p.condition === 'used');
      expect(usedProducts).toHaveLength(1);
      expect(usedProducts[0].condition).toBe('used');
      expect(usedProducts[0].name).toContain('SEMI-NOVO');
    });

    it('todos os produtos devem ter preços inteiros positivos e posições 3D válidas', () => {
      for (const prod of TOMPETS_INTERIOR_PRODUCTS) {
        expect(Number.isInteger(prod.priceCents)).toBe(true);
        expect(prod.priceCents).toBeGreaterThan(0);
        expect(prod.position).toBeInstanceOf(THREE.Vector3);
        expect(Number.isFinite(prod.position.x)).toBe(true);
        expect(Number.isFinite(prod.position.y)).toBe(true);
        expect(Number.isFinite(prod.position.z)).toBe(true);
      }
    });
  });

  describe('3. Cena 3D do Interior do Box 04', () => {
    it('deve instanciar a cena de interior com iluminação e arquitetura Petz', () => {
      const interior = new TomPetsInteriorScene();
      expect(interior.scene).toBeDefined();
      expect(interior.colliders.length).toBeGreaterThanOrEqual(5); // 4 paredes + gôndolas
      expect(interior.interactiveMeshes.length).toBeGreaterThanOrEqual(8); // 8 produtos + etiquetas + vendedor + saída
    });

    it('deve conter etiquetas de preço 3D visíveis diretamente nas gôndolas antes do detalhamento', () => {
      const interior = new TomPetsInteriorScene();

      // Busca etiquetas 3D na cena
      const priceTags: THREE.Mesh[] = [];
      interior.scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData?.isPriceTag) {
          priceTags.push(child);
        }
      });

      expect(priceTags.length).toBe(8);

      // Cada etiqueta 3D deve conter o preço formatado e ser interativa
      for (const tag of priceTags) {
        expect(tag.userData.isInteractive).toBe(true);
        expect(tag.userData.targetType).toBe('product');
        expect(tag.userData.priceDisplay).toMatch(/^R\$ \d+,\d{2}$/);
      }
    });

    it('deve possuir o balcão do vendedor Tom com metadados de atendimento', () => {
      const interior = new TomPetsInteriorScene();
      expect(interior.sellerMesh).toBeDefined();

      const sellerChild = interior.sellerMesh.children.find(
        (c) => c.userData?.targetType === 'seller'
      );
      expect(sellerChild).toBeDefined();
      expect(sellerChild?.userData.name).toBe('Tom');
      expect(sellerChild?.userData.role).toContain('Nutrição');
    });

    it('deve possuir o tapete de saída para retornar à Alameda das Nações', () => {
      const interior = new TomPetsInteriorScene();
      expect(interior.exitThresholdMesh).toBeDefined();
      expect(interior.exitThresholdMesh.userData.targetType).toBe('exit');
      expect(interior.exitThresholdMesh.position.z).toBeCloseTo(4.0);
    });
  });

  describe('4. Raycasting Universal (Mouse / Touch / WebXR Controller)', () => {
    it('deve detectar o clique em um produto da gôndola via raycaster', () => {
      const interior = new TomPetsInteriorScene();
      interior.scene.updateMatrixWorld(true);

      // Encontra a mesh do primeiro produto
      const prodMesh = interior.interactiveMeshes.find(
        (m) => m.userData?.targetType === 'product' && m.userData?.productData?.id === 'prod-viva-verde-4kg'
      );
      expect(prodMesh).toBeDefined();

      const worldPos = new THREE.Vector3();
      prodMesh!.getWorldPosition(worldPos);

      // Cria um raycaster mirando exatamente no centro da mesh do produto em espaço mundial
      const rayOrigin = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z + 1.0);
      const rayDirection = new THREE.Vector3(0, 0, -1).normalize();
      const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);

      const target = interior.raycast(raycaster);
      expect(target).not.toBeNull();
      expect(target?.type).toBe('product');

      if (target?.type === 'product') {
        expect(target.data.id).toBe('prod-viva-verde-4kg');
        expect(target.data.priceCents).toBe(6890);
      }
    });

    it('deve detectar interação com o vendedor Tom via raycaster', () => {
      const interior = new TomPetsInteriorScene();

      const sellerObj = interior.interactiveMeshes.find(
        (m) => m.userData?.targetType === 'seller'
      );
      expect(sellerObj).toBeDefined();

      const pos = new THREE.Vector3();
      sellerObj!.getWorldPosition(pos);

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(pos.x, pos.y, pos.z + 1.0),
        new THREE.Vector3(0, 0, -1).normalize()
      );

      const target = interior.raycast(raycaster);
      expect(target).not.toBeNull();
      expect(target?.type).toBe('seller');
      if (target?.type === 'seller') {
        expect(target.name).toBe('Tom');
      }
    });

    it('deve retornar null se o raio não colidir com nenhum objeto interativo', () => {
      const interior = new TomPetsInteriorScene();
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(999, 999, 999),
        new THREE.Vector3(0, 1, 0)
      );

      const target = interior.raycast(raycaster);
      expect(target).toBeNull();
    });
  });

  describe('5. Identidade Visual & Merchandising (Luci, Totens Dupla Face & Logomarca)', () => {
    it('deve possuir o banner monumental da cadela Luci na parede frontal direita', () => {
      const interior = new TomPetsInteriorScene();
      let luciBannerFound = false;

      interior.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat && mat.map && (mat.map.name?.includes('banner-luci-wall') || (mat.map as any).sourceFile?.includes('banner-luci-wall'))) {
            luciBannerFound = true;
          }
        }
      });

      // Também verifica pela posição do grupo do banner da Luci (X = 5.9, Z = 4.38)
      let luciGroupFound = false;
      interior.scene.traverse((child) => {
        if (child instanceof THREE.Group && Math.abs(child.position.x - 5.9) < 0.1 && Math.abs(child.position.z - 4.38) < 0.1) {
          luciGroupFound = true;
          expect(child.rotation.y).toBeCloseTo(Math.PI);
        }
      });

      expect(luciGroupFound).toBe(true);
    });

    it('deve possuir totens de piso dupla face com banners na frente e no verso', () => {
      const interior = new TomPetsInteriorScene();

      // Procura os totens em X = -3.2 e X = 3.2
      const totemGroups: THREE.Group[] = [];
      interior.scene.traverse((child) => {
        if (child instanceof THREE.Group && Math.abs(child.position.z - 2.4) < 0.1 && (Math.abs(child.position.x - 3.2) < 0.1 || Math.abs(child.position.x - (-3.2)) < 0.1)) {
          totemGroups.push(child);
        }
      });

      expect(totemGroups.length).toBe(2);

      for (const totem of totemGroups) {
        // Cada totem deve ter painéis gráficos em Z = 0.07 (frente) e Z = -0.07 (verso)
        const frontPanels = totem.children.filter((c) => Math.abs(c.position.z - 0.07) < 0.01);
        const backPanels = totem.children.filter((c) => Math.abs(c.position.z - (-0.07)) < 0.01);

        expect(frontPanels.length).toBeGreaterThanOrEqual(3); // foto, topBadge, botBadge
        expect(backPanels.length).toBeGreaterThanOrEqual(3);  // foto, topBadge, botBadge

        // O verso gráfico (painéis PlaneGeometry) deve estar rotacionado em Math.PI
        const backPlanes = backPanels.filter((p) => (p as THREE.Mesh).geometry instanceof THREE.PlaneGeometry);
        expect(backPlanes.length).toBe(3);
        for (const p of backPlanes) {
          expect(p.rotation.y).toBeCloseTo(Math.PI);
        }
      }
    });

    it('deve posicionar a logomarca do Tom no lado esquerdo do letreiro (X = -2.75)', () => {
      const interior = new TomPetsInteriorScene();
      let logoMedallionFound = false;

      interior.scene.traverse((child) => {
        if (child instanceof THREE.Group && Math.abs(child.position.x - (-2.75)) < 0.1 && Math.abs(child.position.z - (-8.32)) < 0.1) {
          logoMedallionFound = true;
          expect(child.position.y).toBeCloseTo(2.9);
        }
      });

      expect(logoMedallionFound).toBe(true);
    });
  });
});
