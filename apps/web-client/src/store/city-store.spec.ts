import { describe, it, expect, vi } from 'vitest';
import { cityStore, TelemetryData } from './city-store';

describe('CityStore — Store Externo Reativo (Task-023)', () => {
  it('deve inicializar com o estado padrão da cidade', () => {
    const state = cityStore.getState();
    expect(state.telemetry).toEqual({ x: 8.5, z: 12.0, speedKmH: 0 });
    expect(state.trafficLightState).toBe('green');
    expect(state.timeOfDay).toBe('day');
    expect(state.isFirstPerson).toBe(false);
  });

  it('deve despachar telemetria para subscrições diretas a 60 FPS sem notificar listeners React', () => {
    const directListener = vi.fn();
    const reactListener = vi.fn();

    const unsubDirect = cityStore.subscribeTelemetryDirect(directListener);
    const unsubReact = cityStore.subscribe(reactListener);

    cityStore.updateTelemetry(10.2, 15.4, 25.0);

    expect(directListener).toHaveBeenCalledWith({
      x: 10.2,
      z: 15.4,
      speedKmH: 25.0,
    });
    // O listener do React NÃO deve ser chamado a cada frame de telemetria
    expect(reactListener).not.toHaveBeenCalled();

    unsubDirect();
    unsubReact();
  });

  it('deve notificar listeners apenas quando a observação semântica mudar', () => {
    const listener = vi.fn();
    const unsub = cityStore.subscribe(listener);

    const mockObj = {
      id: 'sign-1',
      name: 'Placa',
      type: 'sign' as const,
      position: null as any,
      observationRadius: 5,
      description: 'Placa de trânsito',
      semanticRule: 'Pare',
      emotionalWeight: 0.5,
    };

    cityStore.setObservation(mockObj);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(cityStore.getState().observation?.id).toBe('sign-1');

    // Chamar com o mesmo objeto ID não deve duplicar notificações
    cityStore.setObservation({ ...mockObj });
    expect(listener).toHaveBeenCalledTimes(1);

    cityStore.setObservation(null);
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('deve alterar o ciclo do semáforo e a hora do dia', () => {
    cityStore.setTrafficLightState('yellow');
    expect(cityStore.getState().trafficLightState).toBe('yellow');

    cityStore.setTimeOfDay('night');
    expect(cityStore.getState().timeOfDay).toBe('night');
  });

  it('deve alternar o estado de áudio mudo e notificar listeners', () => {
    const listener = vi.fn();
    const unsub = cityStore.subscribe(listener);

    expect(cityStore.getState().isAudioMuted).toBe(false);

    const isMutedNow = cityStore.toggleAudioMute();
    expect(isMutedNow).toBe(true);
    expect(cityStore.getState().isAudioMuted).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    cityStore.setAudioMuted(false);
    expect(cityStore.getState().isAudioMuted).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });
});
