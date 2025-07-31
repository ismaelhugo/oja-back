import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DeputadoImportService {
  constructor(private readonly httpService: HttpService) {}

  async importarDeputadosPorLegislatura(idLegislatura: number): Promise<any[]> {
    const url = `https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=${idLegislatura}&ordem=ASC&ordenarPor=nome`;
    const response: any = await firstValueFrom(this.httpService.get(url));
    return response.data.dados;
  }
}
