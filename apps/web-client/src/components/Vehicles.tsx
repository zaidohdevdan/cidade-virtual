// apps/web-client/src/components/Vehicles.tsx
import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleAgent } from '../vehicles/vehicle-agent';
import { TrafficLightRef } from '../scenes/city-scene';
import { AgentAvatar } from '../avatars/agent-avatar';

interface VehiclesProps {
  vehicles: VehicleAgent[];
  trafficLights: TrafficLightRef[];
  agents: AgentAvatar[];
  playerPos: THREE.Vector3;
}

export const Vehicles: React.FC<VehiclesProps> = ({ vehicles, trafficLights, agents, playerPos }) => {
  // Reúne posições dos pedestres para detecção eficiente nos carros
  const pedestrianPositions = useMemo(() => {
    return agents.map((a) => a.position);
  }, [agents]);

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.1);

    for (const vehicle of vehicles) {
      vehicle.update(clampedDelta, trafficLights, pedestrianPositions, playerPos, vehicles);
    }
  });

  return (
    <group>
      {vehicles.map((vehicle) => (
        <primitive key={vehicle.config.id} object={vehicle.mesh} />
      ))}
    </group>
  );
};
