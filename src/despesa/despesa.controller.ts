import { Body, Controller, Get, Post, Put, Delete, Param, Query } from '@nestjs/common';
import { DespesaService } from './despesa.service';
import { Despesa } from './despesa.entity';
import { DespesaFiltros } from './dtos/despesa.dto';

@Controller('despesa')
export class DespesaController {
    constructor(private readonly despesaService: DespesaService) {}

    @Get('list')
    async listDespesas(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('deputadoId') deputadoId?: number,
        @Query('ano') ano?: number,
        @Query('mes') mes?: number,
        @Query('tipoDespesa') tipoDespesa?: string,
        @Query('nomeFornecedor') nomeFornecedor?: string,
        @Query('valorMinimo') valorMinimo?: number,
        @Query('valorMaximo') valorMaximo?: number
    ) {
        const filtros: DespesaFiltros = {
            deputadoId,
            ano,
            mes,
            tipoDespesa,
            nomeFornecedor,
            valorMinimo,
            valorMaximo
        };
        return this.despesaService.findAllPaginated(page, limit, filtros);
    }

    @Get('deputado/:deputadoId')
    async getDespesasDeputado(
        @Param('deputadoId') deputadoId: number,
        @Query('ano') ano?: number,
        @Query('mes') mes?: number
    ) {
        return this.despesaService.findByDeputado(deputadoId, ano, mes);
    }

    @Get('deputado/:deputadoId/estatisticas')
    async getEstatisticasDeputado(
        @Param('deputadoId') deputadoId: number,
        @Query('ano') ano?: number
    ) {
        return this.despesaService.obterEstatisticasDeputado(deputadoId, ano);
    }

    @Post('create')
    async createDespesa(@Body() despesa: Partial<Despesa>) {
        return this.despesaService.create(despesa);
    }

    @Get('tipos-despesa')
    async getTiposDespesa() {
        return this.despesaService.obterTiposDespesaDisponiveis();
    }

    @Get('anos-disponiveis')
    async getAnosDisponiveis() {
        return this.despesaService.obterAnosDisponiveis();
    }

    @Get(':id')
    async getDespesa(@Param('id') id: number) {
        return this.despesaService.findOne(id);
    }

    @Put('update/:id')
    async updateDespesa(@Param('id') id: number, @Body() despesa: Partial<Despesa>) {
        return this.despesaService.update(id, despesa);
    }

    @Delete('delete/:id')
    async deleteDespesa(@Param('id') id: number) {
        await this.despesaService.remove(id);
        return { message: 'Despesa deletada com sucesso' };
    }

    // Endpoints para importação e administração
    @Post('import/deputado/:deputadoId')
    async importarDespesasDeputado(
        @Param('deputadoId') deputadoId: number,
        @Query('ano') ano?: number,
        @Query('mes') mes?: number
    ) {
        try {
            const despesas = await this.despesaService.importarDespesasDeputadoESalvar(deputadoId, ano, mes);
            return {
                success: true,
                message: `${despesas.length} despesas do deputado ${deputadoId} importadas com sucesso`,
                count: despesas.length,
                deputadoId,
                ano: ano || 'todos',
                mes: mes || 'todos'
            };
        } catch (error) {
            return {
                success: false,
                message: `Erro ao importar despesas do deputado ${deputadoId}`,
                error: error.message,
                deputadoId
            };
        }
    }

    @Get('import/deputado/:deputadoId')
    async importarDespesasDeputadoGet(
        @Param('deputadoId') deputadoId: number,
        @Query('ano') ano?: number,
        @Query('mes') mes?: number
    ) {
        try {
            const despesas = await this.despesaService.importarDespesasDeputadoESalvar(deputadoId, ano, mes);
            return {
                success: true,
                message: `${despesas.length} despesas do deputado ${deputadoId} importadas com sucesso`,
                count: despesas.length,
                deputadoId,
                ano: ano || 'todos',
                mes: mes || 'todos'
            };
        } catch (error) {
            return {
                success: false,
                message: `Erro ao importar despesas do deputado ${deputadoId}`,
                error: error.message,
                deputadoId
            };
        }
    }

    @Post('import/multiplos-deputados')
    async importarDespesasMultiplosDeputados(
        @Body() body: { deputadosIds: number[]; ano?: number; mes?: number }
    ) {
        try {
            const { deputadosIds, ano, mes } = body;
            const resultado = await this.despesaService.importarDespesasMultiplosDeputadosESalvar(deputadosIds, ano, mes);
            
            const totalDespesas = resultado.reduce((sum, item) => sum + item.count, 0);
            const deputadosComSucesso = resultado.filter(item => item.count > 0).length;
            
            return {
                success: true,
                message: `${totalDespesas} despesas de ${deputadosComSucesso}/${deputadosIds.length} deputados importadas com sucesso`,
                totalDespesas,
                deputadosProcessados: deputadosIds.length,
                deputadosComSucesso,
                detalhes: resultado.map(r => ({
                    deputadoId: r.deputadoId,
                    count: r.count
                }))
            };
        } catch (error) {
            return {
                success: false,
                message: 'Erro ao importar despesas de múltiplos deputados',
                error: error.message
            };
        }
    }

    @Get('admin/count')
    async contarDespesas(
        @Query('deputadoId') deputadoId?: number,
        @Query('ano') ano?: number,
        @Query('mes') mes?: number
    ) {
        const filtros: DespesaFiltros = { deputadoId, ano, mes };
        const count = await this.despesaService.count(filtros);
        return { count, filtros };
    }

    @Delete('admin/clear')
    async limparDespesas() {
        try {
            await this.despesaService.clearAll();
            return {
                success: true,
                message: 'Todas as despesas foram removidas'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Erro ao limpar despesas',
                error: error.message
            };
        }
    }

    @Delete('admin/clear/deputado/:deputadoId')
    async limparDespesasDeputado(@Param('deputadoId') deputadoId: number) {
        try {
            await this.despesaService.clearByDeputado(deputadoId);
            return {
                success: true,
                message: `Despesas do deputado ${deputadoId} foram removidas`
            };
        } catch (error) {
            return {
                success: false,
                message: `Erro ao limpar despesas do deputado ${deputadoId}`,
                error: error.message
            };
        }
    }
}
