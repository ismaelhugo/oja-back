import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { OpenAI } from '@langchain/openai';
import { DataSource } from 'typeorm';
import { PromptTemplate } from '@langchain/core/prompts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private llm: OpenAI;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Initialize OpenAI GPT-4 model
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      
      console.log('🔍 [DEBUG] Environment variables:');
      console.log('   OPENAI_API_KEY:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT DEFINED');
      console.log('   OPENAI_MODEL:', model);

      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not defined in .env');
      }

      this.llm = new OpenAI({
        openAIApiKey: apiKey,
        modelName: model,
        temperature: 0,
      });

      this.logger.log('✅ AI service initialized with OpenAI GPT-4o');
      this.logger.log('✅ PostgreSQL database connection established');
    } catch (error) {
      this.logger.error('❌ Error initializing OpenAI GPT-4o:', error.message);
      this.logger.error('Stack:', error.stack);
    }
  }

  private getSchemaContext(): string {
    return `
You are an assistant specialized in analyzing expenses of Brazilian deputies.

The PostgreSQL database has the following tables:

1. Table: deputados (ATTENTION: table name in PLURAL)
   Columns:
   - id (integer): Official ID from Chamber of Deputies
   - id_local (integer, PK): Unique ID in local database
   - nome (varchar): Deputy's full name
   - siglaPartido (varchar): Party acronym (ex: PT, PSDB, PL, etc)
   - siglaUf (varchar): State acronym (ex: SP, RJ, MG, etc)
   - urlFoto (varchar): Photo URL
   - email (varchar): Deputy's email

2. Table: despesas (ATTENTION: table name in PLURAL)
   Columns:
   - id_local (integer, PK): Unique expense ID
   - deputadoId (integer): Deputy ID (matches 'id' from deputados table)
   - ano (integer): Expense year
   - mes (integer): Expense month (1-12)
   - tipoDespesa (varchar): Expense type/category
   - codDocumento (integer): Document code
   - numDocumento (varchar): Document number
   - valorDocumento (decimal): Original document value
   - valorGlosa (decimal): Discount value
   - valorLiquido (decimal): Net paid value (use this for calculations)
   - nomeFornecedor (varchar): Supplier name
   - cnpjCpfFornecedor (varchar): Supplier CNPJ/CPF
   - dataDocumento (varchar): Document date

IMPORTANT Rules:
- ALWAYS use "deputados" and "despesas" (PLURAL) in SQL commands
- ALWAYS use valorLiquido for expense calculations (not valorDocumento)
- To join deputies and expenses, use: JOIN deputados ON despesas."deputadoId" = deputados.id
- Limit results with LIMIT when appropriate
- Use ORDER BY to sort results
- For monetary values, use SUM("valorLiquido")
- To count expenses, use COUNT(*)
- Column names with uppercase letters must be in double quotes (ex: "deputadoId", "valorLiquido")
- Always use double quotes for case-sensitive column names

CORRECT QUERY EXAMPLES:
- SELECT * FROM deputados WHERE nome ILIKE '%nikolas%';
- SELECT SUM("valorLiquido") FROM despesas WHERE "deputadoId" = 123 AND ano = 2024;
- SELECT d.nome, SUM(de."valorLiquido") as total FROM deputados d JOIN despesas de ON d.id = de."deputadoId" GROUP BY d.nome;
- SELECT d.nome, SUM(de."valorLiquido") as total FROM deputados d JOIN despesas de ON d.id = de."deputadoId" WHERE (d.nome ILIKE '%Nikolas%' OR d.nome ILIKE '%Bandeira%Mello%') AND de.ano = 2025 GROUP BY d.nome;
`;
  }

  async askAboutExpenses(question: string, history: Message[] = []): Promise<string> {
    try {
      if (!this.llm) {
        throw new Error('AI service not initialized. Check GPT-4 OpenAI configuration.');
      }

      this.logger.log(`Processing question: ${question}`);
      this.logger.log(`History of ${history.length} messages`);

      // Build history context escaping curly braces to avoid f-string errors
      const historyContext = history.length > 0 
        ? `\n\nCONVERSATION HISTORY (use to understand context and references like "his", "hers", "that deputy", "first place", "current month", etc):\n${history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.replace(/{/g, '{{').replace(/}/g, '}}')}`).join('\n')}\n\nCURRENT DATE: ${new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })} (use to interpret "current month")\n`
        : `\n\nCURRENT DATE: ${new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })} (use to interpret "current month")\n`;

      // 1. Generate SQL query
      const sqlPrompt = PromptTemplate.fromTemplate(`
