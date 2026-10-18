import fs from 'node:fs';
import path from 'node:path';

/**
 * Script de verificação de Schema Drift (Task-009 / Task-019).
 * Valida a consistência entre:
 * 1. infrastructure/database/init.sql
 * 2. packages/persistence/src/schema.ts
 * 3. packages/types/index.ts
 */
function main() {
  const rootDir = process.cwd();
  const initSqlPath = path.join(rootDir, 'infrastructure/database/init.sql');
  const schemaTsPath = path.join(rootDir, 'packages/persistence/src/schema.ts');
  const typesTsPath = path.join(rootDir, 'packages/types/index.ts');

  const initSql = fs.readFileSync(initSqlPath, 'utf-8');
  const schemaTs = fs.readFileSync(schemaTsPath, 'utf-8');
  const typesTs = fs.readFileSync(typesTsPath, 'utf-8');

  const errors: string[] = [];

  // 1. Verificar colunas essenciais de agent_experiences no init.sql
  const expectedExpColumnsSql = [
    'id',
    'agent_id',
    'event_type',
    'description',
    'occurred_at',
    'location_id',
    'source_type',
    'source_agent_id',
    'confidence',
    'importance',
    'related_entity_ids',
    'metadata',
  ];

  for (const col of expectedExpColumnsSql) {
    if (!initSql.includes(col)) {
      errors.push(`init.sql: coluna esperada '${col}' ausente em agent_experiences.`);
    }
  }

  // 2. Verificar correspondência no schema Drizzle (schema.ts)
  const expectedDrizzleFields = [
    { field: 'agentId', column: 'agent_id' },
    { field: 'eventType', column: 'event_type' },
    { field: 'description', column: 'description' },
    { field: 'occurredAt', column: 'occurred_at' },
    { field: 'locationId', column: 'location_id' },
    { field: 'sourceType', column: 'source_type' },
    { field: 'sourceAgentId', column: 'source_agent_id' },
    { field: 'confidence', column: 'confidence' },
    { field: 'importance', column: 'importance' },
    { field: 'relatedEntityIds', column: 'related_entity_ids' },
    { field: 'metadata', column: 'metadata' },
  ];

  for (const item of expectedDrizzleFields) {
    if (!schemaTs.includes(item.field) || !schemaTs.includes(item.column)) {
      errors.push(`schema.ts: mapeamento '${item.field}' -> '${item.column}' ausente no Drizzle schema.`);
    }
  }

  // 3. Verificar correspondência no contrato AgentExperience (@cidade-virtual/types)
  const expectedTypeFields = [
    'id: string',
    'agentId: string',
    'eventType: string',
    'description: string',
    'occurredAt: string',
    'sourceType:',
    'relatedEntityIds: string[]',
  ];

  for (const field of expectedTypeFields) {
    if (!typesTs.includes(field)) {
      errors.push(`packages/types/index.ts: campo '${field}' ausente na interface AgentExperience.`);
    }
  }

  // 4. Verificar índice de ordenação temporal descrescente
  if (!initSql.includes('idx_agent_exp_occurred_at') || !initSql.includes('occurred_at DESC')) {
    errors.push('init.sql: índice idx_agent_exp_occurred_at com DESC ausente.');
  }

  if (!schemaTs.includes('idx_agent_exp_occurred_at') || !schemaTs.includes('table.occurredAt.desc()')) {
    errors.push('schema.ts: índice idx_agent_exp_occurred_at com table.occurredAt.desc() ausente.');
  }

  if (errors.length > 0) {
    console.error('❌ Schema Drift Detectado:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('✅ Schema Drift Check: 100% sincronizado entre init.sql, schema.ts e types.');
}

main();
