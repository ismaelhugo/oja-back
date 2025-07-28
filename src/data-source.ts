import { DataSource } from 'typeorm';
import { Deputado } from './deputado/deputado.entity';
import 'dotenv/config';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [Deputado],
    migrations: ['src/migrations/*.ts'],
    synchronize: true,
});