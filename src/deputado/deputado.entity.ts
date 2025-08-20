// deputado/deputado.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('deputados')
export class Deputado {
  @PrimaryGeneratedColumn()
  id_local: number; // ID gerado no banco

  @Column({ unique: true })
  id: number; // ID oficial da API da câmara

  @Column()
  uri: string;

  @Column()
  nome: string;

  @Column()
  siglaPartido: string;

  @Column()
  uriPartido: string;

  @Column()
  siglaUf: string;

  @Column()
  idLegislatura: number;

  @Column()
  urlFoto: string;

  @Column({ nullable: true })
  email: string;
}