import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { randomUUID } from 'crypto';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Controller('ai')
export class AiController {
  // Store conversation history per session
  private sessions = new Map<string, Message[]>();

  constructor(private readonly aiService: AiService) {
    // Clean old sessions every 1 hour
    setInterval(() => this.cleanOldSessions(), 60 * 60 * 1000);
  }

  @Post('perguntar')
  @HttpCode(HttpStatus.OK)
  async ask(
    @Body('pergunta') question: string,
    @Body('sessaoId') sessionId?: string,
  ) {
    if (!question || question.trim() === '') {
      return {
        erro: 'Question cannot be empty',
      };
    }

    try {
      // Generate or retrieve session ID
      const id = sessionId || randomUUID();
      
      // Retrieve session history (or create new)
      const history = this.sessions.get(id) || [];
      
      // Limit history to last 6 messages before sending to OpenAI
      const limitedHistory = history.slice(-6);
      
      const response = await this.aiService.askAboutExpenses(
        question,
        limitedHistory,
      );
      
      // Save complete history in backend
      history.push(
        { role: 'user', content: question },
        { role: 'assistant', content: response }
      );
      
      // Keep only last 20 messages in complete history
      const updatedHistory = history.slice(-20);
      this.sessions.set(id, updatedHistory);

      return {
        sessaoId: id,
        pergunta: question,
        resposta: response,
      };
    } catch (error) {
      return {
        erro: error.message,
      };
    }
  }

  @Post('limpar-sessao')
  @HttpCode(HttpStatus.OK)
  clearSession(@Body('sessaoId') sessionId: string) {
    if (!sessionId) {
      return { erro: 'sessionId is required' };
    }
    
    this.sessions.delete(sessionId);
    return { sucesso: true };
  }

  private cleanOldSessions() {
    // Clean sessions with more than 100 interactions (considered inactive)
    for (const [id, history] of this.sessions.entries()) {
      if (history.length > 100) {
        this.sessions.delete(id);
      }
    }
  }
}
