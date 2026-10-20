import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';

import { CityScene, TrafficLightState, type InteractiveObject } from './scenes/city-scene';
import { DanielAvatar } from './avatars/daniel-avatar';
import { AgentAvatar, CITY_AGENTS, type LearnedDirectiveClient } from './avatars/agent-avatar';
import { VehicleAgent, CITY_VEHICLES } from './vehicles/vehicle-agent';
import { City } from './components/City';
import { Player } from './components/Player';
import { Agents } from './components/Agents';
import { Vehicles } from './components/Vehicles';
import { CameraController } from './components/CameraController';
import { HUD } from './components/HUD';
import { DialogueModal, DialogueMessage } from './components/DialogueModal';
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

  // Estados do sistema conversacional e de proximidade (Task-026 + Diálogo Bidirecional)
  const [isDialogueOpen, setIsDialogueOpen] = useState<boolean>(false);
  const [activeDialogueAgent, setActiveDialogueAgent] = useState<AgentAvatar | null>(null);
  const [dialogueMessages, setDialogueMessages] = useState<DialogueMessage[]>([]);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [nearbyAgent, setNearbyAgent] = useState<{ id: string; name: string; role: string } | null>(null);

  // Estados do store externo consumidos seletivamente
  const trafficLightState = useCityStore((s) => s.trafficLightState);
  const timeOfDay = useCityStore((s) => s.timeOfDay);
  const isFirstPerson = useCityStore((s) => s.isFirstPerson);
  const cameraAngleY = useCityStore((s) => s.cameraAngleY);

  // Monitora proximidade física entre o avatar Daniel e os habitantes autônomos (raio ≤ 3.5m)
  useEffect(() => {
    const interval = setInterval(() => {
      let closest: AgentAvatar | null = null;
      let minDistance = 3.5;

      for (const agent of agents) {
        const dx = agent.position.x - player.position.x;
        const dz = agent.position.z - player.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= minDistance) {
          minDistance = dist;
          closest = agent;
        }
      }

      if (closest) {
        setNearbyAgent({
          id: closest.config.id,
          name: closest.config.name,
          role: closest.config.role,
        });
      } else {
        setNearbyAgent(null);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [agents, player]);

  // Transmite periodicamente a posição física autoritativa do avatar Daniel para o servidor via Socket.IO
  useEffect(() => {
    let lastSent = 0;
    let lastPos = { x: 0, y: 0, z: 0 };

    const interval = setInterval(() => {
      const now = Date.now();
      const currentPos = player.position;
      const distSq = (currentPos.x - lastPos.x) ** 2 + (currentPos.z - lastPos.z) ** 2;

      if ((distSq > 0.05 || now - lastSent > 2000) && socketRef.current?.connected) {
        socketRef.current.emit('avatar:position', {
          x: currentPos.x,
          y: currentPos.y,
          z: currentPos.z,
        });
        lastSent = now;
        lastPos = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
      }
    }, 200);

    return () => clearInterval(interval);
  }, [player]);

  // Conexão em tempo real Socket.IO autenticada (JWT) com o namespace autoritativo /world (Task-022)
  useEffect(() => {
    let socket: Socket | null = null;
    let isMounted = true;

    async function connectSocket() {
      try {
        const host = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
        const apiBase = `http://${host}:3001`;
        const serverUrl = `${apiBase}/world`;

        // 1. Obtém token JWT de convidado (Guest Principal) via HTTP seguro com retentativas
        async function fetchGuestToken(): Promise<string | null> {
          for (let attempt = 1; attempt <= 10 && isMounted; attempt++) {
            try {
              const res = await fetch(`${apiBase}/auth/guest-token`, { method: 'POST' });
              if (res.ok) {
                const data = await res.json();
                if (data?.token) return data.token;
              }
            } catch {
              // Servidor HTTP ainda subindo, aguarda breve intervalo antes de tentar novamente
            }
            if (attempt < 10 && isMounted) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
          return null;
        }

        const token = await fetchGuestToken();
        if (!isMounted || !token) {
          console.warn('[Socket.IO] Servidor da API indisponível ou token não obtido. Conexão WS suspensa.');
          return;
        }

        // 2. Conecta ao WebSocket enviando token garantido no auth do handshake
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
          // Sincronização e Ciclo Autônomo dos NPCs (Task-026)
          if (event.name === 'agent.moved' && event.payload) {
            const { agentId, principalId, position } = event.payload as {
              agentId?: string;
              principalId?: string;
              position?: { x: number; y?: number; z: number };
            };
            const id = agentId || (principalId?.startsWith('principal_') ? principalId.replace('principal_', '') : principalId);
            const agent = agents.find((a) => a.config.id === id);
            if (agent && position) {
              agent.setTargetPosition(position);
            }
          }
          if (event.name === 'agent.speech' && event.payload) {
            const { agentId, principalId, message } = event.payload as {
              agentId?: string;
              principalId?: string;
              message?: string;
              isProximitySpeech?: boolean;
            };
            const id = agentId || (principalId?.startsWith('principal_') ? principalId.replace('principal_', '') : principalId);
            const agent = agents.find((a) => a.config.id === id);
            if (agent && message) {
              // Os balões de conversa só devem ser emitidos quando o avatar Daniel estiver próximo (<= 3.5m)
              const distToPlayer = agent.position.distanceTo(player.position);
              if (distToPlayer <= 3.5) {
                agent.say(message, 4.0);
              }
            }
          }
          if (event.name === 'agent.instruction.learned' && event.payload) {
            const { agentId, directive, playerMessage } = event.payload as {
              agentId?: string;
              directive?: LearnedDirectiveClient;
              playerMessage?: string;
            };
            const agent = agents.find((a) => a.config.id === agentId);
            if (agent && (directive || playerMessage)) {
              agent.learnInstruction(playerMessage || directive?.instruction || '', directive);
            }
          }
          if (event.name === 'agent.target' && event.payload) {
            const { agentId, targetPosition, instruction } = event.payload as {
              agentId?: string;
              targetPosition?: { x: number; y?: number; z: number };
              instruction?: LearnedDirectiveClient;
            };
            const agent = agents.find((a) => a.config.id === agentId);
            if (agent) {
              if (instruction) {
                agent.learnInstruction(instruction.instruction || '', instruction);
              }
              if (targetPosition) {
                agent.setTargetPosition(targetPosition);
              }
            }
          }
          if (event.name === 'npc.alert' && event.payload) {
            const { message, citizenIds } = event.payload as { message?: string; citizenIds?: string[] };
            if (message) {
              const targets = citizenIds && citizenIds.length > 0
                ? agents.filter((a) => citizenIds.includes(a.config.id))
                : agents;
              targets.forEach((a) => {
                // Apenas emite balão para agentes próximos ao avatar Daniel (<= 3.5m)
                if (a.position.distanceTo(player.position) <= 3.5) {
                  a.say(`⚠️ ${message}`, 5);
                }
              });
            }
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
  }, [agents]);

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

  // Abertura da interface de diálogo bidirecional com o habitante próximo
  const handleOpenDialogueForNearbyAgent = useCallback(() => {
    if (!nearbyAgent) return;
    const target = agents.find((a) => a.config.id === nearbyAgent.id);
    if (!target) return;

    setActiveDialogueAgent(target);
    setIsDialogueOpen(true);

    // Inicializa histórico de conversa com a saudação atual do habitante
    setDialogueMessages((prev) => {
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const initialGreeting =
        target.speechText ||
        `Olá Daniel! Sou ${target.config.name}, atuando como ${target.config.role} em Synapse City. Em que posso colaborar?`;

      return [
        {
          id: `greet-${Date.now()}`,
          sender: 'agent',
          senderName: target.config.name,
          text: initialGreeting,
          time: currentTime,
        },
      ];
    });
  }, [nearbyAgent, agents]);

  // Escuta teclas de atalho: 'E' para iniciar diálogo e 'M' para alternar voz/mudo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && !isDialogueOpen && nearbyAgent) {
        e.preventDefault();
        handleOpenDialogueForNearbyAgent();
      } else if ((e.code === 'KeyM' || e.key === 'm' || e.key === 'M') && !isDialogueOpen) {
        cityStore.toggleAudioMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDialogueOpen, nearbyAgent, handleOpenDialogueForNearbyAgent]);

  // Envio de mensagem bidirecional de Daniel para o habitante autônomo
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeDialogueAgent) return;

      const playerMsg: DialogueMessage = {
        id: `msg-p-${Date.now()}`,
        sender: 'player',
        senderName: 'Daniel',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setDialogueMessages((prev) => [...prev, playerMsg]);
      player.say(text, 5);
      setIsThinking(true);

      const targetAgentId = activeDialogueAgent.config.id;
      const targetAgentName = activeDialogueAgent.config.name;

      if (socketRef.current?.connected) {
        socketRef.current.emit(
          'agent:dialogue',
          { targetAgentId, message: text },
          (ack: { success: boolean; response?: string; error?: string; directive?: LearnedDirectiveClient }) => {
            setIsThinking(false);
            if (ack && ack.success && ack.response) {
              const agentMsg: DialogueMessage = {
                id: `msg-a-${Date.now()}`,
                sender: 'agent',
                senderName: targetAgentName,
                text: ack.response,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                directive: ack.directive,
              };
              setDialogueMessages((prev) => [...prev, agentMsg]);
              activeDialogueAgent.say(ack.response, 6, true);
              activeDialogueAgent.learnInstruction(text, ack.directive);
            } else {
              activeDialogueAgent.learnInstruction(text);
              const latestDirective = activeDialogueAgent.learnedDirectives[activeDialogueAgent.learnedDirectives.length - 1];
              const fallbackResponse = `Instrução gravada, Daniel! Aprendi e executarei: "${text}". Não esquecerei!`;
              const agentMsg: DialogueMessage = {
                id: `msg-a-${Date.now()}`,
                sender: 'agent',
                senderName: targetAgentName,
                text: fallbackResponse,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                directive: latestDirective,
              };
              setDialogueMessages((prev) => [...prev, agentMsg]);
              activeDialogueAgent.say(fallbackResponse, 6, true);
            }
          },
        );
      } else {
        setTimeout(() => {
          setIsThinking(false);
          activeDialogueAgent.learnInstruction(text);
          const latestDirective = activeDialogueAgent.learnedDirectives[activeDialogueAgent.learnedDirectives.length - 1];
          const fallback = `Instrução ouvida e gravada, Daniel! Aprendi e cumprirei: "${text}". Jamais esquecerei!`;
          const agentMsg: DialogueMessage = {
            id: `msg-a-${Date.now()}`,
            sender: 'agent',
            senderName: targetAgentName,
            text: fallback,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            directive: latestDirective,
          };
          setDialogueMessages((prev) => [...prev, agentMsg]);
          activeDialogueAgent.say(fallback, 6, true);
        }, 500);
      }
    },
    [activeDialogueAgent, player],
  );

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

      {/* HUD Overlay — Controles, Telemetria, Percepção e Notificação de Proximidade */}
      <HUD
        agentCount={agents.length}
        onToggleTrafficLight={handleToggleTrafficLight}
        onToggleTimeOfDay={handleToggleTimeOfDay}
        onOpenSnapshot={handleOpenSnapshot}
        isSnapshotOpen={isSnapshotOpen}
        onCloseSnapshot={() => setIsSnapshotOpen(false)}
        snapshotData={snapshotData}
        nearbyAgent={isDialogueOpen ? null : nearbyAgent}
        onOpenDialogue={handleOpenDialogueForNearbyAgent}
      />

      {/* Modal Glassmorphism de Diálogo Bidirecional com Cidadãos Autônomos */}
      <DialogueModal
        agent={activeDialogueAgent}
        isOpen={isDialogueOpen}
        onClose={() => setIsDialogueOpen(false)}
        onSendMessage={handleSendMessage}
        messages={dialogueMessages}
        isThinking={isThinking}
      />
    </div>
  );
};

