import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { WebhookHerdMetrixSchema } from "@/lib/schemas/herdmetrix";

// O Vercel pode dar timeout se a função demorar, mas como é só salvar no Firebase,
// o padrão (10-15s) é suficiente.
export async function POST(request: Request) {
  try {
    // 1. Validar a API Key do Edge Worker
    const apiKey = request.headers.get("x-api-key");
    const expectedApiKey = process.env.VITU_WEBHOOK_API_KEY;

    if (!apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 2. Ler e validar o payload JSON com Zod
    const body = await request.json();
    const validationResult = WebhookHerdMetrixSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Payload inválido:", validationResult.error.format());
      return NextResponse.json(
        { error: "Payload inválido", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const payload = validationResult.data;
    const { fazenda_id, data, turnos } = payload;

    if (!fazenda_id) {
      return NextResponse.json({ error: "fazenda_id é obrigatório" }, { status: 400 });
    }

    if (!adminDb) {
      console.error("Erro: adminDb não inicializado.");
      return NextResponse.json({ error: "Banco de dados não inicializado" }, { status: 500 });
    }

    // 3. Salvar no Firestore
    // Estrutura: /fazendas/{fazenda_id}/ordenhas_diarias/{data}
    const docRef = adminDb
      .collection("fazendas")
      .doc(fazenda_id)
      .collection("ordenhas_diarias")
      .doc(data);

    // Como recebemos os turnos todos de uma vez do Edge Worker,
    // sobrescrevemos o documento do dia (ou fazemos merge).
    // Usamos merge para não apagar outras informações que possam estar lá (ex: checkin).
    await docRef.set({
      ...payload,
      atualizado_em: new Date().toISOString(),
    }, { merge: true });

    console.log(`✅ [Webhook HerdMetrix] Dados salvos para ${fazenda_id} - ${data}`);
    return NextResponse.json({ success: true, message: "Dados salvos com sucesso" }, { status: 200 });
    
  } catch (error: any) {
    console.error("❌ [Webhook HerdMetrix] Erro interno:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor", details: error.message },
      { status: 500 }
    );
  }
}
