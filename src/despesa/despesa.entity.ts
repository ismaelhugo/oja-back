import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Deputado } from '../deputado/deputado.entity';

@Entity('despesas')
@Index(['deputadoId', 'ano', 'mes']) // Índice composto para melhor performance
@Index(['tipoDespesa'])
@Index(['ano', 'mes'])
export class Despesa {
  @PrimaryGeneratedColumn()
  id_local: number; // ID gerado no banco

  @Column()
  deputadoId: number; // ID do deputado (referência para a API)

  @Column()
  ano: number;

  @Column({ nullable: true })
  cnpjCpfFornecedor: string;

  @Column()
  codDocumento: number;

  @Column()
  codLote: number;

  @Column()
  codTipoDocumento: number;

  @Column()
  dataDocumento: string;

  @Column()
  mes: number;

  @Column()
  nomeFornecedor: string;

  @Column()
  numDocumento: string;

  @Column({ nullable: true })
  numRessarcimento: string;

  @Column()
  parcela: number;

  @Column()
  tipoDespesa: string;

  @Column()
  tipoDocumento: string;

  @Column({ nullable: true })
  urlDocumento: string;

  @Column('decimal', { precision: 10, scale: 2 })
  valorDocumento: number;

  @Column('decimal', { precision: 10, scale: 2 })
  valorGlosa: number;

  @Column('decimal', { precision: 10, scale: 2 })
  valorLiquido: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Relacionamento com Deputado
  @ManyToOne(() => Deputado, { eager: false })
  @JoinColumn({ name: 'deputadoId', referencedColumnName: 'id' })
  deputado?: Deputado;
}
