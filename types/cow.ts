export interface Cow {
  id: string; 
  brinco: string;
  nome: string;
  statusSaude: 'ok' | 'alerta' | 'critico';
}

export interface MilkingSession {
  id: string;
  cowId: string;
  timestamp: Date;
  anglesConfidence: {
    frontal: number;
    superior: number;
    lateralEsq: number;
    lateralDir: number;
  };
  finalConfidence: number;
}

export interface SyncPayload {
  cowId: string;
  timestamp: string;
  anglesConfidence: {
    frontal: number;
    superior: number;
    lateral_esq: number;
    lateral_dir: number;
  };
  finalConfidence: number;
}
