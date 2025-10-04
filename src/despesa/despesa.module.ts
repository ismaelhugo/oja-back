import { Module } from '@nestjs/common';
import { DespesaController } from './despesa.controller';
import { DespesaService } from './despesa.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Despesa } from './despesa.entity';
import { DespesaImportService } from './despesa-import.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [TypeOrmModule.forFeature([Despesa]), HttpModule],
  controllers: [DespesaController],
  providers: [DespesaService, DespesaImportService],
  exports: [DespesaService, DespesaImportService]
})
export class DespesaModule {}
