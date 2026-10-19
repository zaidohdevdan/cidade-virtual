import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../packages/event-system';
import type { DomainEvent } from '@cidade-virtual/types';

describe('tests/unit/event-bus.test.ts — EventBus Pub/Sub & Handlers Assíncronos', () => {
  const createTestEvent = <T extends Record<string, unknown>>(name: string, payload: T): DomainEvent<T> => ({
    id: crypto.randomUUID(),
    name,
    timestamp: new Date().toISOString(),
    origin: 'unit-test',
    payload,
  });

  it('deve registrar handler via subscribe e invocá-lo ao publicar o evento correspondente', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('agent.movement.completed', handler);

    const event = createTestEvent('agent.movement.completed', {
      agentId: 'agent-lyra',
      destination: { x: 10, y: 0.19, z: -5 },
    });

    await bus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('deve despachar o evento para múltiplos handlers assíncronos registrados', async () => {
    const bus = new EventBus();
    const callOrder: string[] = [];

    const asyncFirstHandler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      callOrder.push('first');
    });

    const asyncSecondHandler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      callOrder.push('second');
    });

    bus.subscribe('traffic.light.changed', asyncFirstHandler);
    bus.subscribe('traffic.light.changed', asyncSecondHandler);

    const event = createTestEvent('traffic.light.changed', {
      signal: 'red',
      lightId: 'traffic-light-01',
    });

    await bus.publish(event);

    expect(asyncFirstHandler).toHaveBeenCalledTimes(1);
    expect(asyncSecondHandler).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['first', 'second']);
  });

  it('não deve acionar handlers de outros eventos ao publicar um evento distinto', async () => {
    const bus = new EventBus();
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    bus.subscribe('event.type.alpha', handlerA);
    bus.subscribe('event.type.beta', handlerB);

    await bus.publish(createTestEvent('event.type.alpha', { ok: true }));

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('deve completar graciosamente ao publicar evento sem nenhum handler registrado', async () => {
    const bus = new EventBus();
    await expect(
      bus.publish(createTestEvent('unhandled.event.name', { test: true })),
    ).resolves.toBeUndefined();
  });
});
