// apps/web-client/src/audio/speech-synth.ts
/**
 * Módulo de Síntese de Voz (TTS) em Português (pt-BR)
 * Utiliza a Web Speech API nativa (window.speechSynthesis) com calibração acústica
 * de pitch, velocidade (rate) e perfis vocais distintos para o cidadão canônico do MVP (Sulafat).
 */

export interface AgentVoiceProfile {
  pitch: number;
  rate: number;
  preferredGender?: 'female' | 'male' | 'neutral';
  lang: string;
  description: string;
}

export const CITIZEN_VOICE_PROFILES: Record<string, AgentVoiceProfile> = {
  'agent-sulafat': {
    pitch: 0.88,
    rate: 0.95,
    preferredGender: 'male',
    lang: 'pt-BR',
    description: 'Voz masculina calma, ponderada e zelosa (Zelador Urbano)',
  },
};

const DEFAULT_PROFILE: AgentVoiceProfile = {
  pitch: 1.0,
  rate: 1.0,
  preferredGender: 'neutral',
  lang: 'pt-BR',
  description: 'Voz padrão de habitante da Cidade Virtual',
};

export class SpeechSynthesizer {
  private muted: boolean = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    const loadVoices = () => {
      this.cachedVoices = window.speechSynthesis.getVoices();
      if (this.cachedVoices.length > 0) {
        this.voicesLoaded = true;
      }
    };

    loadVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.muted) {
      this.stop();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Higieniza o texto removendo emojis, marcadores visuais e pontuação técnica
   * para uma pronúncia suave e natural sem leitura de códigos UTF ou termos como "emoji de carro".
   */
  public cleanText(text: string): string {
    if (!text) return '';

    return text
      // Remove emojis conhecidos e blocos unicode de símbolos/pictogramas
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      // Remove seletores de variação, zero-width joiners e símbolos diversos
      .replace(/[\u200B-\u200D\uFE00-\uFE0F]/g, '')
      .replace(/[💬⚠️🚦🟢🟡🔴🚶🚗🪧◆📸☀️🌅🌙👁️⬡]/g, '')
      // Remove marcações markdown comuns
      .replace(/[*_#`~]/g, '')
      // Normaliza espaços múltiplos
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Localiza a melhor voz compatível no navegador para o perfil do cidadão.
   */
  private pickVoice(profile: AgentVoiceProfile): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;

    const voices = this.cachedVoices.length > 0
      ? this.cachedVoices
      : window.speechSynthesis.getVoices();

    if (voices.length === 0) return null;

    // Filtra vozes em português brasileiro
    const ptBrVoices = voices.filter(
      (v) => v.lang.toLowerCase().replace('_', '-') === 'pt-br' || v.lang.toLowerCase().startsWith('pt'),
    );

    const candidates = ptBrVoices.length > 0 ? ptBrVoices : voices;

    if (profile.preferredGender === 'female') {
      const femaleVoice = candidates.find((v) =>
        /female|mulher|luciana|maria|vitória|francisca|yara|leticia|camila/i.test(v.name),
      );
      if (femaleVoice) return femaleVoice;
    } else if (profile.preferredGender === 'male') {
      const maleVoice = candidates.find((v) =>
        /male|homem|daniel|jorge|felipe|ricardo|antonio|gabriel/i.test(v.name),
      );
      if (maleVoice) return maleVoice;
    }

    // Retorna a melhor voz em pt-BR padrão ou a primeira disponível
    return ptBrVoices[0] || candidates[0] || null;
  }

  /**
   * Pronuncia a fala do habitante através da Web Speech API.
   * Retorna Promise<boolean> indicando se a emissão foi enviada para reprodução.
   */
  public async speak(agentId: string, rawText: string): Promise<boolean> {
    if (this.muted || !this.isSupported()) {
      return false;
    }

    const cleaned = this.cleanText(rawText);
    if (!cleaned) {
      return false;
    }

    const profile = CITIZEN_VOICE_PROFILES[agentId] || DEFAULT_PROFILE;

    // Cancela falas anteriores para não acumular fila defasada
    window.speechSynthesis.cancel();

    try {
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = profile.lang;
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;

      const voice = this.pickVoice(profile);
      if (voice) {
        utterance.voice = voice;
      }

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[SpeechSynthesizer] Falha ao sintetizar fala:', err);
      return false;
    }
  }
}

// Instância singleton para uso em todo o web-client
export const speechSynth = new SpeechSynthesizer();
