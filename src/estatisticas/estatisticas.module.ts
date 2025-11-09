import { Module } from '@nestjs/common';
import { EstatisticasController } from './estatisticas.controller';
import { EstatisticasService } from './estatisticas.service';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule],
  controllers: [EstatisticasController],
  providers: [EstatisticasService],
  exports: [EstatisticasService],
})
export class EstatisticasModule {}
