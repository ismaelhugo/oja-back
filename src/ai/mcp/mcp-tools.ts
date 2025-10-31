import { z } from 'zod';
import { DataSource } from 'typeorm';

/**
 * MCP Tool Definitions
 * Model Context Protocol tools for database queries
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (params: any, dataSource: DataSource) => Promise<any>;
}

/**
 * Mapeamento semântico de termos comuns para palavras-chave dos tipos de despesa no banco
 * Entende o contexto/significado por trás dos termos do usuário
 */
function getSemanticSearchTerms(userTerm: string): string[] {
  const normalized = userTerm.trim().toUpperCase();

  // Remove acentos para normalização
  const withoutAccents = normalized
    .replace(/[ÁÀÃÂ]/g, 'A')
    .replace(/[ÉÊ]/g, 'E')
    .replace(/[ÍÎ]/g, 'I')
    .replace(/[ÓÔÕ]/g, 'O')
    .replace(/[ÚÛ]/g, 'U')
    .replace(/Ç/g, 'C');

  // Mapeamento semântico: termo do usuário → palavras-chave no banco
  const semanticMap: Record<string, string[]> = {
    // Combustível
    COMBUSTIVEL: ['COMBUST', 'LUBRIFICANTE'],
    COMBUSTÍVEL: ['COMBUST', 'LUBRIFICANTE'],
    // Aluguel/Locação de carros/veículos
    'ALUGUEL DE CARRO': ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    'ALUGUEL DE CARROS': ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    'LOCACAO DE CARRO': ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    'LOCACAO DE CARROS': ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    'LOCAÇÃO DE CARRO': ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    'LOCAÇÃO DE CARROS': ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    FRETAMENTO: ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    // Alimentação
    ALIMENTACAO: ['ALIMENTA', 'REFEICAO', 'REFEIÇÃO'],
    ALIMENTAÇÃO: ['ALIMENTA', 'REFEICAO', 'REFEIÇÃO'],
    // Telefonia
    TELEFONIA: ['TELEFONE', 'TELEFON', 'CELULAR'],
    TELEFONE: ['TELEFONE', 'TELEFON', 'CELULAR'],
    // Hospedagem
    HOSPEDAGEM: ['HOTEL', 'HOSPEDA', 'HOSPEDAGEM'],
    HOTEL: ['HOTEL', 'HOSPEDA', 'HOSPEDAGEM'],
    // Passagens aéreas
    'PASSAGEM AEREA': ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    'PASSAGENS AEREAS': ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    'PASSAGEM AÉREA': ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    'PASSAGENS AÉREAS': ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    PASSAGEM: ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    PASSAGENS: ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    'PASSAGENS AEREA': ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    'PASSAGENS AÉREA': ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    // Divulgação parlamentar
    DIVULGACAO: ['DIVULGACAO', 'PARLAMENTAR', 'ATIVIDADE'],
    DIVULGAÇÃO: ['DIVULGACAO', 'PARLAMENTAR', 'ATIVIDADE'],
    'DIVULGACAO PARLAMENTAR': ['DIVULGACAO', 'PARLAMENTAR', 'ATIVIDADE'],
    'DIVULGAÇÃO PARLAMENTAR': ['DIVULGACAO', 'PARLAMENTAR', 'ATIVIDADE'],
  };

  // Verifica se há um mapeamento direto
  if (semanticMap[normalized] || semanticMap[withoutAccents]) {
    return semanticMap[normalized] || semanticMap[withoutAccents] || [];
  }

  // Busca parcial em chaves do mapeamento
  for (const [key, keywords] of Object.entries(semanticMap)) {
    const keyWithoutAccents = key
      .replace(/[ÁÀÃÂ]/g, 'A')
      .replace(/[ÉÊ]/g, 'E')
      .replace(/[ÍÎ]/g, 'I')
      .replace(/[ÓÔÕ]/g, 'O')
      .replace(/[ÚÛ]/g, 'U')
      .replace(/Ç/g, 'C');

    // Se o termo do usuário contém a chave ou vice-versa
    if (
      withoutAccents.includes(keyWithoutAccents) ||
      keyWithoutAccents.includes(withoutAccents)
    ) {
      return keywords;
    }

    // Busca por palavras-chave individuais (ex: "carro" em "aluguel de carro")
    const keyWords = keyWithoutAccents.split(/\s+/);
    const userWords = withoutAccents.split(/\s+/);

    // Se pelo menos uma palavra coincide
    if (
      keyWords.some((kw) => userWords.includes(kw)) ||
      userWords.some((uw) => keyWords.includes(uw))
    ) {
      return keywords;
    }
  }

  // Detecção heurística baseada em palavras-chave comuns
  const heuristics: Array<{ pattern: string[]; keywords: string[] }> = [
    {
      pattern: ['CARRO', 'AUTOMOVEL', 'VEICULO'],
      keywords: ['LOCACAO', 'FRETAMENTO', 'VEICULO', 'AUTOMOTOR'],
    },
    {
      pattern: ['COMBUST', 'GASOLINA', 'ETANOL', 'DIESEL'],
      keywords: ['COMBUST', 'LUBRIFICANTE'],
    },
    {
      pattern: ['TELEFONE', 'CELULAR', 'TELEFONIA'],
      keywords: ['TELEFONE', 'TELEFON', 'CELULAR'],
    },
    {
      pattern: ['HOTEL', 'HOSPEDA', 'HOSPEDAGEM'],
      keywords: ['HOTEL', 'HOSPEDA', 'HOSPEDAGEM'],
    },
    {
      pattern: ['ALIMENTA', 'COMIDA', 'REFEICAO'],
      keywords: ['ALIMENTA', 'REFEICAO', 'REFEIÇÃO'],
    },
    {
      pattern: ['PASSAGEM', 'AEREA', 'AVIAO'],
      keywords: ['PASSAGEM', 'AEREA', 'AEREO', 'AVIAO'],
    },
  ];

  for (const { pattern, keywords } of heuristics) {
    if (pattern.some((p) => withoutAccents.includes(p))) {
      return keywords;
    }
  }

  // Se não encontrou mapeamento, retorna variações do próprio termo
  return [normalized, withoutAccents];
}

