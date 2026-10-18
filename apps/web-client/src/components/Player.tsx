import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DanielAvatar, MovementInput } from '../avatars/daniel-avatar';
import { InteractiveObject, ObstacleCollider } from '../scenes/city-scene';
import { VehicleAgent } from '../vehicles/vehicle-agent';
import { cityStore } from '../store/city-store';

interface PlayerProps {
  player: DanielAvatar;
  cameraAngleY: number;
  colliders: ObstacleCollider[];
  vehicles?: VehicleAgent[];
  interactiveObjects: InteractiveObject[];
  onTelemetryUpdate?: (x: number, z: number, speedKmH: number) => void;
  onObservationUpdate?: (obs: InteractiveObject | null) => void;
}

export const Player: React.FC<PlayerProps> = ({
  player,
  cameraAngleY,
  colliders,
  vehicles,
  interactiveObjects,
  onTelemetryUpdate,
  onObservationUpdate,
}) => {
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

    // Reúne colisores estáticos da cidade e dinâmicos dos veículos em movimento
    const dynamicColliders = colliders.slice();
    if (vehicles && vehicles.length > 0) {
      for (const v of vehicles) {
        for (const c of v.getColliders()) {
          dynamicColliders.push(c);
        }
      }
    }

    // Atualiza avatar com resposta de colisão e animação de marcha
    player.update(clampedDelta, inputRef.current, cameraAngleY, dynamicColliders);

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

    // Atualiza observação apenas quando houver transição de alvo
    cityStore.setObservation(closest);
    if (onObservationUpdate) {
      onObservationUpdate(closest);
    }
  });

  return <primitive object={player.mesh} />;
};
