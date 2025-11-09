import { Module } from '@nestjs/common';
import { DeputadoModule } from './deputado/deputado.module';
import { DespesaModule } from './despesa/despesa.module';
import { AiModule } from './ai/ai.module';
import { EstatisticasModule } from './estatisticas/estatisticas.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true,
      logging: true, // Enable logging for debugging
      ssl: {
        rejectUnauthorized: false, // Necessário para Supabase
      },
    }),
    DeputadoModule,
    DespesaModule,
    AiModule,
    EstatisticasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
