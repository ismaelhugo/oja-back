import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DespesaService } from './despesa.service';
import { DeputadoService } from '../deputado/deputado.service';

async function main() {
  console.log('🚀 Iniciando CLI de importação de despesas...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const despesaService = app.get(DespesaService);
  const deputadoService = app.get(DeputadoService);
  
  const comando = process.argv[2] || 'help';
  const deputadoId = process.argv[3] ? Number(process.argv[3]) : undefined;
  const ano = process.argv[4] ? Number(process.argv[4]) : undefined;
  const mes = process.argv[5] ? Number(process.argv[5]) : undefined;
  
  try {
    switch (comando) {
      case 'deputado':
        if (deputadoId === undefined) {
          console.log('❌ É necessário fornecer o ID do deputado');
          console.log('Uso: npm run import:despesas deputado <deputadoId> [ano] [mes]');
          break;
        }
        
        console.log(`📥 Importando despesas do deputado ${deputadoId}...`);
        if (ano) console.log(`🗓️  Ano: ${ano}`);
        if (mes) console.log(`📅 Mês: ${mes}`);
        
        const despesas = await despesaService.importarDespesasDeputadoESalvar(deputadoId, ano, mes);
        console.log(`✅ Importadas ${despesas.length} despesas do deputado ${deputadoId}`);
        break;
        
      case 'multiplos':
        console.log('📥 Importando despesas de múltiplos deputados...');
        
        // Buscar alguns deputados ativos para teste
        const deputados = await deputadoService.findAllPaginated(1, 10);
        const deputadosIds = deputados.data.map(d => d.id);
        
        console.log(`👥 Importando despesas de ${deputadosIds.length} deputados...`);
        
        const resultado = await despesaService.importarDespesasMultiplosDeputadosESalvar(deputadosIds, ano, mes);
        const totalDespesas = resultado.reduce((sum, item) => sum + item.count, 0);
        const deputadosComSucesso = resultado.filter(item => item.count > 0).length;
        
        console.log(`✅ Importadas ${totalDespesas} despesas de ${deputadosComSucesso}/${deputadosIds.length} deputados`);
        
        // Mostrar detalhes
        resultado.forEach(r => {
          if (r.count > 0) {
            console.log(`  • Deputado ${r.deputadoId}: ${r.count} despesas`);
          }
        });
        break;
        
      case 'todos-atuais':
        console.log('📥 Importando despesas de todos os deputados atuais...');
        
        // Buscar todos os deputados da legislatura atual (57)
        const deputadosAtuais = await deputadoService.findAllPaginated(1, 0, { legislatura: 57 });
        const idsDeputadosAtuais = deputadosAtuais.data.map(d => d.id);
        
        console.log(`👥 Encontrados ${idsDeputadosAtuais.length} deputados da legislatura atual`);
        console.log('⚠️  Esta operação pode demorar muito tempo...');
        
        const resultadoTodos = await despesaService.importarDespesasMultiplosDeputadosESalvar(idsDeputadosAtuais, ano, mes);
        const totalDespesasTodos = resultadoTodos.reduce((sum, item) => sum + item.count, 0);
        const deputadosComSucessoTodos = resultadoTodos.filter(item => item.count > 0).length;
        
        console.log(`✅ Importação concluída: ${totalDespesasTodos} despesas de ${deputadosComSucessoTodos}/${idsDeputadosAtuais.length} deputados`);
        break;
        
      case 'contar':
        const filtroDeputado = deputadoId !== undefined ? { deputadoId } : {};
        const count = await despesaService.count({ ...filtroDeputado, ano, mes });
        console.log(`📊 Total de despesas no banco: ${count}`);
        if (deputadoId !== undefined) console.log(`👤 Deputado: ${deputadoId}`);
        if (ano !== undefined) console.log(`🗓️  Ano: ${ano}`);
        if (mes !== undefined) console.log(`📅 Mês: ${mes}`);
        break;
        
      case 'limpar':
        if (deputadoId !== undefined) {
          console.log(`🗑️  Limpando despesas do deputado ${deputadoId}...`);
          await despesaService.clearByDeputado(deputadoId);
          console.log(`✅ Despesas do deputado ${deputadoId} removidas`);
        } else {
          console.log('🗑️  Limpando TODAS as despesas...');
          await despesaService.clearAll();
          console.log('✅ Todas as despesas foram removidas');
        }
        break;
        
      case 'estatisticas':
        if (deputadoId === undefined) {
          console.log('❌ É necessário fornecer o ID do deputado para estatísticas');
          console.log('Uso: npm run import:despesas estatisticas <deputadoId> [ano]');
          break;
        }
        
        console.log(`📊 Gerando estatísticas do deputado ${deputadoId}...`);
        const stats = await despesaService.obterEstatisticasDeputado(deputadoId, ano);
        
        console.log(`\n📈 Estatísticas do Deputado ${deputadoId}:`);
        console.log(`💰 Total gasto: R$ ${stats.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        console.log(`📄 Total de documentos: ${stats.totalDocumentos}`);
        console.log(`🏪 Total de fornecedores: ${stats.totalFornecedores}`);
        
        console.log('\n🏷️  Gastos por tipo:');
        Object.entries(stats.gastosPorTipo).forEach(([tipo, valor]: [string, any]) => {
          console.log(`  • ${tipo}: R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        });
        break;
        
      default:
        console.log('Comandos disponíveis:');
        console.log('');
        console.log('📥 IMPORTAÇÃO:');
        console.log('  npm run import:despesas deputado <deputadoId> [ano] [mes]');
        console.log('    # Importa despesas de um deputado específico');
        console.log('');
        console.log('  npm run import:despesas multiplos [ano] [mes]');
        console.log('    # Importa despesas de 10 deputados (para teste)');
        console.log('');
        console.log('  npm run import:despesas todos-atuais [ano] [mes]');
        console.log('    # Importa despesas de TODOS os deputados atuais (legislatura 57)');
        console.log('');
        console.log('📊 CONSULTAS:');
        console.log('  npm run import:despesas contar [deputadoId] [ano] [mes]');
        console.log('    # Conta despesas no banco com filtros opcionais');
        console.log('');
        console.log('  npm run import:despesas estatisticas <deputadoId> [ano]');
        console.log('    # Mostra estatísticas detalhadas de um deputado');
        console.log('');
        console.log('🗑️  LIMPEZA:');
        console.log('  npm run import:despesas limpar [deputadoId]');
        console.log('    # Remove despesas (todas ou de um deputado específico)');
        console.log('');
        console.log('💡 Exemplos:');
        console.log('  npm run import:despesas deputado 74848      # Importa todas as despesas');
        console.log('  npm run import:despesas deputado 74848 2024 # Importa despesas de 2024');
        console.log('  npm run import:despesas deputado 74848 2024 12 # Importa despesas de dez/2024');
        console.log('  npm run import:despesas contar 74848 2024   # Conta despesas do deputado em 2024');
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.response) {
      console.error('📡 Resposta da API:', error.response.status, error.response.statusText);
    }
  } finally {
    await app.close();
  }
}

main();
