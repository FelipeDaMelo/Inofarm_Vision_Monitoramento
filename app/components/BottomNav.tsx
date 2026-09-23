"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const [hasUnread, setHasUnread] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let isInitialLoad = true;
    const unsubscribe = onSnapshot(collection(db, "whatsapp_chats"), (snapshot) => {
      let unread = false;
      isInitialLoad = false;
      snapshot.forEach((doc) => {
        if (doc.data().unread > 0) {
          unread = true;
        }
      });
      setHasUnread(unread);
    });
    return () => unsubscribe();
  }, []);

  const navItems = [
    {
      name: "Central",
      href: "/central",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
      )
    },
    {
      name: "Chat",
      href: "/chat",
      icon: (
        <div className="relative">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.84.5 3.56 1.36 5.08L2 22l5.08-1.36C8.44 21.5 10.16 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.52 0-2.97-.37-4.24-1.03l-.3-.16-3.14.84.85-3.07-.17-.3A7.95 7.95 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm4.24-5.38c-.23-.12-1.38-.68-1.59-.76-.21-.08-.37-.12-.52.12s-.6.76-.74.92c-.14.16-.28.18-.51.06-1.12-.56-2.14-1.44-2.85-2.52-.15-.22-.02-.34.09-.46.11-.11.23-.27.35-.41.11-.14.15-.23.23-.39.08-.15.04-.29-.02-.41s-.52-1.25-.71-1.71c-.19-.45-.38-.39-.52-.4h-.44c-.16 0-.41.06-.62.29-.21.23-.81.79-.81 1.93 0 1.14.83 2.24.95 2.4.12.16 1.63 2.49 3.95 3.49 1.48.64 2.15.71 2.92.59.85-.13 1.38-.56 1.57-1.11.19-.55.19-1.02.14-1.12-.06-.1-.23-.16-.46-.28z"></path></svg>
          {hasUnread && (
            <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full border-2 border-[#2C3E50] animate-pulse"></span>
          )}
        </div>
      )
    },
    {
      name: "Fazendas",
      href: "/fazendas",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
      )
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-[#1e2b3c]/95 backdrop-blur-md border-t border-[#A59D92]/20 z-50 flex md:hidden justify-around items-center h-16 pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link 
            key={item.href} 
            href={item.href} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
