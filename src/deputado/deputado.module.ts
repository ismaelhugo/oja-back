import { Module } from '@nestjs/common';
import { DeputadoController } from './deputado.controller';
import { DeputadoService } from './deputado.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deputado } from './deputado.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Deputado])],
  controllers: [DeputadoController],
  providers: [DeputadoService]
})
export class DeputadoModule {}
