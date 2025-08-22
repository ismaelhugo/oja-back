import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateDeputadosTable1661234567890 implements MigrationInterface {
    name = 'CreateDeputadosTable1661234567890';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'deputados',
                columns: [
                    {
                        name: 'id_local',
                        type: 'serial',
                        isPrimary: true,
                    },
                    {
                        name: 'id',
                        type: 'int',
                        isUnique: true,
                        comment: 'ID oficial da API da Câmara',
                    },
                    {
                        name: 'uri',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'nome',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'siglaPartido',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'uriPartido',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'siglaUf',
                        type: 'varchar',
                        length: '2',
                        isNullable: false,
                    },
                    {
                        name: 'idLegislatura',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'urlFoto',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
                indices: [
                    {
                        name: 'IDX_DEPUTADO_PARTIDO',
                        columnNames: ['siglaPartido'],
                    },
                    {
                        name: 'IDX_DEPUTADO_UF',
                        columnNames: ['siglaUf'],
                    },
                    {
                        name: 'IDX_DEPUTADO_LEGISLATURA',
                        columnNames: ['idLegislatura'],
                    },
                ],
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('deputados');
    }
}
