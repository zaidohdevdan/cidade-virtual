// apps/api/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

export async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: ['log', 'error', 'warn', 'debug'] },
  );

  app.enableCors();

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Synapse City API running on http://0.0.0.0:${port}`);
}

bootstrap();
