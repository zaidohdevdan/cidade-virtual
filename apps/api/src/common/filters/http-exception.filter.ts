// apps/api/src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

export interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  error: string;
  message: string | string[];
}

/**
 * Filtro Global de Exceções do NestJS (ExceptionsHandler)
 * Em conformidade com mandatory-secure-web-skills:
 * - Trata de forma determinística exceções HTTP do NestJS (400, 401, 403, 404, etc.).
 * - Mascara mensagens internas e stack traces em erros não tratados (500) para evitar vazamento de dados.
 * - Registra logs auditáveis de segurança [SECURITY] [AUDIT] para erros de acesso e [SECURITY] [ERROR] para falhas internas.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Ocorreu um erro interno no servidor';
    let errorName = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        errorName = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        message = (body['message'] as string | string[]) ?? exception.message;
        errorName = (body['error'] as string) ?? exception.name;
      }

      this.logger.warn(
        `[SECURITY] [AUDIT] HTTP ${status} em ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${Array.isArray(message) ? message.join(', ') : message}`,
      );
    } else {
      // Erro não tratado (500) — Proteção contra Information Disclosure (CWE-209)
      const err = exception as Error;
      this.logger.error(
        `[SECURITY] [ERROR] Falha interna não tratada em ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${err?.message}`,
        err?.stack,
      );
    }

    const payload: ErrorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url ?? '',
      error: errorName,
      message,
    };

    // Suporte tanto para Fastify (status/send) quanto Express (status/json)
    if (typeof response?.status === 'function') {
      response.status(status);
      if (typeof response.send === 'function') {
        response.send(payload);
      } else if (typeof response.json === 'function') {
        response.json(payload);
      }
    } else if (typeof response?.code === 'function') {
      response.code(status).send(payload);
    }
  }
}
