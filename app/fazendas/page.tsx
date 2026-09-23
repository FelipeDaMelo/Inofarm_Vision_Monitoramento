"use client";

import { useState, useEffect } from "react";
import { collection, doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "@/app/components/Sidebar";
import BottomNav from "@/app/components/BottomNav";

const DISPONIVEIS_MODULOS = [
  { val: "MATERNIDADE", label: "Maternidade" },
  { val: "CONFINAMENTO", label: "Confinamento" },
  { val: "ORDENHA", label: "Ordenha" },
  { val: "SALA_ESPERA", label: "Sala de Espera" },
  { val: "QUIMICOS", label: "Controle Químico" },
  { val: "VITU", label: "Vitu (Assistente)" },
];

export default function FazendasDashboard() {
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [nome, setNome] = useState("");
  const [idUnico, setIdUnico] = useState("");
  const [proprietario, setProprietario] = useState("");
  const [cidade, setCidade] = useState("");
  const [urlLocal, setUrlLocal] = useState("");
  const [anydeskId, setAnydeskId] = useState("");
  const [anydeskPass, setAnydeskPass] = useState("");
  const [modulos, setModulos] = useState<string[]>(["CONFINAMENTO", "MATERNIDADE", "VITU"]);

  const [contatos, setContatos] = useState<{ nome: string, numero: string, isPrincipal: boolean }[]>([
    { nome: "", numero: "", isPrincipal: true }
  ]);

  // Carregar fazendas registradas
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, "fazendas_registradas"), (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFazendas(lista);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleModulo = (modVal: string) => {
    setModulos(prev =>
      prev.includes(modVal) ? prev.filter(m => m !== modVal) : [...prev, modVal]
    );
  };

  const handleAddContato = () => {
    setContatos([...contatos, { nome: "", numero: "", isPrincipal: false }]);
  };

  const handleRemoveContato = (idx: number) => {
    const newC = [...contatos];
    newC.splice(idx, 1);
    if (newC.length > 0 && !newC.some(c => c.isPrincipal)) {
      newC[0].isPrincipal = true;
    }
    setContatos(newC);
  };

  const handleSetPrincipal = (idx: number) => {
    const newC = contatos.map((c, i) => ({ ...c, isPrincipal: i === idx }));
    setContatos(newC);
  };

  const handleEditarFazenda = (f: any) => {
    setNome(f.nome || "");
    setIdUnico(f.idUnico || f.id || "");
    setProprietario(f.proprietario || "");
    setCidade(f.cidade || "");
    setUrlLocal(f.urlLocal || "");
    setAnydeskId(f.anydeskId || "");
    setAnydeskPass(f.anydeskPass || "");
    setModulos(f.modulos || []);
    if (f.contatos && f.contatos.length > 0) {
      setContatos(f.contatos);
    } else {
      setContatos([{ nome: "", numero: "", isPrincipal: true }]);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLimparForm = () => {
    setNome("");
    setIdUnico("");
    setProprietario("");
    setCidade("");
    setUrlLocal("");
    setAnydeskId("");
    setAnydeskPass("");
    setModulos(["CONFINAMENTO", "MATERNIDADE", "VITU"]);
    setContatos([{ nome: "", numero: "", isPrincipal: true }]);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return alert("Banco não conectado!");
    if (!idUnico.trim() || idUnico.includes(" ")) return alert("ID Único inválido! Use apenas letras minúsculas e underline, sem espaço.");

    const dados: Record<string, any> = {
      nome,
      idUnico,
      proprietario,
      cidade,
      urlLocal,
      anydeskId,
      anydeskPass,
      modulos,
      contatos,
      ultima_atualizacao: new Date().toISOString()
    };

    try {
      // Salva com merge=True para preservar dados dos agentes locais (como pushTokens, códigoApp, histórico, etc)
      await setDoc(doc(db, "fazendas_registradas", idUnico), dados, { merge: true });
      alert("✅ Fazenda salva e sincronizada com sucesso!");
      handleLimparForm();
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao salvar fazenda no banco central.");
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#A59D92] font-sans overflow-hidden text-[#2C3E50]">
      <Sidebar />
      <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-10 pb-24 md:pb-6 lg:pb-10 custom-scrollbar overflow-y-auto relative">
        <header className="flex justify-between items-center bg-[#2C3E50] text-white p-4 rounded-xl shadow-lg mb-6">
          <h1 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <span className="text-[#A59D92]">⚙️</span> Gestão de Fazendas & Módulos
          </h1>
          <button
            type="button"
            onClick={handleLimparForm}
            className="text-xs font-bold uppercase bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors cursor-pointer"
          >
            + Novo Cadastro
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lado Esquerdo: Formulário */}
          <div className="lg:col-span-1 bg-white/90 p-6 rounded-2xl shadow-xl border border-[#2C3E50]/10 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-[#2C3E50]/10 pb-2">
              <h2 className="text-lg font-black uppercase text-[#2C3E50]">
                {idUnico ? "Editar Fazenda" : "Cadastrar Nova Fazenda"}
              </h2>
              {idUnico && (
                <span className="text-[10px] font-mono bg-[#2C3E50]/10 px-2 py-0.5 rounded text-[#2C3E50]">
                  {idUnico}
                </span>
              )}
            </div>

            <form onSubmit={handleSalvar} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Nome da Fazenda</label>
                <input
                  required
                  value={nome}
                  onChange={e => {
                    setNome(e.target.value);
                    if (!idUnico) {
                      setIdUnico(e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, ""));
                    }
                  }}
                  className="p-2 border rounded bg-white text-sm outline-none focus:border-[#2C3E50]"
                  placeholder="Ex: Fazenda São Francisco"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">ID Único no Banco</label>
                <input
                  required
                  value={idUnico}
                  onChange={e => setIdUnico(e.target.value)}
                  className="p-2 border rounded bg-[#2C3E50]/5 text-sm font-mono outline-none"
                  placeholder="Ex: fazendasaofrancisco_toninho"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Proprietário</label>
                  <input
                    required
                    value={proprietario}
                    onChange={e => setProprietario(e.target.value)}
                    className="p-2 border rounded text-sm outline-none focus:border-[#2C3E50]"
                    placeholder="Ex: Toninho"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Cidade/UF</label>
                  <input
                    required
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    className="p-2 border rounded text-sm outline-none focus:border-[#2C3E50]"
                    placeholder="Ex: Piumhi, MG"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">URL de Acesso Local (Funnel / Tailscale)</label>
                <input
                  required
                  value={urlLocal}
                  onChange={e => setUrlLocal(e.target.value)}
                  className="p-2 border rounded font-mono text-sm outline-none focus:border-[#2C3E50]"
                  placeholder="Ex: https://fazendasaofrancisco.tailnet.ts.net"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">ID AnyDesk</label>
                  <input
                    value={anydeskId}
                    onChange={e => setAnydeskId(e.target.value)}
                    className="p-2 border rounded font-mono text-sm outline-none focus:border-[#2C3E50]"
                    placeholder="Ex: 1456175227"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Senha AnyDesk</label>
                  <input
                    value={anydeskPass}
                    onChange={e => setAnydeskPass(e.target.value)}
                    className="p-2 border rounded font-mono text-sm outline-none focus:border-[#2C3E50]"
                    placeholder="Ex: ino123456"
                  />
                </div>
              </div>

              {/* Módulos Habilitados */}
              <div className="mt-2 border-t border-[#2C3E50]/10 pt-2 flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">
                  Módulos Ativos Nesta Fazenda
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-[#2C3E50]/5 p-2 rounded-lg border border-[#2C3E50]/10">
                  {DISPONIVEIS_MODULOS.map(m => (
                    <label key={m.val} className="flex items-center gap-1.5 text-[11px] font-bold text-[#2C3E50] cursor-pointer hover:text-black">
                      <input
                        type="checkbox"
                        checked={modulos.includes(m.val)}
                        onChange={() => handleToggleModulo(m.val)}
                        className="rounded border-[#2C3E50]/30 text-[#2C3E50] focus:ring-[#2C3E50]/50 cursor-pointer w-3.5 h-3.5"
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Seção Múltiplos Contatos */}
              <div className="mt-2 border-t border-[#2C3E50]/10 pt-2 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Contatos de Alerta (WhatsApp)</label>
                  <button
                    type="button"
                    onClick={handleAddContato}
                    className="text-[10px] font-bold bg-[#A59D92]/30 px-2 py-1 rounded text-[#2C3E50] hover:bg-[#A59D92]/50 cursor-pointer"
                  >
                    + ADICIONAR
                  </button>
                </div>

                {contatos.map((c, idx) => (
                  <div key={idx} className={`p-2 rounded border flex flex-col gap-2 ${c.isPrincipal ? 'bg-[#2C3E50]/5 border-[#2C3E50]/30' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-bold uppercase flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="contatoPrincipal" checked={c.isPrincipal} onChange={() => handleSetPrincipal(idx)} />
                        Contato Principal
                      </label>
                      {contatos.length > 1 && (
                        <button type="button" onClick={() => handleRemoveContato(idx)} className="text-red-500 text-[10px] font-bold cursor-pointer">✕ Remover</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        required
                        value={c.nome}
                        onChange={(e) => { const nc = [...contatos]; nc[idx].nome = e.target.value; setContatos(nc); }}
                        className="p-1 border text-xs rounded outline-none"
                        placeholder="Nome (Ex: Felipe)"
                      />
                      <input
                        required
                        value={c.numero}
                        onChange={(e) => { const nc = [...contatos]; nc[idx].numero = e.target.value; setContatos(nc); }}
                        className="p-1 border text-xs font-mono rounded outline-none"
                        placeholder="5511999999999"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="flex-1 bg-[#2C3E50] text-white font-black py-3 rounded-lg shadow-md hover:scale-[1.01] active:scale-[0.99] transition-transform cursor-pointer"
                >
                  {idUnico ? "SALVAR ALTERAÇÕES" : "CADASTRAR FAZENDA"}
                </button>
                {idUnico && (
                  <button
                    type="button"
                    onClick={handleLimparForm}
                    className="px-4 bg-gray-200 text-[#2C3E50] font-bold py-3 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer text-xs"
                  >
                    CANCELAR
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lado Direito: Lista */}
          <div className="lg:col-span-2 bg-white/90 p-6 rounded-2xl shadow-xl border border-[#2C3E50]/10 flex flex-col gap-4">
            <h2 className="text-lg font-black uppercase border-b border-[#2C3E50]/10 pb-2 text-[#2C3E50]">
              Fazendas Cadastradas ({fazendas.length})
            </h2>

            {loading ? (
              <p className="text-sm">Carregando banco central...</p>
            ) : fazendas.length === 0 ? (
              <p className="text-sm text-[#2C3E50]/50 italic">Nenhuma fazenda cadastrada ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fazendas.map(f => {
                  const princ = f.contatos?.find((c: any) => c.isPrincipal) || f.contatos?.[0];
                  const farmModulos: string[] = f.modulos || [];

                  return (
                    <div
                      key={f.id}
                      className="border border-[#2C3E50]/10 rounded-xl p-4 flex flex-col gap-2 relative bg-white shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-black text-base text-[#2C3E50]">{f.nome}</h3>
                          <span className="text-[9px] bg-[#2C3E50]/10 px-2 py-0.5 rounded font-mono text-[#2C3E50]">
                            {f.idUnico || f.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEditarFazenda(f)}
                          className="text-[10px] font-bold uppercase bg-[#2C3E50]/5 hover:bg-[#2C3E50] hover:text-white px-2.5 py-1 rounded transition-colors cursor-pointer"
                        >
                          ✏️ Editar
                        </button>
                      </div>

                      {/* Badges de Módulos */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {farmModulos.length > 0 ? (
                          farmModulos.map(m => (
                            <span
                              key={m}
                              className="text-[8px] font-black uppercase tracking-wider bg-[#2C3E50]/5 text-[#2C3E50] border border-[#2C3E50]/10 px-1.5 py-0.5 rounded"
                            >
                              {m}
                            </span>
                          ))
                        ) : (
                          <span className="text-[8px] font-bold uppercase text-red-500/70 italic">
                            Nenhum módulo configurado
                          </span>
                        )}
                      </div>

                      {f.urlLocal && (
                        <div className="flex flex-col mt-1">
                          <span className="text-[8px] font-bold uppercase text-[#2C3E50]/50">URL Local</span>
                          <a
                            href={f.urlLocal}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-blue-600 truncate hover:underline"
                          >
                            {f.urlLocal}
                          </a>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-1 text-[10px]">
                        {f.anydeskId && (
                          <div>
                            <span className="text-[8px] font-bold uppercase text-[#2C3E50]/50 block">AnyDesk ID</span>
                            <span className="font-mono text-red-600 font-bold">{f.anydeskId}</span>
                          </div>
                        )}
                        {f.anydeskPass && (
                          <div>
                            <span className="text-[8px] font-bold uppercase text-[#2C3E50]/50 block">AnyDesk Senha</span>
                            <span className="font-mono text-[#2C3E50] font-bold">{f.anydeskPass}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs flex flex-col gap-1 mt-2 text-[#2C3E50]/70 border-t border-gray-100 pt-2">
                        <p><strong>Proprietário:</strong> {f.proprietario || "—"}</p>
                        <p><strong>Cidade:</strong> {f.cidade || "—"}</p>
                        {princ && (
                          <p><strong>Contato Principal:</strong> {princ.nome} - <span className="font-mono font-bold text-[#2C3E50]">{princ.numero}</span></p>
                        )}
                      </div>

                      <div className="mt-auto text-[9px] bg-slate-50 p-2 rounded text-[#2C3E50]/70">
                        <strong>Outros Contatos:</strong> {f.contatos?.length > 1 ? f.contatos.filter((c: any) => !c.isPrincipal).map((c: any) => c.nome).join(", ") : "Nenhum"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
