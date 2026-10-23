// apps/web-client/src/components/TomPetsInterior.tsx
import React, { useMemo, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import {
  TomPetsInteriorScene,
  InteriorProductData,
  InteriorInteractiveTarget,
} from '../scenes/tompets-interior';

interface TomPetsInteriorProps {
  interior: TomPetsInteriorScene;
  onSelectProduct: (product: InteriorProductData) => void;
  onTalkToTom: () => void;
  onExitStore: () => void;
}

export const TomPetsInterior: React.FC<TomPetsInteriorProps> = ({
  interior,
  onSelectProduct,
  onTalkToTom,
  onExitStore,
}) => {
  const { camera, raycaster } = useThree();

  // Handler de clique/toque universal (mouse, touch ou raycast XR)
  const handlePointerDown = useCallback(
    (e: any) => {
      // Ignora se o clique veio de um overlay de UI React
      if ((e.target as HTMLElement)?.closest?.('.hud-overlay, .modal-backdrop, .dialogue-prompt-card')) {
        return;
      }

      // Converte coordenadas do ponteiro para NDC (-1 a 1)
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);
      const hit: InteriorInteractiveTarget | null = interior.raycast(raycaster);

      if (hit) {
        if (hit.type === 'product') {
          onSelectProduct(hit.data);
        } else if (hit.type === 'seller') {
          onTalkToTom();
        } else if (hit.type === 'exit') {
          onExitStore();
        }
      }
    },
    [camera, raycaster, interior, onSelectProduct, onTalkToTom, onExitStore]
  );

  // Rapier Colliders criados a partir dos obstáculos físicos da sala do Box 04
  const colliders = useMemo(() => {
    return interior.colliders.map((c, index) => {
      if (c.type === 'box') {
        if (c.minX === undefined || c.maxX === undefined || c.minZ === undefined || c.maxZ === undefined) {
          return null;
        }
        const cx = (c.minX + c.maxX) / 2;
        const cz = (c.minZ + c.maxZ) / 2;
        const hx = Math.max(0.1, (c.maxX - c.minX) / 2);
        const hz = Math.max(0.1, (c.maxZ - c.minZ) / 2);
        const height = 4.0; // Altura padrão de bloqueio físico na sala

        return (
          <RigidBody key={`interior-box-${index}`} type="fixed" position={[cx, height / 2, cz]}>
            <CuboidCollider args={[hx, height / 2, hz]} />
          </RigidBody>
        );
      }
      return null;
    });
  }, [interior.colliders]);

  return (
    <group onPointerDown={handlePointerDown}>
      {/* Cena gráfica 3D Three.js do interior da loja */}
      <primitive object={interior.scene} />

      {/* Chão físico Rapier para a sala ampliada (20m x 13m) */}
      <RigidBody type="fixed" position={[0, -0.25, -2.0]}>
        <CuboidCollider args={[11.0, 0.25, 7.5]} />
      </RigidBody>

      {/* Paredes e móveis físicos mapeados no Rapier */}
      {colliders}
    </group>
  );
};
