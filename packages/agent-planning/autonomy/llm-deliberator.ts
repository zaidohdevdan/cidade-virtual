// packages/agent-planning/autonomy/llm-deliberator.ts
// Deliberação estruturada via LLM quando há ambiguidade, presença do avatar humano,
// ou desempate entre opções de alta relevância. Retorna JSON validado que determina
// a ação de fato executada.

import type { LLMProviderAdapter } from '@cidade-virtual/llm-adapters';
import type { ActionCandidate, Intention, Needs, Personality, TrafficLight } from './types.js';
import { describeNeedsPt, mostPressingNeed, NEED_MOTIVE_PT } from './needs.js';

export interface LLMDeliberationParams {
  agentId: string;
  agentName: string;
  role: string;
  biography: string;
  personality: Personality;
  needs: Needs;
  trafficLight: TrafficLight;
  candidates: ActionCandidate[];
  playerNearby: boolean;
  playerDistance?: number;
  lastAction?: string;
  recentMemories?: string[];
}

export interface DeliberationResult {
  candidate: ActionCandidate;
  reason: string;
  speech?: string;
  source: 'llm' | 'utility';
}

/**
 * Sanitiza e valida o JSON retornado pela LLM, garantindo que candidateId exista na lista.
 */
function parseStructuredLLMResponse(
  rawText: string,
  candidates: ActionCandidate[],
): { candidateId: string; reason: string; speech?: string } | null {
  try {
    // Extrai o bloco JSON caso o modelo tenha envolvido em markdown ```json ... ```
    let cleaned = rawText.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    const parsed = JSON.parse(cleaned);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidateId = String(parsed.chosenCandidateId || parsed.candidateId || '').trim();
    const reason = String(parsed.reason || parsed.thought || '').trim();
    const speech = parsed.speech ? String(parsed.speech).trim() : undefined;

    // Garante que o candidateId exista na lista oferecida
    const matched = candidates.find((c) => c.id === candidateId);
    if (!matched) {
      return null;
    }

    return { candidateId, reason, speech };
  } catch {
    return null;
  }
}

/**
 * Delibera entre os melhores candidatos utilizando a LLM, ou recai honestamente
 * sobre o candidato de maior utilidade caso a LLM falhe ou não esteja presente.
 */
export async function deliberateWithLLM(
  llm: LLMProviderAdapter | undefined,
  params: LLMDeliberationParams,
): Promise<DeliberationResult> {
  const topCandidate = params.candidates[0];
  if (!topCandidate) {
    throw new Error('deliberateWithLLM requer pelo menos 1 candidato de ação');
  }

  // Se não houver LLM, usa a escolha do motor de utilidade com justificativa interna
  if (!llm) {
    const pressing = mostPressingNeed(params.needs, params.personality);
    return {
      candidate: topCandidate,
      reason: `Decisão autônoma por utilidade: ${NEED_MOTIVE_PT[pressing]} e escolhi ${topCandidate.targetLabel} (${topCandidate.affordance}).`,
      source: 'utility',
    };
  }

  // Lista os top 4 candidatos para o LLM escolher
  const candidateOptions = params.candidates.slice(0, 4).map((c, idx) => ({
    optionNumber: idx + 1,
    candidateId: c.id,
    affordance: c.affordance,
    target: c.targetLabel,
    targetKind: c.targetKind,
    distanceMeters: Math.round(c.distance * 10) / 10,
    score: Math.round(c.score * 100) / 100,
  }));

  const systemPrompt = `Você é a mente viva e autônoma de ${params.agentName}, habitante da Cidade Virtual.
Papel/Arquétipo: ${params.role}
Biografia: ${params.biography}
Traços de Personalidade: Abertura=${params.personality.openness.toFixed(2)}, Extroversão=${params.personality.extraversion.toFixed(2)}, Amabilidade=${params.personality.agreeableness.toFixed(2)}.

Você decide por conta própria ONDE IR e O QUE FAZER baseado no que você sente e percebe. Ninguém dita ordens pré-fixadas para você.
Estado interno de necessidades atuais:
${describeNeedsPt(params.needs)}

Semáforo atual da via: ${params.trafficLight.toUpperCase()}.
${params.playerNearby ? `O avatar Daniel (jogador humano) está próximo a ${params.playerDistance?.toFixed(1) ?? '3'}m de você!` : 'Nenhum jogador humano próximo no momento.'}

Você DEVE responder ESTRITAMENTE em formato JSON puro, sem comentários adicionais, escolhendo UMA das opções disponíveis:
{
  "chosenCandidateId": "<o candidateId exato escolhido>",
  "reason": "<seu pensamento íntimo em 1 frase concisa em primeira pessoa explicando por que escolheu isso>",
  "speech": "<opcional: o que você fala em voz alta agora para Daniel ou consigo mesmo, máximo 2 frases calorosas em pt-BR>"
}`;

  const userPrompt = `Opções disponíveis no seu campo de visão e memória:
${JSON.stringify(candidateOptions, null, 2)}

Qual opção você decide seguir agora? Responda no formato JSON solicitado.`;

  try {
    const response = await llm.complete({
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    const parsed = parseStructuredLLMResponse(response.content, params.candidates);
    if (parsed) {
      const chosen = params.candidates.find((c) => c.id === parsed.candidateId) || topCandidate;
      return {
        candidate: chosen,
        reason: parsed.reason || `Decidi ir para ${chosen.targetLabel} por vontade própria.`,
        speech: parsed.speech,
        source: 'llm',
      };
    }

    if (response.content && response.content.trim().length > 0) {
      return {
        candidate: topCandidate,
        reason: response.content.trim(),
        source: 'llm',
      };
    }
  } catch {
    // Em caso de falha de rede/timeout, prossegue sem interrupção
  }

  // Fallback gracioso para a utilidade mais alta
  const pressing = mostPressingNeed(params.needs, params.personality);
  return {
    candidate: topCandidate,
    reason: `Decisão de utilidade: ${NEED_MOTIVE_PT[pressing]} rumo a ${topCandidate.targetLabel}.`,
    source: 'utility',
  };
}
