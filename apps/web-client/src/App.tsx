import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';

import { CityScene, TrafficLightState } from './scenes/city-scene';
import { DanielAvatar } from './avatars/daniel-avatar';
import { AgentAvatar, CITY_AGENTS } from './avatars/agent-avatar';
import { VehicleAgent, CITY_VEHICLES } from './vehicles/vehicle-agent';
import { City } from './components/City';
import { Player } from './components/Player';
import { Agents } from './components/Agents';
import { Vehicles } from './components/Vehicles';
import { CameraController } from './components/CameraController';
import { HUD } from './components/HUD';
import { cityStore, useCityStore } from './store/city-store';

export const App: React.FC = () => {
  // Modelos e simulações urbanas instanciados de forma estável
  const city = useMemo(() => new CityScene(), []);
  const player = useMemo(() => new DanielAvatar(), []);
  const agents = useMemo(() => CITY_AGENTS.map((cfg) => new AgentAvatar(cfg)), []);
  const vehicles = useMemo(() => CITY_VEHICLES.map((cfg) => new VehicleAgent(cfg)), []);

  // Estados locais do shell da aplicação
  const [isSnapshotOpen, setIsSnapshotOpen] = useState<boolean>(false);
  const [snapshotData, setSnapshotData] = useState<unknown>(null);
  const socketRef = useRef<Socket | null>(null);

  // Estados do store externo consumidos seletivamente
  const trafficLightState = useCityStore((s) => s.trafficLightState);
  const timeOfDay = useCityStore((s) => s.timeOfDay);
  const isFirstPerson = useCityStore((s) => s.isFirstPerson);
  const cameraAngleY = useCityStore((s) => s.cameraAngleY);

  // Conexão em tempo real Socket.IO autenticada (JWT) com o namespace autoritativo /world (Task-022)
  useEffect(() => {
    let socket: Socket | null = null;
    let isMounted = true;

    async function connectSocket() {
      try {
        const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
        const apiBase = `http://${host}:3001`;
        const serverUrl = `${apiBase}/world`;

        // 1. Obtém token JWT de convidado (Guest Principal) via HTTP seguro
        let token: string | undefined = undefined;
        try {
          const res = await fetch(`${apiBase}/auth/guest-token`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            token = data.token;
          }
        } catch {
          console.warn('[Socket.IO] Não foi possível obter guest token via HTTP. Tentando handshake direto...');
        }

        if (!isMounted) return;

        // 2. Conecta ao WebSocket enviando token no auth do handshake
        socket = io(serverUrl, {
          autoConnect: true,
          transports: ['websocket', 'polling'],
          auth: { token },
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          cityStore.setIsConnected(true);
          console.log('[Socket.IO] Conectado e autenticado no /world:', socket?.id);
        });

        socket.on('connect_error', (err) => {
          console.warn('[Socket.IO] Erro de autenticação no handshake:', err.message);
        });

        socket.on('disconnect', () => {
          cityStore.setIsConnected(false);
          console.warn('[Socket.IO] Desconectado do servidor autoritativo.');
        });

        socket.on('error', (err: { code?: string; message?: string }) => {
          console.warn('[Socket.IO] Alerta de segurança do servidor:', err?.code, err?.message);
        });

        socket.on('avatar:correction', (corr: { x: number; y: number; z: number; reason: string }) => {
          console.warn('[Socket.IO] Correção server-side de posição aplicada:', corr.reason);
        });

        socket.on('world:state', (state: { trafficLight?: TrafficLightState; timeOfDay?: number | string }) => {
          if (state.trafficLight) {
            cityStore.setTrafficLightState(state.trafficLight);
          }
          if (state.timeOfDay !== undefined) {
            const hour = typeof state.timeOfDay === 'number' ? state.timeOfDay : 12;
            const tod: 'day' | 'sunset' | 'night' =
              hour >= 6 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'sunset' : 'night';
            cityStore.setTimeOfDay(tod);
          }
        });

        socket.on('world:event', (event: { name: string; payload: Record<string, unknown> }) => {
          if (event.name === 'traffic_light.changed' && typeof event.payload?.state === 'string') {
            cityStore.setTrafficLightState(event.payload.state as TrafficLightState);
          }
          if (event.name === 'world.weather.changed' && typeof event.payload?.timeOfDay === 'number') {
            const hour = event.payload.timeOfDay;
            const tod: 'day' | 'sunset' | 'night' =
              hour >= 6 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'sunset' : 'night';
            cityStore.setTimeOfDay(tod);
          }
        });
      } catch (err) {
        console.warn('[Socket.IO] Falha na conexão com o servidor autoritativo.');
      }
    }

    connectSocket();

    return () => {
      isMounted = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const handleToggleTrafficLight = useCallback(() => {
    const current = cityStore.getState().trafficLightState;
    const next: TrafficLightState = current === 'green' ? 'yellow' : current === 'yellow' ? 'red' : 'green';
    cityStore.setTrafficLightState(next);
    socketRef.current?.emit('traffic_light:set', { state: next });
  }, []);

  const handleToggleTimeOfDay = useCallback(() => {
    const current = cityStore.getState().timeOfDay;
    const next = current === 'day' ? 'sunset' : current === 'sunset' ? 'night' : 'day';
    cityStore.setTimeOfDay(next);
  }, []);

  const handleToggleFirstPerson = useCallback(() => {
    cityStore.setIsFirstPerson(!cityStore.getState().isFirstPerson);
  }, []);

  const handleCameraAngleChange = useCallback((angle: number) => {
    cityStore.setCameraAngleY(angle);
  }, []);

  // Geração sob demanda do snapshot apenas quando o modal for aberto
  const handleOpenSnapshot = useCallback(() => {
    const currentTelemetry = cityStore.getState().telemetry;
    const currentTL = cityStore.getState().trafficLightState;
    const currentTOD = cityStore.getState().timeOfDay;

    const data = {
      scenarioId: 'synapse-city-01',
      citizens: [
        {
          id: 'player-daniel',
          role: 'Protagonista / Avatar',
          position: { x: Number(currentTelemetry.x.toFixed(2)), z: Number(currentTelemetry.z.toFixed(2)) },
          speedKmH: Number(currentTelemetry.speedKmH.toFixed(1)),
        },
        ...agents.map((a) => ({
          id: a.config.id,
          name: a.config.name,
          star: a.config.starDesignation,
          role: a.config.role,
          position: { x: Number(a.position.x.toFixed(2)), z: Number(a.position.z.toFixed(2)) },
        })),
      ],
      vehicles: vehicles.map((v) => ({
        id: v.config.id,
        name: v.config.name,
        model: v.config.modelName,
        state: v.state,
        speedKmH: Number((v.speed * 3.6).toFixed(1)),
        position: { x: Number(v.position.x.toFixed(2)), z: Number(v.position.z.toFixed(2)) },
      })),
      interactiveObjects: city.interactiveObjects.map((obj) => ({
        id: obj.id,
        name: obj.name,
        type: obj.type,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      })),
      environment: {
        trafficLight: currentTL,
        timeOfDay: currentTOD,
        activeColliders: city.colliders.length,
      },
      timestamp: new Date().toISOString(),
    };

    setSnapshotData(data);
    setIsSnapshotOpen(true);
  }, [agents, vehicles, city]);

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
            <City city={city} trafficLightState={trafficLightState} timeOfDay={timeOfDay} />
            <Vehicles
              vehicles={vehicles}
              trafficLights={city.trafficLights}
              agents={agents}
              playerPos={player.position}
            />
            <Player
              player={player}
              cameraAngleY={cameraAngleY}
              colliders={city.colliders}
              vehicles={vehicles}
              agents={agents}
              interactiveObjects={city.interactiveObjects}
            />
            <Agents
              agents={agents}
              vehicles={vehicles}
              colliders={city.colliders}
              playerPos={player.position}
            />
            <CameraController
              playerPosition={player.position}
              isFirstPerson={isFirstPerson}
              onAngleChange={handleCameraAngleChange}
              onToggleFirstPerson={handleToggleFirstPerson}
            />
          </Physics>
        </Suspense>
      </Canvas>

      {/* HUD Overlay — Controles, Telemetria, Percepção e Legenda */}
      <HUD
        agentCount={agents.length}
        onToggleTrafficLight={handleToggleTrafficLight}
        onToggleTimeOfDay={handleToggleTimeOfDay}
        onOpenSnapshot={handleOpenSnapshot}
        isSnapshotOpen={isSnapshotOpen}
        onCloseSnapshot={() => setIsSnapshotOpen(false)}
        snapshotData={snapshotData}
      />
    </div>
  );
};
