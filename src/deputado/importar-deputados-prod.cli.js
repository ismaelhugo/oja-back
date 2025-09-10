#!/usr/bin/env node
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../app.module');
const { DeputadoService } = require('../deputado/deputado.service');

async function main() {
  console.log('🚀 Importando deputados em produção...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const deputadoService = app.get(DeputadoService);
  
  const comando = process.argv[2] || 'atuais';
  
  try {
    switch (comando) {
      case 'atuais':
        console.log('📥 Importando deputados ATUAIS (legislatura 57)...');
        const atuais = await deputadoService.importarDeputadosAtuaisESalvar();
        console.log(`✅ Importados ${atuais.length} deputados atuais`);
        break;
        
      case 'todos':
        console.log('📥 Importando TODOS os deputados...');
        const todos = await deputadoService.importarTodosDeputadosESalvar();
        console.log(`✅ Importados ${todos.length} deputados`);
        break;
        
      default:
        console.log('❌ Comando inválido. Use: atuais ou todos');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

main();
