import { useSyncExternalStore } from 'react';
import type { TrafficLightState, InteractiveObject } from '../scenes/city-scene';
import { speechSynth } from '../audio/speech-synth';

export interface TelemetryData {
  x: number;
  z: number;
  speedKmH: number;
}

export interface CityStoreState {
  telemetry: TelemetryData;
  observation: InteractiveObject | null;
  trafficLightState: TrafficLightState;
  timeOfDay: 'day' | 'sunset' | 'night';
  isFirstPerson: boolean;
  cameraAngleY: number;
  isConnected: boolean;
  isAudioMuted: boolean;
}

type Listener = () => void;

class CityStore {
  private state: CityStoreState = {
    telemetry: { x: 8.5, z: 12.0, speedKmH: 0 },
    observation: null,
    trafficLightState: 'green',
    timeOfDay: 'day',
    isFirstPerson: false,
    cameraAngleY: 0,
    isConnected: false,
    isAudioMuted: false,
  };

  private listeners: Set<Listener> = new Set();
  private telemetryDOMSubscribers: Set<(t: TelemetryData) => void> = new Set();

  getState = (): CityStoreState => {
    return this.state;
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Permite subscrição direta para updates a 60 FPS (DOM update sem reconciliação React).
   */
  subscribeTelemetryDirect = (sub: (t: TelemetryData) => void): (() => void) => {
    this.telemetryDOMSubscribers.add(sub);
    return () => {
      this.telemetryDOMSubscribers.delete(sub);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  // ── Ações Finas ──

  updateTelemetry(x: number, z: number, speedKmH: number) {
    this.state.telemetry = { x, z, speedKmH };
    // Notifica diretamente quem atualiza DOM a 60 FPS (sem acionar listeners do React)
    for (const sub of this.telemetryDOMSubscribers) {
      sub(this.state.telemetry);
    }
  }

  setObservation(obs: InteractiveObject | null) {
    if (this.state.observation?.id !== obs?.id) {
      this.state = { ...this.state, observation: obs };
      this.notify();
    }
  }

  setTrafficLightState(trafficLightState: TrafficLightState) {
    if (this.state.trafficLightState !== trafficLightState) {
      this.state = { ...this.state, trafficLightState };
      this.notify();
    }
  }

  setTimeOfDay(timeOfDay: 'day' | 'sunset' | 'night') {
    if (this.state.timeOfDay !== timeOfDay) {
      this.state = { ...this.state, timeOfDay };
      this.notify();
    }
  }

  setIsFirstPerson(isFirstPerson: boolean) {
    if (this.state.isFirstPerson !== isFirstPerson) {
      this.state = { ...this.state, isFirstPerson };
      this.notify();
    }
  }

  setCameraAngleY(cameraAngleY: number) {
    if (this.state.cameraAngleY !== cameraAngleY) {
      this.state = { ...this.state, cameraAngleY };
      this.notify();
    }
  }

  setIsConnected(isConnected: boolean) {
    if (this.state.isConnected !== isConnected) {
      this.state = { ...this.state, isConnected };
      this.notify();
    }
  }

  setAudioMuted(isAudioMuted: boolean) {
    if (this.state.isAudioMuted !== isAudioMuted) {
      this.state = { ...this.state, isAudioMuted };
      speechSynth.setMuted(isAudioMuted);
      this.notify();
    }
  }

  toggleAudioMute(): boolean {
    const next = !this.state.isAudioMuted;
    this.setAudioMuted(next);
    return next;
  }
}

export const cityStore = new CityStore();

/**
 * Hook com seletor refinado usando useSyncExternalStore do React 18.
 * Só dispara re-render se o valor retornado pelo selector mudar!
 */
export function useCityStore<T>(selector: (state: CityStoreState) => T): T {
  return useSyncExternalStore(
    cityStore.subscribe,
    () => selector(cityStore.getState()),
    () => selector(cityStore.getState()),
  );
}
