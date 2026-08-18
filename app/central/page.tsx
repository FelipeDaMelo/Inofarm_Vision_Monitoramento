"use client";

import { useState, useEffect } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { db, rtdb } from "@/lib/firebase";

import Sidebar from "@/app/components/Sidebar";

const formatPhoneNumber = (phone: string) => {
  if (!phone) return phone;
  const p = phone.replace(/\D/g, '');
  if (p.length === 11) return `(${p.substring(0, 2)}) ${p.substring(2, 7)}-${p.substring(7)}`;
  if (p.length === 13 && p.startsWith('55')) return `(${p.substring(2, 4)}) ${p.substring(4, 9)}-${p.substring(9)}`;
  if (p.length === 10) return `(${p.substring(0, 2)}) ${p.substring(2, 6)}-${p.substring(6)}`;
  if (p.length === 12 && p.startsWith('55')) return `(${p.substring(2, 4)}) ${p.substring(4, 8)}-${p.substring(8)}`;
  return phone;
};

// Componente para reutilizar UI do Cards
const FarmCard = ({
  title, data, href = "#", hbMat, hbConf, hbPainel, proprietario, contato, cidade, idUnico, anydeskId, anydeskPass, modulos = []
}: {
  title: string, data: any, href?: string, hbMat?: any, hbConf?: any, hbPainel?: any, proprietario?: string, contato?: string, cidade?: string, idUnico?: string, anydeskId?: string, anydeskPass?: string, modulos?: string[]
}) => {
  const [viewingCamera, setViewingCamera] = useState<string | null>(null);
  const nowSecs = Date.now() / 1000;
  const showConfinamento = modulos.includes('CONFINAMENTO') || !!data?.compost_barn_cama || !!data?.status_rebanho || !!data?.status_manejo || !!hbConf;
  const showMaternidade = modulos.includes('MATERNIDADE') || !!data?.maternidade || !!hbMat;
  const showOrdenha = modulos.includes('ORDENHA') || !!data?.herdmetrix;
  const isMatOnline = hbMat && (nowSecs - hbMat.ts < 90);
  const isConfOnline = hbConf && (nowSecs - hbConf.ts < 90);
  const isPainelOnline = hbPainel && (nowSecs - hbPainel.ts < 720) && hbPainel.status !== 'offline';
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
        const apiKey = process.env.NEXT_PUBLIC_EDGE_API_KEY || "";
        const res = await fetch(`${baseUrl}/api/status`, {
          headers: { 'X-Api-Key': apiKey }
        });
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
      const apiKey = process.env.NEXT_PUBLIC_EDGE_API_KEY || "";
      console.log(`[ACTION] Enviando ${action} para ${target} na URL: ${baseUrl}/api/toggle-ai`);
      const res = await fetch(`${baseUrl}/api/toggle-ai`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        },
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
        const apiKey = process.env.NEXT_PUBLIC_EDGE_API_KEY || "";
        const statusRes = await fetch(`${baseUrl}/api/status`, { headers: { 'X-Api-Key': apiKey } });
        if (statusRes.ok) setEdgeStatus(await statusRes.json());
      } else {
        console.error(`[ACTION] Erro retornado:`, respData.error);
        alert(`❌ Erro: ${respData.error}`);
      }
    } catch (e) {
      console.error(`[ACTION] Falha na requisição:`, e);
      alert("Falha na comunicação com o Painel Local. Verifique se o túnel Tailscale está online.");
    }
  };

  const copyPass = () => {
    if (anydeskPass) {
      navigator.clipboard.writeText(anydeskPass).catch(() => { });
    }
  };

  const handleAnydeskOpen = () => {
    if (!anydeskId) return;
    copyPass();
    const cleanId = anydeskId.replace(/\s+/g, '');
    window.location.href = `anydesk://${cleanId}`;
  };

  const handleAnydeskDownload = () => {
    alert("Você será redirecionado para a página de download do AnyDesk.\n\nApós terminar a instalação, volte aqui e clique no botão principal 'ANYDESK' para conectar à máquina!");
    window.open('https://anydesk.com/download', '_blank');
  };

  const getCameraButtons = (type: string) => {
    if (!edgeStatus?.cameras) return null;
    const sectorCameras = edgeStatus.cameras.filter((c: any) => c.type === type);
    if (sectorCameras.length === 0) return null;

    return (
      <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-[#2C3E50]/5">
        {sectorCameras.map((c: any, idx: number) => (
          <button
            key={idx}
            onClick={() => setViewingCamera(c.name)}
            disabled={!c.cam_ok}
            className={`flex items-center justify-between px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${c.cam_ok ? 'bg-[#2C3E50]/5 text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white cursor-pointer' : 'bg-red-500/10 text-red-500/50 cursor-not-allowed'}`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {c.name.replace(/_/g, ' ')}
            </div>
            {!c.cam_ok && <span>OFFLINE</span>}
          </button>
        ))}
      </div>
    );
  };

  let baseUrl = href;
  if (baseUrl !== "#") {
    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
  }
  const apiKey = process.env.NEXT_PUBLIC_EDGE_API_KEY || "";
  const painelUrl = baseUrl !== "#" ? `${baseUrl}/painel` : "#";

  return (
    <div className="bg-white/80 rounded-xl shadow-md border border-[#2C3E50]/10 flex flex-col p-3 gap-2 h-full">
      {/* Header do Card */}
      <div className="flex justify-between items-center border-b border-[#2C3E50]/10 pb-2">
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
              {formatPhoneNumber(contato)}
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
      <div className="flex-1 flex flex-col gap-2">
        {/* Confinamento */}
        {showConfinamento && (
        <div className="bg-white p-2 rounded-lg border border-[#2C3E50]/5 flex flex-col gap-1.5 shadow-sm">
          <h3 className="text-[9px] font-black uppercase text-[#2C3E50] tracking-widest border-b border-[#2C3E50]/10 pb-1"> Confinamento</h3>
          {getCameraButtons('confinamento')}
          {data?.compost_barn_cama || data?.status_rebanho || data?.status_manejo ? (
            <div className={`flex flex-col gap-3 mt-1 ${!isOnline ? 'opacity-60 grayscale' : ''}`}>
              {/* Linha 1: Status do Rebanho (Independente) */}
              <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded border border-gray-100">
                <span className="text-[9px] text-[#2C3E50]/70 uppercase font-bold tracking-wide">THI</span>
                <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded ${data?.status_rebanho?.status_maioria?.includes('PÉ') ? 'bg-emerald-100 text-emerald-700' : data?.status_rebanho?.status_maioria?.includes('DEITADA') ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}`}>
                  {data?.status_rebanho?.status_maioria || "CALCULANDO..."}
                </span>
              </div>

              {/* Linha 2: Monitoramento de Trator (Independente) */}
              <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded border border-gray-100">
                <span className="text-[9px] text-[#2C3E50]/70 uppercase font-bold tracking-wide">Monitoramento Trator</span>
                {data?.status_manejo === 'EM ANDAMENTO' ? (
                  <span className="text-[10px] text-red-600 font-black uppercase tracking-wider animate-pulse border border-red-500/30 bg-red-50 px-2 py-0.5 rounded shadow-sm">
                    🚨 TRATOR NA CAMA
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-[#2C3E50]/50 uppercase font-bold">Último Manejo:</span>
                    <span className="text-[10px] text-[#2C3E50]/80 font-mono font-bold">
                      {data?.compost_barn_cama?.data_finalizacao
                        ? (data.compost_barn_cama.data_finalizacao.includes('T') || data.compost_barn_cama.data_finalizacao.length > 20
                          ? new Date(data.compost_barn_cama.data_finalizacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : data.compost_barn_cama.data_finalizacao)
                        : "--:--"}
                    </span>
                  </div>
                )}
              </div>
              {!isOnline && (
                <div className="text-[8px] text-center text-red-500 font-bold uppercase tracking-widest mt-[-4px]">
                  (Dados Desatualizados - Fazenda Offline)
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 p-2 rounded text-center border bg-green-500/5 border-green-500/10">
              <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center justify-center gap-1">
                <span className="text-emerald-500 text-xs">✓</span> TUDO TRANQUILO
              </span>
            </div>
          )}
        </div>
        )}

        {/* Maternidade */}
        {showMaternidade && (
        <div className="bg-white p-2 rounded-lg border border-[#2C3E50]/5 flex flex-col gap-1.5 shadow-sm">
          <h3 className="text-[9px] font-black uppercase text-[#2C3E50] tracking-widest border-b border-[#2C3E50]/10 pb-1"> Maternidade</h3>
          {getCameraButtons('maternidade')}
          {data?.maternidade ? (
            <div className={`mt-2 p-2 rounded text-center border ${data.maternidade.evento?.includes('NASCIMENTO') || data.maternidade.evento?.includes('PARTO') || data.maternidade.evento?.includes('DISTOCIA') ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/5 border-green-500/10'}`}>
              {data.maternidade.evento?.includes('NASCIMENTO') || data.maternidade.evento?.includes('PARTO') || data.maternidade.evento?.includes('DISTOCIA') ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full led-glow"></div> ALERTA: {data.maternidade.evento?.includes('DISTOCIA') ? 'DISTOCIA' : 'PARTO'}
                  </span>
                  <span className="text-[8px] text-red-400/70">{data.maternidade.hora_da_captura}</span>
                  {data.maternidade.evento && (
                    <span className="text-[8px] text-red-600 font-bold mt-1">{(data.maternidade.evento).replace(/_/g, ' ')}</span>
                  )}
                </div>
              ) : (
                <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center justify-center gap-1">
                  <span className="text-emerald-500 text-xs">✓</span> TUDO TRANQUILO
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 p-2 rounded text-center border bg-green-500/5 border-green-500/10">
              <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center justify-center gap-1">
                <span className="text-emerald-500 text-xs">✓</span> TUDO TRANQUILO
              </span>
            </div>
          )}
        </div>
        )}

        {/* Ordenha / HerdMetrix */}
        {showOrdenha && (
        <div className="bg-white p-2 rounded-lg border border-[#2C3E50]/5 flex flex-col gap-1.5 shadow-sm">
          <h3 className="text-[9px] font-black uppercase text-[#2C3E50] tracking-widest border-b border-[#2C3E50]/10 pb-1"> Ordenha (HerdMetrix)</h3>
          {data?.herdmetrix?.ultimo_sync ? (
            <div className={`flex flex-col gap-3 mt-1 ${!isOnline ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded border border-gray-100 mt-1">
                <span className="text-[9px] text-[#2C3E50]/70 uppercase font-bold tracking-wide">Último Arquivo</span>
                <span className="text-[10px] text-[#2C3E50] font-mono font-black tracking-widest">
                  {data.herdmetrix.ultimo_sync.includes('T') ? new Date(data.herdmetrix.ultimo_sync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : data.herdmetrix.ultimo_sync}
                </span>
              </div>
              {data.herdmetrix.erros && data.herdmetrix.erros.length > 0 && (
                <div className="flex justify-between items-center bg-red-50 p-2 rounded border border-red-200 mt-1">
                  <span className="text-[9px] text-red-600 uppercase font-bold tracking-wide flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                    FALHA RECENTE
                  </span>
                  <span className="text-[8px] text-red-700 font-bold truncate max-w-[100px]">{data.herdmetrix.erros[0]}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 p-2 rounded text-center border bg-green-500/5 border-green-500/10">
              <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center justify-center gap-1">
                <span className="text-emerald-500 text-xs">✓</span> SERVIÇO ATIVO
              </span>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Footer do Card */}
      <div className="mt-auto pt-1.5 flex flex-col gap-1.5">
        {/* Controle Remoto de IA */}
        {(showMaternidade || showConfinamento || showOrdenha) && (
        <div className="bg-[#2C3E50]/5 rounded p-2 flex flex-col gap-2 border border-[#2C3E50]/10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[8px] font-black uppercase text-[#2C3E50]">Controle de IA (Edge)</span>
            {edgeStatus && (
              <div className="flex items-center gap-2 text-[8px] font-black font-mono">
                <span className={`${edgeStatus.cpu > 80 ? 'text-red-500' : 'text-[#2C3E50]/60'}`}>CPU: {edgeStatus.cpu}%</span>
                <span className={`${edgeStatus.ram > 80 ? 'text-red-500' : 'text-[#2C3E50]/60'}`}>RAM: {edgeStatus.ram}%</span>
              </div>
            )}
          </div>

          {/* Maternidade */}
          {showMaternidade && (
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
          )}

          {/* Confinamento */}
          {showConfinamento && (
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
          )}

          {/* VITU (Voz) */}
          {showOrdenha && (
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[9px] font-bold text-[#2C3E50]/80 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${edgeStatus?.agente_vitu ? 'bg-green-500 led-glow' : 'bg-gray-400'}`}></span>
              FUNCIONÁRIO DIGITAL VITU
            </span>
            <div className="flex gap-1">
              <button disabled={edgeStatus?.agente_vitu} onClick={() => handleAction('vitu', 'start')} className={`px-2 py-1 transition-all duration-200 ${edgeStatus?.agente_vitu ? 'bg-green-600/50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'} text-white text-[8px] font-bold rounded uppercase`}>▶ Iniciar</button>
              <button disabled={!edgeStatus?.agente_vitu} onClick={() => handleAction('vitu', 'stop')} className={`px-2 py-1 transition-all duration-200 ${!edgeStatus?.agente_vitu ? 'bg-red-600/50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'} text-white text-[8px] font-bold rounded uppercase`}>⏹ Parar</button>
            </div>
          </div>
          )}
        </div>
        )}

        <div className="flex gap-2 w-full">
          <a href={painelUrl} target="_blank" className="flex-1 flex">
            <button className="w-full py-2 bg-[#2C3E50] text-[#A59D92] font-black text-[9px] uppercase tracking-widest rounded transition-all hover:bg-[#1a252f] cursor-pointer shadow-md flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
              ACESSAR PAINEL
            </button>
          </a>

          {anydeskId && (
            <div className="flex-1 flex rounded shadow-md overflow-hidden">
              <button
                onClick={handleAnydeskOpen}
                className="flex-1 py-2 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest transition-all hover:bg-red-700 cursor-pointer flex items-center justify-center gap-1.5"
                title="Abrir no app do AnyDesk (copia a senha automaticamente)"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8.322 3.677L0 12l8.322 8.323L16.645 12zM15.353 3.677v.001l-.815.815 7.507 7.507-7.507 7.507.815.815 8.322-8.322z" /></svg>
                ANYDESK
              </button>
              <button
                onClick={handleAnydeskDownload}
                className="px-2 bg-red-700 text-white transition-all hover:bg-red-800 border-l border-red-500 flex items-center justify-center cursor-pointer"
                title="Não tem o AnyDesk? Clique para baixar"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </button>
            </div>
          )}
        </div>

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
                  'api_vitu.py': 'VITU',
                };
                const defaultPath = pastasPorArquivo[file.name] ?? (file.name.includes('confinamento') ? 'confinamento' : file.name.includes('maternidade') ? 'maternidade' : file.name.includes('vitu') ? 'VITU' : '');
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

                  const apiKey = process.env.NEXT_PUBLIC_EDGE_API_KEY || "";
                  const res = await fetch(`${baseUrl}/api/update`, {
                    method: 'POST',
                    headers: { 'X-Api-Key': apiKey },
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

      {/* Modal de Câmera */}
      {viewingCamera && (
        <div className="fixed inset-0 bg-[#2C3E50]/95 z-[9999] flex justify-center items-center p-6" onClick={() => setViewingCamera(null)}>
          <div className="bg-white p-4 rounded-2xl w-full max-w-4xl shadow-2xl border border-white/20 flex flex-col relative" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 border-b border-[#2C3E50]/10 pb-3">
              <h3 className="text-sm font-black uppercase text-[#2C3E50] tracking-widest flex items-center">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span> 
                {viewingCamera.replace(/_/g, ' ')} - {title}
              </h3>
              <button onClick={() => setViewingCamera(null)} className="text-[#2C3E50]/50 hover:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-inner aspect-video flex items-center justify-center">
              <img 
                src={`${baseUrl}/api/stream/${viewingCamera}`} 
                alt="Live Stream" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden absolute inset-0 flex-col items-center justify-center text-white/50 text-xs font-bold uppercase tracking-widest gap-2">
                <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                Sem Sinal / Câmera Offline
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default function CentralDashboard() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const [heartbeats, setHeartbeats] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConexao, setFilterConexao] = useState("ALL");
  const [filterIA, setFilterIA] = useState("ALL");
  const [filterAlertas, setFilterAlertas] = useState("ALL");
  const [filterModulos, setFilterModulos] = useState<string[]>([]);

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

  // Aplicando todos os filtros
  const fazendasFiltradas = fazendas.filter(f => {
    // 1. Busca por Texto
    const s = searchTerm.toLowerCase();
    const matchText = (f.nome || "").toLowerCase().includes(s) || 
                      (f.cidade || "").toLowerCase().includes(s) || 
                      (f.proprietario || "").toLowerCase().includes(s);
    if (!matchText) return false;

    // Dados de Status para filtros avançados
    const data = telemetry[f.idUnico];
    const hbMat = heartbeats[`${f.idUnico}_mat`];
    const hbConf = heartbeats[`${f.idUnico}_conf`];
    const hbPainel = heartbeats[`${f.idUnico}_painel`];

    const nowSecs = Date.now() / 1000;
    const isMatOnline = hbMat && (nowSecs - hbMat.ts < 90);
    const isConfOnline = hbConf && (nowSecs - hbConf.ts < 90);
    const isPainelOnline = hbPainel && (nowSecs - hbPainel.ts < 720) && hbPainel.status !== 'offline';
    const isOnline = isPainelOnline || isMatOnline || isConfOnline;
    const isIaRunning = isMatOnline || isConfOnline;

    const hasAlertaMaternidade = data?.maternidade?.evento?.includes('NASCIMENTO') || data?.maternidade?.evento?.includes('PARTO');
    const hasAlertaConfinamento = data?.status_manejo === 'EM ANDAMENTO';
    const hasAlerta = hasAlertaMaternidade || hasAlertaConfinamento;

    const fModulos = f.modulos || [];
    const hasMaternidade = !!data?.maternidade || !!hbMat || fModulos.includes("MATERNIDADE");
    const hasConfinamento = !!data?.compost_barn_cama || !!data?.status_rebanho || !!data?.status_manejo || !!hbConf || fModulos.includes("CONFINAMENTO");
    const hasOrdenha = fModulos.includes("ORDENHA");
    const hasSalaEspera = fModulos.includes("SALA_ESPERA");
    const hasQuimicos = fModulos.includes("QUIMICOS");
    const hasVitu = fModulos.includes("VITU");

    // 2. Filtro Conexão
    if (filterConexao === 'ONLINE' && !isOnline) return false;
    if (filterConexao === 'OFFLINE' && isOnline) return false;

    // 3. Filtro IA
    if (filterIA === 'RUNNING' && isIaRunning) return false;
    if (filterIA === 'STOPPED' && !isIaRunning) return false;

    // 4. Filtro Alertas
    if (filterAlertas === 'COM_ALERTAS' && !hasAlerta) return false;

    // 5. Filtro Módulos (Multi-select com lógica OR)
    if (filterModulos.length > 0) {
      let hasAny = false;
      if (filterModulos.includes('MATERNIDADE') && hasMaternidade) hasAny = true;
      if (filterModulos.includes('CONFINAMENTO') && hasConfinamento) hasAny = true;
      if (filterModulos.includes('ORDENHA') && hasOrdenha) hasAny = true;
      if (filterModulos.includes('SALA_ESPERA') && hasSalaEspera) hasAny = true;
      if (filterModulos.includes('QUIMICOS') && hasQuimicos) hasAny = true;
      if (filterModulos.includes('VITU') && hasVitu) hasAny = true;
      
      if (!hasAny) return false;
    }

    return true;
  });

  return (
    <div className="flex h-screen bg-[#A59D92] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col p-6 lg:p-10 custom-scrollbar overflow-y-auto relative text-[#2C3E50]">
        <header className="flex flex-col gap-4 bg-[#2C3E50] border border-[#2C3E50]/10 p-4 lg:px-6 rounded-2xl shadow-lg relative group shrink-0">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10 rounded-t-2xl"></div>
          
          {/* Top Row: Logo and Status */}
          <div className="flex flex-col lg:flex-row justify-between items-center relative z-10">
            <div className="flex items-center gap-4 transition-transform">
              <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tight text-white uppercase leading-none">
                  INOFARM <span className="text-[#A59D92]">VISION</span>
                </h1>
                <p className="text-[8px] font-bold text-white/50 uppercase tracking-[0.2em] mt-0.5">Central de Monitoramento</p>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4 lg:mt-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full led-glow"></div>
                <span className="text-[8px] text-green-400 font-black uppercase tracking-widest">Nuvem Global Estável</span>
              </div>
              <div className="bg-black/30 px-3 py-1.5 rounded border border-white/5 flex flex-col items-end">
                <span className="text-[6px] text-white/40 uppercase tracking-widest font-black">Relógio Mestre</span>
                <span className="text-sm font-mono text-white tracking-widest">{currentTime}</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Search and Filters */}
          <div className="flex flex-col xl:flex-row gap-4 items-center justify-between relative z-10 pt-4 mt-2 border-t border-white/10">
            {/* Search */}
            <div className="relative w-full xl:w-[450px] shrink-0">
              <input 
                type="text" 
                placeholder="Buscar por nome, cidade ou proprietário..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-black/20 border border-white/10 text-white px-4 py-2 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/20 placeholder-white/40 shadow-inner transition-all text-sm font-semibold"
              />
              <svg className="w-4 h-4 absolute left-3.5 top-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-center xl:justify-end gap-2 w-full">
              <select value={filterConexao} onChange={e => setFilterConexao(e.target.value)} className="bg-white/10 border border-white/10 text-white/90 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/20 transition-colors cursor-pointer">
                <option value="ALL" className="bg-white text-[#2C3E50]">Conexão: TODAS</option>
                <option value="ONLINE" className="bg-white text-[#2C3E50]">🟢 APENAS ONLINE</option>
                <option value="OFFLINE" className="bg-white text-[#2C3E50]">🔴 APENAS OFFLINE</option>
              </select>
              <select value={filterIA} onChange={e => setFilterIA(e.target.value)} className="bg-white/10 border border-white/10 text-white/90 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/20 transition-colors cursor-pointer">
                <option value="ALL" className="bg-white text-[#2C3E50]">IA: TODAS</option>
                <option value="RUNNING" className="bg-white text-[#2C3E50]">▶️ IA INICIADA</option>
                <option value="STOPPED" className="bg-white text-[#2C3E50]">⏹️ IA PARADA</option>
              </select>
              <select value={filterAlertas} onChange={e => setFilterAlertas(e.target.value)} className="bg-white/10 border border-white/10 text-white/90 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/20 transition-colors cursor-pointer">
                <option value="ALL" className="bg-white text-[#2C3E50]">Alertas: TODOS</option>
                <option value="COM_ALERTAS" className="bg-white text-[#2C3E50]">🚨 APENAS ALERTAS ATIVOS</option>
              </select>
              
              <div className="relative group">
                <button className="bg-white/10 border border-white/10 text-white/90 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-white/20 hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1.5">
                  Controle de IA: {filterModulos.length === 0 ? 'TODOS' : `${filterModulos.length} SELECIONADOS`}
                  <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="absolute top-full right-0 mt-1 bg-white border border-[#2C3E50]/20 rounded-xl shadow-xl p-2 hidden group-hover:flex flex-col gap-1 z-50 min-w-[180px]">
                  {[
                    { val: 'CONFINAMENTO', label: 'Confinamento' },
                    { val: 'MATERNIDADE', label: 'Maternidade' },
                    { val: 'ORDENHA', label: 'Ordenha' },
                    { val: 'SALA_ESPERA', label: 'Sala de Espera' },
                    { val: 'QUIMICOS', label: 'Controle Químico' },
                    { val: 'VITU', label: 'Vitu (Assistente)' },
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2C3E50]/5 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={filterModulos.includes(opt.val)} 
                        onChange={(e) => {
                          if (e.target.checked) setFilterModulos(prev => [...prev, opt.val]);
                          else setFilterModulos(prev => prev.filter(v => v !== opt.val));
                        }}
                        className="rounded border-[#2C3E50]/30 text-[#2C3E50] focus:ring-[#2C3E50]/50 cursor-pointer w-3.5 h-3.5"
                      />
                      <span className="text-[10px] font-bold uppercase text-[#2C3E50]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="text-[9px] text-white/70 font-black uppercase tracking-widest bg-black/20 px-3 py-2 rounded-xl border border-white/5 shrink-0 ml-1">
                {fazendasFiltradas.length} EXIBIDAS
              </div>
            </div>
          </div>
        </header>

        {/* Grid Central de Fazendas Parceiras */}
        <div className="flex-1 mt-6">
          {fazendasFiltradas.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-[#2C3E50]/50 italic">Nenhuma fazenda encontrada com os filtros atuais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 auto-rows-fr pb-6">
              {fazendasFiltradas.map(f => {
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
                    anydeskId={f.anydeskId}
                    anydeskPass={f.anydeskPass}
                    modulos={f.modulos || []}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-auto pt-6 border-t border-[#2C3E50]/10 flex flex-col lg:flex-row justify-center items-center gap-8 lg:gap-16 text-[9px] text-[#2C3E50] font-black uppercase tracking-widest opacity-60 shrink-0">
          <div className="flex items-center gap-4">
            <p>© 2026 Inofarm - Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
