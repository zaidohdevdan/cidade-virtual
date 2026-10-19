// apps/api/src/common/filters/http-exception.filter.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter, ErrorResponseBody } from './http-exception.filter';

describe('HttpExceptionFilter (NestJS ExceptionsHandler)', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    code: ReturnType<typeof vi.fn>;
  };
  let mockRequest: {
    url: string;
    method: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/auth/me',
      method: 'GET',
    };

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('deve interceptar UnauthorizedException (401) e formatar resposta padronizada', () => {
    const exception = new UnauthorizedException('Token de autenticação não fornecido');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.send).toHaveBeenCalledTimes(1);

    const body: ErrorResponseBody = mockResponse.send.mock.calls[0][0];
    expect(body.statusCode).toBe(401);
    expect(body.path).toBe('/auth/me');
    expect(body.message).toBe('Token de autenticação não fornecido');
    expect(body.error).toBe('Unauthorized');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('deve interceptar BadRequestException (400) com mensagens de validação em array', () => {
    mockRequest.url = '/auth/guest-token';
    mockRequest.method = 'POST';

    const exception = new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: ['campo1 é obrigatório', 'campo2 deve ser string'],
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

    const body: ErrorResponseBody = mockResponse.send.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message).toEqual(['campo1 é obrigatório', 'campo2 deve ser string']);
  });

  it('deve interceptar ForbiddenException (403) ao negar acesso administrativo', () => {
    mockRequest.url = '/auth/admin-panel';
    mockRequest.method = 'POST';

    const exception = new ForbiddenException('Acesso restrito a administradores');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const body: ErrorResponseBody = mockResponse.send.mock.calls[0][0];
    expect(body.statusCode).toBe(403);
    expect(body.message).toBe('Acesso restrito a administradores');
  });

  it('deve interceptar NotFoundException (404) para rotas inexistentes', () => {
    mockRequest.url = '/api/v1/unknown';
    mockRequest.method = 'GET';

    const exception = new NotFoundException('Recurso não encontrado');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body: ErrorResponseBody = mockResponse.send.mock.calls[0][0];
    expect(body.statusCode).toBe(404);
    expect(body.message).toBe('Recurso não encontrado');
  });

  it('deve mascarar falhas internas (500) prevenindo vazamento de dados confidenciais (CWE-209)', () => {
    mockRequest.url = '/internal-query';
    mockRequest.method = 'POST';

    // Simula erro de banco de dados com credenciais expostas na mensagem de erro
    const internalDbError = new Error('FATAL: connection to postgres failed. password="secret_root_pass" table="private"');

    filter.catch(internalDbError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);

    const body: ErrorResponseBody = mockResponse.send.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('InternalServerError');

    // CRÍTICO: Nunca vazar dados internos ou senhas para o cliente
    expect(body.message).toBe('Ocorreu um erro interno no servidor');
    expect(JSON.stringify(body)).not.toContain('secret_root_pass');
    expect(JSON.stringify(body)).not.toContain('postgres');
  });

  it('deve suportar adapters Fastify que utilizam code().send()', () => {
    const fastifyMockResponse = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    const host = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => fastifyMockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    const exception = new UnauthorizedException('Token inválido');
    filter.catch(exception, host);

    expect(fastifyMockResponse.code).toHaveBeenCalledWith(401);
    expect(fastifyMockResponse.send).toHaveBeenCalledTimes(1);
    const body: ErrorResponseBody = fastifyMockResponse.send.mock.calls[0][0];
    expect(body.statusCode).toBe(401);
  });
});
