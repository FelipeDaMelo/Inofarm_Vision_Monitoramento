import { NextRequest, NextResponse } from "next/server";
import { SyncPayload } from "@/types/cow";

export async function POST(request: NextRequest) {
  try {
    const body: SyncPayload = await request.json();

    // Validação da nova estrutura Portico v2.0
    if (
      !body.cowId || 
      !body.timestamp || 
      !body.anglesConfidence || 
      typeof body.finalConfidence !== 'number'
    ) {
      return NextResponse.json(
        { status: 'error', message: 'Dados inválidos ou estrutura v2.0 incompleta' },
        { status: 400 }
      );
    }

    const { frontal, superior, lateral_esq, lateral_dir } = body.anglesConfidence;

    // Log detalhado da arquitetura v2.0
    console.log("--------------------------------------------------");
    console.log("RECEBENDO SINCRONIZAÇÃO PÓRTICO v2.0 (EDGE)");
    console.log(`Vaca ID: ${body.cowId}`);
    console.log(`Timestamp: ${body.timestamp}`);
    console.log("--------- Confiança por Ângulo ---------");
    console.log(`Frontal:  ${(frontal * 100).toFixed(1)}%`);
    console.log(`Superior: ${(superior * 100).toFixed(1)}%`);
    console.log(`Lat. Esq: ${(lateral_esq * 100).toFixed(1)}%`);
    console.log(`Lat. Dir: ${(lateral_dir * 100).toFixed(1)}%`);
    console.log("----------------------------------------");
    console.log(`CONFIANÇA FINAL: ${(body.finalConfidence * 100).toFixed(2)}%`);
    console.log("--------------------------------------------------");

    return NextResponse.json({
      status: 'success',
      message: 'Sincronização v2.0 recebida com sucesso'
    });
  } catch (error) {
    console.error("Erro ao processar sincronização v2.0:", error);
    return NextResponse.json(
      { status: 'error', message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
