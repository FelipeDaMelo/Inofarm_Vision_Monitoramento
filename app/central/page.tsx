"use client";

import { useState, useEffect } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, rtdb } from "@/lib/firebase";

import Sidebar from "@/app/components/Sidebar";

  // Componente para reutilizar UI do Card
  const FarmCard = ({
    title, data, href = "#", hbMat, hbConf, hbPainel, proprietario, contato, cidade, idUnico
  }: {
    title: string, data: any, href?: string, hbMat?: any, hbConf?: any, hbPainel?: any, proprietario?: string, contato?: string, cidade?: string, idUnico?: string
  }) => {
    const nowSecs = Date.now() / 1000;
    const isMatOnline = hbMat && (nowSecs - hbMat.ts < 15);
    const isConfOnline = hbConf && (nowSecs - hbConf.ts < 15);
    const isPainelOnline = hbPainel && (nowSecs - hbPainel.ts < 15);
    const isOnline = isPainelOnline || isMatOnline || isConfOnline;

    const parto = data?.maternidade?.parto_detectado;

    const [edgeStatus, setEdgeStatus] = useState<any>(null);

    useEffect(() => {
      if (!href || href === "#") return;
      let baseUrl = href.endsWith('/') ? href.slice(0, -1) : href;
      if (!baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl;
      }

      const fetchEdgeStatus = async () => {
        try {
          const res = await fetch(`${baseUrl}/api/status`);
          if (res.ok) {
            const data = await res.json();
            setEdgeStatus(data);
          }
        } catch (error) {
          setEdgeStatus(null);
        }
      };

      fetchEdgeStatus();
      const interval = setInterval(fetchEdgeStatus, 5000);
      return () => clearInterval(interval);
    }, [href]);

    const handleAction = async (target: string, action: string) => {
      if (!href || href === "#") {
        alert("Esta fazenda ainda não tem o Painel Local (Tailscale) configurado!");
        return;
      }
      try {
        let baseUrl = href.endsWith('/') ? href.slice(0, -1) : href;
        if (!baseUrl.startsWith('http')) {
          baseUrl = 'https://' + baseUrl;
        }
        console.log(`[ACTION] Enviando ${action} para ${target} na URL: ${baseUrl}/api/toggle-ai`);
        const res = await fetch(`${baseUrl}/api/toggle-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, action })
        });

        console.log(`[ACTION] Status HTTP: ${res.status}`);
        const textData = await res.text();
        console.log(`[ACTION] Resposta Crua:`, textData);

        let respData;
        try {
          respData = JSON.parse(textData);
        } catch (e) {
          respData = { error: "Resposta do servidor não é um JSON válido" };
        }

        if (res.ok) {
          const msg = respData.message || "Comando executado com sucesso!";
          console.log(`[ACTION] Sucesso:`, msg);
          alert(`✅ Sucesso: ${msg}`);
          // Força atualização do status local
          const statusRes = await fetch(`${baseUrl}/api/status`);
          if (statusRes.ok) setEdgeStatus(await statusRes.json());
        } else {
          console.error(`[ACTION] Erro retornado:`, respData.error);
          alert(`❌ Erro: ${respData.error}`);
        }
      } catch (error) {
        console.error(`[ACTION] Falha de conexão:`, error);
        alert(`🚨 Falha de Conexão com o túnel da fazenda: ${error}`);
      }
    };

    return (
      <div className="bg-white/80 rounded-xl shadow-md border border-[#2C3E50]/10 flex flex-col p-4 gap-4 h-full">
        {/* Header do Card */}
        <div className="flex justify-between items-center border-b border-[#2C3E50]/10 pb-3">
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-[#2C3E50] uppercase tracking-widest flex items-center gap-2">
              <span className="text-[#A59D92] text-lg">🏛️</span> {title}
            </h2>
            <p className="text-[9px] text-[#2C3E50]/50 font-mono uppercase mt-1">ID: {idUnico || title.replace(" ", "").toLowerCase()}</p>
          </div>
          <div className={`px-2 py-1 rounded border flex items-center gap-1.5 ${isOnline ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <span className={`text-[8px] font-black uppercase tracking-tight flex items-center gap-1.5 ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full led-glow ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Informações da Fazenda */}
        <div className="flex flex-col gap-1 px-1 mt-[-4px] text-[10px]">
          {proprietario && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#2C3E50]/60 min-w-[85px]">PROPRIETÁRIO:</span>
              <span className="text-[#2C3E50] font-medium">{proprietario}</span>
            </div>
          )}
          {contato && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#2C3E50]/60 min-w-[85px]">CONTATO (PR):</span>
              <a href={`/chat?phone=${contato.replace(/\D/g, '')}`} className="text-emerald-600 font-bold hover:underline cursor-pointer flex items-center gap-1">
                {contato}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              </a>
            </div>
          )}
          {cidade && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#2C3E50]/60 min-w-[85px]">CIDADE:</span>
              <span className="text-[#2C3E50] font-medium">{cidade}</span>
            </div>
          )}
        </div>

        {/* Corpo do Card: Dados */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Confinamento */}
          <div className="bg-white p-3 rounded-lg border border-[#2C3E50]/5 flex flex-col gap-2 shadow-sm">
            <h3 className="text-[9px] font-black uppercase text-[#2C3E50] tracking-widest border-b border-[#2C3E50]/10 pb-1"> Confinamento</h3>
            {data?.compost_barn_cama || data?.status_rebanho || data?.status_manejo ? (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex flex-col">
                  <span className="text-[8px] text-[#2C3E50]/60 uppercase font-bold">Status do Rebanho</span>
                  <span className={`text-sm font-black mono-data mt-0.5 ${data?.status_rebanho?.status_maioria?.includes('PÉ') ? 'text-emerald-600' : data?.status_rebanho?.status_maioria?.includes('DEITADA') ? 'text-amber-500' : 'text-[#2C3E50]'}`}>
                    {data?.status_rebanho?.status_maioria || "CALCULANDO..."}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  {data?.status_manejo === 'EM ANDAMENTO' ? (
                    <div className="flex flex-col items-center mt-1">
                      <span className="text-[10px] text-red-500 font-black uppercase tracking-wider animate-pulse border border-red-500/30 bg-red-50 px-2 py-0.5 rounded shadow-sm">
                        🚨 TRATOR NA CAMA
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="text-[8px] text-[#2C3E50]/60 uppercase font-bold">Último Manejo</span>
                      <span className="text-[10px] text-[#2C3E50]/80 font-mono mt-1 font-bold">
                        {data?.compost_barn_cama?.data_finalizacao 
                          ? new Date(data.compost_barn_cama.data_finalizacao).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) 
                          : "--:--"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-emerald-500 text-sm">✓</span>
                <span className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-tight">Tudo Tranquilo</span>
              </div>
            )}
          </div>

          {/* Maternidade */}
          <div className="bg-white p-3 rounded-lg border border-[#2C3E50]/5 flex flex-col gap-2 shadow-sm">
            <h3 className="text-[9px] font-black uppercase text-[#2C3E50] tracking-widest border-b border-[#2C3E50]/10 pb-1"> Maternidade</h3>
            {data?.maternidade ? (
              <div className={`mt-2 p-2 rounded text-center border ${data.maternidade.evento?.includes('NASCIMENTO') || data.maternidade.evento?.includes('PARTO') ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/5 border-green-500/10'}`}>
                {data.maternidade.evento?.includes('NASCIMENTO') || data.maternidade.evento?.includes('PARTO') ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full led-glow"></div> ALERTA DE PARTO
                    </span>
                    <span className="text-[8px] text-red-400/70">{data.maternidade.hora_da_captura}</span>
                    {data.maternidade.evento && (
                      <span className="text-[8px] text-red-600 font-bold mt-1">{(data.maternidade.evento).replace(/_/g, ' ')}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-[9px] font-bold text-emerald-600 uppercase">Tudo Tranquilo</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-emerald-500 text-sm">✓</span>
                <span className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-tight">Tudo Tranquilo</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer do Card */}
        <div className="mt-auto pt-2 flex flex-col gap-2">
          {/* Controle Remoto de IA */}
          <div className="bg-[#2C3E50]/5 rounded p-2 flex flex-col gap-2 border border-[#2C3E50]/10">
            <span className="text-[8px] font-black uppercase text-[#2C3E50] mb-1">Controle de IA (Edge)</span>

            {/* Maternidade */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold text-[#2C3E50]/80 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${edgeStatus?.agente_maternidade ? 'bg-green-500 led-glow' : 'bg-gray-400'}`}></span>
                MATERNIDADE
              </span>
              <div className="flex gap-1">
                <button disabled={edgeStatus?.agente_maternidade} onClick={() => handleAction('maternidade', 'start')} className={`px-2 py-1 transition-all duration-200 ${edgeStatus?.agente_maternidade ? 'bg-green-600/50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'} text-white text-[8px] font-bold rounded uppercase`}>▶ Iniciar</button>
                <button disabled={!edgeStatus?.agente_maternidade} onClick={() => handleAction('maternidade', 'stop')} className={`px-2 py-1 transition-all duration-200 ${!edgeStatus?.agente_maternidade ? 'bg-red-600/50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'} text-white text-[8px] font-bold rounded uppercase`}>⏹ Parar</button>
              </div>
            </div>

            {/* Confinamento */}
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-[9px] font-bold text-[#2C3E50]/80 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${edgeStatus?.agente_confinamento ? 'bg-green-500 led-glow' : 'bg-gray-400'}`}></span>
                CONFINAMENTO
              </span>
              <div className="flex gap-1">
                <button disabled={edgeStatus?.agente_confinamento} onClick={() => handleAction('confinamento', 'start')} className={`px-2 py-1 transition-all duration-200 ${edgeStatus?.agente_confinamento ? 'bg-green-600/50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'} text-white text-[8px] font-bold rounded uppercase`}>▶ Iniciar</button>
                <button disabled={!edgeStatus?.agente_confinamento} onClick={() => handleAction('confinamento', 'stop')} className={`px-2 py-1 transition-all duration-200 ${!edgeStatus?.agente_confinamento ? 'bg-red-600/50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'} text-white text-[8px] font-bold rounded uppercase`}>⏹ Parar</button>
              </div>
            </div>
          </div>

          <a href={href} target="_blank" className="w-full flex">
            <button className="w-full py-2 bg-[#2C3E50] text-[#A59D92] font-black text-[9px] uppercase tracking-widest rounded transition-all hover:bg-[#1a252f] cursor-pointer shadow-md">
              ACESSAR PAINEL LOCAL
            </button>
          </a>

          <div className="relative w-full">
            <input
              type="file"
              accept=".py"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Fazer upload de nova versão da IA"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                if (!href || href === "#") {
                  alert("Esta fazenda ainda não tem o Painel Local (Tailscale) configurado!");
                  return;
                }

                if (confirm(`Atenção: Isso vai enviar o arquivo '${file.name}' para a fazenda ${title}. Confirmar atualização OTA?`)) {
                  // Detecta automaticamente a subpasta correta pelo nome do arquivo
                  const pastasPorArquivo: Record<string, string> = {
                    'agente_maternidade_hibrido.py': 'maternidade',
                    'monitoramento_confinamento.py': 'confinamento',
                    'painel_local.py': '',
                  };
                  const defaultPath = pastasPorArquivo[file.name] ?? (file.name.includes('confinamento') ? 'confinamento' : file.name.includes('maternidade') ? 'maternidade' : '');
                  const targetPath = prompt(`Para qual subpasta o arquivo '${file.name}' deve ir?\n(Detectado automaticamente: '${defaultPath || 'raiz'}')`, defaultPath);

                  if (targetPath === null) {
                    // Usuário cancelou o prompt
                    e.target.value = '';
                    return;
                  }

                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("target_path", targetPath);

                    // Ajuste de URL garantindo que não duplica a barra
                    let baseUrl = href.endsWith('/') ? href.slice(0, -1) : href;
      if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

                    console.log(`[OTA] Enviando ${file.name} para a subpasta '${targetPath || 'raiz'}' na URL: ${baseUrl}/api/update`);
                    alert(`Enviando ${file.name} para a subpasta '${targetPath || 'raiz'}' na fazenda...`);

                    const res = await fetch(`${baseUrl}/api/update`, {
                      method: 'POST',
                      body: formData,
                    });

                    console.log(`[OTA] Status HTTP: ${res.status}`);
                    const textData = await res.text();
                    console.log(`[OTA] Resposta Crua:`, textData);

                    let data;
                    try {
                      data = JSON.parse(textData);
                    } catch (e) {
                      data = { error: "Resposta do servidor não é um JSON válido" };
                    }

                    if (res.ok) {
                      console.log(`[OTA] Sucesso:`, data.message);
                      alert(`✅ Sucesso na Fazenda ${title}: \n\n${data.message}`);
                    } else {
                      console.error(`[OTA] Erro retornado:`, data.error);
                      alert(`❌ Erro da Fazenda: ${data.error || 'Erro desconhecido'}`);
                    }
                  } catch (error) {
                    console.error(`[OTA] Falha de conexão:`, error);
                    alert(`🚨 Falha de Conexão com o túnel da fazenda: ${error}`);
                  } finally {
                    e.target.value = ''; // Reseta o input para permitir enviar o mesmo arquivo novamente
                  }
                }
                // Limpa o input
                e.target.value = '';
              }}
            />
            <button className="w-full py-2 bg-emerald-600/10 text-emerald-600 border border-emerald-600/30 font-black text-[9px] uppercase tracking-widest rounded transition-all hover:bg-emerald-600 hover:text-white shadow-sm flex items-center justify-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              ENVIAR ATUALIZAÇÃO (OTA)
            </button>
          </div>
        </div>
      </div>
    );
  };


export default function CentralDashboard() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const [heartbeats, setHeartbeats] = useState<Record<string, any>>({});

  // Relógio Mestre
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Busca Fazendas Registradas
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "fazendas_registradas"), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFazendas(lista);
    });
    return () => unsub();
  }, []);

  // Firestore Sincronização Dinâmica (Telemetria)
  useEffect(() => {
    if (!db) return;
    const unsubs: any[] = [];

    fazendas.forEach(f => {
      if (!f.idUnico) return;

      const docRef = doc(db!, "fazendas_registradas", f.idUnico);
      const u = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          setTelemetry(prev => ({ ...prev, [f.idUnico]: snap.data() }));
        }
      });
      unsubs.push(u);
    });

    return () => unsubs.forEach(u => u());
  }, [fazendas]);

  // Realtime Database Heartbeat Sincronização Dinâmica
  useEffect(() => {
    const validRtdb = rtdb;
    if (!validRtdb) return;
    const unsubs: any[] = [];

    fazendas.forEach(f => {
      if (!f.idUnico) return;
      const refMat = ref(validRtdb, `heartbeat/${f.idUnico}/maternidade`);
      const u1 = onValue(refMat, (snap) => {
        setHeartbeats(prev => ({ ...prev, [`${f.idUnico}_mat`]: snap.val() }));
      });
      const refConf = ref(validRtdb, `heartbeat/${f.idUnico}/confinamento`);
      const u2 = onValue(refConf, (snap) => {
        setHeartbeats(prev => ({ ...prev, [`${f.idUnico}_conf`]: snap.val() }));
      });
      const refPainel = ref(validRtdb, `heartbeat/${f.idUnico}/painel`);
      const u3 = onValue(refPainel, (snap) => {
        setHeartbeats(prev => ({ ...prev, [`${f.idUnico}_painel`]: snap.val() }));
      });
      unsubs.push(u1, u2, u3);
    });

    return () => unsubs.forEach(u => u());
  }, [fazendas]);

  return (
    <div className="flex h-screen bg-[#A59D92] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col p-6 lg:p-10 custom-scrollbar overflow-y-auto relative text-[#2C3E50]">
        <header className="flex flex-col lg:flex-row justify-between items-center bg-[#2C3E50] border border-[#2C3E50]/10 p-3 lg:px-6 rounded-2xl shadow-lg relative overflow-hidden group shrink-0">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10"></div>
          <div className="flex items-center gap-4 relative z-10 transition-transform">
            <img src="/cara_vaca.png" alt="Logo" className="h-10 w-auto object-contain relative transition-transform group-hover:scale-105" />
            <div className="w-[1px] h-8 bg-white/10 hidden lg:block"></div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight text-white uppercase leading-none">
                INOFARM <span className="text-[#A59D92]">VISION</span>
              </h1>
              <p className="text-[8px] font-bold text-white/50 uppercase tracking-[0.2em] mt-0.5">Central de Controle Multi-Fazendas</p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 lg:mt-0 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full led-glow"></div>
              <span className="text-[8px] text-green-400 font-black uppercase tracking-widest">Nuvem Global Estável</span>
            </div>
            <div className="bg-black/30 px-3 py-1.5 rounded border border-white/5 flex flex-col items-end">
              <span className="text-[6px] text-white/40 uppercase tracking-widest font-black">Relógio Mestre</span>
              <span className="text-sm font-mono text-white tracking-widest">{currentTime}</span>
            </div>
          </div>
        </header>

        {/* Grid Central de Fazendas Parceiras */}
        <div className="flex-1 mt-6">
          {fazendas.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-[#2C3E50]/50 italic">Nenhuma fazenda registrada. Use o painel de Gestão para adicionar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
              {fazendas.map(f => {
                const princ = f.contatos?.find((c: any) => c.isPrincipal) || f.contatos?.[0];
                const hbMat = heartbeats[`${f.idUnico}_mat`];
                const hbConf = heartbeats[`${f.idUnico}_conf`];
                const hbPainel = heartbeats[`${f.idUnico}_painel`];
                const data = telemetry[f.idUnico];
                const urlFunnel = f.urlLocal ? f.urlLocal : "#";

                return (
                  <FarmCard
                    key={f.idUnico}
                    idUnico={f.idUnico}
                    title={f.nome}
                    data={data}
                    href={urlFunnel}
                    hbMat={hbMat}
                    hbConf={hbConf}
                    hbPainel={hbPainel}
                    proprietario={f.proprietario}
                    contato={princ?.numero}
                    cidade={f.cidade}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-auto pt-6 border-t border-[#2C3E50]/10 flex flex-col lg:flex-row justify-between items-center gap-4 text-[9px] text-[#2C3E50] font-black uppercase tracking-widest opacity-60 shrink-0">
          <div className="flex items-center gap-4">
            <img src="/cara_vaca.png" alt="Inofarm Icon" className="w-6 h-6 grayscale opacity-50" />
            <p>© 2026 INOFARM TECHNOLOGIES / MASTER CONTROL</p>
          </div>
          <div className="flex gap-10 items-center">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span>REDE GLOBAL ESTÁVEL</span>
            </div>
            <span>NÚCLEO CLOUD: 1.1.0-PROD</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
