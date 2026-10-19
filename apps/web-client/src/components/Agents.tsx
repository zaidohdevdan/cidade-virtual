import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AgentAvatar } from '../avatars/agent-avatar';
import { VehicleAgent } from '../vehicles/vehicle-agent';
import { ObstacleCollider } from '../scenes/city-scene';
import { cityStore } from '../store/city-store';

interface AgentsProps {
  agents: AgentAvatar[];
  vehicles?: VehicleAgent[];
  colliders?: ObstacleCollider[];
  playerPos?: THREE.Vector3;
}

export const Agents: React.FC<AgentsProps> = ({ agents, vehicles, colliders = [], playerPos }) => {
  const { camera, gl } = useThree();

  useEffect(() => {
    // Garante que as labels DOM dos agentes sejam limpas caso o componente seja desmontado
    return () => {
      agents.forEach((a) => {
        a.dispose();
      });
    };
  }, [agents]);

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.1);
    const trafficLight = cityStore.getState().trafficLightState;

    // Reúne colisores base: cidade, veículos dinâmicos e avatar do jogador
    const baseColliders: ObstacleCollider[] = colliders.slice();
    if (vehicles && vehicles.length > 0) {
      for (const v of vehicles) {
        for (const c of v.getColliders()) {
          baseColliders.push(c);
        }
      }
    }
    if (playerPos) {
      baseColliders.push({
        type: 'cylinder',
        cx: playerPos.x,
        cz: playerPos.z,
        radius: 0.45,
        name: 'player-daniel',
      });
    }

    // Para cada agente, compõe os colisores incluindo todos os OUTROS agentes (evita atravessamento)
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const agentColliders: ObstacleCollider[] = baseColliders.slice();
      for (let j = 0; j < agents.length; j++) {
        if (i === j) continue;
        const other = agents[j];
        agentColliders.push({
          type: 'cylinder',
          cx: other.position.x,
          cz: other.position.z,
          radius: other.radius || 0.4,
          name: other.config.name,
        });
      }

      agent.update(clampedDelta, agentColliders, trafficLight, playerPos);
      agent.updateLabel(camera, gl);
    }

    // Resolução física mútua anti-penetração entre agentes (garante 0 sobreposição visual)
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const a1 = agents[i];
        const a2 = agents[j];
        const dx = a1.position.x - a2.position.x;
        const dz = a1.position.z - a2.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = (a1.radius || 0.4) + (a2.radius || 0.4);
        if (distSq < minDist * minDist && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          a1.position.x += nx * (overlap * 0.5);
          a1.position.z += nz * (overlap * 0.5);
          a2.position.x -= nx * (overlap * 0.5);
          a2.position.z -= nz * (overlap * 0.5);
        }
      }
    }

    // Resolução física anti-penetração entre agentes e o player
    if (playerPos) {
      for (const a of agents) {
        const dx = a.position.x - playerPos.x;
        const dz = a.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;
        const minDist = (a.radius || 0.4) + 0.45;
        if (distSq < minDist * minDist && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          a.position.x += (dx / dist) * overlap;
          a.position.z += (dz / dist) * overlap;
        }
      }
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
