import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In } from 'typeorm';
import { Despesa } from './despesa.entity';
import { DespesaImportService } from './despesa-import.service';
import { DespesaDto, DespesaFiltros } from './dtos/despesa.dto';

@Injectable()
export class DespesaService {
  private readonly logger = new Logger(DespesaService.name);
  
  constructor(
    @InjectRepository(Despesa)
    private readonly despesaRepository: Repository<Despesa>,
    private readonly despesaImportService: DespesaImportService,
  ) {}

  async create(despesa: Partial<Despesa>): Promise<Despesa> {
    return this.despesaRepository.save(despesa);
  }

  async findAll(): Promise<Despesa[]> {
    return this.despesaRepository.find({
      order: { ano: 'DESC', mes: 'DESC' }
    });
  }

  async findAllPaginated(
    page?: number, 
    limit?: number,
    filtros?: DespesaFiltros
  ): Promise<{ data: Despesa[]; total: number; page?: number; limit?: number }> {
    // Monta condições de filtro
    const where: any = {};
    
    if (filtros?.deputadoId) {
      where.deputadoId = filtros.deputadoId;
    }
    if (filtros?.ano) {
      where.ano = filtros.ano;
    }
    if (filtros?.mes) {
      where.mes = filtros.mes;
    }
    if (filtros?.tipoDespesa) {
      where.tipoDespesa = Like(`%${filtros.tipoDespesa}%`);
    }
    if (filtros?.nomeFornecedor) {
      where.nomeFornecedor = Like(`%${filtros.nomeFornecedor}%`);
    }
    if (filtros?.valorMinimo !== undefined && filtros?.valorMaximo !== undefined) {
      where.valorLiquido = Between(filtros.valorMinimo, filtros.valorMaximo);
    } else if (filtros?.valorMinimo !== undefined) {
      where.valorLiquido = Between(filtros.valorMinimo, 999999999);
    } else if (filtros?.valorMaximo !== undefined) {
      where.valorLiquido = Between(0, filtros.valorMaximo);
    }

    // Se não foram fornecidos page e limit, retorna todos
    if (limit !== undefined && Number(limit) <= 0) {
      const [data, total] = await this.despesaRepository.findAndCount({
        where,
        order: { ano: 'DESC', mes: 'DESC', dataDocumento: 'DESC' }
      });
      return { data, total };
    }

    const pageNum = page ?? 1;
    const limitNum = limit ?? 20;
    const [data, total] = await this.despesaRepository.findAndCount({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { ano: 'DESC', mes: 'DESC', dataDocumento: 'DESC' },
    });

    return { data, total, page: pageNum, limit: limitNum };
  }

  async findByDeputado(deputadoId: number, ano?: number, mes?: number): Promise<Despesa[]> {
    const where: any = { deputadoId };
    
    if (ano) {
      where.ano = ano;
    }
    if (mes) {
      where.mes = mes;
    }

    return this.despesaRepository.find({
      where,
      order: { ano: 'DESC', mes: 'DESC', dataDocumento: 'DESC' }
    });
  }

  async findOne(id: number): Promise<Despesa | null> {
    return this.despesaRepository.findOne({
      where: { id_local: id },
      relations: ['deputado']
    });
  }

