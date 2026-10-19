import React, { useEffect, useRef } from 'react';
import { TrafficLightState, InteractiveObject } from '../scenes/city-scene';
import { cityStore, useCityStore, TelemetryData } from '../store/city-store';

interface HUDProps {
  agentCount: number;
  trafficLightState?: TrafficLightState;
  onToggleTrafficLight: () => void;
  timeOfDay?: 'day' | 'sunset' | 'night';
  onToggleTimeOfDay: () => void;
  observation?: InteractiveObject | null;
  telemetry?: { x: number; z: number; speedKmH: number };
  isFirstPerson?: boolean;
  onOpenSnapshot: () => void;
  isSnapshotOpen: boolean;
  onCloseSnapshot: () => void;
  snapshotData?: unknown;
  nearbyAgent?: { id: string; name: string; role: string } | null;
  onOpenDialogue?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  agentCount,
  onToggleTrafficLight,
  onToggleTimeOfDay,
  onOpenSnapshot,
  isSnapshotOpen,
  onCloseSnapshot,
  snapshotData,
  nearbyAgent,
  onOpenDialogue,
}) => {
  // Subscrições reativas seletivas (só re-renderizam se o valor específico mudar)
  const trafficLightState = useCityStore((s) => s.trafficLightState);
  const timeOfDay = useCityStore((s) => s.timeOfDay);
  const observation = useCityStore((s) => s.observation);
  const isFirstPerson = useCityStore((s) => s.isFirstPerson);
  const isAudioMuted = useCityStore((s) => s.isAudioMuted);

  // Refs para atualização direta de telemetria no DOM a 60 FPS (zero re-render React)
  const coordsRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const unsubscribe = cityStore.subscribeTelemetryDirect((t: TelemetryData) => {
      if (coordsRef.current) {
        coordsRef.current.textContent = `X: ${t.x.toFixed(1)}m | Z: ${t.z.toFixed(1)}m`;
      }
      if (speedRef.current) {
        speedRef.current.textContent = `${t.speedKmH.toFixed(1)} km/h`;
      }
    });

    return unsubscribe;
  }, []);

  const tlBadgeColors: Record<TrafficLightState, { icon: string; text: string }> = {
    green: { icon: '🟢', text: 'AV. CENTRAL' },
    yellow: { icon: '🟡', text: 'ATENÇÃO (N-S)' },
    red: { icon: '🟢', text: 'TRANSVERSAL' },
  };

  const timeLabels = {
    day: '☀️ Dia',
    sunset: '🌅 Pôr do Sol',
    night: '🌙 Noite',
  };

  return (
    <>
      <div className="hud-overlay" id="hud-root">
        {/* ▌HEADER ▌ */}
        <header className="top-bar">
          <div className="brand-card">
            <div className="brand-title">
              <span className="brand-logo">⬡</span>
              <span>SYNAPSE CITY</span>
            </div>
            <div className="brand-subtitle" id="brand-subtitle">
              Ambiente Inicial — 5 Ruas | 1 Praça | 1 Comércio |{' '}
              <span id="agent-count">{agentCount}</span> Pessoas
            </div>
          </div>

          {/* Legenda */}
          <div className="legend-panel">
            <div className="legend-title">Legenda</div>
            <div className="legend-item">
              <span className="legend-icon legend-agent">🚶</span> Pessoa (Agente)
            </div>
            <div className="legend-item">
              <span className="legend-icon legend-vehicle">🚗</span> Veículo
            </div>
            <div className="legend-item">
              <span className="legend-icon legend-tl">🚦</span> Semáforos (DENATRAN)
              <span className="tl-badge" id="tl-status">
                {tlBadgeColors[trafficLightState].icon} {tlBadgeColors[trafficLightState].text}
              </span>
            </div>
            <div className="legend-item">
              <span className="legend-icon legend-sign">🪧</span> Placa / Sinalização
            </div>
            <div className="legend-item">
              <span className="legend-icon legend-poi">◆</span> Ponto de Interesse
            </div>
          </div>
        </header>

        {/* ▌CONTROLS ▌ */}
        <div className="controls-strip">
          <button
            className="action-btn"
            id="btn-traffic-light"
            onClick={onToggleTrafficLight}
            title="Alternar ciclo semafórico DENATRAN"
          >
            🚦 Semáforos: {trafficLightState === 'green' ? 'AV. CENTRAL' : trafficLightState === 'yellow' ? 'ATENÇÃO' : 'TRANSVERSAL'}
          </button>
          <button
            className="action-btn"
            id="btn-time-cycle"
            onClick={onToggleTimeOfDay}
            title="Alternar hora do dia"
          >
            {timeLabels[timeOfDay]}
          </button>
          <button
            className="action-btn"
            id="btn-snapshot"
            onClick={onOpenSnapshot}
            title="Exportar estado da cena"
          >
            📸 Snapshot
          </button>
          <button
            className="action-btn"
            id="btn-audio-mute"
            onClick={() => cityStore.toggleAudioMute()}
            title={isAudioMuted ? 'Ativar voz dos cidadãos (TTS)' : 'Silenciar voz dos cidadãos (TTS)'}
            style={{
              borderColor: isAudioMuted ? 'rgba(239, 68, 68, 0.45)' : 'rgba(16, 185, 129, 0.45)',
              color: isAudioMuted ? '#f87171' : '#34d399',
            }}
          >
            {isAudioMuted ? '🔇 Voz: Mudo' : '🔊 Voz: Ativa'}
          </button>
        </div>

        {/* ▌OBSERVATION PANEL ▌ */}
        <div
          className="observation-container"
          id="observation-container"
          style={{
            opacity: observation ? 1 : 0,
            transform: observation ? 'translateY(0)' : 'translateY(15px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
          }}
        >
          {observation && (
            <div className="observation-card">
              <div className="obs-header">
                <div className="obs-tag">👁️ PERCEPÇÃO SEMÂNTICA</div>
                <div className="obs-weight" id="obs-weight">
                  Peso Emocional: {(observation.emotionalWeight * 100).toFixed(0)}%
                </div>
              </div>
              <div className="obs-title" id="obs-title">
                {observation.name}
              </div>
              <div className="obs-desc" id="obs-desc">
                {observation.description}
              </div>
              <div className="obs-rule-box">
                <div className="obs-rule-label">Regra Semântica (Memória)</div>
                <div className="obs-rule-text" id="obs-rule-text">
                  {observation.semanticRule}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ▌FOOTER ▌ */}
        <footer className="bottom-bar">
          <div className="controls-help">
            <div>
              <span className="key-badge">W</span>
              <span className="key-badge">A</span>
              <span className="key-badge">S</span>
              <span className="key-badge">D</span> Mover
            </div>
            <div>
              <span className="key-badge">Shift</span> Correr
            </div>
            <div>
              <span className="key-badge">E</span> Conversar
            </div>
            <div>
              <span className="key-badge">M</span> Voz
            </div>
            <div>
              <span className="key-badge">Drag</span> Câmera
            </div>
            <div>
              <span className="key-badge">Scroll</span> Zoom
            </div>
            <div>
              <span className="key-badge">C</span>{' '}
              <span id="camera-mode-text">{isFirstPerson ? '1ª Pessoa' : 'Isométrica'}</span>
            </div>
          </div>

          <div className="compass">
            <span className="compass-n">N</span>
            <span className="compass-arrow">↑</span>
          </div>

          <div className="telemetry-card">
            <div>
              Pos:{' '}
              <span className="telemetry-val" id="telemetry-coords" ref={coordsRef}>
                X: 8.5m | Z: 12.0m
              </span>
            </div>
            <div>
              Vel:{' '}
              <span className="telemetry-val" id="telemetry-speed" ref={speedRef}>
                0.0 km/h
              </span>
            </div>
            <div className="brand-footer">◆ SYNAPSE CITY</div>
          </div>
        </footer>

        <div className="city-tagline">Uma pequena cidade. Muitas histórias. Um grande potencial.</div>
      </div>

      {/* ▌SNAPSHOT MODAL ▌ */}
      <div className={`modal-backdrop ${isSnapshotOpen ? 'active' : ''}`} id="snapshot-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title">📸 getSceneSnapshot()</h2>
            <button className="modal-close-btn" id="modal-close" onClick={onCloseSnapshot}>
              &times;
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
            Estado atual da cena retornado pela Tool de Percepção do Agente e sincronizado sob demanda.
          </p>
          <pre className="json-viewer">
            <code id="snapshot-json">
              {isSnapshotOpen ? JSON.stringify(snapshotData, null, 2) : ''}
            </code>
          </pre>
        </div>
      </div>

      {/* ▌PROXIMIDADE COM HABITANTE AUTÔNOMO ▌ */}
      {nearbyAgent && (
        <div
          className="dialogue-prompt-card"
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.92))',
            border: '1.5px solid rgba(56, 189, 248, 0.7)',
            borderRadius: '28px',
            padding: '10px 22px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 95,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'transform 0.15s ease',
          }}
          onClick={onOpenDialogue}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateX(-50%) scale(1.03)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateX(-50%) scale(1.0)')}
          title="Conversar com o habitante"
        >
          <span style={{ fontSize: '18px' }}>💬</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
            Pressione <span style={{ background: '#0284c7', padding: '2px 8px', borderRadius: '6px', color: '#fff', fontWeight: 700 }}>E</span> ou clique para conversar com <strong>{nearbyAgent.name}</strong> ({nearbyAgent.role})
          </span>
        </div>
      )}
    </>
  );
};
