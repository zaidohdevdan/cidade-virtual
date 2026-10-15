// apps/web/src/index.ts — SYNAPSE CITY ENGINE
import * as THREE from 'three';
import { CityScene, TrafficLightState, InteractiveObject } from './scenes/city-scene';
import { DanielAvatar } from './avatars/daniel-avatar';
import { AgentAvatar, CITY_AGENTS, AgentConfig } from './avatars/agent-avatar';
import { VehicleAgent, CITY_VEHICLES } from './vehicles/vehicle-agent';
import { CameraControls } from './controls/camera-controls';
import type { SceneSnapshot, CitizenId } from '@cidade-virtual/types';

export function createSynapseCity(): {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  city: CityScene;
  player: DanielAvatar;
  agents: AgentAvatar[];
  vehicles: VehicleAgent[];
} {
  const container = document.getElementById('canvas-container');
  if (!container) throw new Error('Element #canvas-container not found.');

  // ── Renderer ──────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // ── Camera ─────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
  // Posição isométrica inicial, olhando para o centro da cidade
  camera.position.set(0, 60, 70);
  camera.lookAt(0, 0, 0);

  // ── City Scene ─────────────────────────────────────
  const city = new CityScene();

  // ── Player ─────────────────────────────────────────
  const player = new DanielAvatar();
  player.mesh.position.set(8.5, 0.22, 12.0);
  city.scene.add(player.mesh);

  // ── Controls ───────────────────────────────────────
  const controls = new CameraControls(camera, renderer.domElement);
  controls.isFirstPerson = false;
  controls.cameraAngleX = 0.55; // Ângulo perfeito para ver o cruzamento, semáforo e praça

  // ── AI Agents (Cidadãos Estelares) ─────────────────
  const agents: AgentAvatar[] = CITY_AGENTS.map((cfg: AgentConfig) => {
    const agent = new AgentAvatar(cfg);
    city.scene.add(agent.mesh);
    return agent;
  });

  // ── Autonomous Vehicles ────────────────────────────
  const vehicles: VehicleAgent[] = CITY_VEHICLES.map((cfg) => {
    const veh = new VehicleAgent(cfg);
    city.scene.add(veh.mesh);
    return veh;
  });

  // ── Resize ─────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Ciclo dos Semáforos do Cruzamento (Padrão DENATRAN em 2 Fases) ──
  let tlTimer = 0;
  const tlStates: TrafficLightState[] = ['green', 'yellow', 'red'];
  let tlIdx = 0;

  const clock = new THREE.Clock();

  // ── HUD elements ──────────────────────────────────
  const obsContainer = document.getElementById('observation-container');
  const obsTitle = document.getElementById('obs-title');
  const obsDesc = document.getElementById('obs-desc');
  const obsRuleText = document.getElementById('obs-rule-text');
  const obsWeight = document.getElementById('obs-weight');
  const telemetryCoords = document.getElementById('telemetry-coords');
  const telemetrySpeed = document.getElementById('telemetry-speed');
  const cameraModeText = document.getElementById('camera-mode-text');
  const agentCountEl = document.getElementById('agent-count');
  const tlStatusEl = document.getElementById('tl-status');

  if (agentCountEl) agentCountEl.textContent = `${agents.length}`;

  // ── Snapshot ───────────────────────────────────────
  const getSnapshot = (): SceneSnapshot => ({
    scenarioId: 'synapse-city-01',
    citizens: [
      {
        id: '00000000-0000-0000-0000-000000000001' as CitizenId,
        position: { lat: player.position.x, lng: player.position.z, altitude: player.position.y },
        emotion: 'curious' as const,
      },
      ...agents.map((a, i) => ({
        id: `00000000-0000-0000-0000-${String(i + 2).padStart(12, '0')}` as CitizenId,
        position: { lat: a.position.x, lng: a.position.z, altitude: a.position.y },
        emotion: 'calm' as const,
      })),
    ],
    objects: city.interactiveObjects.map((obj: InteractiveObject) => ({
      id: obj.id,
      type: obj.type,
      position: { lat: obj.position.x, lng: obj.position.z, altitude: obj.position.y },
    })),
    weather: 'clear',
    timeOfDay: 14,
  });

  // ── Animate ────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    // Ciclo do Semáforo (8s vermelho, 8s verde, 3s amarelo)
    tlTimer += delta;
    const currentDuration = tlStates[tlIdx] === 'yellow' ? 3.0 : 8.0;
    if (tlTimer > currentDuration) {
      tlTimer = 0;
      tlIdx = (tlIdx + 1) % tlStates.length;
      city.setAllTrafficLights(tlStates[tlIdx]);
      if (tlStatusEl) {
        const icons: Record<TrafficLightState, string> = { red: '🔴', yellow: '🟡', green: '🟢' };
        tlStatusEl.textContent = `${icons[tlStates[tlIdx]]} ${tlStates[tlIdx].toUpperCase()}`;
      }
      const btn = document.getElementById('btn-traffic-light');
      if (btn) btn.innerHTML = `🚦 Semáforo: ${tlStates[tlIdx].toUpperCase()}`;
    }

    // Player com resposta física a todos os obstáculos da cena
    avatar_update: {
      player.update(delta, controls.input, controls.cameraAngleY, city.colliders);
    }

    // Agents (Cidadãos Estelares)
    for (const agent of agents) {
      agent.update(delta);
      agent.updateLabel(camera, renderer);
    }

    // Autonomous Vehicles (Trânsito Inteligente)
    const pedPositions = agents.map((a) => a.position);
    for (const vehicle of vehicles) {
      vehicle.update(delta, city.trafficLights, pedPositions, player.position, vehicles);
    }

    // Camera
    controls.update(player.position, delta);

    // Render
    renderer.render(city.scene, camera);

    // HUD telemetry
    if (telemetryCoords) telemetryCoords.textContent = `X: ${player.position.x.toFixed(1)}m | Z: ${player.position.z.toFixed(1)}m`;
    if (telemetrySpeed) telemetrySpeed.textContent = `${(player.speed * 3.6).toFixed(1)} km/h`;
    if (cameraModeText) cameraModeText.textContent = controls.isFirstPerson ? '1ª Pessoa' : 'Isométrica';

    // Observation sensor (player proximity)
    let closest = null as typeof city.interactiveObjects[0] | null;
    let minDist = Infinity;
    for (const obj of city.interactiveObjects) {
      const d = player.position.distanceTo(obj.position);
      if (d <= obj.observationRadius && d < minDist) { minDist = d; closest = obj; }
    }

    if (closest && obsContainer && obsTitle && obsDesc && obsRuleText && obsWeight) {
      obsContainer.style.opacity = '1';
      obsContainer.style.transform = 'translateY(0)';
      obsTitle.textContent = closest.name;
      obsDesc.textContent = closest.description;
      obsRuleText.textContent = closest.semanticRule;
      obsWeight.textContent = `Peso Emocional: ${(closest.emotionalWeight * 100).toFixed(0)}%`;
    } else if (obsContainer) {
      obsContainer.style.opacity = '0';
      obsContainer.style.transform = 'translateY(15px)';
    }
  }

  animate();
  return { scene: city.scene, renderer, camera, city, player, agents, vehicles };
}

