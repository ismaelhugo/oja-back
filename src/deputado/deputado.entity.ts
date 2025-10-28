// deputado/deputado.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('deputados')
export class Deputado {
  @PrimaryGeneratedColumn()
  id_local: number; // Generated ID in database

  @Column({ unique: true })
  id: number; // Official API ID from Chamber of Deputies

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