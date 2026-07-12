import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const QUEUE_FILE = path.join(process.cwd(), 'local_sync_queue.json');

export async function GET() {
    try {
        if (!fs.existsSync(QUEUE_FILE)) {
            return NextResponse.json({ success: true, message: "Fila vazia." });
        }

        const data = fs.readFileSync(QUEUE_FILE, 'utf-8');
        let queue: any[] = [];
        try {
            queue = JSON.parse(data);
        } catch (e) {
            // Arquivo corrompido, limpa
            fs.writeFileSync(QUEUE_FILE, '[]');
            return NextResponse.json({ success: true, message: "Fila estava corrompida e foi limpa." });
        }

        if (queue.length === 0) {
            return NextResponse.json({ success: true, message: "Fila vazia." });
        }

        console.log(`🔄 [SYNC] Encontrados ${queue.length} registros offline. Tentando sincronizar com o Firebase...`);
        
        let pendingQueue = [];
        let successCount = 0;

        for (const item of queue) {
            try {
                if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
                    throw new Error("Firebase não configurado (.env ausente)");
                }
                
                await addDoc(collection(db, 'eventos_ordenha'), {
                    ...item,
                    synced_at: new Date().toISOString(),
                    sync_type: 'delayed_offline'
                });
                successCount++;
            } catch (error) {
                // Se falhou, mantém na fila
                pendingQueue.push(item);
            }
        }

        // Atualiza a fila apenas com os que falharam (ou limpa se todos foram sucesso)
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(pendingQueue, null, 2));

        if (pendingQueue.length === queue.length) {
             console.log(`⚠️ [SYNC] Falha ao sincronizar a fila. Sem internet?`);
             return NextResponse.json({ success: false, message: "Nenhum dado pôde ser sincronizado (Sem rede?)" });
        }

        console.log(`✅ [SYNC] Sucesso! ${successCount} registros subiram para a nuvem. Restantes na fila: ${pendingQueue.length}`);
        return NextResponse.json({ success: true, message: `Sincronizados ${successCount} registros.` });

    } catch (error: any) {
        console.error("Erro interno no Worker de Sync:", error.message);
        return NextResponse.json({ error: "Erro interno no Worker de Sync." }, { status: 500 });
    }
}
