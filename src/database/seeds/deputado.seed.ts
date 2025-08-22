import { DataSource } from 'typeorm';
import { Deputado } from '../../deputado/deputado.entity';
import { DeputadoImportService } from '../../deputado/deputado-import.service';
import { HttpService } from '@nestjs/axios';

export class DeputadoSeed {
    async run(dataSource: DataSource): Promise<void> {
        console.log('🏛️  Importando deputados...');
        
        const deputadoRepository = dataSource.getRepository(Deputado);
        
        // Verificar se já existem deputados
        const count = await deputadoRepository.count();
        if (count > 0) {
            console.log(`⚠️  Já existem ${count} deputados na base. Pulando importação.`);
            return;
        }
        
        try {
            // Usar o serviço existente para importar deputados
            const httpService = new HttpService();
            const importService = new DeputadoImportService(httpService);
            
            // Importar deputados atuais (legislatura 57)
            const deputados = await importService.importarDeputadosAtuais();
            
            // Salvar no banco
            for (const deputadoData of deputados) {
                const deputado = deputadoRepository.create(deputadoData);
                await deputadoRepository.save(deputado);
            }
            
            console.log(`✅ ${deputados.length} deputados importados com sucesso!`);
        } catch (error) {
            console.error('❌ Erro ao importar deputados:', error);
            throw error;
        }
    }
}
