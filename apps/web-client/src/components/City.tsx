import React, { useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { CityScene, TrafficLightState } from '../scenes/city-scene';

interface CityProps {
  city: CityScene;
  trafficLightState: TrafficLightState;
  timeOfDay: 'day' | 'sunset' | 'night';
}

export const City: React.FC<CityProps> = ({ city, trafficLightState, timeOfDay }) => {
  useEffect(() => {
    city.setAllTrafficLights(trafficLightState);
  }, [city, trafficLightState]);

  useEffect(() => {
    city.setTimeOfDay(timeOfDay);
  }, [city, timeOfDay]);

  useFrame((_, delta) => {
    city.updateNavigation(delta);
  });

  // Rapier Colliders criados a partir dos obstáculos da CityScene
  const colliders = useMemo(() => {
    return city.colliders.map((c, index) => {
      if (c.type === 'box') {
        if (c.minX === undefined || c.maxX === undefined || c.minZ === undefined || c.maxZ === undefined) {
          return null;
        }
        const cx = (c.minX + c.maxX) / 2;
        const cz = (c.minZ + c.maxZ) / 2;
        const hx = Math.max(0.1, (c.maxX - c.minX) / 2);
        const hz = Math.max(0.1, (c.maxZ - c.minZ) / 2);
        const height = 12; // Altura padrão de bloqueio físico para edifícios e obstáculos

        return (
          <RigidBody key={`box-${index}`} type="fixed" position={[cx, height / 2, cz]}>
            <CuboidCollider args={[hx, height / 2, hz]} />
          </RigidBody>
        );
      } else if (c.type === 'cylinder') {
        if (c.cx === undefined || c.cz === undefined || c.radius === undefined) {
          return null;
        }
        const height = 10;
        return (
          <RigidBody key={`cyl-${index}`} type="fixed" position={[c.cx, height / 2, c.cz]}>
            <CylinderCollider args={[height / 2, Math.max(0.1, c.radius)]} />
          </RigidBody>
        );
      }
      return null;
    });
  }, [city.colliders]);

  return (
    <group>
      {/* Cena gráfica 3D Three.js renderizada declarativamente no R3F */}
      <primitive object={city.scene} />

      {/* Chão físico Rapier */}
      <RigidBody type="fixed" position={[0, -0.5, 0]}>
        <CuboidCollider args={[95, 0.5, 95]} />
      </RigidBody>

      {/* Obstáculos físicos urbanos mapeados no Rapier */}
      {colliders}
    </group>
  );
};
