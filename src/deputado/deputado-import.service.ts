import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface DeputadoApiResponse {
  dados: any[];
  links: {
    first?: string;
    last?: string;
    next?: string;
    prev?: string;
  }[];
}

@Injectable()
export class DeputadoImportService {
  private readonly logger = new Logger(DeputadoImportService.name);
  
  constructor(private readonly httpService: HttpService) {}

  async importarDeputadosPorLegislatura(idLegislatura: number): Promise<any[]> {
    const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=${idLegislatura}&ordem=ASC&ordenarPor=nome`;
    const response: any = await firstValueFrom(this.httpService.get(url));
    return response.data.dados;
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
          this.logger.log(`Página ${pagina}: ${data.dados.length} deputados encontrados`);
          
          // Verifica se existe próxima página
          const linkNext = data.links?.find(link => link.next);
          temMaisPaginas = !!linkNext;
          pagina++;
          
          // Delay entre requisições para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          temMaisPaginas = false;
        }
      } catch (error) {
        this.logger.error(`Erro ao buscar página ${pagina}:`, error);
        temMaisPaginas = false;
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
