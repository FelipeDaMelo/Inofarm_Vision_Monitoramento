"use client";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login");
    }
    // Redireciona o usuário logado se ele tentar acessar o login
    if (!loading && user && pathname === "/login") {
      router.push("/central");
    }
  }, [user, loading, router, pathname]);

  // Se estiver na tela de login e não logado, deixa renderizar a página de login
  if (pathname === "/login" && !user && !loading) {
    return <>{children}</>;
  }

  // Loading global inicial
  if (loading || (!user && pathname !== "/login")) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#A59D92]">
        <div className="flex flex-col items-center gap-6">
          <img src="/logo_sem_escrito.png" alt="Inofarm Logo" className="w-24 animate-pulse opacity-80" />
          <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-[#2C3E50]"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