// ── Bootstrap ──────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = createSynapseCity();

    // Traffic light button
    const btnTL = document.getElementById('btn-traffic-light');
    if (btnTL) {
      btnTL.addEventListener('click', () => {
        const cur = app.city.trafficLights[0]?.state ?? 'red';
        const next: TrafficLightState = cur === 'red' ? 'green' : cur === 'green' ? 'yellow' : 'red';
        app.city.setAllTrafficLights(next);
        btnTL.innerHTML = `🚦 Semáforo: ${next.toUpperCase()}`;
      });
    }

    // Time cycle button
    let timeIdx = 0;
    const times: Array<'day' | 'sunset' | 'night'> = ['day', 'sunset', 'night'];
    const timeIcons = { day: '☀️ Dia', sunset: '🌅 Pôr do Sol', night: '🌙 Noite' };
    const btnTime = document.getElementById('btn-time-cycle');
    if (btnTime) {
      btnTime.addEventListener('click', () => {
        timeIdx = (timeIdx + 1) % times.length;
        const selected = times[timeIdx];
        app.city.setTimeOfDay(selected);
        btnTime.innerHTML = `${timeIcons[selected]}`;
      });
    }

    // Snapshot modal
    const btnSnap = document.getElementById('btn-snapshot');
    const modal = document.getElementById('snapshot-modal');
    const modalClose = document.getElementById('modal-close');
    const jsonOutput = document.getElementById('snapshot-json');
    if (btnSnap && modal && jsonOutput) {
      btnSnap.addEventListener('click', () => {
        const snap = {
          scenarioId: 'synapse-city-01',
          citizens: [{ id: 'player', position: { x: app.player.position.x, z: app.player.position.z } }],
          objects: app.city.interactiveObjects.length,
          agents: app.agents.length,
          timestamp: new Date().toISOString(),
        };
        jsonOutput.textContent = JSON.stringify(snap, null, 2);
        modal.classList.add('active');
      });
    }
    if (modalClose && modal) {
      modalClose.addEventListener('click', () => modal.classList.remove('active'));
    }
  });
}
