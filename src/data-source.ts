import { DataSource } from 'typeorm';
import { Deputado } from './deputado/deputado.entity';
import 'dotenv/config';

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Deputado],
    migrations: ['src/database/migrations/*.ts'],
    synchronize: false, // Desabilitar em produção, usar migrations
    logging: false,
    ssl: {
        rejectUnauthorized: false, // Necessário para Supabase
    },
    migrationsRun: false, // Para controle manual das migrations
    dropSchema: false,
});