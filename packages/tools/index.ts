import { z } from 'zod';

export * from './schemas';

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  invoke(input: TInput): Promise<TOutput>;
}

export function createTool<TSchema extends z.ZodTypeAny, TOutput>(
  fn: (input: z.infer<TSchema>) => Promise<TOutput>,
  meta: {
    name: string;
    description: string;
    schema: TSchema;
  },
): ToolDefinition<z.infer<TSchema>, TOutput> {
  return {
    name: meta.name,
    description: meta.description,
    schema: meta.schema,
    invoke: fn,
  };
}
