// apps/web/src/index.ts
import * as THREE from 'three';
import { StreetScene, TrafficLightState, InteractiveObject } from './scenes/street-scene';
import { DanielAvatar } from './avatars/daniel-avatar';
import { CameraControls } from './controls/camera-controls';
import type { SceneSnapshot, CitizenId } from '@cidade-virtual/types';

export function createVirtualCityScene(): {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  avatar: DanielAvatar;
  street: StreetScene;
  controls: CameraControls;
  getSnapshot: () => SceneSnapshot;
} {
  const container = document.getElementById('canvas-container');
  if (!container) {
    throw new Error('Element #canvas-container not found in DOM.');
  }

  // 1. Inicializa Renderer Three.js
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // 2. Câmera
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);

  // 3. Cena e Elementos
  const street = new StreetScene();
  const avatar = new DanielAvatar();
  street.scene.add(avatar.mesh);

  // 4. Controles de Câmera e Teclado
  const controls = new CameraControls(camera, renderer.domElement);

  // 5. Redimensionamento responsivo
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 6. Ciclo do Semáforo automático (a cada 10s alterna para dar vida urbana)
  let trafficLightTimer = 0;
  const trafficStates: TrafficLightState[] = ['red', 'green', 'yellow'];
  let currentTrafficIdx = 0;

  // 7. Elementos de HUD
  const obsContainer = document.getElementById('observation-container');
  const obsTitle = document.getElementById('obs-title');
  const obsDesc = document.getElementById('obs-desc');
  const obsRuleText = document.getElementById('obs-rule-text');
  const obsWeight = document.getElementById('obs-weight');
  const telemetryCoords = document.getElementById('telemetry-coords');
  const telemetrySpeed = document.getElementById('telemetry-speed');
  const cameraModeText = document.getElementById('camera-mode-text');

  // Relógio Three.js
  const clock = new THREE.Clock();

  // Função para gerar Snapshot da Cena conforme contrato da Tool getSceneSnapshotTool
  const getSnapshot = (): SceneSnapshot => {
    return {
      scenarioId: 'rua-central-01',
      citizens: [
        {
          id: '00000000-0000-0000-0000-000000000001' as CitizenId,
          position: {
            lat: avatar.position.x,
            lng: avatar.position.z,
            altitude: avatar.position.y,
          },
          emotion: 'curious',
        },
      ],
      objects: street.interactiveObjects.map((obj) => ({
        id: obj.id,
        type: obj.type,
        position: {
          lat: obj.position.x,
          lng: obj.position.z,
          altitude: obj.position.y,
        },
      })),
      weather: 'clear',
      timeOfDay: 14,
    };
  };

  // 8. Loop de animação
  function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    // Ciclo automático do semáforo
    trafficLightTimer += delta;
    if (trafficLightTimer > 12) {
      trafficLightTimer = 0;
      currentTrafficIdx = (currentTrafficIdx + 1) % trafficStates.length;
      street.setTrafficLight(trafficStates[currentTrafficIdx]);
      const btn = document.getElementById('btn-traffic-light');
      if (btn) {
        btn.innerHTML = `🚦 Semáforo: ${street.trafficLightState.toUpperCase()}`;
      }
    }

    // Atualiza avatar com inputs
    avatar.update(delta, controls.input, controls.cameraAngleY);

    // Atualiza câmera
    controls.update(avatar.position, delta);

    // Renderiza
    renderer.render(street.scene, camera);

    // Atualiza telemetria no HUD
    if (telemetryCoords) {
      telemetryCoords.textContent = `X: ${avatar.position.x.toFixed(1)}m | Z: ${avatar.position.z.toFixed(1)}m`;
    }
    if (telemetrySpeed) {
      telemetrySpeed.textContent = `${(avatar.speed * 3.6).toFixed(1)} km/h`;
    }
    if (cameraModeText) {
      cameraModeText.textContent = controls.isFirstPerson ? '1ª Pessoa' : '3ª Pessoa';
    }

    // 9. Sensor de Observação Semântica (RAG / Online Learning)
    let closestObject: InteractiveObject | null = null;
    let minDistance = Infinity;

    for (const obj of street.interactiveObjects) {
      const dist = avatar.position.distanceTo(obj.position);
      if (dist <= obj.observationRadius && dist < minDistance) {
        minDistance = dist;
        closestObject = obj;
      }
    }

    if (closestObject && obsContainer && obsTitle && obsDesc && obsRuleText && obsWeight) {
      obsContainer.style.opacity = '1';
      obsContainer.style.transform = 'translateY(0)';
      obsTitle.textContent = closestObject.name;
      obsDesc.textContent = closestObject.description;
      obsRuleText.textContent = closestObject.semanticRule;
      obsWeight.textContent = `Peso Emocional: ${(closestObject.emotionalWeight * 100).toFixed(0)}%`;
    } else if (obsContainer) {
      obsContainer.style.opacity = '0';
      obsContainer.style.transform = 'translateY(15px)';
    }
  }

  animate();

  return { scene: street.scene, renderer, camera, avatar, street, controls, getSnapshot };
}

// Inicializa automaticamente no navegador
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = createVirtualCityScene();

    // Configura botões de controle God Mode
    const btnTraffic = document.getElementById('btn-traffic-light');
    if (btnTraffic) {
      btnTraffic.addEventListener('click', () => {
        const nextState =
          app.street.trafficLightState === 'red'
            ? 'green'
            : app.street.trafficLightState === 'green'
            ? 'yellow'
            : 'red';
        app.street.setTrafficLight(nextState);
        btnTraffic.innerHTML = `🚦 Semáforo: ${nextState.toUpperCase()}`;
      });
    }

    let timeIdx = 0;
    const times: Array<'day' | 'sunset' | 'night'> = ['day', 'sunset', 'night'];
    const timeIcons = { day: '☀️ Dia', sunset: '🌅 Pôr do Sol', night: '🌙 Noite' };
    const btnTime = document.getElementById('btn-time-cycle');
    if (btnTime) {
      btnTime.addEventListener('click', () => {
        timeIdx = (timeIdx + 1) % times.length;
        const selected = times[timeIdx];
        app.street.setTimeOfDay(selected);
        btnTime.innerHTML = `Clima/Hora: ${timeIcons[selected]}`;
      });
    }

    // Modal de Snapshot
    const btnSnapshot = document.getElementById('btn-snapshot');
    const modal = document.getElementById('snapshot-modal');
    const modalClose = document.getElementById('modal-close');
    const jsonOutput = document.getElementById('snapshot-json');

    if (btnSnapshot && modal && jsonOutput) {
      btnSnapshot.addEventListener('click', () => {
        const snap = app.getSnapshot();
        jsonOutput.textContent = JSON.stringify(snap, null, 2);
        modal.classList.add('active');
      });
    }

    if (modalClose && modal) {
      modalClose.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }
  });
}
