import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { OpenAI } from '@langchain/openai';
import { DataSource } from 'typeorm';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private llm: OpenAI;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Inicializar o modelo GPT-4 da OpenAI
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      
      console.log('🔍 [DEBUG] Variáveis de ambiente:');
      console.log('   OPENAI_API_KEY:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NÃO DEFINIDA');
      console.log('   OPENAI_MODEL:', model);

      if (!apiKey) {
        throw new Error('OPENAI_API_KEY não está definida no .env');
      }

      this.llm = new OpenAI({
        openAIApiKey: apiKey,
        modelName: model,
        temperature: 0,
      });

      this.logger.log('✅ Serviço de IA inicializado com GPT-4o da OpenAI');
      this.logger.log('✅ Conexão com banco de dados PostgreSQL estabelecida');
    } catch (error) {
      this.logger.error('❌ Erro ao inicializar GPT-4o da OpenAI:', error.message);
      this.logger.error('Stack:', error.stack);
    }
  }

  private getSchemaContext(): string {
    return `
Você é um assistente especializado em analisar gastos de deputados brasileiros.

O banco de dados PostgreSQL possui as seguintes tabelas:

1. Tabela: deputados (ATENÇÃO: nome da tabela no PLURAL)
   Colunas:
   - id (integer): ID oficial da Câmara dos Deputados
   - id_local (integer, PK): ID único no banco local
   - nome (varchar): Nome completo do deputado
   - siglaPartido (varchar): Sigla do partido (ex: PT, PSDB, PL, etc)
   - siglaUf (varchar): Sigla do estado (ex: SP, RJ, MG, etc)
   - urlFoto (varchar): URL da foto
   - email (varchar): Email do deputado

2. Tabela: despesas (ATENÇÃO: nome da tabela no PLURAL)
   Colunas:
   - id_local (integer, PK): ID único da despesa
   - deputadoId (integer): ID do deputado (corresponde ao 'id' da tabela deputados)
   - ano (integer): Ano da despesa
   - mes (integer): Mês da despesa (1-12)
   - tipoDespesa (varchar): Tipo/categoria da despesa
   - codDocumento (integer): Código do documento
   - numDocumento (varchar): Número do documento
   - valorDocumento (decimal): Valor original do documento
   - valorGlosa (decimal): Valor de glosa (desconto)
   - valorLiquido (decimal): Valor líquido pago (use este para cálculos)
   - nomeFornecedor (varchar): Nome do fornecedor
   - cnpjCpfFornecedor (varchar): CNPJ/CPF do fornecedor
   - dataDocumento (varchar): Data do documento

Regras IMPORTANTES:
- SEMPRE use "deputados" e "despesas" (PLURAL) nos comandos SQL
- Use SEMPRE valorLiquido para calcular gastos (não valorDocumento)
- Para juntar deputados e despesas, use: JOIN deputados ON despesas."deputadoId" = deputados.id
- Limite resultados com LIMIT quando apropriado
- Use ORDER BY para ordenar resultados
- Para valores monetários, use SUM("valorLiquido")
- Para contar despesas, use COUNT(*)
- Os nomes das colunas com maiúsculas devem estar entre aspas duplas (ex: "deputadoId", "valorLiquido")
- Sempre use aspas duplas para nomes de colunas case-sensitive

EXEMPLOS DE QUERIES CORRETAS:
- SELECT * FROM deputados WHERE nome ILIKE '%nikolas%';
- SELECT SUM("valorLiquido") FROM despesas WHERE "deputadoId" = 123 AND ano = 2024;
- SELECT d.nome, SUM(de."valorLiquido") as total FROM deputados d JOIN despesas de ON d.id = de."deputadoId" GROUP BY d.nome;
`;
  }

  async perguntarSobreGastos(pergunta: string): Promise<string> {
    try {
      if (!this.llm) {
        throw new Error('Serviço de IA não inicializado. Verifique a configuração do GPT-4 da OpenAI.');
      }

      this.logger.log(`Processando pergunta: ${pergunta}`);

      // 1. Gerar query SQL
      const sqlPrompt = PromptTemplate.fromTemplate(`
${this.getSchemaContext()}

Pergunta do usuário: {question}

INSTRUÇÕES OBRIGATÓRIAS - LEIA COM MUITA ATENÇÃO:
1. TODOS os nomes de colunas com maiúsculas DEVEM estar entre aspas duplas
2. Exemplos CORRETOS que você DEVE seguir:
   - SELECT "siglaPartido", "siglaUf", nome FROM deputados
   - WHERE "deputadoId" = 123
   - SUM("valorLiquido") as total
   - "tipoDespesa", "valorLiquido", "nomeFornecedor"
3. Nomes em LOWERCASE não precisam de aspas:
   - SELECT id, nome, ano FROM deputados
4. Use SEMPRE "deputados" e "despesas" (PLURAL)
5. Use aspas duplas em TODAS as colunas: "deputadoId", "siglaPartido", "siglaUf", "valorLiquido", "tipoDespesa", "nomeFornecedor", "cnpjCpfFornecedor", "valorGlosa", "valorDocumento"
6. Retorne APENAS SQL puro, sem markdown, sem explicações

Agora gere APENAS a query SQL com aspas duplas nas colunas camelCase:
`);

      const sqlQuery = await this.llm.call(await sqlPrompt.format({ question: pergunta }));

      // Limpar a query (remover markdown, espaços extras, etc)
      const cleanedQuery = sqlQuery
        .replace(/```sql/g, '')
        .replace(/```/g, '')
        .trim();

      this.logger.log(`[DEBUG] Query SQL gerada pelo LLM: ${cleanedQuery}`);

      // 2. Executar query
      const resultado = await this.dataSource.query(cleanedQuery);

      this.logger.log(`[DEBUG] Resultado da query (${resultado.length} linhas):`);
      this.logger.log(`[DEBUG] Dados completos: ${JSON.stringify(resultado, null, 2)}`);

      // 3. Gerar resposta em linguagem natural
      const answerPrompt = PromptTemplate.fromTemplate(`
Você é um assistente que responde sobre gastos de deputados brasileiros.

Dados da consulta (JSON): {result}
Pergunta: {question}

REGRAS CRÍTICAS - LEIA COM ATENÇÃO:
1. COPIE EXATAMENTE os valores do JSON - NÃO calcule, NÃO estime, NÃO arredonde
2. Use APENAS os deputados que aparecem no JSON, na ORDEM que aparecem
3. O campo "total" já está correto - apenas formate para R$
4. Se o JSON tem 5 resultados, mostre APENAS esses 5
5. NÃO invente nomes, NÃO invente valores, NÃO invente partidos
6. Copie LITERALMENTE: nome, siglaPartido, siglaUf, total

Agora responda copiando EXATAMENTE os dados do JSON:
`);

      const resposta = await this.llm.call(await answerPrompt.format({
        question: pergunta,
        result: JSON.stringify(resultado, null, 2),
      }));

      this.logger.log('Pergunta processada com sucesso');

      // Limpar quebras de linha extras e formatar melhor
      const respostaLimpa = resposta.replace(/\n/g, ' ').replace(/\n\n+/g, ' ').trim();

      return respostaLimpa;
    } catch (error) {
      this.logger.error('Erro ao processar pergunta:', error.message);

      if (error.message.includes('syntax error')) {
        throw new Error('Desculpe, não consegui entender sua pergunta. Tente reformular.');
      }

      throw new Error(`Erro ao processar sua pergunta: ${error.message}`);
    }
  }

  async perguntarComContexto(pergunta: string): Promise<{
    resposta: string;
    query?: string;
    resultado?: any;
  }> {
    try {
      if (!this.llm) {
        throw new Error('Serviço de IA não inicializado. Instale o Ollama: https://ollama.ai');
      }

      this.logger.log(`Processando pergunta com contexto: ${pergunta}`);

      // 1. Gerar query SQL (mesmo prompt melhorado)
      const sqlPrompt = PromptTemplate.fromTemplate(`
${this.getSchemaContext()}

Pergunta do usuário: {question}

INSTRUÇÕES OBRIGATÓRIAS - LEIA COM MUITA ATENÇÃO:
1. TODOS os nomes de colunas com maiúsculas DEVEM estar entre aspas duplas
2. Exemplos CORRETOS que você DEVE seguir:
   - SELECT "siglaPartido", "siglaUf", nome FROM deputados
   - WHERE "deputadoId" = 123
   - SUM("valorLiquido") as total
   - "tipoDespesa", "valorLiquido", "nomeFornecedor"
3. Nomes em LOWERCASE não precisam de aspas:
   - SELECT id, nome, ano FROM deputados
4. Use SEMPRE "deputados" e "despesas" (PLURAL)
5. Use aspas duplas em TODAS as colunas: "deputadoId", "siglaPartido", "siglaUf", "valorLiquido", "tipoDespesa", "nomeFornecedor", "cnpjCpfFornecedor", "valorGlosa", "valorDocumento"
6. Retorne APENAS SQL puro, sem markdown, sem explicações

Agora gere APENAS a query SQL com aspas duplas nas colunas camelCase:
`);

      const sqlChain = sqlPrompt.pipe(this.llm).pipe(new StringOutputParser());
      let sqlQuery = await sqlChain.invoke({ question: pergunta });
      
      // Limpar a query
      sqlQuery = sqlQuery
        .replace(/```sql/g, '')
        .replace(/```/g, '')
        .trim();

      this.logger.log(`Query SQL gerada: ${sqlQuery}`);

      // 2. Executar query
      const resultado = await this.dataSource.query(sqlQuery);
      
      this.logger.log(`Resultado: ${JSON.stringify(resultado).substring(0, 200)}...`);

      // 3. Gerar resposta em linguagem natural (mesmo prompt melhorado)
      const answerPrompt = PromptTemplate.fromTemplate(`
Você é um assistente que responde sobre gastos de deputados brasileiros.

Pergunta: {question}
Resultado: {result}

REGRAS OBRIGATÓRIAS:
1. Use APENAS os dados do resultado JSON
2. NÃO invente dados extras
3. Formate valores: R$ 123.456,78
4. Seja direto e objetivo
5. NÃO use quebras de linha (\n)
6. NÃO crie tabelas markdown

Responda de forma DIRETA:
`);

      const answerChain = answerPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      const resposta = await answerChain.invoke({
        question: pergunta,
        result: JSON.stringify(resultado, null, 2),
      });

      this.logger.log('Pergunta processada com sucesso');
      
      // Limpar formatação
      const respostaLimpa = resposta.replace(/\\n/g, ' ').replace(/\n\n+/g, ' ').trim();

      return {
        resposta: respostaLimpa,
        query: sqlQuery,
        resultado,
      };

    } catch (error) {
      this.logger.error('Erro ao processar pergunta:', error.message);
      
      if (error.message.includes('syntax error')) {
        throw new Error('Desculpe, não consegui entender sua pergunta. Tente reformular.');
      }
      
      throw new Error(`Erro ao processar sua pergunta: ${error.message}`);
    }
  }
}
