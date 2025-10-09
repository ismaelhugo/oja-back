import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ChatOllama } from '@langchain/ollama';
import { DataSource } from 'typeorm';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private llm: ChatOllama;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Inicializar o modelo Ollama (local e gratuito)
    try {
      this.llm = new ChatOllama({
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        temperature: 0,
      });

      this.logger.log('Serviço de IA inicializado com Ollama (modelo local gratuito)');
      this.logger.log('Conexão com banco de dados PostgreSQL estabelecida');
    } catch (error) {
      this.logger.error('Erro ao inicializar Ollama:', error.message);
      this.logger.warn('Instale o Ollama: https://ollama.ai');
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
        throw new Error('Serviço de IA não inicializado. Instale o Ollama: https://ollama.ai');
      }

      this.logger.log(`Processando pergunta: ${pergunta}`);

      // 1. Gerar query SQL
      const sqlPrompt = PromptTemplate.fromTemplate(`
${this.getSchemaContext()}

Pergunta do usuário: {question}

INSTRUÇÕES OBRIGATÓRIAS:
1. Analise a pergunta e gere uma query SQL completa que responda TUDO que foi perguntado
2. Use SEMPRE: "deputados" e "despesas" (PLURAL)
3. Para buscar por nome: WHERE nome ILIKE '%nome%'
4. Para somar gastos: SUM("valorLiquido")
5. Para comparações: retorne dados de TODOS os deputados mencionados
6. SEMPRE inclua "siglaPartido" e "siglaUf" quando relevante
7. Use JOIN entre deputados e despesas quando necessário
8. Retorne APENAS SQL puro, sem explicações, sem markdown

EXEMPLOS DE QUERIES CORRETAS:

1) "Quanto deputado X gastou?":
SELECT d.nome, d."siglaPartido", COALESCE(SUM(de."valorLiquido"), 0) as total 
FROM deputados d 
LEFT JOIN despesas de ON d.id = de."deputadoId"
WHERE d.nome ILIKE '%x%'
GROUP BY d.nome, d."siglaPartido";

2) "Quem gastou mais: A ou B? E os partidos?":
SELECT d.nome, d."siglaPartido", d."siglaUf", COALESCE(SUM(de."valorLiquido"), 0) as total 
FROM deputados d 
LEFT JOIN despesas de ON d.id = de."deputadoId"
WHERE d.nome ILIKE '%a%' OR d.nome ILIKE '%b%'
GROUP BY d.nome, d."siglaPartido", d."siglaUf"
ORDER BY total DESC;

3) "Top 10 deputados que mais gastaram" ou "Quais deputados mais gastaram em 2025":
SELECT d.nome, d."siglaPartido", d."siglaUf", SUM(de."valorLiquido") as total
FROM deputados d
JOIN despesas de ON d.id = de."deputadoId"
WHERE de.ano = 2025
GROUP BY d.nome, d."siglaPartido", d."siglaUf"
ORDER BY total DESC
LIMIT 10;

4) "Deputados do PT que gastaram mais de 100 mil":
SELECT d.nome, d."siglaUf", SUM(de."valorLiquido") as total
FROM deputados d
JOIN despesas de ON d.id = de."deputadoId"
WHERE d."siglaPartido" = 'PT'
GROUP BY d.nome, d."siglaUf"
HAVING SUM(de."valorLiquido") > 100000
ORDER BY total DESC;

5) "Qual partido gastou mais?":
SELECT d."siglaPartido", COUNT(DISTINCT d.id) as qtd_deputados, SUM(de."valorLiquido") as total
FROM deputados d
JOIN despesas de ON d.id = de."deputadoId"
GROUP BY d."siglaPartido"
ORDER BY total DESC
LIMIT 10;

ATENÇÃO: 
- Se a pergunta menciona "maiores", "mais", "top X", SEMPRE use ORDER BY total DESC LIMIT X
- Se não especificar número, use LIMIT 10 por padrão
- SEMPRE filtre por ano quando mencionado (WHERE de.ano = XXXX)

Agora gere APENAS a query SQL (sem texto, sem markdown):
`);

      const sqlChain = sqlPrompt.pipe(this.llm).pipe(new StringOutputParser());
      let sqlQuery = await sqlChain.invoke({ question: pergunta });
      
      // Limpar a query (remover markdown, espaços extras, etc)
      sqlQuery = sqlQuery
        .replace(/```sql/g, '')
        .replace(/```/g, '')
        .trim();

      this.logger.log(`[DEBUG] Query SQL gerada pelo LLM: ${sqlQuery}`);

      // 2. Executar query
      const resultado = await this.dataSource.query(sqlQuery);
      
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

FORMATO OBRIGATÓRIO:
Para rankings: "Os deputados que mais gastaram foram: 1. [nome exato do JSON] ([siglaPartido]-[siglaUf]): R$ [total do JSON], 2. [próximo do JSON]..."

EXEMPLO CORRETO (copiando do JSON):
JSON: [{{"nome":"João","siglaPartido":"PT","siglaUf":"SP","total":"100000.50"}}]
Resposta: "João (PT-SP) gastou R$ 100.000,50"

Agora responda copiando EXATAMENTE os dados do JSON:
`);

      const answerChain = answerPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      const resposta = await answerChain.invoke({
        question: pergunta,
        result: JSON.stringify(resultado, null, 2),
      });

      this.logger.log('Pergunta processada com sucesso');
      
      // Limpar quebras de linha extras e formatar melhor
      const respostaLimpa = resposta.replace(/\\n/g, ' ').replace(/\n\n+/g, ' ').trim();
      
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

INSTRUÇÕES OBRIGATÓRIAS:
1. Analise a pergunta e gere SQL que responda TUDO
2. Use: "deputados" e "despesas" (PLURAL)
3. Para comparações: retorne dados de TODOS os mencionados
4. SEMPRE inclua "siglaPartido" e "siglaUf" quando relevante
5. Use agregações (SUM, COUNT, AVG) quando necessário
6. Retorne APENAS SQL, sem texto

EXEMPLOS: veja exemplos no método anterior

Gere APENAS a query SQL:
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
