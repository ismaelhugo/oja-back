import { DataSource } from 'typeorm';
import { Deputado } from '../../deputado/deputado.entity';
import { DeputadoImportService } from '../../deputado/deputado-import.service';
import { HttpService } from '@nestjs/axios';

export class DeputadoSeed {
    async run(dataSource: DataSource, force: boolean = false): Promise<void> {
        console.log('🏛️  Importando deputados...');
        
        const deputadoRepository = dataSource.getRepository(Deputado);
        
        // Verificar se já existem deputados (apenas se não for forçado)
        if (!force) {
            const count = await deputadoRepository.count();
            if (count > 0) {
                console.log(`⚠️  Já existem ${count} deputados na base. Pulando importação.`);
                console.log('💡 Para forçar reimportação, use: npm run seed:refresh');
                return;
            }
        } else {
            // Se for forçado, limpar dados existentes
            const count = await deputadoRepository.count();
            if (count > 0) {
                console.log(`🗑️  Removendo ${count} deputados existentes...`);
                await deputadoRepository.clear();
            }
        }
        
        try {
            // Usar o serviço existente para importar deputados
            const httpService = new HttpService();
            const importService = new DeputadoImportService(httpService);
            
            console.log('📥 Iniciando importação de deputados da legislatura atual...');
            
            // Importar deputados atuais (legislatura 57) - agora com paginação corrigida
            const deputados = await importService.importarDeputadosAtuais();
            
            console.log(`📊 Total de deputados a serem salvos: ${deputados.length}`);
            
            // Salvar no banco em lotes para melhor performance
            const loteSize = 50;
            let salvos = 0;
            
            for (let i = 0; i < deputados.length; i += loteSize) {
                const lote = deputados.slice(i, i + loteSize);
                
                for (const deputadoData of lote) {
                    const deputado = deputadoRepository.create(deputadoData);
                    await deputadoRepository.save(deputado);
                    salvos++;
                }
                
                console.log(`💾 Progresso: ${salvos}/${deputados.length} deputados salvos`);
            }
            
            console.log(`✅ ${deputados.length} deputados importados com sucesso!`);
        } catch (error) {
            console.error('❌ Erro ao importar deputados:', error);
            throw error;
        }
    }
}
