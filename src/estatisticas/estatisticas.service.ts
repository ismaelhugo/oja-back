import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  GastoPorMesDto,
  GastoPorCategoriaDto,
  DeputyExpensesStatsDto,
  StateAverageExpensesDto,
  TopFornecedorDto,
} from './dtos/expense-stats.dto';

@Injectable()
export class EstatisticasService {
  private readonly logger = new Logger(EstatisticasService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  /**
   * Retorna gastos do deputado agrupados por mês/ano
   */
  async getDeputyExpensesByMonth(
    deputadoId: number,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<GastoPorMesDto[]> {
    let query = `
      SELECT 
        de.ano,
        de.mes,
        SUM(de."valorLiquido") as total,
        COUNT(*) as quantidade
      FROM despesas de
      WHERE de."deputadoId" = $1
    `;

    const queryParams: any[] = [deputadoId];

    if (year) {
      query += ` AND de.ano = $${queryParams.length + 1}`;
      queryParams.push(year);
    }

    if (startDate) {
      query += ` AND de."dataDocumento"::date >= $${queryParams.length + 1}`;
      queryParams.push(startDate);
    }

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    if (endDate) {
      query += ` AND de."dataDocumento"::date <= $${queryParams.length + 1}`;
      queryParams.push(endDate);
    }

    query += `
      GROUP BY de.ano, de.mes
      ORDER BY de.ano DESC, de.mes DESC
    `;

    const results = await this.dataSource.query(query, queryParams);

    const meses = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];

    return results.map((row: any) => ({
      ano: Number(row.ano),
      mes: Number(row.mes),
      total: Number(row.total),
      quantidade: Number(row.quantidade),
      mesLabel: meses[Number(row.mes) - 1] || '',
    }));
  }

  /**
   * Retorna gastos do deputado agrupados por tipo de despesa (categoria)
   */
  async getDeputyExpensesByCategory(
    deputadoId: number,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<GastoPorCategoriaDto[]> {
    let query = `
      SELECT 
        de."tipoDespesa" as tipo,
        SUM(de."valorLiquido") as valor,
        COUNT(*) as quantidade
      FROM despesas de
      WHERE de."deputadoId" = $1
    `;

    const queryParams: any[] = [deputadoId];

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

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    query += `
      GROUP BY de."tipoDespesa"
      ORDER BY valor DESC
    `;

    const results = await this.dataSource.query(query, queryParams);

    // Calcular total para percentuais
    const total = results.reduce(
      (sum: number, row: any) => sum + Number(row.valor),
      0,
    );

    return results.map((row: any) => ({
      tipo: row.tipo,
      valor: Number(row.valor),
      quantidade: Number(row.quantidade),
      percentual: total > 0 ? (Number(row.valor) / total) * 100 : 0,
    }));
  }

  /**
   * Retorna estatísticas completas do deputado (gastos por mês e por categoria)
   */
  async getDeputyExpensesStats(
    deputadoId: number,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<DeputyExpensesStatsDto> {
    // Buscar gastos por mês e por categoria em paralelo
    const [gastosPorMes, gastosPorCategoria] = await Promise.all([
      this.getDeputyExpensesByMonth(deputadoId, year, month, startDate, endDate),
      this.getDeputyExpensesByCategory(deputadoId, year, month, startDate, endDate),
    ]);

    // Calcular totais
    const totalGeral = gastosPorMes.reduce((sum, item) => sum + item.total, 0);
    const totalDespesas = gastosPorMes.reduce(
      (sum, item) => sum + item.quantidade,
      0,
    );

    return {
      deputadoId,
      periodo: {
        ano: year,
        mes: month,
        startDate,
        endDate,
      },
      totalGeral,
      totalDespesas,
      gastosPorMes,
      gastosPorCategoria,
    };
  }

  /**
   * Retorna ranking dos top fornecedores do deputado
   */
  async getTopFornecedores(
    deputadoId: number,
    limit: number = 10,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<TopFornecedorDto[]> {
    let query = `
      SELECT 
        de."nomeFornecedor",
        de."cnpjCpfFornecedor",
        SUM(de."valorLiquido") as total,
        COUNT(*) as quantidade
      FROM despesas de
      WHERE de."deputadoId" = $1
    `;

    const queryParams: any[] = [deputadoId];

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

    if (month) {
      query += ` AND de.mes = $${queryParams.length + 1}`;
      queryParams.push(month);
    }

    query += `
      GROUP BY de."nomeFornecedor", de."cnpjCpfFornecedor"
      ORDER BY total DESC
      LIMIT $${queryParams.length + 1}
    `;
    queryParams.push(limit);

    const results = await this.dataSource.query(query, queryParams);

    // Calcular total geral para percentuais
    let totalQuery = `
      SELECT SUM(de."valorLiquido") as total
      FROM despesas de
      WHERE de."deputadoId" = $1
    `;
    const totalParams: any[] = [deputadoId];

    if (year) {
      totalQuery += ` AND de.ano = $${totalParams.length + 1}`;
      totalParams.push(year);
    }

    if (startDate) {
      totalQuery += ` AND de."dataDocumento"::date >= $${totalParams.length + 1}`;
      totalParams.push(startDate);
    }

    if (endDate) {
      totalQuery += ` AND de."dataDocumento"::date <= $${totalParams.length + 1}`;
      totalParams.push(endDate);
    }

    if (month) {
      totalQuery += ` AND de.mes = $${totalParams.length + 1}`;
      totalParams.push(month);
    }

    const totalResult = await this.dataSource.query(totalQuery, totalParams);
    const totalGeral = Number(totalResult[0]?.total || 0);

    return results.map((row: any) => ({
      nomeFornecedor: row.nomeFornecedor,
      cnpjCpfFornecedor: row.cnpjCpfFornecedor || null,
      total: Number(row.total),
      quantidade: Number(row.quantidade),
      percentual: totalGeral > 0 ? (Number(row.total) / totalGeral) * 100 : 0,
    }));
  }

  /**
   * Retorna média de gastos do estado (UF) considerando todos os deputados
   */
  async getStateAverageExpenses(
    estado: string,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<StateAverageExpensesDto> {
    const uf = estado.toUpperCase();

    const { whereClause, params } = this.buildStateFilters(
      uf,
      year,
      month,
      startDate,
      endDate,
    );

    const deputyTotals = await this.dataSource.query(
      `
        SELECT de."deputadoId", SUM(de."valorLiquido") as total
        FROM despesas de
        JOIN deputados d ON d.id = de."deputadoId"
        ${whereClause}
        GROUP BY de."deputadoId"
      `,
      params,
    );

    const totalDeputadosConsiderados = deputyTotals.length;
    const totalGastos = deputyTotals.reduce(
      (sum: number, row: any) => sum + Number(row.total),
      0,
    );
    const mediaGeral =
      totalDeputadosConsiderados > 0
        ? totalGastos / totalDeputadosConsiderados
        : 0;

    const { params: categoriaParams, whereClause: categoriaWhere } =
      this.buildStateFilters(uf, year, month, startDate, endDate);

    const categorias = await this.dataSource.query(
      `
        SELECT 
          categoria_totals.tipo,
          AVG(categoria_totals.total_por_deputado) AS media,
          SUM(categoria_totals.total_por_deputado) AS total,
          COUNT(*) AS deputados
        FROM (
          SELECT 
            de."deputadoId",
            de."tipoDespesa" as tipo,
            SUM(de."valorLiquido") as total_por_deputado
          FROM despesas de
          JOIN deputados d ON d.id = de."deputadoId"
          ${categoriaWhere}
          GROUP BY de."deputadoId", de."tipoDespesa"
        ) as categoria_totals
        GROUP BY categoria_totals.tipo
        ORDER BY total DESC
      `,
      categoriaParams,
    );

    const totalDeputadosEstadoResult = await this.dataSource.query(
      `
        SELECT COUNT(*) as total
        FROM deputados d
        WHERE d."siglaUf" = $1
      `,
      [uf],
    );
    const totalDeputadosEstado = Number(
      totalDeputadosEstadoResult[0]?.total || 0,
    );

    return {
      estado: uf,
      periodo: {
        ano: year,
        mes: month,
        startDate,
        endDate,
      },
      totalGastos,
      mediaGeral,
      totalDeputadosConsiderados,
      totalDeputadosEstado,
      mediaPorCategoria: categorias.map((row: any) => ({
        tipo: row.tipo,
        media: Number(row.media) || 0,
        total: Number(row.total) || 0,
        deputadosComDespesa: Number(row.deputados) || 0,
      })),
    };
  }

  private buildStateFilters(
    uf: string,
    year?: number,
    month?: number,
    startDate?: string,
    endDate?: string,
  ): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    const addCondition = (template: string, value: any) => {
      params.push(value);
      const placeholder = `$${params.length}`;
      conditions.push(template.replace('?', placeholder));
    };

    addCondition('d."siglaUf" = ?', uf);
    if (year) {
      addCondition('de.ano = ?', year);
    }
    if (month) {
      addCondition('de.mes = ?', month);
    }
    if (startDate) {
      addCondition(`de."dataDocumento"::date >= ?`, startDate);
    }
    if (endDate) {
      addCondition(`de."dataDocumento"::date <= ?`, endDate);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return { whereClause, params };
  }
}