/**
 * Tool 1: Search Deputy by Name
 */
export const searchDeputyTool: MCPTool = {
  name: 'search_deputy',
  description:
    'Search for deputies by name (partial, case-insensitive). Returns deputy information including party and state.',
  inputSchema: z.object({
    name: z.string().describe('Deputy name or partial name to search for'),
  }),
  handler: async (params, dataSource) => {
    const { name } = params;

    const query = `
      SELECT 
        id, 
        id_local as "idLocal",
        nome, 
        "siglaPartido", 
        "siglaUf", 
        email, 
        "urlFoto"
      FROM deputados 
      WHERE nome ILIKE $1
      LIMIT 10
    `;

    return await dataSource.query(query, [`%${name}%`]);
  },
};

/**
 * Tool 1B: Get Deputies by Party
 */
export const getDeputiesByPartyTool: MCPTool = {
  name: 'get_deputies_by_party',
  description:
    'Get all deputies from a specific political party. Use when user asks "deputados do partido X", "quem são os deputados do CIDADANIA", "listar deputados de um partido". Returns deputy information including name, party, state, email, and photo URL.',
  inputSchema: z.object({
    party: z.string().describe('Party acronym (e.g., CIDADANIA, PT, PL, MDB)'),
    state: z
      .string()
      .optional()
      .describe('Optional: Filter by state (e.g., SP, RJ, MG)'),
    limit: z
      .number()
      .optional()
      .default(100)
      .describe(
        'Maximum number of results to return (default 100, can be increased if needed)',
      ),
  }),
  handler: async (params, dataSource) => {
    const { party, state, limit = 100 } = params;

    let query = `
      SELECT 
        id, 
        id_local as "idLocal",
        nome, 
        "siglaPartido", 
        "siglaUf", 
        email, 
        "urlFoto"
      FROM deputados 
      WHERE "siglaPartido" = $1
    `;

    const queryParams: any[] = [party.toUpperCase()];

    if (state) {
      query += ` AND "siglaUf" = $${queryParams.length + 1}`;
      queryParams.push(state.toUpperCase());
    }

    query += ` ORDER BY nome ASC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 2: Get Deputy Expenses
 */
export const getDeputyExpensesTool: MCPTool = {
  name: 'get_deputy_expenses',
  description:
    'Get total expenses for a specific deputy, optionally filtered by year, month, day, legislatura, or date range.',
  inputSchema: z.object({
    deputyId: z.number().describe('Deputy ID from database'),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
  }),
  handler: async (params, dataSource) => {
    const { deputyId, year, month, day, legislatura, startDate, endDate } =
      params;

    let query = `
      SELECT 
        d.nome, 
        d."siglaPartido", 
        d."siglaUf",
        SUM(de."valorLiquido") as total,
        COUNT(*) as count
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE d.id = $1
    `;

    const queryParams: any[] = [deputyId];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (day) {
      query += ` AND EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`;
      queryParams.push(day);
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    query += ` GROUP BY d.nome, d."siglaPartido", d."siglaUf"`;

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 2B: Get Deputy Monthly Expenses
 */
export const getDeputyMonthlyExpensesTool: MCPTool = {
  name: 'get_deputy_monthly_expenses',
  description:
    'Get expenses grouped by month for a specific deputy, including monthly totals and average monthly expense. Use this for questions about "gasto médio por mês" or monthly spending patterns.',
  inputSchema: z.object({
    deputyId: z.number().describe('Deputy ID from database'),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
  }),
  handler: async (params, dataSource) => {
    const { deputyId, year, legislatura, startDate, endDate } = params;

    // Query to get expenses grouped by month
    let query = `
      SELECT 
        d.nome, 
        d."siglaPartido", 
        d."siglaUf",
        de.ano,
        de.mes,
        SUM(de."valorLiquido") as monthly_total,
        COUNT(*) as monthly_count
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE d.id = $1
    `;

    const queryParams: any[] = [deputyId];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    query += ` 
      GROUP BY d.nome, d."siglaPartido", d."siglaUf", de.ano, de.mes
      ORDER BY de.ano, de.mes
    `;

    const monthlyResults = await dataSource.query(query, queryParams);

    // Calculate overall average monthly expense
    const totalExpenses = monthlyResults.reduce(
      (sum: number, row: any) => sum + Number(row.monthly_total),
      0,
    );
    const monthsWithExpenses = monthlyResults.length;
    const avgMonthlyExpense =
      monthsWithExpenses > 0 ? totalExpenses / monthsWithExpenses : 0;

    // Also calculate total and count for the period
    const totalCount = monthlyResults.reduce(
      (sum: number, row: any) => sum + Number(row.monthly_count),
      0,
    );

    return {
      deputy_info:
        monthlyResults.length > 0
          ? {
              nome: monthlyResults[0].nome,
              siglaPartido: monthlyResults[0].siglaPartido,
              siglaUf: monthlyResults[0].siglaUf,
            }
          : null,
      monthly_breakdown: monthlyResults.map((row: any) => ({
        ano: row.ano,
        mes: row.mes,
        monthly_total: Number(row.monthly_total),
        monthly_count: Number(row.monthly_count),
      })),
      summary: {
        total_expenses: totalExpenses,
        total_count: totalCount,
        months_with_expenses: monthsWithExpenses,
        avg_monthly_expense: avgMonthlyExpense,
      },
    };
  },
};

/**
 * Tool 3: Get Top Deputies by Expenses
 */
export const getTopDeputiesTool: MCPTool = {
  name: 'get_top_deputies',
  description:
    'Get ranking of deputies by expenses. Use orderBy="desc" for highest expenses (who spent most) or orderBy="asc" for lowest expenses (who spent least). Optionally filtered by year, month, day, state, expenseType, legislatura, or date range. Use expenseType to filter by specific expense category (e.g., "Passagens Aéreas", "Alimentação", "Hospedagem", "Telefonia", "Aluguel de carros", "Divulgação da atividade parlamentar").',
  inputSchema: z.object({
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    state: z.string().optional().describe('Filter by state (e.g., SP, RJ, MG)'),
    expenseType: z
      .string()
      .optional()
      .describe(
        'Filter by expense type/category (e.g., "Passagens Aéreas", "Alimentação", "Hospedagem", "Telefonia", "Aluguel de carros", "Divulgação da atividade parlamentar", "Combustível"). Partial matching is supported.',
      ),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
    orderBy: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe(
        'Sort order: "desc" for highest expenses (default), "asc" for lowest expenses. Use "asc" when user asks "menos gastaram", "que menos gastou", "menores gastos"',
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Number of results to return (default 10)'),
  }),
  handler: async (params, dataSource) => {
    const {
      year,
      month,
      day,
      state,
      expenseType,
      legislatura,
      startDate,
      endDate,
      orderBy = 'desc',
      limit = 10,
    } = params;

    let query = `
      SELECT 
        d.nome, 
        d."siglaPartido", 
        d."siglaUf",
        SUM(de."valorLiquido") as total
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (day) {
      query += ` AND EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`;
      queryParams.push(day);
    }

    if (state) {
      query += ` AND d."siglaUf" = $${queryParams.length + 1}`;
      queryParams.push(state.toUpperCase());
    }

    if (expenseType) {
      // Usa mapeamento semântico para entender o contexto do termo do usuário
      // Ex: "aluguel de carro" → encontra "LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES"
      const semanticKeywords = getSemanticSearchTerms(expenseType);

      // Cria condição OR para buscar qualquer uma das palavras-chave semânticas
      const conditions = semanticKeywords
        .map(
          (term, idx) =>
            `de."tipoDespesa" ILIKE $${queryParams.length + idx + 1}`,
        )
        .join(' OR ');

      query += ` AND (${conditions})`;
      semanticKeywords.forEach((term) => {
        queryParams.push(`%${term}%`);
      });
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    const orderDirection = orderBy.toUpperCase();
    query += `
      GROUP BY d.nome, d."siglaPartido", d."siglaUf"
      ORDER BY total ${orderDirection}
      LIMIT $${queryParams.length + 1}
    `;
    queryParams.push(limit);

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 4: Get Top Parties by Expenses
 */
export const getTopPartiesTool: MCPTool = {
  name: 'get_top_parties',
  description:
    'Get ranking of political parties by total expenses. Use orderBy="desc" for highest expenses (who spent most) or orderBy="asc" for lowest expenses (who spent least). Optionally filtered by year, month, day, legislatura, or date range.',
  inputSchema: z.object({
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
    orderBy: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe(
        'Sort order: "desc" for highest expenses (default), "asc" for lowest expenses. Use "asc" when user asks "menos gastaram", "que menos gastou", "menores gastos"',
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Number of results to return (default 10)'),
  }),
  handler: async (params, dataSource) => {
    const {
      year,
      month,
      day,
      legislatura,
      startDate,
      endDate,
      orderBy = 'desc',
      limit = 10,
    } = params;

    let query = `
      SELECT 
        d."siglaPartido",
        SUM(de."valorLiquido") as total
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (day) {
      query += ` AND EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`;
      queryParams.push(day);
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    const orderDirection = orderBy.toUpperCase();
    query += `
      GROUP BY d."siglaPartido"
      ORDER BY total ${orderDirection}
      LIMIT $${queryParams.length + 1}
    `;
    queryParams.push(limit);

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 5: Get Expense Types for Deputy
 */
export const getExpenseTypesTool: MCPTool = {
  name: 'get_expense_types',
  description:
    'Get ranking/breakdown of expenses by type/category. Can filter by deputy, year, month, day, state, expenseType, legislatura, or date range. Use expenseType to filter by a specific expense category and get its total (not a ranking). Use state to filter expenses from a specific state.',
  inputSchema: z.object({
    deputyId: z
      .number()
      .optional()
      .describe('Deputy ID (if not provided, returns for all deputies)'),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    state: z
      .string()
      .optional()
      .describe(
        'Filter by state (e.g., SP, RJ, MG). Requires joining with deputados table.',
      ),
    expenseType: z
      .string()
      .optional()
      .describe(
        'Filter by specific expense type/category (e.g., "Passagens Aéreas", "Aluguel de carros", "Alimentação"). When provided, returns total for that specific type. Partial matching is supported.',
      ),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe(
        'Number of results to return (default 10, ignored when expenseType is specified)',
      ),
  }),
  handler: async (params, dataSource) => {
    const {
      deputyId,
      year,
      month,
      day,
      state,
      expenseType,
      legislatura,
      startDate,
      endDate,
      limit = 10,
    } = params;

    // Track if we need to join with deputados (for state filter or legislatura)
    let hasJoin = false;

    let query = `
      SELECT 
        de."tipoDespesa",
        SUM(de."valorLiquido") as total,
        COUNT(*) as count
      FROM despesas de
    `;

    const queryParams: any[] = [];
    const whereConditions: string[] = [];

    if (deputyId) {
      whereConditions.push(`de."deputadoId" = $${queryParams.length + 1}`);
      queryParams.push(deputyId);
    }

    if (legislatura || state) {
      if (!hasJoin) {
        query = `
          SELECT 
            de."tipoDespesa",
            SUM(de."valorLiquido") as total,
            COUNT(*) as count
          FROM despesas de
          JOIN deputados d ON de."deputadoId" = d.id
        `;
        hasJoin = true;
      }
    }

    if (legislatura) {
      whereConditions.push(`d."idLegislatura" = $${queryParams.length + 1}`);
      queryParams.push(legislatura);
    }

    if (state) {
      whereConditions.push(`d."siglaUf" = $${queryParams.length + 1}`);
      queryParams.push(state.toUpperCase());
    }

    if (expenseType) {
      // Usa mapeamento semântico para entender o contexto do termo do usuário
      const semanticKeywords = getSemanticSearchTerms(expenseType);

      // Cria condição OR para buscar qualquer uma das palavras-chave semânticas
      const conditions = semanticKeywords
        .map(
          (term, idx) =>
            `de."tipoDespesa" ILIKE $${queryParams.length + idx + 1}`,
        )
        .join(' OR ');

      whereConditions.push(`(${conditions})`);
      semanticKeywords.forEach((term) => {
        queryParams.push(`%${term}%`);
      });
    }

    if (year) {
      whereConditions.push(`de.ano = $${queryParams.length + 1}`);
      queryParams.push(year);
    }

    if (month) {
      whereConditions.push(`de.mes = $${queryParams.length + 1}`);
      queryParams.push(month);
    }

    if (day) {
      whereConditions.push(
        `EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`,
      );
      queryParams.push(day);
    }

    if (startDate) {
      whereConditions.push(
        `de."dataDocumento"::date >= $${queryParams.length + 1}`,
      );
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push(
        `de."dataDocumento"::date <= $${queryParams.length + 1}`,
      );
      queryParams.push(endDate);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += `
      GROUP BY de."tipoDespesa"
      ORDER BY total DESC
      LIMIT $${queryParams.length + 1}
    `;
    queryParams.push(limit);

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 6: Get Top Suppliers
 */
export const getTopSuppliersTool: MCPTool = {
  name: 'get_top_suppliers',
  description:
    'Get ranking of suppliers/companies with highest total payments. If deputyId is NOT provided, returns for ALL deputies (use when user asks "principais fornecedores" without mentioning specific deputy). If deputyId is provided, returns suppliers for that specific deputy. Supports filtering by year, month, day, legislatura, or date range.',
  inputSchema: z.object({
    deputyId: z
      .number()
      .optional()
      .describe('Deputy ID (if not provided, returns for all deputies)'),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Number of results to return (default 10)'),
  }),
  handler: async (params, dataSource) => {
    const {
      deputyId,
      year,
      month,
      day,
      legislatura,
      startDate,
      endDate,
      limit = 10,
    } = params;

    let query = `
      SELECT 
        de."nomeFornecedor",
        de."cnpjCpfFornecedor",
        SUM(de."valorLiquido") as total,
        COUNT(*) as count
      FROM despesas de
    `;

    const queryParams: any[] = [];
    const whereConditions: string[] = [];

    if (deputyId) {
      whereConditions.push(`de."deputadoId" = $${queryParams.length + 1}`);
      queryParams.push(deputyId);
    }

    if (legislatura) {
      query = `
        SELECT 
          de."nomeFornecedor",
          de."cnpjCpfFornecedor",
          SUM(de."valorLiquido") as total,
          COUNT(*) as count
        FROM despesas de
        JOIN deputados d ON de."deputadoId" = d.id
      `;
      whereConditions.push(`d."idLegislatura" = $${queryParams.length + 1}`);
      queryParams.push(legislatura);
    }

    if (year) {
      whereConditions.push(`de.ano = $${queryParams.length + 1}`);
      queryParams.push(year);
    }

    if (month) {
      whereConditions.push(`de.mes = $${queryParams.length + 1}`);
      queryParams.push(month);
    }

    if (day) {
      whereConditions.push(
        `EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`,
      );
      queryParams.push(day);
    }

    if (startDate) {
      whereConditions.push(
        `de."dataDocumento"::date >= $${queryParams.length + 1}`,
      );
      queryParams.push(startDate);
    }

    if (endDate) {
      whereConditions.push(
        `de."dataDocumento"::date <= $${queryParams.length + 1}`,
      );
      queryParams.push(endDate);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += `
      GROUP BY de."nomeFornecedor", de."cnpjCpfFornecedor"
      ORDER BY total DESC
      LIMIT $${queryParams.length + 1}
    `;
    queryParams.push(limit);

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 7: Compare Deputies
 */
export const compareDeputiesTool: MCPTool = {
  name: 'compare_deputies',
  description:
    'Compare expenses between two or more deputies. Supports filtering by year, month, day, legislatura, or date range.',
  inputSchema: z.object({
    deputyIds: z.array(z.number()).describe('Array of deputy IDs to compare'),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
  }),
  handler: async (params, dataSource) => {
    const { deputyIds, year, month, day, legislatura, startDate, endDate } =
      params;

    let query = `
      SELECT 
        d.nome, 
        d."siglaPartido", 
        d."siglaUf",
        SUM(de."valorLiquido") as total,
        COUNT(*) as count
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE d.id = ANY($1)
    `;

    const queryParams: any[] = [deputyIds];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (day) {
      query += ` AND EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`;
      queryParams.push(day);
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    query += ` GROUP BY d.nome, d."siglaPartido", d."siglaUf" ORDER BY total DESC`;

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 8: Compare Parties
 */
export const comparePartiesTool: MCPTool = {
  name: 'compare_parties',
  description:
    'Compare expenses between two or more political parties. Supports filtering by year, month, day, expenseType, legislatura, or date range. Use expenseType to compare parties for a specific expense category.',
  inputSchema: z.object({
    parties: z
      .array(z.string())
      .describe(
        'Array of party acronyms to compare (e.g., ["PT", "PL", "PSDB"])',
      ),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    expenseType: z
      .string()
      .optional()
      .describe(
        'Filter by expense type/category (e.g., "Combustível", "Passagens Aéreas", "Alimentação"). Partial matching is supported.',
      ),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
  }),
  handler: async (params, dataSource) => {
    const {
      parties,
      year,
      month,
      day,
      expenseType,
      legislatura,
      startDate,
      endDate,
    } = params;

    let query = `
      SELECT 
        d."siglaPartido",
        SUM(de."valorLiquido") as total,
        COUNT(DISTINCT d.id) as deputy_count,
        COUNT(*) as expense_count
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE d."siglaPartido" = ANY($1)
    `;

    const queryParams: any[] = [parties.map((p) => p.toUpperCase())];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (day) {
      query += ` AND EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`;
      queryParams.push(day);
    }

    if (expenseType) {
      // Usa mapeamento semântico para entender o contexto do termo do usuário
      // Ex: "aluguel de carro" → encontra "LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES"
      const semanticKeywords = getSemanticSearchTerms(expenseType);

      // Cria condição OR para buscar qualquer uma das palavras-chave semânticas
      const conditions = semanticKeywords
        .map(
          (term, idx) =>
            `de."tipoDespesa" ILIKE $${queryParams.length + idx + 1}`,
        )
        .join(' OR ');

      query += ` AND (${conditions})`;
      semanticKeywords.forEach((term) => {
        queryParams.push(`%${term}%`);
      });
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    query += ` GROUP BY d."siglaPartido" ORDER BY total DESC`;

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 9: Compare States
 */
export const compareStatesTool: MCPTool = {
  name: 'compare_states',
  description:
    'Compare expenses between two or more states (UFs). Supports filtering by year, month, day, legislatura, or date range.',
  inputSchema: z.object({
    states: z
      .array(z.string())
      .describe(
        'Array of state acronyms to compare (e.g., ["SP", "RJ", "MG"])',
      ),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
  }),
  handler: async (params, dataSource) => {
    const { states, year, month, day, legislatura, startDate, endDate } =
      params;

    let query = `
      SELECT 
        d."siglaUf",
        SUM(de."valorLiquido") as total,
        COUNT(DISTINCT d.id) as deputy_count,
        COUNT(*) as expense_count
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE d."siglaUf" = ANY($1)
    `;

    const queryParams: any[] = [states.map((s) => s.toUpperCase())];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (day) {
      query += ` AND EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`;
      queryParams.push(day);
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    query += ` GROUP BY d."siglaUf" ORDER BY total DESC`;

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 10: Get Top States by Expenses
 */
export const getTopStatesTool: MCPTool = {
  name: 'get_top_states',
  description:
    'Get ranking of states (UFs) by total expenses. Use orderBy="desc" for highest expenses (who spent most) or orderBy="asc" for lowest expenses (who spent least). Supports filtering by year, month, day, legislatura, or date range.',
  inputSchema: z.object({
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
    orderBy: z
      .enum(['asc', 'desc'])
      .optional()
      .default('desc')
      .describe(
        'Sort order: "desc" for highest expenses (default), "asc" for lowest expenses. Use "asc" when user asks "menos gastaram", "que menos gastou", "menores gastos"',
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe('Number of results to return (default 10)'),
  }),
  handler: async (params, dataSource) => {
    const {
      year,
      month,
      day,
      legislatura,
      startDate,
      endDate,
      orderBy = 'desc',
      limit = 10,
    } = params;

    let query = `
      SELECT 
        d."siglaUf",
        SUM(de."valorLiquido") as total,
        COUNT(DISTINCT d.id) as deputy_count
      FROM deputados d
      JOIN despesas de ON d.id = de."deputadoId"
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (day) {
      query += ` AND EXTRACT(DAY FROM de."dataDocumento"::date) = $${queryParams.length + 1}`;
      queryParams.push(day);
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    const orderDirection = orderBy.toUpperCase();
    query += `
      GROUP BY d."siglaUf"
      ORDER BY total ${orderDirection}
      LIMIT $${queryParams.length + 1}
    `;
    queryParams.push(limit);

    return await dataSource.query(query, queryParams);
  },
};

/**
 * Tool 11: Get Statistics by State/Party
 */
export const getStatisticsTool: MCPTool = {
  name: 'get_statistics',
  description:
    'Calculate statistics (average, sum, count, min, max) for deputies expenses. IMPORTANT: When calculating average by party/state, it sums ALL expenses of deputies in that group and divides by the TOTAL number of deputies in that group (including deputies with 0 expenses). This gives the true average expense per deputy for the group. Use when user asks for "média", "estatística", "quantos deputados", "menor média", "maior média". Supports filtering by state, party, year, month, day, legislatura, or date range. When groupBy is used, can order by average (avg_per_deputy) or total (total_expenses).',
  inputSchema: z.object({
    groupBy: z
      .enum(['state', 'party', 'none'])
      .describe(
        'How to group the statistics: state=by UF, party=by political party, none=overall stats',
      ),
    state: z
      .string()
      .optional()
      .describe(
        'Filter by state (e.g., MG, SP). Required when user asks about specific state',
      ),
    party: z.string().optional().describe('Filter by party (e.g., PT, PL)'),
    year: z.number().optional().describe('Filter by year (e.g., 2024)'),
    month: z.number().optional().describe('Filter by month (1-12)'),
    day: z.number().optional().describe('Filter by day of month (1-31)'),
    legislatura: z
      .number()
      .optional()
      .describe('Filter by legislatura (legislative term)'),
    startDate: z
      .string()
      .optional()
      .describe('Start date for period filter (format: YYYY-MM-DD)'),
    endDate: z
      .string()
      .optional()
      .describe('End date for period filter (format: YYYY-MM-DD)'),
    orderBy: z
      .enum(['avg_asc', 'avg_desc', 'total_asc', 'total_desc'])
      .optional()
      .describe(
        'Sort order when groupBy is used: "avg_asc"=lowest average (use for "menor média"), "avg_desc"=highest average (use for "maior média"), "total_asc"=lowest total, "total_desc"=highest total (default). When groupBy="none", this is ignored.',
      ),
    limit: z
      .number()
      .optional()
      .describe(
        'Limit number of results when groupBy is used (default: no limit, returns all groups)',
      ),
    minDeputies: z
      .number()
      .optional()
      .describe(
        'Minimum number of deputies required in a group (default: 1). Use higher values (e.g., 5) to filter out small parties/states that may have skewed averages.',
      ),
  }),
  handler: async (params, dataSource) => {
    const {
      groupBy,
      state,
      party,
      year,
      month,
      day,
      legislatura,
      startDate,
      endDate,
      orderBy,
      limit,
      minDeputies = 1,
    } = params;

    let selectClause = '';
    let groupByClause = '';

    if (groupBy === 'state') {
      selectClause = 'd."siglaUf" as group_name,';
      groupByClause = 'GROUP BY d."siglaUf"';
    } else if (groupBy === 'party') {
      selectClause = 'd."siglaPartido" as group_name,';
      groupByClause = 'GROUP BY d."siglaPartido"';
    }

    // Build subquery to get expenses per deputy first
    let subquery = `
      SELECT 
        "deputadoId",
        SUM("valorLiquido") as total
      FROM despesas
      WHERE 1=1
    `;

    const subqueryParams: any[] = [];

    if (year) {
      subquery += ` AND ano = $${subqueryParams.length + 1}`;
      subqueryParams.push(year);
    }

    if (month) {
      subquery += ` AND mes = $${subqueryParams.length + 1}`;
      subqueryParams.push(month);
    }

    if (day) {
      subquery += ` AND EXTRACT(DAY FROM "dataDocumento"::date) = $${subqueryParams.length + 1}`;
      subqueryParams.push(day);
    }

    if (startDate) {
      subquery += ` AND "dataDocumento"::date >= $${subqueryParams.length + 1}`;
      subqueryParams.push(startDate);
    }

    if (endDate) {
      subquery += ` AND "dataDocumento"::date <= $${subqueryParams.length + 1}`;
      subqueryParams.push(endDate);
    }

    subquery += ` GROUP BY "deputadoId"`;

    // Main query - use LEFT JOIN to include ALL deputies (even those with 0 expenses)
    // Calculate average manually: SUM(total) / COUNT(deputies) to include ALL deputies (even with NULL/0 expenses)
    // This ensures: (total party expenses) / (total number of deputies in party)
    let query = `
      SELECT 
        ${selectClause}
        COUNT(DISTINCT d.id) as deputy_count,
        COALESCE(SUM(expenses_per_deputy.total), 0) as total_expenses,
        COALESCE(SUM(expenses_per_deputy.total), 0)::decimal / NULLIF(COUNT(DISTINCT d.id), 0) as avg_per_deputy,
        MIN(expenses_per_deputy.total) as min_per_deputy,
        MAX(expenses_per_deputy.total) as max_per_deputy
      FROM deputados d
      LEFT JOIN (${subquery}) as expenses_per_deputy ON d.id = expenses_per_deputy."deputadoId"
      WHERE 1=1
    `;

    const queryParams: any[] = [...subqueryParams];

    if (legislatura) {
      query += ` AND d."idLegislatura" = $${queryParams.length + 1}`;
      queryParams.push(legislatura);
    }

    if (state) {
      query += ` AND d."siglaUf" = $${queryParams.length + 1}`;
      queryParams.push(state.toUpperCase());
    }

    if (party) {
      query += ` AND d."siglaPartido" = $${queryParams.length + 1}`;
      queryParams.push(party.toUpperCase());
    }

    if (groupByClause) {
      query += ` ${groupByClause}`;

      // Only include groups with minimum number of deputies
      // Use COALESCE in HAVING to handle NULL values (deputies with no expenses count as 0)
      query += ` HAVING COUNT(DISTINCT d.id) >= $${queryParams.length + 1}`;
      queryParams.push(minDeputies);

      // Determine order by clause
      // avg_per_deputy already uses COALESCE so NULL values are treated as 0
      let orderByClause = 'ORDER BY total_expenses DESC'; // default
      if (orderBy) {
        if (orderBy === 'avg_asc') {
          orderByClause = 'ORDER BY avg_per_deputy ASC NULLS LAST';
        } else if (orderBy === 'avg_desc') {
          orderByClause = 'ORDER BY avg_per_deputy DESC NULLS LAST';
        } else if (orderBy === 'total_asc') {
          orderByClause = 'ORDER BY total_expenses ASC';
        } else if (orderBy === 'total_desc') {
          orderByClause = 'ORDER BY total_expenses DESC';
        }
      }

      query += ` ${orderByClause}`;

      // Add LIMIT if specified
      if (limit) {
        query += ` LIMIT $${queryParams.length + 1}`;
        queryParams.push(limit);
      }
    }

    return await dataSource.query(query, queryParams);
  },
};

/**
 * All available MCP tools
 */
export const mcpTools: MCPTool[] = [
  searchDeputyTool,
  getDeputiesByPartyTool,
  getDeputyExpensesTool,
  getDeputyMonthlyExpensesTool,
  getTopDeputiesTool,
  getTopPartiesTool,
  getExpenseTypesTool,
  getTopSuppliersTool,
  compareDeputiesTool,
  comparePartiesTool,
  compareStatesTool,
  getTopStatesTool,
  getStatisticsTool,
];
