import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { randomUUID } from 'crypto';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Controller('ai')
export class AiController {
  // Armazena histórico de conversas por sessão
  private sessoes = new Map<string, Message[]>();

  constructor(private readonly aiService: AiService) {
    // Limpar sessões antigas a cada 1 hora
    setInterval(() => this.limparSessoesAntigas(), 60 * 60 * 1000);
  }

  @Post('perguntar')
  @HttpCode(HttpStatus.OK)
  async perguntar(
    @Body('pergunta') pergunta: string,
    @Body('sessaoId') sessaoId?: string,
  ) {
    if (!pergunta || pergunta.trim() === '') {
      return {
        erro: 'Pergunta não pode estar vazia',
      };
    }

    try {
      // Gera ou recupera ID da sessão
      const id = sessaoId || randomUUID();
      
      // Recupera histórico da sessão (ou cria novo)
      const historico = this.sessoes.get(id) || [];
      
      // Limita histórico às últimas 6 mensagens antes de enviar para OpenAI
      const historicoLimitado = historico.slice(-6);
      
      const resposta = await this.aiService.perguntarSobreGastos(
        pergunta,
        historicoLimitado,
      );
      
      // Salva histórico completo no backend
      historico.push(
        { role: 'user', content: pergunta },
        { role: 'assistant', content: resposta }
      );
      
      // Mantém apenas últimas 20 mensagens no histórico completo
      const historicoAtualizado = historico.slice(-20);
      this.sessoes.set(id, historicoAtualizado);

      return {
        sessaoId: id,
        pergunta,
        resposta,
      };
    } catch (error) {
      return {
        erro: error.message,
      };
    }
  }

  @Post('limpar-sessao')
  @HttpCode(HttpStatus.OK)
  limparSessao(@Body('sessaoId') sessaoId: string) {
    if (!sessaoId) {
      return { erro: 'sessaoId é obrigatório' };
    }
    
    this.sessoes.delete(sessaoId);
    return { sucesso: true };
  }

  private limparSessoesAntigas() {
    // Limpa sessões com mais de 100 interações (considerando inativas)
    for (const [id, historico] of this.sessoes.entries()) {
      if (historico.length > 100) {
        this.sessoes.delete(id);
      }
    }
  }
}
