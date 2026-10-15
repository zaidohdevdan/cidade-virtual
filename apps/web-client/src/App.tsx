import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';

import { CityScene, TrafficLightState, InteractiveObject } from './scenes/city-scene';
import { DanielAvatar } from './avatars/daniel-avatar';
import { AgentAvatar, CITY_AGENTS } from './avatars/agent-avatar';
import { City } from './components/City';
import { Player } from './components/Player';
import { Agents } from './components/Agents';
import { CameraController } from './components/CameraController';
import { HUD } from './components/HUD';

export const App: React.FC = () => {
  // Modelos e simulações urbanas
  const city = useMemo(() => new CityScene(), []);
  const player = useMemo(() => new DanielAvatar(), []);
  const agents = useMemo(() => CITY_AGENTS.map((cfg) => new AgentAvatar(cfg)), []);

  // Estados reativos da interface e simulação (Padrão DENATRAN em 2 fases)
  const [trafficLightState, setTrafficLightState] = useState<TrafficLightState>('green');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('day');
  const [isFirstPerson, setIsFirstPerson] = useState<boolean>(false);
  const [cameraAngleY, setCameraAngleY] = useState<number>(0);
  const [observation, setObservation] = useState<InteractiveObject | null>(null);
  const [telemetry, setTelemetry] = useState<{ x: number; z: number; speedKmH: number }>({
    x: 8.5,
    z: 12.0,
    speedKmH: 0,
  });
  const [isSnapshotOpen, setIsSnapshotOpen] = useState<boolean>(false);

  // Ciclo automático semafórico em 2 fases (Padrão DENATRAN: 8s Av. Central Verde -> 3s Amarelo -> 8s Transversal Verde)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = (state: TrafficLightState) => {
      const delay = state === 'yellow' ? 3000 : 8000;
      const nextState: TrafficLightState = state === 'green' ? 'yellow' : state === 'yellow' ? 'red' : 'green';

      timeoutId = setTimeout(() => {
        setTrafficLightState(nextState);
        scheduleNext(nextState);
      }, delay);
    };

    scheduleNext('green');

    return () => clearTimeout(timeoutId);
  }, []);

  // Conexão em tempo real Socket.IO com o backend NestJS
  useEffect(() => {
    let socket: Socket | null = null;
    try {
      const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : `http://${window.location.hostname}:3001`;
      socket = io(serverUrl, {
        autoConnect: true,
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        console.log('[Socket.IO] Conectado ao servidor da Cidade Virtual:', socket?.id);
      });

      socket.on('world:state', (state: { trafficLight?: TrafficLightState; timeOfDay?: 'day' | 'sunset' | 'night' }) => {
        if (state.trafficLight) setTrafficLightState(state.trafficLight);
        if (state.timeOfDay) setTimeOfDay(state.timeOfDay);
      });
    } catch (err) {
      console.warn('[Socket.IO] Servidor indisponível no momento, operando em modo autônomo local.');
    }

    return () => {
      socket?.disconnect();
    };
  }, []);

  const handleToggleTrafficLight = useCallback(() => {
    setTrafficLightState((prev) => (prev === 'green' ? 'yellow' : prev === 'yellow' ? 'red' : 'green'));
  }, []);

  const handleToggleTimeOfDay = useCallback(() => {
    setTimeOfDay((prev) => (prev === 'day' ? 'sunset' : prev === 'sunset' ? 'night' : 'day'));
  }, []);

  const handleToggleFirstPerson = useCallback(() => {
    setIsFirstPerson((prev) => !prev);
  }, []);

  const handleTelemetryUpdate = useCallback((x: number, z: number, speedKmH: number) => {
    setTelemetry({ x, z, speedKmH });
  }, []);

  const handleObservationUpdate = useCallback((obs: InteractiveObject | null) => {
    setObservation(obs);
  }, []);

  // Dados do snapshot da cena
  const snapshotData = useMemo(() => {
    return {
      scenarioId: 'synapse-city-01',
      citizens: [
        {
          id: 'player-daniel',
          role: 'Protagonista / Avatar',
          position: { x: Number(telemetry.x.toFixed(2)), z: Number(telemetry.z.toFixed(2)) },
          speedKmH: Number(telemetry.speedKmH.toFixed(1)),
        },
        ...agents.map((a) => ({
          id: a.config.id,
          name: a.config.name,
          position: { x: Number(a.position.x.toFixed(2)), z: Number(a.position.z.toFixed(2)) },
        })),
      ],
      interactiveObjects: city.interactiveObjects.map((obj) => ({
        id: obj.id,
        name: obj.name,
        type: obj.type,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      })),
      environment: {
        trafficLight: trafficLightState,
        timeOfDay,
        activeColliders: city.colliders.length,
      },
      timestamp: new Date().toISOString(),
    };
  }, [telemetry, agents, city, trafficLightState, timeOfDay]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 3D Canvas via React Three Fiber */}
      <Canvas
        shadows
        camera={{ position: [0, 45, 60], fov: 55, near: 0.1, far: 400 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>
            <City
              city={city}
              trafficLightState={trafficLightState}
              timeOfDay={timeOfDay}
            />
            <Player
              player={player}
              cameraAngleY={cameraAngleY}
              colliders={city.colliders}
              interactiveObjects={city.interactiveObjects}
              onTelemetryUpdate={handleTelemetryUpdate}
              onObservationUpdate={handleObservationUpdate}
            />
            <Agents agents={agents} />
            <CameraController
              playerPosition={player.position}
              isFirstPerson={isFirstPerson}
              onAngleChange={setCameraAngleY}
              onToggleFirstPerson={handleToggleFirstPerson}
            />
          </Physics>
        </Suspense>
      </Canvas>

      {/* HUD Overlay — Controles, Telemetria, Percepção e Legenda */}
      <HUD
        agentCount={agents.length}
        trafficLightState={trafficLightState}
        onToggleTrafficLight={handleToggleTrafficLight}
        timeOfDay={timeOfDay}
        onToggleTimeOfDay={handleToggleTimeOfDay}
        observation={observation}
        telemetry={telemetry}
        isFirstPerson={isFirstPerson}
        onOpenSnapshot={() => setIsSnapshotOpen(true)}
        isSnapshotOpen={isSnapshotOpen}
        onCloseSnapshot={() => setIsSnapshotOpen(false)}
        snapshotData={snapshotData}
      />
    </div>
  );
};
