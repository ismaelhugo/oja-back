import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DeputadoService } from './deputado.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const deputadoService = app.get(DeputadoService);
  
  const comando = process.argv[2] || 'atuais';
  
  try {
    switch (comando) {
      case 'todos':
        console.log('Importando TODOS os deputados...');
        const todosDeps = await deputadoService.importarTodosDeputadosESalvar();
        console.log(`✅ Importados ${todosDeps.length} deputados`);
        break;
        
      case 'atuais':
        console.log('Importando deputados ATUAIS (leg. 57)...');
        const atuais = await deputadoService.importarDeputadosAtuaisESalvar();
        console.log(`✅ Importados ${atuais.length} deputados atuais`);
        break;
        
      case 'legislatura':
        const idLegislatura = Number(process.argv[3]) || 57;
        console.log(`Importando deputados da legislatura ${idLegislatura}...`);
        const result = await deputadoService.importarDeputadosPorLegislaturaESalvar(idLegislatura);
        console.log(`✅ Importados ${result.length} deputados da legislatura ${idLegislatura}`);
        break;
        
      default:
        console.log('Comandos disponíveis:');
        console.log('  npm run import:deputados atuais        # Importa deputados atuais (leg. 57)');
        console.log('  npm run import:deputados todos         # Importa TODOS os deputados');
        console.log('  npm run import:deputados legislatura 56  # Importa deputados de uma legislatura específica');
    }
  } catch (error) {
    console.error('❌ Erro durante a importação:', error);
  }
  
  await app.close();
}

main();
