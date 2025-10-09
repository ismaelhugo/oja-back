import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('perguntar')
  @HttpCode(HttpStatus.OK)
  async perguntar(@Body('pergunta') pergunta: string) {
    if (!pergunta || pergunta.trim() === '') {
      return {
        erro: 'Pergunta não pode estar vazia',
      };
    }

    try {
      const resposta = await this.aiService.perguntarSobreGastos(pergunta);
      return {
        pergunta,
        resposta,
      };
    } catch (error) {
      return {
        erro: error.message,
      };
    }
  }

  @Post('perguntar-detalhado')
  @HttpCode(HttpStatus.OK)
  async perguntarDetalhado(@Body('pergunta') pergunta: string) {
    if (!pergunta || pergunta.trim() === '') {
      return {
        erro: 'Pergunta não pode estar vazia',
      };
    }

    try {
      const resultado = await this.aiService.perguntarComContexto(pergunta);
      return {
        pergunta,
        ...resultado,
      };
    } catch (error) {
      return {
        erro: error.message,
      };
    }
  }
}
