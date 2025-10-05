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

  async importarDespesasParaleloComCheckpoint(
    deputadosIds: number[],
    ano?: number,
    mes?: number,
    batchSize: number = 10,
    deputadosProcessados: number[] = []
  ): Promise<{
    sucesso: { deputadoId: number; count: number }[];
    falhas: { deputadoId: number; erro: string }[];
    totalDespesas: number;
  }> {
    const sucesso: { deputadoId: number; count: number }[] = [];
    const falhas: { deputadoId: number; erro: string }[] = [];
    
    // Filtrar deputados já processados
    const deputadosPendentes = deputadosIds.filter(id => !deputadosProcessados.includes(id));
    
    this.logger.log(`Total de deputados: ${deputadosIds.length}`);
    this.logger.log(`Já processados: ${deputadosProcessados.length}`);
    this.logger.log(`Pendentes: ${deputadosPendentes.length}`);
    
    // Dividir em lotes
    const lotes: number[][] = [];
    for (let i = 0; i < deputadosPendentes.length; i += batchSize) {
      lotes.push(deputadosPendentes.slice(i, i + batchSize));
    }
    
    // Processar cada lote
    for (let i = 0; i < lotes.length; i++) {
      const lote = lotes[i];
      this.logger.log(`\n📦 Processando lote ${i + 1}/${lotes.length} (${lote.length} deputados)...`);
      
      // Processar deputados do lote em paralelo
      const promises = lote.map(async (deputadoId) => {
        try {
          const despesas = await this.importarDespesasDeputadoESalvar(deputadoId, ano, mes);
          return {
            deputadoId,
            count: despesas.length,
            success: true,
            erro: null
          };
        } catch (error) {
          return {
            deputadoId,
            count: 0,
            success: false,
            erro: error.message || 'Erro desconhecido'
          };
        }
      });
      
      const resultadosLote = await Promise.all(promises);
      
      // Separar sucessos e falhas
      resultadosLote.forEach(resultado => {
        if (resultado.success) {
          sucesso.push({ deputadoId: resultado.deputadoId, count: resultado.count });
        } else {
          falhas.push({ deputadoId: resultado.deputadoId, erro: resultado.erro });
        }
      });
      
      // Log do progresso
      const sucessosLote = resultadosLote.filter(r => r.success).length;
      const despesasLote = resultadosLote.reduce((sum, r) => sum + r.count, 0);
      this.logger.log(`✅ Lote ${i + 1} concluído: ${despesasLote} despesas (${sucessosLote}/${lote.length} sucessos)`);
      
      // Mostrar erros do lote
      const errosLote = resultadosLote.filter(r => !r.success);
      if (errosLote.length > 0) {
        errosLote.forEach(erro => {
          this.logger.warn(`  ❌ Deputado ${erro.deputadoId}: ${erro.erro}`);
        });
      }
      
      // Pausa entre lotes
      if (i < lotes.length - 1) {
        this.logger.log('⏸️  Pausa de 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const totalDespesas = sucesso.reduce((sum, s) => sum + s.count, 0);
    
    return {
      sucesso,
      falhas,
      totalDespesas
    };
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

  // Método privado para salvar com upsert OTIMIZADO
  private async salvarDespesasComUpsert(despesas: any[]): Promise<Despesa[]> {
    if (despesas.length === 0) {
      return [];
    }

    const despesasSalvas: Despesa[] = [];
    
    try {
      // SIMPLIFICADO: Buscar despesas existentes apenas por codDocumento e numDocumento
      const deputadoId = despesas[0].deputadoId;
      
      // Extrair todos os codDocumento e numDocumento únicos
      const codsDocumento = [...new Set(despesas.map(d => d.codDocumento))];
      const numsDocumento = [...new Set(despesas.map(d => d.numDocumento))];
      
      // Buscar todas as despesas existentes deste deputado com esses documentos
      const despesasExistentes = await this.despesaRepository
        .createQueryBuilder('despesa')
        .where('despesa.deputadoId = :deputadoId', { deputadoId })
        .andWhere('despesa.codDocumento IN (:...codsDocumento)', { codsDocumento })
        .andWhere('despesa.numDocumento IN (:...numsDocumento)', { numsDocumento })
        .getMany();

      // Criar mapa usando APENAS codDocumento e numDocumento como chave
      const mapaExistentes = new Map<string, Despesa>();
      despesasExistentes.forEach(d => {
        const chave = `${d.codDocumento}-${d.numDocumento}`;
        mapaExistentes.set(chave, d);
      });

      // Separar despesas novas das existentes
      const despesasNovas: any[] = [];
      const despesasParaAtualizar: any[] = [];

      for (const despesa of despesas) {
        const chave = `${despesa.codDocumento}-${despesa.numDocumento}`;
        const existente = mapaExistentes.get(chave);

        if (existente) {
          // Atualizar apenas se houver mudança nos valores
          if (this.despesaMudou(existente, despesa)) {
            despesasParaAtualizar.push({ id: existente.id_local, dados: despesa });
          } else {
            // Despesa já existe e está igual, apenas adicionar à lista de salvas
            despesasSalvas.push(existente);
          }
        } else {
          despesasNovas.push(despesa);
        }
      }

      // Inserir despesas novas em batch
      if (despesasNovas.length > 0) {
        this.logger.log(`💾 Inserindo ${despesasNovas.length} despesas novas...`);
        const novasSalvas = await this.despesaRepository.save(despesasNovas);
        despesasSalvas.push(...novasSalvas);
      }

      // Atualizar despesas modificadas
      if (despesasParaAtualizar.length > 0) {
        this.logger.log(`🔄 Atualizando ${despesasParaAtualizar.length} despesas modificadas...`);
        for (const item of despesasParaAtualizar) {
          await this.despesaRepository.update(item.id, item.dados);
          const atualizada = await this.despesaRepository.findOne({ where: { id_local: item.id } });
          if (atualizada) {
            despesasSalvas.push(atualizada);
          }
        }
      }

      const ignoradas = despesas.length - despesasNovas.length - despesasParaAtualizar.length;
      if (ignoradas > 0) {
        this.logger.log(`⏭️  ${ignoradas} despesas já existentes (sem alterações)`);
      }

      this.logger.log(`✅ ${despesasSalvas.length} de ${despesas.length} despesas processadas (${despesasNovas.length} novas, ${despesasParaAtualizar.length} atualizadas, ${ignoradas} ignoradas)`);
      
    } catch (error) {
      this.logger.error(`Erro ao salvar despesas em batch:`, error.message);
      throw error;
    }
    
    return despesasSalvas;
  }

  // Método auxiliar para verificar se despesa mudou
  private despesaMudou(existente: Despesa, nova: any): boolean {
    return (
      existente.valorDocumento !== nova.valorDocumento ||
      existente.valorGlosa !== nova.valorGlosa ||
      existente.valorLiquido !== nova.valorLiquido ||
      existente.tipoDespesa !== nova.tipoDespesa ||
      existente.nomeFornecedor !== nova.nomeFornecedor
    );
  }
}