  async update(id: number, updateData: Partial<Despesa>): Promise<Despesa | null> {
    await this.despesaRepository.update({ id_local: id }, updateData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.despesaRepository.delete({ id_local: id });
  }

  // Métodos de importação
  async importarDespesasDeputadoESalvar(
    deputadoId: number, 
    ano?: number, 
    mes?: number
  ): Promise<Despesa[]> {
    const despesasApi = await this.despesaImportService.importarDespesasDeputado(deputadoId, ano, mes);
    this.logger.log(`Salvando ${despesasApi.length} despesas do deputado ${deputadoId}...`);
    
    const despesasParaSalvar = despesasApi.map(despesaApi => ({
      deputadoId,
      ...despesaApi
    }));

    return this.salvarDespesasComUpsert(despesasParaSalvar);
  }

  async importarDespesasMultiplosDeputadosESalvar(
    deputadosIds: number[], 
    ano?: number, 
    mes?: number
  ): Promise<{ deputadoId: number; count: number; despesas: Despesa[] }[]> {
    const resultadoImportacao = await this.despesaImportService.importarDespesasMultiplosDeputados(deputadosIds, ano, mes);
    const resultado: { deputadoId: number; count: number; despesas: Despesa[] }[] = [];
    
    for (const item of resultadoImportacao) {
      if (item.despesas.length > 0) {
        const despesasParaSalvar = item.despesas.map(despesaApi => ({
          deputadoId: item.deputadoId,
          ...despesaApi
        }));

        const despesasSalvas = await this.salvarDespesasComUpsert(despesasParaSalvar);
        resultado.push({
          deputadoId: item.deputadoId,
          count: despesasSalvas.length,
          despesas: despesasSalvas
        });
      } else {
        resultado.push({
          deputadoId: item.deputadoId,
          count: 0,
          despesas: []
        });
      }
    }
    
    return resultado;
  }

  // Métodos de estatísticas e análises
  async obterEstatisticasDeputado(deputadoId: number, ano?: number): Promise<any> {
    const where: any = { deputadoId };
    if (ano) {
      where.ano = ano;
    }

    const despesas = await this.despesaRepository.find({ where });
    
    const totalGasto = despesas.reduce((sum, d) => sum + Number(d.valorLiquido), 0);
    const totalDocumentos = despesas.length;
    const gastosPorTipo = despesas.reduce((acc, d) => {
      acc[d.tipoDespesa] = (acc[d.tipoDespesa] || 0) + Number(d.valorLiquido);
      return acc;
    }, {} as Record<string, number>);
    
    const gastosPorMes = despesas.reduce((acc, d) => {
      const chave = `${d.ano}-${d.mes.toString().padStart(2, '0')}`;
      acc[chave] = (acc[chave] || 0) + Number(d.valorLiquido);
      return acc;
    }, {} as Record<string, number>);

    const fornecedores = [...new Set(despesas.map(d => d.nomeFornecedor))];
    const principaisFornecedores = despesas.reduce((acc, d) => {
      acc[d.nomeFornecedor] = (acc[d.nomeFornecedor] || 0) + Number(d.valorLiquido);
      return acc;
    }, {} as Record<string, number>);

    // Ordenar fornecedores por valor gasto
    const fornecedoresOrdenados = Object.entries(principaisFornecedores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((acc, [nome, valor]) => {
        acc[nome] = valor;
        return acc;
      }, {} as Record<string, number>);

    return {
      deputadoId,
      ano: ano || 'todos',
      totalGasto,
      totalDocumentos,
      gastosPorTipo,
      gastosPorMes,
      totalFornecedores: fornecedores.length,
      principaisFornecedores: fornecedoresOrdenados
    };
  }

  async obterTiposDespesaDisponiveis(): Promise<string[]> {
    const result = await this.despesaRepository
      .createQueryBuilder('despesa')
      .select('DISTINCT despesa.tipoDespesa', 'tipoDespesa')
      .orderBy('despesa.tipoDespesa', 'ASC')
      .getRawMany();
    
    return result.map(r => r.tipoDespesa);
  }

  async obterAnosDisponiveis(): Promise<number[]> {
    const result = await this.despesaRepository
      .createQueryBuilder('despesa')
      .select('DISTINCT despesa.ano', 'ano')
      .orderBy('despesa.ano', 'DESC')
      .getRawMany();
    
    return result.map(r => r.ano);
  }

  async count(filtros?: DespesaFiltros): Promise<number> {
    const where: any = {};
    
    if (filtros?.deputadoId) {
      where.deputadoId = filtros.deputadoId;
    }
    if (filtros?.ano) {
      where.ano = filtros.ano;
    }
    if (filtros?.mes) {
      where.mes = filtros.mes;
    }

    return this.despesaRepository.count({ where });
  }

  async clearAll(): Promise<void> {
    this.logger.log('Removendo todas as despesas...');
    await this.despesaRepository.clear();
    this.logger.log('Todas as despesas foram removidas');
  }

  async clearByDeputado(deputadoId: number): Promise<void> {
    this.logger.log(`Removendo despesas do deputado ${deputadoId}...`);
    await this.despesaRepository.delete({ deputadoId });
    this.logger.log(`Despesas do deputado ${deputadoId} foram removidas`);
  }

  // Método privado para salvar com upsert
  private async salvarDespesasComUpsert(despesas: any[]): Promise<Despesa[]> {
    const despesasSalvas: Despesa[] = [];
    
    for (const despesa of despesas) {
      try {
        // Cria uma chave única baseada em dados identificadores
        const despesaExistente = await this.despesaRepository.findOne({
          where: {
            deputadoId: despesa.deputadoId,
            codDocumento: despesa.codDocumento,
            numDocumento: despesa.numDocumento,
            ano: despesa.ano,
            mes: despesa.mes
          }
        });

        let despesaSalva: Despesa;
        if (despesaExistente) {
          // Atualiza a despesa existente
          await this.despesaRepository.update(despesaExistente.id_local, despesa);
          const despesaAtualizada = await this.despesaRepository.findOne({ where: { id_local: despesaExistente.id_local } });
          if (!despesaAtualizada) {
            throw new Error(`Erro ao recuperar despesa atualizada com ID ${despesaExistente.id_local}`);
          }
          despesaSalva = despesaAtualizada;
        } else {
          // Insere nova despesa
          despesaSalva = await this.despesaRepository.save(despesa);
        }

        despesasSalvas.push(despesaSalva);
      } catch (error) {
        this.logger.warn(`Erro ao salvar despesa do deputado ${despesa.deputadoId}:`, error.message);
      }
    }
    
    this.logger.log(`${despesasSalvas.length} de ${despesas.length} despesas processadas com sucesso`);
    return despesasSalvas;
  }
}
