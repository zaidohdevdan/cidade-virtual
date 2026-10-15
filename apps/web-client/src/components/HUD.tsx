import React from 'react';
import { TrafficLightState, InteractiveObject } from '../scenes/city-scene';

interface HUDProps {
  agentCount: number;
  trafficLightState: TrafficLightState;
  onToggleTrafficLight: () => void;
  timeOfDay: 'day' | 'sunset' | 'night';
  onToggleTimeOfDay: () => void;
  observation: InteractiveObject | null;
  telemetry: { x: number; z: number; speedKmH: number };
  isFirstPerson: boolean;
  onOpenSnapshot: () => void;
  isSnapshotOpen: boolean;
  onCloseSnapshot: () => void;
  snapshotData: unknown;
}

export const HUD: React.FC<HUDProps> = ({
  agentCount,
  trafficLightState,
  onToggleTrafficLight,
  timeOfDay,
  onToggleTimeOfDay,
  observation,
  telemetry,
  isFirstPerson,
  onOpenSnapshot,
  isSnapshotOpen,
  onCloseSnapshot,
  snapshotData,
}) => {
  const tlBadgeColors: Record<TrafficLightState, { icon: string; text: string }> = {
    red: { icon: '🔴', text: 'RED' },
    yellow: { icon: '🟡', text: 'YELLOW' },
    green: { icon: '🟢', text: 'GREEN' },
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
              <span className="legend-icon legend-tl">🚦</span> Semáforo
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
            title="Alternar ciclo do semáforo"
          >
            🚦 Semáforo: {trafficLightState.toUpperCase()}
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
              <span className="telemetry-val" id="telemetry-coords">
                X: {telemetry.x.toFixed(1)}m | Z: {telemetry.z.toFixed(1)}m
              </span>
            </div>
            <div>
              Vel:{' '}
              <span className="telemetry-val" id="telemetry-speed">
                {telemetry.speedKmH.toFixed(1)} km/h
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
            Estado atual da cena retornado pela Tool de Percepção do Agente e sincronizado em tempo real.
          </p>
          <pre className="json-viewer">
            <code id="snapshot-json">{JSON.stringify(snapshotData, null, 2)}</code>
          </pre>
        </div>
      </div>
    </>
  );
};
