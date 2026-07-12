import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const event = await request.json();
        
        // Payload Rico: vaca_id, evento, lado, posto, peso, timestamp
        const { vaca_id, evento, lado, posto, peso, timestamp } = event;

        console.log(`\n[ESTADO ORDENHA] --- ${timestamp} ---`);
        
        if (evento === 'OCUPACAO') {
            console.log(` > VACA: ${vaca_id} (SENTOU NO POSTO ${posto})`);
            console.log(` > PESO REGISTRADO: ${peso} KG`);
        } else if (evento === 'ENTRADA') {
            console.log(` > VACA: ${vaca_id} (ENTROU NA FILA: ${lado})`);
        } else if (evento === 'SAIDA') {
            console.log(` > VACA: ${vaca_id} (SAIU DO POSTO ${posto})`);
        }
        
        console.log(` > Hora: ${timestamp}\n`);

        // Aqui poderíamos salvar em um banco de dados (ex: MongoDB/Firebase)
        // Por enquanto, apenas confirmamos o recebimento.
        
        return NextResponse.json({ 
            success: true, 
            message: `Evento de ${evento} registrado para ${vaca_id} no lado ${lado}` 
        });
    } catch (error) {
        return NextResponse.json({ error: 'Falha ao processar evento de fluxo' }, { status: 500 });
    }
}
