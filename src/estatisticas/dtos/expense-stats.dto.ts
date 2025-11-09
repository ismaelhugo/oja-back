export class GastoPorMesDto {
  ano: number;
  mes: number;
  total: number;
  quantidade: number;
  mesLabel: string; // "Janeiro", "Fevereiro", etc.
}

export class GastoPorCategoriaDto {
  tipo: string;
  valor: number;
  quantidade: number;
  percentual: number; // Percentual do total
}

export class DeputyExpensesStatsDto {
  deputadoId: number;
  periodo: {
    ano?: number;
    mes?: number;
    startDate?: string;
    endDate?: string;
  };
  totalGeral: number;
  totalDespesas: number;
  gastosPorMes: GastoPorMesDto[];
  gastosPorCategoria: GastoPorCategoriaDto[];
}

export class StateCategoryAverageDto {
  tipo: string;
  media: number;
  total: number;
  deputadosComDespesa: number;
}

export class StateAverageExpensesDto {
  estado: string;
  periodo: {
    ano?: number;
    mes?: number;
    startDate?: string;
    endDate?: string;
  };
  totalGastos: number;
  mediaGeral: number;
  totalDeputadosConsiderados: number;
  totalDeputadosEstado: number;
  mediaPorCategoria: StateCategoryAverageDto[];
}

export class TopFornecedorDto {
  nomeFornecedor: string;
  cnpjCpfFornecedor?: string;
  total: number;
  quantidade: number;
  percentual: number; // Percentual do total de gastos do deputado
}
