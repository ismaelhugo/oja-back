import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, Like } from 'typeorm';
import { Deputado } from './deputado.entity';
import { DeputadoImportService } from './deputado-import.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class DeputadoService {
  private readonly logger = new Logger(DeputadoService.name);
  
  constructor(
    @InjectRepository(Deputado)
    private readonly deputadoRepository: Repository<Deputado>,
    private readonly deputadoImportService: DeputadoImportService,
  ) {}

  async create(deputado: Partial<Deputado>): Promise<Deputado> {
    return this.deputadoRepository.save(deputado);
  }

  async findAll(): Promise<Deputado[]> {
    return this.deputadoRepository.find({ where: { siglaPartido: Not('ABC') } });
  }

  async findAllPaginated(
    page?: number, 
    limit?: number,
    filters?: { nome?: string; legislatura?: number; partido?: string; estado?: string }
  ): Promise<{ data: Deputado[]; total: number; page?: number; limit?: number; totalAll: number }> {
    // Monta condições de filtro
    const where: any = { siglaPartido: Not('ABC') };
    
    if (filters?.nome) {
      where.nome = Like(`%${filters.nome}%`);
    }
    if (filters?.legislatura) {
      where.idLegislatura = filters.legislatura;
    }
    if (filters?.partido) {
      where.siglaPartido = filters.partido;
    }
    if (filters?.estado) {
      where.siglaUf = Like(`%${filters.estado}%`);
    }

    const totalAll = await this.deputadoRepository.count({ where });
    if (limit !== undefined && Number(limit) <= 0) {
      const [data, total] = await this.deputadoRepository.findAndCount({ where, order: { nome: 'ASC' } });
      return { data, total, totalAll };
    }
    const pageNum = page ?? 1;
    const limitNum = limit ?? 20;
    const [data, total] = await this.deputadoRepository.findAndCount({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      order: { nome: 'ASC' },
    });
    return { data, total, page: pageNum, limit: limitNum, totalAll };
  }

  async findOne(id: number): Promise<Deputado | null> {
    return this.deputadoRepository.findOneBy({ id, siglaPartido: Not('ABC') });
  }

  async update(id: number, updateData: Partial<Deputado>): Promise<Deputado | null> {
    await this.deputadoRepository.update({ id }, updateData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.deputadoRepository.delete({ id });
  }

  async importarDeputadosPorLegislaturaESalvar(idLegislatura: number): Promise<Deputado[]> {
    const deputados = await this.deputadoImportService.importarDeputadosPorLegislatura(idLegislatura);
    return this.salvarDeputadosComUpsert(deputados);
  }

  async importarTodosDeputadosESalvar(): Promise<Deputado[]> {
    const deputados = await this.deputadoImportService.importarTodosDeputados();
    this.logger.log(`Salvando ${deputados.length} deputados no banco de dados...`);
    return this.salvarDeputadosComUpsert(deputados);
  }

  async importarDeputadosAtuaisESalvar(): Promise<Deputado[]> {
    const deputados = await this.deputadoImportService.importarDeputadosAtuais();
    this.logger.log(`Salvando ${deputados.length} deputados atuais no banco de dados...`);
    return this.salvarDeputadosComUpsert(deputados);
  }

  async count(): Promise<number> {
    return this.deputadoRepository.count();
  }

  async clearAll(): Promise<void> {
    this.logger.log('Removendo todos os deputados...');
    await this.deputadoRepository.clear();
    this.logger.log('Todos os deputados foram removidos');
  }

  private async salvarDeputadosComUpsert(deputados: any[]): Promise<Deputado[]> {
    const deputadosSalvos: Deputado[] = [];
    
    for (const deputado of deputados) {
      try {
        // Usa upsert: insere se não existir, atualiza se já existir
        await this.deputadoRepository.upsert(deputado, ['id']);
        deputadosSalvos.push(deputado);
      } catch (error) {
        this.logger.warn(`Erro ao salvar deputado ${deputado.nome} (ID: ${deputado.id}):`, error.message);
      }
    }
    
    this.logger.log(`${deputadosSalvos.length} de ${deputados.length} deputados processados com sucesso`);
    return deputadosSalvos;
  }
}
