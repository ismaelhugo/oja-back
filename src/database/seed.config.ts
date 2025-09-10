import { DataSource } from 'typeorm';
import { AppDataSource } from '../data-source';

export class SeederService {
    private dataSource: DataSource;

    constructor() {
        this.dataSource = AppDataSource;
    }

    async run(): Promise<void> {
        try {
            await this.dataSource.initialize();
            console.log('🌱 Iniciando seeds...');
            
            // Importar e executar seeds aqui
            const { DeputadoSeed } = await import('./seeds/deputado.seed');
            const deputadoSeed = new DeputadoSeed();
            await deputadoSeed.run(this.dataSource);
            
            console.log('✅ Seeds executados com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao executar seeds:', error);
            throw error;
        } finally {
            await this.dataSource.destroy();
        }
    }

    async runForce(): Promise<void> {
        try {
            await this.dataSource.initialize();
            console.log('🌱 Iniciando seeds FORÇADOS (limpando dados existentes)...');
            
            // Usar seed que força reimportação
            const { DeputadoSeedForce } = await import('./seeds/deputado-force.seed');
            const deputadoSeedForce = new DeputadoSeedForce();
            await deputadoSeedForce.run(this.dataSource);
            
            console.log('✅ Seeds forçados executados com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao executar seeds forçados:', error);
            throw error;
        } finally {
            await this.dataSource.destroy();
        }
    }

    async drop(): Promise<void> {
        try {
            await this.dataSource.initialize();
            console.log('🗑️  Limpando banco de dados...');
            
            // Limpar dados (cuidado em produção!)
            await this.dataSource.query('TRUNCATE TABLE deputados RESTART IDENTITY CASCADE');
            
            console.log('✅ Banco limpo com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao limpar banco:', error);
        } finally {
            await this.dataSource.destroy();
        }
    }
}
