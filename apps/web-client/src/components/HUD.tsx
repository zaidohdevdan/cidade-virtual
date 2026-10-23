import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  onOpenAvatarCustomizer?: () => void;
  currentUser?: { displayName?: string; email?: string } | null;
  isGuest?: boolean;
  onOpenLogin?: () => void;

  // Task-045: Navegação até a loja / box
  onNavigateToStore?: (storeSlug: string) => void;
  onTeleportToStore?: (storeSlug: string) => void;
  activeNavigationStore?: { id: string; name: string; addressBox: string } | null;
  onCancelNavigation?: () => void;

  // Task-046: Interior da TomPets
  isInsideStore?: boolean;
  onEnterStore?: () => void;
  onExitStore?: () => void;
  onTalkToTom?: () => void;
  onToggleFirstPerson?: () => void;
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
  onOpenAvatarCustomizer,
  currentUser,
  isGuest,
  onOpenLogin,
  onNavigateToStore,
  onTeleportToStore,
  activeNavigationStore,
  onCancelNavigation,
  isInsideStore,
  onEnterStore,
  onExitStore,
  onTalkToTom,
  onToggleFirstPerson,
}) => {
  // Subscrições reativas seletivas (só re-renderizam se o valor específico mudar)
  const trafficLightState = useCityStore((s) => s.trafficLightState);
  const timeOfDay = useCityStore((s) => s.timeOfDay);
  const observation = useCityStore((s) => s.observation);
  const isFirstPerson = useCityStore((s) => s.isFirstPerson);
  const isAudioMuted = useCityStore((s) => s.isAudioMuted);

  // Estados de busca de lojas e endereço de box (Task-045)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [foundStore, setFoundStore] = useState<{ id: string; name: string; slug: string; addressBox: string } | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

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

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFoundStore(null);
      setSearchFeedback(null);
      return;
    }

    // Busca loja cadastrada (TomPets - Alameda das Nações, Box 04)
    if (
      q.includes('04') ||
      q.includes('box') ||
      q.includes('tompets') ||
      q.includes('pet') ||
      q.includes('alameda') ||
      q.includes('nacoes') ||
      q.includes('nações')
    ) {
      setFoundStore({
        id: 'store-tompets',
        name: 'TomPets',
        slug: 'tompets',
        addressBox: 'Alameda das Nações, Box 04',
      });
      setSearchFeedback(null);
    } else {
      // Feedback claro e amigável para endereço inexistente (sem crash)
      setFoundStore(null);
      setSearchFeedback(`Endereço "${searchQuery}" não encontrado em Synapse City. Verifique o número do box ou link informado pelo vendedor.`);
    }
  }, [searchQuery]);

  const handleCopyStoreLink = useCallback((slug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cidade-virtual.local';
    const link = `${origin}/?store=${slug}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link);
    }
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
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

          {/* Banner de Loja Ativa (Quando o usuário estiver no interior do Box 04 TomPets - Task-046) */}
          {isInsideStore && (
            <div className="store-interior-banner" id="store-interior-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>🐾</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffd000', letterSpacing: '0.5px' }}>
                    TOMPETS • BOX 04 (ALAMEDA DAS NAÇÕES)
                  </div>
                  <div style={{ fontSize: '11px', color: '#e2e8f0' }}>
                    Vendedor Tom on-duty | Preços em 3D nas prateleiras | XR-Ready
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginLeft: '20px' }}>
                <button
                  className="action-btn"
                  id="btn-toggle-camera-interior"
                  onClick={onToggleFirstPerson}
                  style={{
                    background: isFirstPerson ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)',
                    borderColor: '#38bdf8',
                    color: isFirstPerson ? '#0f172a' : '#38bdf8',
                    fontWeight: 800,
                  }}
                  title="Alternar entre câmera em 1ª Pessoa (altura dos olhos) e 3ª Pessoa (ombro)"
                >
                  👁️ {isFirstPerson ? '1ª Pessoa' : '3ª Pessoa'} (C)
                </button>
                <button
                  className="action-btn"
                  id="btn-talk-tom-header"
                  onClick={onTalkToTom}
                  style={{
                    background: '#0f2c59',
                    borderColor: '#ffd000',
                    color: '#ffd000',
                    fontWeight: 700,
                  }}
                  title="Falar com o vendedor Tom"
                >
                  💬 Falar com Tom
                </button>
                <button
                  className="action-btn"
                  id="btn-exit-store-header"
                  onClick={onExitStore}
                  style={{
                    background: '#ef4444',
                    borderColor: '#ffffff',
                    color: '#ffffff',
                    fontWeight: 700,
                  }}
                  title="Sair da loja e voltar para a Alameda das Nações"
                >
                  🚪 Sair para a Rua
                </button>
              </div>
            </div>
          )}

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
              <span className="legend-icon legend-sign">🪧</span> Placa / Box
            </div>
            <div className="legend-item">
              <span className="legend-icon legend-poi">◆</span> Ponto de Interesse
            </div>
          </div>
        </header>

        {/* ▌CONTROLS STRIP ▌ */}
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
          <button
            className="action-btn"
            id="btn-login-welcome"
            onClick={onOpenLogin}
            title={currentUser?.email ? `Conectado como ${currentUser.displayName || currentUser.email}` : 'Entrar com Google ou como Visitante'}
            style={{
              borderColor: currentUser?.email ? 'rgba(56, 189, 248, 0.45)' : 'rgba(2, 132, 199, 0.45)',
              color: currentUser?.email ? '#38bdf8' : '#7dd3fc',
              background: currentUser?.email ? 'rgba(56, 189, 248, 0.12)' : undefined,
            }}
          >
            {currentUser?.email ? `👤 ${currentUser.displayName || 'Daniel'}` : isGuest ? '🚀 Visitante' : '🔑 Entrar'}
          </button>
          <button
            className="action-btn"
            id="btn-avatar-customizer"
            onClick={onOpenAvatarCustomizer}
            title="Personalizar Cores e Acessórios do Avatar"
            style={{
              borderColor: 'rgba(255, 208, 0, 0.45)',
              color: '#FFD000',
            }}
          >
            🎨 Avatar
          </button>

          {/* Campo de Busca por Endereço de Box / Loja (Task-045) */}
          {!isInsideStore && (
            <form onSubmit={handleSearchSubmit} className="store-search-container" id="store-search-form">
              <span style={{ fontSize: '15px' }}>🔍</span>
              <input
                type="text"
                className="store-search-input"
                id="store-search-input"
                placeholder="Buscar box ou loja (ex: Box 04)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchFeedback) setSearchFeedback(null);
                }}
              />
              <button type="submit" className="store-search-btn" id="btn-search-store">
                Buscar
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFoundStore(null);
                    setSearchFeedback(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  &times;
                </button>
              )}
            </form>
          )}
        </div>

        {/* ▌PAINEL FLUTUANTE DE RESULTADO DE BUSCA / GUIA DE ROTA (TASK-045) ▌ */}
        {foundStore && !isInsideStore && (
          <div
            className="store-route-card"
            id="store-search-result-card"
            style={{
              position: 'absolute',
              top: '115px',
              left: '18px',
              zIndex: 90,
            }}
          >
            <span style={{ fontSize: '28px' }}>🐾</span>
            <div>
              <div style={{ fontSize: '11px', color: '#ffd000', fontWeight: 800 }}>LOJA ENCONTRADA</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                {foundStore.name} — {foundStore.addressBox}
              </div>
              <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '2px' }}>
                Piloto Petz | Alimentos Super Premium e Semi-Novos
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
              <button
                className="store-search-btn"
                id="btn-trace-route"
                onClick={() => onNavigateToStore?.(foundStore.slug)}
                title="Mostrar linha de navegação guiada até a porta da loja"
              >
                📍 Traçar Rota
              </button>
              <button
                className="store-search-btn"
                id="btn-teleport-store"
                onClick={() => onTeleportToStore?.(foundStore.slug)}
                style={{ background: '#ff7a00', color: '#ffffff', borderColor: '#ffffff' }}
                title="Teleportar avatar diretamente em frente ao Box 04"
              >
                ⚡ Teleportar
              </button>
              <button
                className="store-search-btn"
                id="btn-copy-link"
                onClick={() => handleCopyStoreLink(foundStore.slug)}
                style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderColor: '#94a3b8' }}
                title="Copiar link compartilhável para WhatsApp ou Instagram"
              >
                🔗 Link
              </button>
            </div>
          </div>
        )}

        {/* Feedback amigável para endereço inexistente (sem erro/crash) */}
        {searchFeedback && !isInsideStore && (
          <div
            id="search-feedback-banner"
            style={{
              position: 'absolute',
              top: '115px',
              left: '18px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
              border: '1.5px solid rgba(239, 68, 68, 0.7)',
              borderRadius: '12px',
              padding: '10px 16px',
              color: '#f8fafc',
              fontSize: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              pointerEvents: 'auto',
              maxWidth: '480px',
            }}
          >
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span>{searchFeedback}</span>
            <button
              onClick={() => setSearchFeedback(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '16px',
                marginLeft: 'auto',
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Alerta de Link Copiado */}
        {copiedToast && (
          <div
            id="toast-copied"
            style={{
              position: 'absolute',
              top: '175px',
              left: '18px',
              background: '#10b981',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }}
          >
            ✓ Link da loja copiado! Pronto para enviar no WhatsApp ou Instagram.
          </div>
        )}

        {/* Indicador de Rota Ativa com Botão de Cancelar */}
        {activeNavigationStore && !isInsideStore && (
          <div
            id="active-route-indicator"
            style={{
              position: 'absolute',
              top: foundStore ? '185px' : '115px',
              left: '18px',
              background: 'linear-gradient(135deg, rgba(0, 76, 191, 0.9), rgba(15, 44, 89, 0.9))',
              border: '1.5px solid #00e5ff',
              borderRadius: '12px',
              padding: '8px 14px',
              color: '#ffffff',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 6px 20px rgba(0, 229, 255, 0.3)',
              pointerEvents: 'auto',
            }}
          >
            <span>🧭</span>
            <span>
              Rota ativa para: <strong>{activeNavigationStore.name}</strong> ({activeNavigationStore.addressBox})
            </span>
            <button
              onClick={onCancelNavigation}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                marginLeft: '8px',
              }}
              title="Cancelar rota guiada"
            >
              Cancelar
            </button>
          </div>
        )}

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

              {observation.id === 'store-tompets' && onEnterStore && (
                <button
                  id="btn-enter-store-prompt"
                  onClick={onEnterStore}
                  style={{
                    marginTop: '12px',
                    width: '100%',
                    background: 'linear-gradient(135deg, #004cbf, #0f2c59)',
                    border: '2px solid #ffd000',
                    color: '#ffd000',
                    fontWeight: 800,
                    fontSize: '13px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(0, 76, 191, 0.4)',
                  }}
                  title="Entrar na loja TomPets Box 04"
                >
                  🐾 Entrar na Loja TomPets (Box 04)
                </button>
              )}
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
      {
        nearbyAgent && (
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
        )
      }
    </>
  );
};
