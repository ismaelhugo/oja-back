import { Module } from '@nestjs/common';
import { DeputadoController } from './deputado.controller';
import { DeputadoService } from './deputado.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deputado } from './deputado.entity';
import { DeputadoImportService } from './deputado-import.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [TypeOrmModule.forFeature([Deputado]), HttpModule],
  controllers: [DeputadoController],
  providers: [DeputadoService, DeputadoImportService]
})
export class DeputadoModule {}
