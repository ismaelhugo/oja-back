import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  GastoPorMesDto,
  GastoPorCategoriaDto,
  DeputyExpensesStatsDto,
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
    startDate?: string,
    endDate?: string,
  ): Promise<DeputyExpensesStatsDto> {
    // Buscar gastos por mês e por categoria em paralelo
    const [gastosPorMes, gastosPorCategoria] = await Promise.all([
      this.getDeputyExpensesByMonth(deputadoId, year, startDate, endDate),
      this.getDeputyExpensesByCategory(deputadoId, year, startDate, endDate),
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
}