${this.getSchemaContext()}
${historyContext}
User question: {question}

MANDATORY INSTRUCTIONS - READ CAREFULLY:
1. ALL column names with uppercase letters MUST be in double quotes
2. CORRECT examples you MUST follow:
   - SELECT "siglaPartido", "siglaUf", nome FROM deputados
   - WHERE "deputadoId" = 123
   - SUM("valorLiquido") as total
   - "tipoDespesa", "valorLiquido", "nomeFornecedor"
3. Lowercase names don't need quotes:
   - SELECT id, nome, ano FROM deputados
4. ALWAYS use "deputados" and "despesas" (PLURAL)
5. Use double quotes in ALL columns: "deputadoId", "siglaPartido", "siglaUf", "valorLiquido", "tipoDespesa", "nomeFornecedor", "cnpjCpfFornecedor", "valorGlosa", "valorDocumento"
6. Return ONLY pure SQL, no markdown, no explanations
7. IMPORTANT: If the question uses pronouns like "his", "hers", "that", use history to identify the deputy/context mentioned previously
8. CRITICAL - Deputy name search:
   - ALWAYS use ILIKE with % for name searches (partial case-insensitive search)
   - Examples: WHERE nome ILIKE '%Nikolas%' or WHERE nome ILIKE '%Bandeira%Mello%'
   - NEVER use = or IN with full names, as the database may have partial names
   - For multiple deputies use: WHERE nome ILIKE '%Name1%' OR nome ILIKE '%Name2%'
   - If user mentions "Eduardo Bandeira de Mello", search for '%Bandeira%Mello%'

Now generate ONLY the SQL query with double quotes in camelCase columns:
`);

      const sqlQuery = await this.llm.call(await sqlPrompt.format({ question }));

      // Clean the query (remove markdown, extra spaces, etc)
      const cleanedQuery = sqlQuery
        .replace(/```sql/g, '')
        .replace(/```/g, '')
        .trim();

      this.logger.log(`[DEBUG] SQL query generated by LLM: ${cleanedQuery}`);

      // 2. Execute query
      const result = await this.dataSource.query(cleanedQuery);

      this.logger.log(`[DEBUG] Query result (${result.length} rows):`);
      this.logger.log(`[DEBUG] Complete data: ${JSON.stringify(result, null, 2)}`);

      // 3. Generate natural language response
      const answerPrompt = PromptTemplate.fromTemplate(`
You are an assistant that answers questions about Brazilian deputies' expenses in a clear and friendly way.
${historyContext}
Query data (JSON): {result}
Question: {question}

CRITICAL RULES - READ CAREFULLY:
1. NEVER show raw JSON in the response - always convert to natural text
2. Use EXACT values from JSON - DON'T calculate, DON'T estimate, DON'T round
3. Format monetary values as "R$ X,XX"
4. For lists/rankings:
   - Use numbering: 1º, 2º, 3º, etc.
   - Show full name, party/state when available
   - Format: "1º - [Name] ([Party]/[State]): R$ [value]"
5. For individual expenses:
   - Be direct: "Deputy [Name] spent R$ [value] in [period/category]"
6. For suppliers:
   - "The main supplier was [Name] with R$ [value]"
7. If empty result, be polite: "I didn't find information about this"
8. Use history to understand context and references
9. Be concise but complete
10. Answer in Portuguese (Brazilian)

Now answer in a NATURAL and FRIENDLY way:
`);

      const response = await this.llm.call(await answerPrompt.format({
        question,
        result: JSON.stringify(result, null, 2),
      }));

      this.logger.log('Question processed successfully');

      // Clean extra line breaks and format better
      const cleanedResponse = response.replace(/\n/g, ' ').replace(/\n\n+/g, ' ').trim();

      return cleanedResponse;
    } catch (error) {
      this.logger.error('Error processing question:', error.message);

      if (error.message.includes('syntax error')) {
        throw new Error('Sorry, I couldn\'t understand your question. Please try rephrasing.');
      }

      throw new Error(`Error processing your question: ${error.message}`);
    }
  }
}
