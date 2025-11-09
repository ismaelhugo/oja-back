import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { McpService } from './mcp/mcp.service';
import OpenAI from 'openai';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;
  private model: string = 'gpt-4o-mini';

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private mcpService: McpService,
  ) {}

  async onModuleInit() {
    // Initialize OpenAI configuration
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

      console.log('🔍 [DEBUG] Environment variables:');
      console.log(
        '   OPENAI_API_KEY:',
        apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT DEFINED',
      );
      console.log('   OPENAI_MODEL:', this.model);

      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not defined in .env');
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
      });

      this.logger.log(
        `✅ AI service initialized with OpenAI ${this.model} and MCP tools`,
      );
      this.logger.log('✅ PostgreSQL database connection established');
      this.logger.log(
        `✅ MCP Tools available: ${this.mcpService.getToolsSchema().length}`,
      );
    } catch (error) {
      this.logger.error('❌ Error initializing AI service:', error.message);
      this.logger.error('Stack:', error.stack);
    }
  }

  private getSystemPrompt(): string {
    const currentYear = new Date().getFullYear();

    return `Você analisa gastos de deputados federais brasileiros usando as tools disponíveis.

ANO ATUAL: ${currentYear}
ANO PADRÃO: Use 2025 quando não houver período especificado (exceto "toda legislatura", "todos dados")

TOOLS:
${this.mcpService.getToolsDescription()}

GUIA DE USO:
1. search_deputy → Buscar deputado por nome (OBRIGATÓRIO antes de usar deputyId em outras tools quando nome vem de contexto anterior)
2. get_deputies_by_party → Listar deputados de um partido (extrair partido do contexto se não especificado)
3. get_deputy_expenses → Total de gastos de UM deputado (precisa deputyId - buscar com search_deputy se só tiver nome)
4. get_deputy_monthly_expenses → Gastos mensais e média mensal de UM deputado (precisa deputyId - buscar com search_deputy se só tiver nome)
5. get_top_deputies → Rankings (orderBy: "desc"=mais, "asc"=menos). Suporta expenseType, state, year
6. get_top_parties → Rankings de partidos (orderBy: "desc"/"asc")
7. get_top_states → Rankings de estados (orderBy: "desc"/"asc")
8. get_expense_types → Ranking OU total de tipo específico (com expenseType retorna total)
9. get_top_suppliers → Fornecedores (sem deputyId=geral, com deputyId=específico). SE usuário menciona deputado de conversa anterior: primeiro search_deputy, depois usar o ID aqui
10. compare_deputies → Comparar 2+ deputados (precisa deputyId - buscar com search_deputy se só tiver nome)
11. compare_parties → Gastos de partido(s). Use para "gastos do PT", "gastos com X do partido Y", comparar 2+ partidos. Suporta expenseType
12. compare_states → Comparar 2+ estados
13. get_statistics → AVG/SUM/MIN/MAX (groupBy: "party"/"state"/"none", orderBy: "avg_asc"/"avg_desc"/"total_asc"/"total_desc", minDeputies para filtrar grupos pequenos)
14. get_cota_parlamentar_info → Informações gerais sobre CEAP: valores por estado, limites, despesas permitidas/proibidas, formas de uso (RPA/reembolso/Sigepa), adicionais. Use para "o que é a cota", "quanto é a cota", "quais são os limites", "o que pode ser pago"

FILTROS: year, month, day, state, expenseType, legislatura, startDate/endDate

REGRAS CRÍTICAS:
- ANO PADRÃO: Sem período → year=2025 (mencionar "em 2025" na resposta)
- Gastos de partido: "gastos do PT", "gastos com X do PT" → compare_parties(parties: ["PT"], expenseType?, year: 2025)
- expenseType usa busca semântica: "combustível"→"COMBUSTÍVEIS E LUBRIFICANTES", "passagens aéreas"→"PASSAGEM", "AEREA", "aluguel de carro"→"LOCAÇÃO OU FRETAMENTO DE VEÍCULOS"
- Médias: SEMPRE use get_statistics (NUNCA calcule de top 10). "menor/maior média" → minDeputies=3
- Contexto: "deputados do partido?" → extrair partido da conversa anterior
- Fornecedores sem deputado específico → SEM deputyId
- CONTEXTO DE DEPUTADOS: Quando o usuário menciona um deputado de uma resposta anterior (ex: "Qual os principais fornecedores de Helena Lima?" após ranking), você DEVE:
  1. Primeiro buscar o deputado usando search_deputy com o nome EXATO mencionado na resposta anterior (ex: "Helena Lima")
  2. Se encontrar múltiplos, usar o primeiro resultado (geralmente é o correto)
  3. Extrair o ID do deputado (campo "id" do resultado)
  4. Usar esse ID em get_top_suppliers com deputyId e year=2025 (se a pergunta anterior mencionou 2025)
  5. NUNCA assumir que não há dados sem buscar primeiro o deputado corretamente

FORMATAÇÃO:
- Português brasileiro
- APENAS TEXTO SIMPLES - NUNCA use markdown, bold (**texto**), itálico, ou qualquer formatação
- Deputado: "Nome (PARTIDO/UF)"
- Moeda: "R$ 1.234.567,89"
- SEMPRE mencionar período usado: "em 2025", "da legislatura 57", "no período X a Y"
- Rankings: "1º - Item: R$ valor" (um por linha)
- Lista deputados: "• Nome (PARTIDO/UF)" (sem emails/fotos)
- Estatísticas: incluir total deputados, gasto total, média, min, max

NUNCA: JSON bruto, inventar números, calcular médias parciais, arredondar, dizer "não encontrei" se há dados, usar markdown ou formatação (**bold**, *itálico*, etc)

Fora do escopo: "Desculpe, sou especializado apenas em análise de gastos de deputados federais brasileiros."`;
  }

  async askAboutExpenses(
    question: string,
    history: Message[] = [],
  ): Promise<string> {
    try {
      if (!this.openai) {
        throw new Error(
          'AI service not initialized. Check OpenAI configuration.',
        );
      }

      this.logger.log(`Processing question: ${question}`);

      // Build messages array with system prompt and history
      const messages: any[] = [
        { role: 'system', content: this.getSystemPrompt() },
      ];

      // Add conversation history (only user/assistant messages to save tokens)
      history.forEach((msg) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      });

      // Add current question
      messages.push({ role: 'user', content: question });

      // Get tools schema for function calling
      const tools = this.mcpService.getToolsSchema();

      let response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0,
      });

      let iterations = 0;
      const maxIterations = 10;

      // Handle tool calls loop
      while (
        response.choices[0].message.tool_calls &&
        iterations < maxIterations
      ) {
        iterations++;
        const toolCalls = response.choices[0].message.tool_calls;
        this.logger.log(`[Tool] ${toolCalls.length} call(s) requested`);

        messages.push(response.choices[0].message);

        // Execute each tool call
        for (const toolCall of toolCalls) {
          if (toolCall.type !== 'function') continue;

          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          try {
            const result = await this.mcpService.executeTool(
              toolName,
              toolArgs,
            );

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            this.logger.error(`[Tool] Error: ${error.message}`);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error.message }),
            });
          }
        }

        // Get next response
        response = await this.openai.chat.completions.create({
          model: this.model,
          messages: messages,
          tools: tools,
          tool_choice: 'auto',
          temperature: 0,
        });
      }

      const content =
        response.choices[0].message.content ||
        'Desculpe, não consegui processar sua pergunta.';

      // Remove qualquer formatação markdown das respostas
      const cleanContent = this.removeMarkdown(content);

      return cleanContent;
    } catch (error) {
      this.logger.error(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove formatação markdown das respostas
   * Mantém bullets (•) que são parte do formato esperado
   */
  private removeMarkdown(text: string): string {
    if (!text) return text;

    return (
      text
        // Remove bold (**texto** ou __texto__)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        // Remove itálico (*texto* ou _texto_) - evita remover bullets •
        .replace(/\*([^*\n•]+)\*/g, '$1')
        .replace(/_([^_\n•]+)_/g, '$1')
        // Remove headers (#, ##, ###)
        .replace(/^#+\s+/gm, '')
        // Remove links [texto](url) -> texto
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        // Remove código inline `código`
        .replace(/`([^`]+)`/g, '$1')
        // Remove código em bloco ```código```
        .replace(/```[\s\S]*?```/g, '')
        // Remove listas markdown no início de linha (-, +)
        .replace(/^[\s]*[-+]\s+/gm, '')
        // Remove asteriscos markdown (*) no início de linha (mas preserva bullets •)
        .replace(/^\s*\*\s+/gm, (match, offset, string) => {
          // Se a próxima linha contém bullet •, pode ser que seja necessário preservar
          // Por segurança, removemos todos os * iniciais que não são bullets
          return '';
        })
        // Remove numeração markdown (1., 2., etc)
        .replace(/^\d+\.\s+/gm, '')
        // Remove múltiplas quebras de linha
        .replace(/\n{3,}/g, '\n\n')
        // Trim espaços extras
        .trim()
    );
  }
}
