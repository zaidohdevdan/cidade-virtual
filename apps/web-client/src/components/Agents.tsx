import React, { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AgentAvatar } from '../avatars/agent-avatar';

interface AgentsProps {
  agents: AgentAvatar[];
}

export const Agents: React.FC<AgentsProps> = ({ agents }) => {
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
    for (const agent of agents) {
      agent.update(clampedDelta);
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
