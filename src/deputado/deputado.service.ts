import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deputado } from './deputado.entity';

@Injectable()
export class DeputadoService {
  constructor(
    @InjectRepository(Deputado)
    private readonly deputadoRepository: Repository<Deputado>,
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
}
