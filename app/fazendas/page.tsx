"use client";

import { useState, useEffect } from "react";
import { collection, doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Sidebar from "@/app/components/Sidebar";

export default function FazendasDashboard() {
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [nome, setNome] = useState("");
  const [idUnico, setIdUnico] = useState("");
  const [proprietario, setProprietario] = useState("");
  const [cidade, setCidade] = useState("");
  const [urlLocal, setUrlLocal] = useState("");

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

  const handleAddContato = () => {
    setContatos([...contatos, { nome: "", numero: "", isPrincipal: false }]);
  };

  const handleRemoveContato = (idx: number) => {
    const newC = [...contatos];
    newC.splice(idx, 1);
    // Se removemos o principal, o primeiro vira principal
    if (newC.length > 0 && !newC.some(c => c.isPrincipal)) {
      newC[0].isPrincipal = true;
    }
    setContatos(newC);
  };

  const handleSetPrincipal = (idx: number) => {
    const newC = contatos.map((c, i) => ({ ...c, isPrincipal: i === idx }));
    setContatos(newC);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return alert("Banco não conectado!");
    if (!idUnico.trim() || idUnico.includes(" ")) return alert("ID Único inválido! Use apenas letras minúsculas sem espaço.");

    const dados = {
      nome,
      idUnico,
      proprietario,
      cidade,
      urlLocal,
      contatos,
      dataCadastro: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "fazendas_registradas", idUnico), dados);
      alert("Fazenda registrada com sucesso!");
      // Limpa form
      setNome(""); setIdUnico(""); setProprietario(""); setCidade(""); setUrlLocal("");
      setContatos([{ nome: "", numero: "", isPrincipal: true }]);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    }
  };

  // Removido helper de Blur para fazer direto no onChange

  return (
    <div className="flex h-screen bg-[#A59D92] font-sans overflow-hidden text-[#2C3E50]">
      <Sidebar />
      <div className="flex-1 flex flex-col p-6 lg:p-10 custom-scrollbar overflow-y-auto relative">
        <header className="flex justify-between items-center bg-[#2C3E50] text-white p-4 rounded-xl shadow-lg mb-6">
          <h1 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <span className="text-[#A59D92]">⚙️</span> Gestão de Fazendas
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lado Esquerdo: Formulário */}
          <div className="lg:col-span-1 bg-white/90 p-6 rounded-2xl shadow-xl border border-[#2C3E50]/10 flex flex-col gap-4">
            <h2 className="text-lg font-black uppercase border-b border-[#2C3E50]/10 pb-2 text-[#2C3E50]">Cadastrar Nova Fazenda</h2>
            <form onSubmit={handleSalvar} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Nome da Fazenda</label>
                <input required value={nome} onChange={e => {
                  setNome(e.target.value);
                  setIdUnico(e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""));
                }} className="p-2 border rounded bg-white text-sm outline-none focus:border-[#2C3E50]" placeholder="Nome da Fazenda" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">ID Único no Banco</label>
                <input required value={idUnico} onChange={e => setIdUnico(e.target.value)} className="p-2 border rounded bg-[#2C3E50]/5 text-sm font-mono outline-none" placeholder="gerado_automaticamente" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Proprietário</label>
                  <input required value={proprietario} onChange={e => setProprietario(e.target.value)} className="p-2 border rounded text-sm outline-none focus:border-[#2C3E50]" placeholder="Proprietário" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Cidade/UF</label>
                  <input required value={cidade} onChange={e => setCidade(e.target.value)} className="p-2 border rounded text-sm outline-none focus:border-[#2C3E50]" placeholder="Cidade, UF" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">URL de Acesso Local (Funnel)</label>
                <input required value={urlLocal} onChange={e => setUrlLocal(e.target.value)} className="p-2 border rounded font-mono text-sm outline-none focus:border-[#2C3E50]" placeholder="Ex: https://fazenda.tailnet.ts.net" />
              </div>

              {/* Seção Múltiplos Contatos */}
              <div className="mt-2 border-t border-[#2C3E50]/10 pt-2 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase text-[#2C3E50]/70">Contatos de Alerta (WhatsApp)</label>
                  <button type="button" onClick={handleAddContato} className="text-[10px] font-bold bg-[#A59D92]/30 px-2 py-1 rounded text-[#2C3E50] hover:bg-[#A59D92]/50">+ ADCIONAR</button>
                </div>

                {contatos.map((c, idx) => (
                  <div key={idx} className={`p-2 rounded border flex flex-col gap-2 ${c.isPrincipal ? 'bg-[#2C3E50]/5 border-[#2C3E50]/30' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-bold uppercase flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="contatoPrincipal" checked={c.isPrincipal} onChange={() => handleSetPrincipal(idx)} />
                        Contato Principal
                      </label>
                      {contatos.length > 1 && (
                        <button type="button" onClick={() => handleRemoveContato(idx)} className="text-red-500 text-[10px] font-bold">X Remover</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input required value={c.nome} onChange={(e) => { const nc = [...contatos]; nc[idx].nome = e.target.value; setContatos(nc); }} className="p-1 border text-xs" placeholder="Ex: Nome" />
                      <input required value={c.numero} onChange={(e) => { const nc = [...contatos]; nc[idx].numero = e.target.value; setContatos(nc); }} className="p-1 border text-xs font-mono" placeholder="Ex: 55XX999999999" />
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" className="mt-4 bg-[#2C3E50] text-white font-black py-3 rounded-lg shadow-md hover:scale-[1.02] transition-transform">
                SALVAR FAZENDA
              </button>
            </form>
          </div>

          {/* Lado Direito: Lista */}
          <div className="lg:col-span-2 bg-white/90 p-6 rounded-2xl shadow-xl border border-[#2C3E50]/10 flex flex-col gap-4">
            <h2 className="text-lg font-black uppercase border-b border-[#2C3E50]/10 pb-2 text-[#2C3E50]">Fazendas Cadastradas ({fazendas.length})</h2>

            {loading ? (
              <p className="text-sm">Carregando banco central...</p>
            ) : fazendas.length === 0 ? (
              <p className="text-sm text-[#2C3E50]/50 italic">Nenhuma fazenda cadastrada ainda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fazendas.map(f => {
                  const princ = f.contatos?.find((c: any) => c.isPrincipal) || f.contatos?.[0];
                  return (
                    <div key={f.id} className="border border-[#2C3E50]/10 rounded-xl p-4 flex flex-col gap-2 relative bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <h3 className="font-black text-lg text-[#2C3E50]">{f.nome}</h3>
                        <span className="text-[8px] bg-[#2C3E50]/10 px-2 py-1 rounded font-mono">{f.id}</span>
                      </div>

                      {f.urlLocal && (
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold uppercase text-[#2C3E50]/50">URL Local</span>
                          <span className="text-[10px] text-blue-600 truncate">{f.urlLocal}</span>
                        </div>
                      )}

                      <div className="text-xs flex flex-col gap-1 mt-2 text-[#2C3E50]/70">
                        <p><strong>Proprietário:</strong> {f.proprietario}</p>
                        <p><strong>Cidade:</strong> {f.cidade}</p>
                        {princ && <p><strong>Contato Principal:</strong> {princ.nome} - <span className="font-mono">{princ.numero}</span></p>}
                        <p className="mt-1 font-mono text-[9px] bg-emerald-500/10 text-emerald-700 p-1 rounded inline-block w-fit border border-emerald-500/20">
                          Tailscale: {f.tailscaleIp || "N/A"}
                        </p>
                      </div>

                      <div className="mt-2 text-[10px] bg-slate-100 p-2 rounded">
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
    </div>
  );
}
