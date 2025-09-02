import { DataSource } from 'typeorm';
import { Deputado } from './deputado/deputado.entity';
import 'dotenv/config';

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Deputado],
    migrations: [
        process.env.NODE_ENV === 'production' 
            ? 'dist/database/migrations/*.js'
            : 'src/database/migrations/*.ts'
    ],
    synchronize: false, // Desabilitar em produção, usar migrations
    logging: process.env.NODE_ENV !== 'production',
    ssl: {
        rejectUnauthorized: false, // Necessário para Supabase
    },
    migrationsRun: false, // Para controle manual das migrations
    dropSchema: false,
    extra: {
        // Configurações específicas para Supabase
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        max: 10, // máximo de conexões no pool
        family: 4, // força IPv4
    },
});