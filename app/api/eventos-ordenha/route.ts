import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Pseudo-Banco de Dados em Memória (perfeito para a fase de testes local)
let dbOrdenha: any[] = [];
const QUEUE_FILE = path.join(process.cwd(), 'local_sync_queue.json');

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        
        // Log para auditoria no terminal (mantido para debugging)
        const { vaca_id, evento, lado, posto, peso_kg, timestamp } = payload;
        console.log(`\n⏱️ [${timestamp}] TELEMETRIA: ${vaca_id || 'ID Desconhecido'} | ${evento} | ${peso_kg ? peso_kg+'kg' : '-'} `);

        // Salva no banco em memória (no topo para ser o mais recente)
        dbOrdenha.unshift(payload);
        
        // Limita a 50 registros para não estourar memória local do painel
        if (dbOrdenha.length > 50) dbOrdenha.pop();

        // 1. Tenta enviar para a Nuvem (Firebase)
        try {
            if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
                throw new Error("Firebase não configurado (.env ausente)");
            }
            await addDoc(collection(db, 'eventos_ordenha'), {
                ...payload,
                synced_at: new Date().toISOString(),
            });
            console.log("✅ Dado sincronizado com o Firebase na Nuvem.");
        } catch (fbError: any) {
            console.warn(`⚠️ Conexão com Firebase falhou (${fbError.message}). Salvando na Fila Offline Local...`);
            
            // 2. Fallback: Escreve no Caderno Offline
            let queue: any[] = [];
            if (fs.existsSync(QUEUE_FILE)) {
                try {
                    queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
                } catch(e) { queue = []; }
            }
            queue.push(payload);
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
        }

        return NextResponse.json({ success: true, message: "Telemetria registrada." });

    } catch (error) {
        console.error("Falha ao processar telemetria:", error);
        return NextResponse.json({ error: "Erro interno." }, { status: 500 });
    }
}

export async function GET() {
    // Rota que alimenta a Tabela Zootécnica no Dashboard
    return NextResponse.json(dbOrdenha);
}

