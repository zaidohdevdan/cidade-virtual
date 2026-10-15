// apps/simulation-worker/src/main.ts — SYNAPSE CITY ENGINE
// Responsável pela execução assíncrona de rotinas determinísticas (Classe A):
// Física, colisões, atualizações espaciais e validações de movimento.

export class SimulationWorker {
  public isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('[SimulationWorker] Inicializado para processamento espacial e físico contínuo.');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('[SimulationWorker] Parado.');
  }
}

if (process.env.NODE_ENV !== 'test') {
  const worker = new SimulationWorker();
  worker.start();
}
