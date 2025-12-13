import { Controller, Get, Param, Query } from '@nestjs/common';
import { EstatisticasService } from './estatisticas.service';
import {
  GastoPorMesDto,
  GastoPorCategoriaDto,
  DeputyExpensesStatsDto,
  TopFornecedorDto,
  StateAverageExpensesDto,
  DeputadoRankingDto,
} from './dtos/expense-stats.dto';

@Controller('estatisticas')
export class EstatisticasController {
  constructor(private readonly estatisticasService: EstatisticasService) {}

  /**
   * GET /estatisticas/deputado/:id/gastos-por-mes
   * Retorna gastos do deputado agrupados por mês/ano
   */
  @Get('deputado/:id/gastos-por-mes')
  async getDeputyExpensesByMonth(
    @Param('id') id: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<GastoPorMesDto[]> {
    return this.estatisticasService.getDeputyExpensesByMonth(
      id,
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/deputado/:id/gastos-por-categoria
   * Retorna gastos do deputado agrupados por tipo de despesa
   */
  @Get('deputado/:id/gastos-por-categoria')
  async getDeputyExpensesByCategory(
    @Param('id') id: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<GastoPorCategoriaDto[]> {
    return this.estatisticasService.getDeputyExpensesByCategory(
      id,
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/deputado/:id/gastos
   * Retorna estatísticas completas (gastos por mês e por categoria)
   */
  @Get('deputado/:id/gastos')
  async getDeputyExpensesStats(
    @Param('id') id: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<DeputyExpensesStatsDto> {
    return this.estatisticasService.getDeputyExpensesStats(
      id,
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/deputado/:id/fornecedores
   * Retorna ranking dos top fornecedores do deputado
   */
  @Get('deputado/:id/fornecedores')
  async getTopFornecedores(
    @Param('id') id: number,
    @Query('limit') limit?: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TopFornecedorDto[]> {
    return this.estatisticasService.getTopFornecedores(
      id,
      limit || 10,
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/estado/:uf/media-gastos
   * Retorna média de gastos do estado (UF) com filtros opcionais
   */
  @Get('estado/:uf/media-gastos')
  async getStateAverageExpenses(
    @Param('uf') uf: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<StateAverageExpensesDto> {
    return this.estatisticasService.getStateAverageExpenses(
      uf,
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/ranking-deputados
   * Retorna ranking dos top 10 deputados que mais gastaram
   * Pode filtrar por estado (ou "GERAL" para todos os estados)
   */
  @Get('ranking-deputados')
  async getTopDeputadosByState(
    @Query('estado') estado?: string,
    @Query('limit') limit?: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<DeputadoRankingDto[]> {
    return this.estatisticasService.getTopDeputadosByState(
      estado,
      limit || 10,
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/estados
   * Retorna lista de estados únicos disponíveis
   */
  @Get('estados')
  async getEstadosDisponiveis(): Promise<string[]> {
    return this.estatisticasService.getEstadosDisponiveis();
  }

  /**
   * GET /estatisticas/total-geral
   * Retorna o total geral de gastos da CEAP (todos os deputados)
   */
  @Get('total-geral')
  async getTotalGeralGastos(
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{ totalGastos: number; totalDespesas: number; totalDeputados: number }> {
    return this.estatisticasService.getTotalGeralGastos(
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/ranking-fornecedores
   * Retorna ranking dos top fornecedores gerais (todos os deputados)
   */
  @Get('ranking-fornecedores')
  async getTopFornecedoresGerais(
    @Query('limit') limit?: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TopFornecedorDto[]> {
    return this.estatisticasService.getTopFornecedoresGerais(
      limit || 10,
      year,
      month,
      startDate,
      endDate,
    );
  }

  /**
   * GET /estatisticas/ultima-atualizacao
   * Retorna a data da última atualização do banco de dados
   */
  @Get('ultima-atualizacao')
  async getUltimaAtualizacao(): Promise<{ lastUpdate: string }> {
    return this.estatisticasService.getLastUpdate();
  }
}
