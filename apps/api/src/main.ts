// apps/api/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { OPERATIONAL_LIMITS } from '@cidade-virtual/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: ['log', 'error', 'warn', 'debug'] },
  );

  // Filtro global de exceções seguro (NestJS ExceptionsHandler)
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS Whitelist rigorosa (Task-022 / mandatory-secure-web-skills)
  // Rejeita explicitamente wildcard '*'
  const allowedOrigins = (
    process.env['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Headers de Proteção HTTP com Helmet
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", ...allowedOrigins],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    noSniff: true,
  });

  // Rate Limiting HTTP derivado de OPERATIONAL_LIMITS
  await app.register(rateLimit, {
    max: OPERATIONAL_LIMITS.maxHttpRequestsPerMinute,
    timeWindow: '1 minute',
  });

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (como mobile apps, curl, SSR interno ou mesmo host)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS_NOT_ALLOWED: Origem ${origin} não autorizada`), false);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env['PORT'] ? Number(process.env['PORT']) : 3001;
  // Segurança de escuta: 127.0.0.1 em desenvolvimento e testes, 0.0.0.0 apenas quando explicitamente em produção
  const host =
    process.env['HOST'] ??
    (process.env['NODE_ENV'] === 'production' ? '0.0.0.0' : '127.0.0.1');

  await app.listen(port, host);
  console.log(`[SECURITY] Synapse City API running securely on http://${host}:${port}`);
}

bootstrap();
