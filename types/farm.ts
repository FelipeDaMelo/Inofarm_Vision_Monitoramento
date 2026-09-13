export interface Contato {
  nome: string;
  numero: string;
  isPrincipal: boolean;
  isWhatsapp?: boolean;
}

export interface ConfinamentoTelemetry {
  setor?: string;
  data_finalizacao?: string;
  timestamp?: number;
  ultima_atualizacao?: any;
}

export interface ConfinamentoStatusAlert {
  tipo?: string;
  mensagem?: string;
  status?: string;
  local_label?: string;
  ultima_atualizacao?: any;
}

export interface OrdenhaLeitura {
  vaca_id?: string | number | null;
  confianca_brinco?: number;
  hora?: string;
  data?: string;
  posto?: string;
  caminho_mosaico?: string;
  volume_leite?: number;
  confianca_volume?: number;
  duracao_segundos?: number;
  timestamp?: number;
  observacoes?: string;
}

export interface MaternidadeTelemetry {
  evento?: string;
  hora_da_captura?: string;
  camera?: string;
  local_label?: string;
  timestamp?: number;
  laudo_gemini?: string;
  parto_detectado?: boolean;
}

export interface PainelHeartbeat {
  status: string;
  ts: number;
  ultima_atualizacao: string;
  cpu?: number;
  ram?: number;
  confinamento?: boolean;
  maternidade?: boolean;
  cameras_ok?: number;
  cameras_total?: number;
}

export interface FarmDocument {
  id: string;
  idUnico: string;
  nome: string;
  proprietario?: string;
  cidade?: string;
  urlLocal?: string;
  anydeskId?: string;
  anydeskPass?: string;
  codigoApp?: number | string;
  contatos?: Contato[];
  modulos?: string[];
  status?: string;
  status_ventiladores?: string;
  motivo_ventiladores?: string;
  hora_ventiladores?: string;
  timestamp_ventiladores?: number;
  confinamento?: ConfinamentoTelemetry;
  confinamento_status?: ConfinamentoStatusAlert;
  maternidade?: MaternidadeTelemetry;
  maternidade_status?: ConfinamentoStatusAlert;
  historico_ordenha?: OrdenhaLeitura;
  [key: string]: any;
}
