import { z } from "zod";

// Schema para um único turno extraído do PDF
export const TurnoOrdenhaSchema = z.object({
  turno: z.number().int().positive(),
  
  // Dados brutos extraídos (A-N)
  total_vacas: z.number().int().nonnegative().nullable(),
  leite_total_litros: z.number().nonnegative().nullable(),
  tempo_total_minutos: z.number().nonnegative().nullable(),
  colocacoes_manual: z.number().int().nonnegative().nullable(),
  retiradas_manual: z.number().int().nonnegative().nullable(),
  pct_leite_2min: z.number().nonnegative().nullable(),
  
  // KPIs calculados (H-AB)
  vacas_hora: z.number().nonnegative().nullable(),
  leite_por_vaca: z.number().nonnegative().nullable(),
  retiradas_excedentes: z.number().int().nonnegative().nullable(),
  tempo_por_vaca: z.number().nonnegative().nullable(),
  
  // Status (Semáforos)
  status_2min: z.enum(["VERDE", "AMARELO", "VERMELHO"]).nullable(),
  status_retirada: z.enum(["VERDE", "VERMELHO"]).nullable(),
  eficiencia_geral: z.enum(["BOA", "ATENÇÃO", "CRÍTICA"]).nullable(),
  
  // Textos Automáticos
  interpretacao: z.string().nullable(),
  acao_recomendada: z.string().nullable(),
});

// Payload completo recebido do Edge Worker (Webhook)
export const WebhookHerdMetrixSchema = z.object({
  fazenda: z.string(),
  fazenda_id: z.string(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser no formato YYYY-MM-DD"),
  total_turnos: z.number().int().nonnegative(),
  turnos: z.array(TurnoOrdenhaSchema),
  enviado_em: z.string().datetime(),
});

// Tipos TypeScript extraídos dos schemas
export type TurnoOrdenha = z.infer<typeof TurnoOrdenhaSchema>;
export type WebhookHerdMetrixPayload = z.infer<typeof WebhookHerdMetrixSchema>;
