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
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false, // Necessário para Railway
    } : false,
    migrationsRun: false, // Para controle manual das migrations
    dropSchema: false,
    extra: {
        // Configurações otimizadas para Railway
        connectionTimeoutMillis: 20000,
        idleTimeoutMillis: 20000,
        max: 5, // máximo de conexões no pool (Railway tem limite menor)
    },
});