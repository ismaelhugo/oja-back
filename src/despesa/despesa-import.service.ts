import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DespesaApiResponse, DespesaDto } from './dtos/despesa.dto';

@Injectable()
export class DespesaImportService {
  private readonly logger = new Logger(DespesaImportService.name);
  
  constructor(private readonly httpService: HttpService) {}

  async importarDespesasDeputado(
    deputadoId: number, 
    ano?: number, 
    mes?: number
  ): Promise<DespesaDto[]> {
    let todasDespesas: DespesaDto[] = [];
    let pagina = 1;
    const itemsPorPagina = 100;
    let temMaisPaginas = true;

    this.logger.log(`Iniciando importação de despesas do deputado ${deputadoId}...`);

    while (temMaisPaginas) {
      try {
        let url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${deputadoId}/despesas?pagina=${pagina}&itens=${itemsPorPagina}&ordem=ASC&ordenarPor=ano`;
        
        // Adicionar filtros de ano e mês se fornecidos
        if (ano) {
          url += `&ano=${ano}`;
        }
        if (mes) {
          url += `&mes=${mes}`;
        }
        
        this.logger.log(`Buscando página ${pagina} de despesas do deputado ${deputadoId}...`);
        
        const response: any = await firstValueFrom(
          this.httpService.get(url, {
            timeout: 30000, // 30 segundos de timeout
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'OJA-Backend/1.0'
            }
          })
        );
        
        const data: DespesaApiResponse = response.data;
        
        if (data.dados && data.dados.length > 0) {
          todasDespesas = todasDespesas.concat(data.dados);
          this.logger.log(`Página ${pagina}: ${data.dados.length} despesas encontradas. Total: ${todasDespesas.length}`);
          
          // Verifica se retornou menos itens que o solicitado (indica última página)
          if (data.dados.length < itemsPorPagina) {
            this.logger.log(`Última página atingida - retornou ${data.dados.length} de ${itemsPorPagina} possíveis`);
            temMaisPaginas = false;
          } else {
            // Verifica se existe próxima página nos links
            const temProximaPagina = data.links?.some(link => link.rel === 'next');
            
            if (!temProximaPagina) {
              this.logger.log('Não há link "next" - fim da paginação');
              temMaisPaginas = false;
            } else {
              pagina++;
              // Delay entre requisições para não sobrecarregar a API
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } else {
          temMaisPaginas = false;
        }
      } catch (error) {
        this.logger.error(`Erro ao buscar página ${pagina} do deputado ${deputadoId}:`, error.message);
        
        // Se for erro 404, para a busca
        if (error.response?.status === 404) {
          this.logger.log('Página não encontrada - fim da paginação ou deputado sem despesas');
          temMaisPaginas = false;
        } else if (error.response?.status === 429) {
          // Rate limit - espera mais tempo e tenta novamente
          this.logger.warn('Rate limit atingido, aguardando 2 segundos...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue; // Tenta a mesma página novamente
        } else {
          // Para outros erros, para a importação
          temMaisPaginas = false;
        }
      }
    }

    this.logger.log(`Importação de despesas do deputado ${deputadoId} concluída: ${todasDespesas.length} despesas encontradas`);
    return todasDespesas;
  }

  async importarDespesasMultiplosDeputados(
    deputadosIds: number[], 
    ano?: number, 
    mes?: number
  ): Promise<{ deputadoId: number; despesas: DespesaDto[] }[]> {
    const resultado: { deputadoId: number; despesas: DespesaDto[] }[] = [];
    
    this.logger.log(`Iniciando importação de despesas para ${deputadosIds.length} deputados...`);
    
    for (const deputadoId of deputadosIds) {
      try {
        const despesas = await this.importarDespesasDeputado(deputadoId, ano, mes);
        resultado.push({ deputadoId, despesas });
        
        // Delay entre deputados para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(`Erro ao importar despesas do deputado ${deputadoId}:`, error.message);
        // Continua com os próximos deputados mesmo se um falhar
        resultado.push({ deputadoId, despesas: [] });
      }
    }
    
    const totalDespesas = resultado.reduce((total, item) => total + item.despesas.length, 0);
    this.logger.log(`Importação concluída: ${totalDespesas} despesas de ${deputadosIds.length} deputados`);
    
    return resultado;
  }

  async obterAnosDisponiveis(deputadoId: number): Promise<number[]> {
    try {
      const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${deputadoId}/despesas?itens=1&ordem=DESC&ordenarPor=ano`;
      
      const response: any = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'OJA-Backend/1.0'
          }
        })
      );
      
      const data: DespesaApiResponse = response.data;
      
      if (data.dados && data.dados.length > 0) {
        // Retorna os anos únicos encontrados (seria melhor fazer uma consulta mais específica)
        const anos = [...new Set(data.dados.map(d => d.ano))].sort((a, b) => b - a);
        return anos;
      }
      
      return [];
    } catch (error) {
      this.logger.error(`Erro ao obter anos disponíveis para deputado ${deputadoId}:`, error.message);
      return [];
    }
  }
}
