import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const feedback = await request.json();
        const { img_temp, id_correto } = feedback;

        console.log(`\n[FEEDBACK IA] Recebido: Imagem ${img_temp} -> ID Correto: ${id_correto}`);

        // Encaminha o comando para o motor Python na porta 5001
        const pythonRes = await fetch("http://localhost:5001/validar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ img_temp, id_correto })
        });

        if (pythonRes.ok) {
            return NextResponse.json({ success: true, message: "Feedback processado e dataset atualizado." });
        } else {
            return NextResponse.json({ error: "Erro ao comunicar com o servidor Python." }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Falha ao processar feedback." }, { status: 500 });
    }
}
