import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DespesaService } from './despesa.service';
import { DeputadoService } from '../deputado/deputado.service';
import * as fs from 'fs';
import * as path from 'path';

// Arquivo de checkpoint para salvar progresso
const CHECKPOINT_FILE = path.join(__dirname, '../../.checkpoint-despesas.json');

interface Checkpoint {
  deputadosProcessados: number[];
  deputadosComErro: number[];
  timestamp: string;
  ano?: number;
  mes?: number;
}

function salvarCheckpoint(checkpoint: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  console.log(`💾 Checkpoint salvo: ${checkpoint.deputadosProcessados.length} processados, ${checkpoint.deputadosComErro.length} com erro`);
}

function carregarCheckpoint(): Checkpoint | null {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return null;
}

function limparCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('🗑️  Checkpoint removido');
  }
}

async function main() {
  console.log('🚀 Iniciando CLI de importação de despesas...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const despesaService = app.get(DespesaService);
  const deputadoService = app.get(DeputadoService);
  
  const comando = process.argv[2] || 'help';
  
  // Comandos que NÃO usam deputadoId: os parâmetros começam em argv[3]
  const comandosSemDeputadoId = ['todos-atuais', 'todos-atuais-paralelo', 'multiplos', 'contar', 'limpar', 'limpar-checkpoint', 'ver-checkpoint'];
  const usaDeputadoId = !comandosSemDeputadoId.includes(comando);
  
  let deputadoId: number | undefined;
  let ano: number | undefined;
  let mes: number | undefined;
  
  if (usaDeputadoId) {
    // Comandos como: deputado <deputadoId> [ano] [mes]
    deputadoId = process.argv[3] ? Number(process.argv[3]) : undefined;
    ano = process.argv[4] ? Number(process.argv[4]) : undefined;
    mes = process.argv[5] ? Number(process.argv[5]) : undefined;
  } else {
    // Comandos como: todos-atuais [ano] [mes]
    deputadoId = undefined;
    ano = process.argv[3] ? Number(process.argv[3]) : undefined;
    mes = process.argv[4] ? Number(process.argv[4]) : undefined;
  }
  
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
        
      case 'todos-atuais-paralelo':
        const batchSize = process.argv[6] ? Number(process.argv[6]) : 10;
        
        console.log('🚀 Importando despesas em PARALELO de todos os deputados atuais...');
        
        // Verificar se existe checkpoint
        const checkpointExistente = carregarCheckpoint();
        let deputadosJaProcessados: number[] = [];
        
        if (checkpointExistente && checkpointExistente.ano === ano && checkpointExistente.mes === mes) {
          console.log('📋 Checkpoint encontrado!');
          console.log(`   Processados: ${checkpointExistente.deputadosProcessados.length}`);
          console.log(`   Com erro: ${checkpointExistente.deputadosComErro.length}`);
          deputadosJaProcessados = checkpointExistente.deputadosProcessados;
        }
        
        // Buscar todos os deputados da legislatura atual (57)
        const deputadosParalelo = await deputadoService.findAllPaginated(1, 0, { legislatura: 57 });
        const idsDeputadosParalelo = deputadosParalelo.data.map(d => d.id);
        
        console.log(`👥 Total: ${idsDeputadosParalelo.length} deputados`);
        console.log(`⚡ Tamanho do lote: ${batchSize}`);
        if (ano) console.log(`🗓️  Ano: ${ano}`);
        if (mes) console.log(`📅 Mês: ${mes}`);
        
        const startTime = Date.now();
        
        const resultadoParalelo = await despesaService.importarDespesasParaleloComCheckpoint(
          idsDeputadosParalelo,
          ano,
          mes,
          batchSize,
          deputadosJaProcessados
        );
        
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
        
        // Salvar checkpoint com resultados finais
        const checkpointFinal: Checkpoint = {
          deputadosProcessados: resultadoParalelo.sucesso.map(s => s.deputadoId),
          deputadosComErro: resultadoParalelo.falhas.map(f => f.deputadoId),
          timestamp: new Date().toISOString(),
          ano,
          mes
        };
        salvarCheckpoint(checkpointFinal);
        
        console.log(`\n🎉 PROCESSAMENTO PARALELO CONCLUÍDO em ${duration} minutos!`);
        console.log(`📊 Resultado:`);
        console.log(`   ✅ Sucessos: ${resultadoParalelo.sucesso.length}/${idsDeputadosParalelo.length} deputados`);
        console.log(`   💾 Total de despesas: ${resultadoParalelo.totalDespesas.toLocaleString('pt-BR')}`);
        console.log(`   ❌ Falhas: ${resultadoParalelo.falhas.length}`);
        
        // Mostrar deputados com erro
        if (resultadoParalelo.falhas.length > 0) {
          console.log(`\n❌ Deputados com erro:`);
          resultadoParalelo.falhas.forEach(f => {
            console.log(`   • Deputado ${f.deputadoId}: ${f.erro}`);
          });
          console.log(`\n💡 Para reprocessar apenas os que falharam, execute novamente o comando.`);
        } else {
          console.log(`\n✨ Processamento 100% concluído sem erros!`);
          limparCheckpoint();
        }
        break;
        
      case 'limpar-checkpoint':
        limparCheckpoint();
        console.log('✅ Checkpoint removido com sucesso');
        break;
        
      case 'ver-checkpoint':
        const checkpoint = carregarCheckpoint();
        if (checkpoint) {
          console.log('📋 Checkpoint atual:');
          console.log(`   Timestamp: ${checkpoint.timestamp}`);
          console.log(`   Processados: ${checkpoint.deputadosProcessados.length}`);
          console.log(`   Com erro: ${checkpoint.deputadosComErro.length}`);
          if (checkpoint.ano) console.log(`   Ano: ${checkpoint.ano}`);
          if (checkpoint.mes) console.log(`   Mês: ${checkpoint.mes}`);
          console.log(`\n   IDs processados: ${checkpoint.deputadosProcessados.join(', ')}`);
          if (checkpoint.deputadosComErro.length > 0) {
            console.log(`   IDs com erro: ${checkpoint.deputadosComErro.join(', ')}`);
          }
        } else {
          console.log('❌ Nenhum checkpoint encontrado');
        }
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
        console.log('  npm run import:despesas todos-atuais-paralelo [ano] [mes] [batchSize]');
        console.log('    # Importa despesas de TODOS os deputados atuais em paralelo com checkpoint');
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
        console.log('🛠️  CHECKPOINT:');
        console.log('  npm run import:despesas limpar-checkpoint');
        console.log('    # Remove o checkpoint atual');
        console.log('');
        console.log('  npm run import:despesas ver-checkpoint');
        console.log('    # Exibe o checkpoint atual');
        console.log('');
        console.log('💡 Exemplos:');
        console.log('  npm run import:despesas deputado 74848      # Importa todas as despesas');
        console.log('  npm run import:despesas deputado 74848 2024 # Importa despesas de 2024');
        console.log('  npm run import:despesas deputado 74848 2024 12 # Importa despesas de dez/2024');
        console.log('  npm run import:despesas contar 74848 2024   # Conta despesas do deputado em 2024');
        console.log('  npm run import:despesas todos-atuais-paralelo 2025 # Importa 2025 em paralelo');
        console.log('  npm run import:despesas todos-atuais-paralelo 2025 0 20 # Lotes de 20');
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
