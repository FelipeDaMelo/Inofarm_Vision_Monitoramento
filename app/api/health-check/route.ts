import { NextResponse } from 'next/server';
import { db, rtdb } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ref, set } from 'firebase/database';

/**
 * GET /api/health-check
 * 
 * Chamado externamente pelo cron-job.org a cada 10 minutos.
 * Fluxo:
 *   1. Busca todas as fazendas no Firestore (fazendas_registradas)
 *   2. Para cada uma, pinga GET {urlLocal}/api/health (Tailscale Funnel)
 *   3. Se responder → grava "online" no Firebase RTDB
 *   4. Se não responder → grava "offline"
 * 
 * Modelo PULL: a fazenda NÃO faz nenhum upload. 
 * A nuvem é quem pergunta. Zero impacto na rede local.
 */
export async function GET() {
  if (!db || !rtdb) {
    return NextResponse.json(
      { error: 'Firebase não configurado' },
      { status: 500 }
    );
  }

  const resultados: Record<string, any> = {};

  try {
    // 1. Busca todas as fazendas registradas
    const snapshot = await getDocs(collection(db, 'fazendas_registradas'));

    // 2. Pinga cada fazenda em paralelo (com timeout curto)
    const promises = snapshot.docs.map(async (doc) => {
      const farmId = doc.id;
      const data = doc.data();
      const urlLocal = data.urlLocal;

      if (!urlLocal) {
        resultados[farmId] = { status: 'sem_url', ts: Date.now() };
        return;
      }

      try {
        // Timeout de 15s — se a máquina não responder, está offline
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${urlLocal}/api/health`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeout);

        if (response.ok) {
          const healthData = await response.json();

          // 3. Grava no Firebase RTDB — substitui o heartbeat antigo
          const heartbeatRef = ref(rtdb, `heartbeat/${farmId}/painel`);
          await set(heartbeatRef, {
            status: 'online',
            ts: Date.now() / 1000,
            ultima_atualizacao: new Date().toISOString(),
            cpu: healthData.cpu ?? null,
            ram: healthData.ram ?? null,
            maternidade: healthData.maternidade ?? false,
            confinamento: healthData.confinamento ?? false,
            cameras_ok: healthData.cameras_ok ?? 0,
            cameras_total: healthData.cameras_total ?? 0,
          });

          resultados[farmId] = { status: 'online', ...healthData };
        } else {
          // Respondeu mas com erro (ex: 500)
          const heartbeatRef = ref(rtdb, `heartbeat/${farmId}/painel`);
          await set(heartbeatRef, {
            status: 'degraded',
            ts: Date.now() / 1000,
            ultima_atualizacao: new Date().toISOString(),
            http_status: response.status,
          });

          resultados[farmId] = { status: 'degraded', http_status: response.status };
        }
      } catch (err: any) {
        // Timeout ou erro de rede → fazenda offline
        const heartbeatRef = ref(rtdb, `heartbeat/${farmId}/painel`);
        await set(heartbeatRef, {
          status: 'offline',
          ts: Date.now() / 1000,
          ultima_atualizacao: new Date().toISOString(),
        });

        resultados[farmId] = { 
          status: 'offline', 
          error: err.name === 'AbortError' ? 'timeout' : err.message 
        };
      }
    });

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      checked_at: new Date().toISOString(),
      fazendas: resultados,
    });

  } catch (error: any) {
    console.error('[HEALTH-CHECK] Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: error.message },
      { status: 500 }
    );
  }
}
