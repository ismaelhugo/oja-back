export interface DespesaDto {
  ano: number;
  cnpjCpfFornecedor: string;
  codDocumento: number;
  codLote: number;
  codTipoDocumento: number;
  dataDocumento: string;
  mes: number;
  nomeFornecedor: string;
  numDocumento: string;
  numRessarcimento: string;
  parcela: number;
  tipoDespesa: string;
  tipoDocumento: string;
  urlDocumento: string;
  valorDocumento: number;
  valorGlosa: number;
  valorLiquido: number;
}

export interface DespesaApiResponse {
  dados: DespesaDto[];
  links: Array<{
    rel: string;
    href: string;
    type: string;
  }>;
}

export interface DespesaFiltros {
  deputadoId?: number;
  ano?: number;
  mes?: number;
  tipoDespesa?: string;
  nomeFornecedor?: string;
  valorMinimo?: number;
  valorMaximo?: number;
}
