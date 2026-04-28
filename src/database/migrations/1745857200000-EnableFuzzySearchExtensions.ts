import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableFuzzySearchExtensions1745857200000 implements MigrationInterface {
    name = 'EnableFuzzySearchExtensions1745857200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        // unaccent() é STABLE, não IMMUTABLE — índices exigem IMMUTABLE.
        // Wrapper explícito com referência direta ao dicionário resolve isso.
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION immutable_unaccent(text)
            RETURNS text AS $$
                SELECT unaccent('unaccent', $1)
            $$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
        `);

        // Índice GIN trigrama sobre nome normalizado para acelerar buscas fuzzy
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS IDX_DEPUTADO_NOME_TRGM ON deputados USING gin (immutable_unaccent(lower(nome)) gin_trgm_ops)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS IDX_DEPUTADO_NOME_TRGM`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS immutable_unaccent(text)`);
        // Extensões não são removidas no down pois podem ser usadas por outros objetos
    }
}
