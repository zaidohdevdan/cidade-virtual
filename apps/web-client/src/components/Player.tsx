import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DanielAvatar, MovementInput } from '../avatars/daniel-avatar';
import { AgentAvatar } from '../avatars/agent-avatar';
import { InteractiveObject, ObstacleCollider } from '../scenes/city-scene';
import { VehicleAgent } from '../vehicles/vehicle-agent';
import { cityStore } from '../store/city-store';

interface PlayerProps {
  player: DanielAvatar;
  cameraAngleY: number;
  colliders: ObstacleCollider[];
  vehicles?: VehicleAgent[];
  agents?: AgentAvatar[];
  interactiveObjects: InteractiveObject[];
  onTelemetryUpdate?: (x: number, z: number, speedKmH: number) => void;
  onObservationUpdate?: (obs: InteractiveObject | null) => void;
}

export const Player: React.FC<PlayerProps> = ({
  player,
  cameraAngleY,
  colliders,
  vehicles,
  agents,
  interactiveObjects,
  onTelemetryUpdate,
  onObservationUpdate,
}) => {
  const { camera, gl } = useThree();
  const inputRef = useRef<MovementInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputRef.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inputRef.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inputRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inputRef.current.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputRef.current.sprint = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputRef.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inputRef.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inputRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inputRef.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputRef.current.sprint = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.1);

    // Reúne colisores estáticos da cidade e dinâmicos dos veículos e pedestres
    const dynamicColliders = colliders.slice();
    if (vehicles && vehicles.length > 0) {
      for (const v of vehicles) {
        for (const c of v.getColliders()) {
          dynamicColliders.push(c);
        }
      }
    }
    if (agents && agents.length > 0) {
      for (const a of agents) {
        dynamicColliders.push({
          type: 'cylinder',
          cx: a.position.x,
          cz: a.position.z,
          radius: a.radius || 0.4,
          name: a.config.name,
        });
      }
    }

    // Atualiza avatar com resposta de colisão e animação de marcha
    player.update(clampedDelta, inputRef.current, cameraAngleY, dynamicColliders);

    // Resolução física mútua anti-penetração (impede que o jogador atravesse pedestres)
    if (agents && agents.length > 0) {
      for (const a of agents) {
        const dx = player.position.x - a.position.x;
        const dz = player.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = player.radius + (a.radius || 0.4);
        if (distSq < minDist * minDist && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          player.position.x += nx * (overlap * 0.5);
          player.position.z += nz * (overlap * 0.5);
          a.position.x -= nx * (overlap * 0.5);
          a.position.z -= nz * (overlap * 0.5);
        }
      }
    }

    // Atualiza telemetria diretamente no store externo a 60 Hz sem disparar re-render do React
    const speedKmH = player.speed * 3.6;
    cityStore.updateTelemetry(player.position.x, player.position.z, speedKmH);
    if (onTelemetryUpdate) {
      onTelemetryUpdate(player.position.x, player.position.z, speedKmH);
    }

    // Percepção semântica por proximidade
    let closest: InteractiveObject | null = null;
    let minDist = Infinity;
    for (const obj of interactiveObjects) {
      const d = player.position.distanceTo(obj.position);
      if (d <= obj.observationRadius && d < minDist) {
        minDist = d;
        closest = obj;
      }
    }

    // Projeta balão de fala do jogador para tela 2D
    player.updateLabel(camera, gl);
  });

  useEffect(() => {
    return () => {
      player.dispose();
    };
  }, [player]);

  return <primitive object={player.mesh} />;
};
