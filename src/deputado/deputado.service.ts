import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.deputadoRepository.find();
  }

  async findOne(id: number): Promise<Deputado | null> {
    return this.deputadoRepository.findOneBy({ id });
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
