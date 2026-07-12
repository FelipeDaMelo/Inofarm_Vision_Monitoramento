import { Cow, MilkingSession } from "@/types/cow";

export const mockCows: Cow[] = [
  { id: "c1", brinco: "BR-042", nome: "Estrela", statusSaude: "ok" },
  { id: "c2", brinco: "BR-115", nome: "Mimosa", statusSaude: "alerta" },
  { id: "c3", brinco: "BR-089", nome: "Luna", statusSaude: "critico" },
];

export const mockMilkingSessions: MilkingSession[] = [
  {
    id: "s1",
    cowId: "c1",
    timestamp: new Date("2026-04-18T14:00:00"),
    anglesConfidence: { frontal: 0.98, superior: 0.95, lateralEsq: 0.92, lateralDir: 0.94 },
    finalConfidence: 0.96,
  },
  {
    id: "s2",
    cowId: "c2",
    timestamp: new Date("2026-04-18T14:20:00"),
    anglesConfidence: { frontal: 0.92, superior: 0.88, lateralEsq: 0.75, lateralDir: 0.82 },
    finalConfidence: 0.85,
  },
  {
    id: "s3",
    cowId: "c3",
    timestamp: new Date("2026-04-18T14:40:00"),
    anglesConfidence: { frontal: 0.99, superior: 0.97, lateralEsq: 0.98, lateralDir: 0.96 },
    finalConfidence: 0.98,
  },
];
