"use client";

import { useState, useRef, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Caso o vídeo falhe ao carregar ou o navegador bloqueie autoplay,
    // um fallback de 5 segundos garante que a tela de login apareça.
    const fallbackTimer = setTimeout(() => {
      finishSplash();
    }, 5000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  const finishSplash = () => {
    setFadeSplash(true);
    setTimeout(() => setShowSplash(false), 800); // 800ms de transição fade
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirecionamento após sucesso
      router.push("/central");
    } catch (err: any) {
      console.error(err);
      setError("Credenciais inválidas. Verifique seu e-mail e senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#A59D92] overflow-hidden flex items-center justify-center">
      
      {/* Splash Screen */}
      {showSplash && (
        <div 
          className={`absolute inset-0 z-50 bg-black flex items-center justify-center transition-opacity duration-700 ease-in-out ${fadeSplash ? 'opacity-0' : 'opacity-100'}`}
        >
          <video 
            ref={videoRef}
            src="/splash.mp4" 
            autoPlay 
            muted 
            playsInline
            onEnded={finishSplash}
            className="w-full h-full object-contain max-w-4xl"
          />
        </div>
      )}

      {/* Tela de Login */}
      <div className="relative z-10 w-full max-w-md p-8 bg-[#2C3E50] rounded-3xl shadow-2xl border border-white/10 m-4">
        <div className="flex justify-center mb-8">
          <img src="/logo_sem_escrito.png" alt="Inofarm Vision" className="h-20 hover:scale-105 transition-transform" />
        </div>
        
        <h1 className="text-2xl font-black text-white text-center tracking-tight mb-2 uppercase">
          Inofarm Vision
        </h1>
        <p className="text-white/50 text-center text-sm font-semibold mb-8">
          Acesso restrito à plataforma
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm mb-6 text-center shadow-inner">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-white/70 text-[10px] font-black uppercase tracking-[0.1em]">E-mail de Acesso</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-black/20 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A59D92] placeholder-white/20 transition-all font-medium text-sm"
              placeholder="seu@email.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-white/70 text-[10px] font-black uppercase tracking-[0.1em]">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-black/20 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A59D92] placeholder-white/20 transition-all font-medium text-sm"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="mt-6 bg-[#A59D92] text-[#2C3E50] py-3.5 rounded-xl font-black uppercase tracking-widest hover:bg-white hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex justify-center items-center h-12"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#2C3E50]/30 border-t-[#2C3E50] rounded-full animate-spin"></div>
            ) : (
              "Acessar"
            )}
          </button>
        </form>
      </div>
      
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#2C3E50]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-white/20 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
}
