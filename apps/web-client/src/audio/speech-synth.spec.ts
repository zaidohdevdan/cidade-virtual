// apps/web-client/src/audio/speech-synth.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SpeechSynthesizer,
  CITIZEN_VOICE_PROFILES,
} from './speech-synth';

describe('SpeechSynthesizer (Web Speech API TTS)', () => {
  let synth: SpeechSynthesizer;
  let mockSpeechSynthesis: any;
  let mockUtteranceConstructor: any;
  let spokenUtterances: any[];

  beforeEach(() => {
    spokenUtterances = [];

    mockSpeechSynthesis = {
      speak: vi.fn((utterance: any) => {
        spokenUtterances.push(utterance);
      }),
      cancel: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'Google Português do Brasil (Luciana)', lang: 'pt-BR' },
        { name: 'Microsoft Daniel - Portuguese (Brazil)', lang: 'pt-BR' },
        { name: 'English United States', lang: 'en-US' },
      ]),
      onvoiceschanged: null,
    };

    mockUtteranceConstructor = vi.fn(function (this: any, text: string) {
      this.text = text;
      this.lang = 'pt-BR';
      this.pitch = 1.0;
      this.rate = 1.0;
      this.voice = null;
    });

    (globalThis as any).window = {
      speechSynthesis: mockSpeechSynthesis,
      SpeechSynthesisUtterance: mockUtteranceConstructor,
    };
    (globalThis as any).SpeechSynthesisUtterance = mockUtteranceConstructor;

    synth = new SpeechSynthesizer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve possuir perfis acústicos únicos para o cidadão canônico (Sulafat)', () => {
    const requiredAgents = ['agent-sulafat'];

    for (const agentId of requiredAgents) {
      const profile = CITIZEN_VOICE_PROFILES[agentId];
      expect(profile).toBeDefined();
      expect(profile.pitch).toBeGreaterThan(0.5);
      expect(profile.pitch).toBeLessThan(1.5);
      expect(profile.rate).toBeGreaterThan(0.7);
      expect(profile.rate).toBeLessThan(1.4);
      expect(profile.lang).toBe('pt-BR');
    }
  });

  it('roster de vozes deve conter somente Sulafat', () => {
    expect(Object.keys(CITIZEN_VOICE_PROFILES)).toEqual(['agent-sulafat']);
    expect(CITIZEN_VOICE_PROFILES['agent-sulafat'].pitch).toBeLessThan(1.0);
  });

  it('deve higienizar emojis e formatação markdown no cleanText', () => {
    const raw = '💬 Olá **Daniel**! 🚦 Atenção na *faixa* de pedestres 🚶‍♂️!';
    const cleaned = synth.cleanText(raw);

    expect(cleaned).toBe('Olá Daniel! Atenção na faixa de pedestres !');
    expect(cleaned).not.toContain('💬');
    expect(cleaned).not.toContain('🚦');
    expect(cleaned).not.toContain('🚶');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('*');
  });

  it('deve sintetizar fala e configurar pitch/rate do cidadão correspondente', async () => {
    const success = await synth.speak('agent-sulafat', 'Atenção na travessia urbana.');
    expect(success).toBe(true);
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();

    const utterance = spokenUtterances[0];
    expect(utterance).toBeDefined();
    expect(utterance.text).toBe('Atenção na travessia urbana.');
    expect(utterance.pitch).toBe(CITIZEN_VOICE_PROFILES['agent-sulafat'].pitch);
    expect(utterance.rate).toBe(CITIZEN_VOICE_PROFILES['agent-sulafat'].rate);
    expect(utterance.voice?.name).toContain('Daniel');
  });

  it('deve selecionar voz masculina para Sulafat', async () => {
    await synth.speak('agent-sulafat', 'Vamos manter a praça limpa!');
    const utterance = spokenUtterances[0];
    expect(utterance.voice?.name).toContain('Daniel');
  });

  it('deve respeitar modo mudo e não invocar speechSynthesis.speak', async () => {
    synth.setMuted(true);
    expect(synth.isMuted()).toBe(true);

    const success = await synth.speak('agent-sulafat', 'Bora pro skatepark!');
    expect(success).toBe(false);
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();

    // Reativa o som
    synth.toggleMute();
    expect(synth.isMuted()).toBe(false);

    const successAfterUnmute = await synth.speak('agent-sulafat', 'Bora pro skatepark!');
    expect(successAfterUnmute).toBe(true);
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
  });

  it('ao silenciar (mute), deve cancelar imediatamente falas ativas', () => {
    synth.setMuted(true);
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
  });
});
