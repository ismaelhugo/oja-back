import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface DeputadoApiResponse {
  dados: any[];
  links: Array<{
    rel: string;
    href: string;
  }>;
}

@Injectable()
export class DeputadoImportService {
  private readonly logger = new Logger(DeputadoImportService.name);
  
  constructor(private readonly httpService: HttpService) {}

  async importarDeputadosPorLegislatura(idLegislatura: number): Promise<any[]> {
    let todosDeputados: any[] = [];
    let pagina = 1;
    const itemsPorPagina = 100; // máximo permitido pela API
    let temMaisPaginas = true;

    this.logger.log(`Iniciando importação de deputados da legislatura ${idLegislatura}...`);

    while (temMaisPaginas) {
      try {
        const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=${idLegislatura}&pagina=${pagina}&itens=${itemsPorPagina}&ordem=ASC&ordenarPor=nome`;
        this.logger.log(`Buscando página ${pagina} da legislatura ${idLegislatura}...`);
        
        const response: any = await firstValueFrom(this.httpService.get(url));
        const data: DeputadoApiResponse = response.data;
        
        if (data.dados && data.dados.length > 0) {
          todosDeputados = todosDeputados.concat(data.dados);
          this.logger.log(`Página ${pagina}: ${data.dados.length} deputados encontrados. Total até agora: ${todosDeputados.length}`);
          
          // Correção: verifica se retornou menos itens que o solicitado (indica última página)
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
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        } else {
          temMaisPaginas = false;
        }
      } catch (error) {
        this.logger.error(`Erro ao buscar página ${pagina} da legislatura ${idLegislatura}:`, error.message);
        
        // Se for erro 404, para a busca
        if (error.response?.status === 404) {
          this.logger.log('Página não encontrada - fim da paginação');
          temMaisPaginas = false;
        } else {
          // Para outros erros, para a importação
          temMaisPaginas = false;
        }
      }
    }

    this.logger.log(`Importação da legislatura ${idLegislatura} concluída: ${todosDeputados.length} deputados encontrados`);
    return todosDeputados;
  }

  async importarTodosDeputados(): Promise<any[]> {
    let todosDeputados: any[] = [];
    let pagina = 1;
    const itemsPorPagina = 100; // máximo permitido pela API
    let temMaisPaginas = true;

    this.logger.log('Iniciando importação de todos os deputados...');

    while (temMaisPaginas) {
      try {
        const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=${pagina}&itens=${itemsPorPagina}&ordem=ASC&ordenarPor=nome`;
        this.logger.log(`Buscando página ${pagina}...`);
        
        const response: any = await firstValueFrom(this.httpService.get(url));
        const data: DeputadoApiResponse = response.data;
        
        if (data.dados && data.dados.length > 0) {
          todosDeputados = todosDeputados.concat(data.dados);
          this.logger.log(`Página ${pagina}: ${data.dados.length} deputados encontrados. Total até agora: ${todosDeputados.length}`);
          
          // Correção: verifica se retornou menos itens que o solicitado (indica última página)
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
        this.logger.error(`Erro ao buscar página ${pagina}:`, error.message);
        
        // Se for erro 404, para a busca
        if (error.response?.status === 404) {
          this.logger.log('Página não encontrada - fim da paginação');
          temMaisPaginas = false;
        } else {
          // Para outros erros, para a importação
          temMaisPaginas = false;
        }
      }
    }

    this.logger.log(`Importação concluída: ${todosDeputados.length} deputados encontrados`);
    return todosDeputados;
  }

  async importarDeputadosAtuais(): Promise<any[]> {
    // Busca deputados da legislatura atual (57)
    return this.importarDeputadosPorLegislatura(57);
  }
}
