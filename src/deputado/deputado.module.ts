import { Module } from '@nestjs/common';
import { DeputadoController } from './deputado.controller';
import { DeputadoService } from './deputado.service';

@Module({
  controllers: [DeputadoController],
  providers: [DeputadoService]
})
export class DeputadoModule {}
