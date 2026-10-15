import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AgentAvatar } from '../avatars/agent-avatar';
import { VehicleAgent } from '../vehicles/vehicle-agent';
import { ObstacleCollider } from '../scenes/city-scene';

interface AgentsProps {
  agents: AgentAvatar[];
  vehicles?: VehicleAgent[];
  colliders?: ObstacleCollider[];
}

export const Agents: React.FC<AgentsProps> = ({ agents, vehicles, colliders = [] }) => {
  const { camera, gl } = useThree();

  useEffect(() => {
    // Garante que as labels DOM dos agentes sejam limpas caso o componente seja desmontado
    return () => {
      agents.forEach((a) => {
        if (a.label && a.label.parentNode) {
          a.label.parentNode.removeChild(a.label);
        }
      });
    };
  }, [agents]);

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.1);

    // Reúne colisores da cidade e colisores dinâmicos dos veículos
    const activeColliders = colliders.slice();
    if (vehicles && vehicles.length > 0) {
      for (const v of vehicles) {
        for (const c of v.getColliders()) {
          activeColliders.push(c);
        }
      }
    }

    for (const agent of agents) {
      agent.update(clampedDelta, activeColliders);
      agent.updateLabel(camera, gl);
    }
  });

  return (
    <group>
      {agents.map((agent) => (
        <primitive key={agent.config.id} object={agent.mesh} />
      ))}
    </group>
  );
};
