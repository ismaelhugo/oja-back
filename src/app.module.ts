import { Module } from '@nestjs/common';
import { DeputadoModule } from './deputado/deputado.module';

@Module({
  imports: [DeputadoModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
 