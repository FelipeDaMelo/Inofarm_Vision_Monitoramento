"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/app/components/Sidebar";
import { db, storage } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface Chat {
  id: string;
  phone: string;
  name: string;
  lastMessage: string;
  unread: number;
  online?: boolean;
  time?: string;
  updatedAt?: any;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  replyToMessageId?: string;
  type?: string;
  audioUrl?: string;
}

export default function ChatInbox() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Escuta os chats (Contatos)
  useEffect(() => {
    const q = query(collection(db, "whatsapp_chats"), orderBy("updatedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Formata hora
        let timeStr = "";
        if (data.updatedAt) {
          const date = data.updatedAt.toDate();
          timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }

        chatList.push({
          id: doc.id,
          phone: data.phone,
          name: data.name || data.phone,
          lastMessage: data.lastMessage || "",
          unread: data.unread || 0,
          time: timeStr,
          updatedAt: data.updatedAt
        });
      });
      setChats(chatList);
      if (!activeChatId && chatList.length > 0) {
        setActiveChatId(chatList[0].id);
      }
    });

    return () => unsubscribe();
  }, [activeChatId]);

  // Escuta as mensagens do chat ativo
  useEffect(() => {
    if (!activeChatId) return;

    const q = query(
      collection(db, "whatsapp_chats", activeChatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          text: data.text,
          type: data.type || 'text',
          audioUrl: data.audioUrl,
          sender: data.sender,
          timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date(),
          replyToMessageId: data.replyToMessageId,
        });
      });
      setMessages(msgs);
      setTimeout(() => scrollToBottom(), 100);
      
      // Zera unread quando visualizado
      updateDoc(doc(db, "whatsapp_chats", activeChatId), { unread: 0 }).catch(() => {});
    });

    return () => unsubscribe();
  }, [activeChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeChatId) return;
    
    const textToSend = inputText;
    const replyId = replyingTo?.id;
    setInputText(""); // limpa logo
    setReplyingTo(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: activeChatId, text: textToSend, replyToMessageId: replyId })
      });
      if (!res.ok) {
        console.error("Falha ao enviar mensagem");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Erro ao acessar microfone", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null; // Remove o envio
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!activeChatId) return;
    
    try {
      // 1. Upload to Firebase Storage
      const fileName = `whatsapp_audios/${activeChatId}/out_${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, audioBlob);
      const audioUrl = await getDownloadURL(storageRef);

      const replyId = replyingTo?.id;
      setReplyingTo(null);
      
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: activeChatId, 
          text: '🎵 Áudio', 
          type: 'audio',
          audioUrl: audioUrl,
          replyToMessageId: replyId 
        })
      });
    } catch (err) {
      console.error("Erro ao enviar áudio:", err);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <Sidebar />

      {/* Lista de Conversas (Esquerda) */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col shadow-sm z-0">
        <div className="h-20 bg-slate-50 flex items-center px-6 border-b border-slate-200 justify-between">
          <h1 className="text-xl font-bold text-[#2C3E50]">Central Inbox</h1>
        </div>
        
        <div className="p-4">
          <div className="bg-slate-100 rounded-lg p-2 flex items-center gap-2 text-slate-500">
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input type="text" placeholder="Buscar conversas..." className="bg-transparent outline-none w-full text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chats.map((chat) => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChatId(chat.id)}
              className={`p-4 flex gap-4 cursor-pointer transition-colors border-b border-slate-50 ${activeChatId === chat.id ? 'bg-[#A59D92]/10 border-l-4 border-l-[#A59D92]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
            >
              <div className="relative">
                <div className="w-12 h-12 bg-[#2C3E50]/10 rounded-full flex items-center justify-center text-[#2C3E50] font-bold uppercase">
                  {chat.name.charAt(0)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h2 className="font-semibold text-slate-800 truncate">{chat.name}</h2>
                  <span className={`text-xs ${chat.unread > 0 ? 'text-green-600 font-bold' : 'text-slate-400'}`}>{chat.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500 truncate">{chat.lastMessage}</p>
                  {chat.unread > 0 && (
                    <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {chats.length === 0 && (
             <div className="p-6 text-center text-slate-400 text-sm">
                Nenhuma conversa ainda.<br/>As mensagens do WhatsApp aparecerão aqui.
             </div>
          )}
        </div>
      </div>

      {/* Área de Chat (Direita) */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative" style={{ backgroundImage: "url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')", backgroundSize: '400px', opacity: 0.95 }}>
        
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-20 bg-white border-b border-slate-200 flex items-center px-6 shadow-sm z-10 justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#2C3E50] text-white rounded-full flex items-center justify-center font-bold uppercase">
                  {activeChat.name.charAt(0)}
                </div>
                <div>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (newName.trim()) {
                              updateDoc(doc(db, "whatsapp_chats", activeChat.id), { name: newName.trim() });
                            }
                            setIsEditingName(false);
                          }
                        }}
                        className="border border-slate-300 rounded px-2 py-1 text-sm text-slate-800 outline-none focus:border-[#A59D92]"
                        autoFocus
                      />
                      <button 
                        onClick={() => {
                          if (newName.trim()) {
                            updateDoc(doc(db, "whatsapp_chats", activeChat.id), { name: newName.trim() });
                          }
                          setIsEditingName(false);
                        }}
                        className="text-green-600 hover:text-green-700 p-1"
                        title="Salvar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      </button>
                      <button 
                        onClick={() => setIsEditingName(false)}
                        className="text-red-500 hover:text-red-600 p-1"
                        title="Cancelar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setIsEditingName(true); setNewName(activeChat.name); }}>
                      <h2 className="font-bold text-slate-800">{activeChat.name}</h2>
                      <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">{activeChat.phone}</p>
                </div>
              </div>
            </div>

            {/* Messages View */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'} group`}>
                  
                  {/* Reply Button for Bot Messages */}
                  {msg.sender === 'bot' && (
                    <div className="hidden group-hover:flex items-center justify-center pr-2">
                      <button onClick={() => setReplyingTo(msg)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-full shadow-sm" title="Responder">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                      </button>
                    </div>
                  )}

                  <div className={`max-w-md rounded-2xl px-4 py-2 shadow-sm relative ${msg.sender === 'user' ? 'bg-white text-slate-800 rounded-tl-none' : 'bg-[#d9fdd3] text-slate-800 rounded-tr-none'}`}>
                    
                    {/* Quoted Message (if it's a reply) */}
                    {msg.replyToMessageId && (
                      <div className="mb-2 p-2 bg-black/5 border-l-4 border-[#2C3E50]/40 rounded text-xs opacity-80 truncate">
                        <span className="font-semibold block mb-1">Citação</span>
                        {messages.find(m => m.id === msg.replyToMessageId)?.type === 'audio' ? '🎵 Áudio' : messages.find(m => m.id === msg.replyToMessageId)?.text || "Mensagem original"}
                      </div>
                    )}

                    {msg.type === 'audio' && msg.audioUrl ? (
                      <audio controls src={msg.audioUrl} className="w-60 h-10 mb-1" />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    )}
                    
                    <div className="flex justify-end items-center gap-1 mt-1">
                      <span className="text-[10px] text-slate-400">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Reply Button for User Messages */}
                  {msg.sender === 'user' && (
                    <div className="hidden group-hover:flex items-center justify-center pl-2">
                      <button onClick={() => setReplyingTo(msg)} className="text-slate-400 hover:text-slate-600 p-1 bg-white rounded-full shadow-sm" title="Responder">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-[#f0f2f5] p-4 flex flex-col z-10">
              
              {/* Replying To Preview Box */}
              {replyingTo && (
                <div className="mb-2 mx-12 p-3 bg-white border-l-4 border-[#2C3E50] rounded shadow-sm flex justify-between items-start">
                  <div className="flex-1 truncate">
                    <span className="text-xs font-bold text-[#2C3E50] block mb-1">
                      Respondendo a {replyingTo.sender === 'user' ? activeChat.name : 'Você'}
                    </span>
                    <span className="text-sm text-slate-600 truncate block">{replyingTo.text}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 ml-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4">
                
                {isRecording ? (
                  <div className="flex-1 bg-red-50 rounded-xl flex items-center px-4 py-3 shadow-sm border border-red-200 justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-red-600 font-semibold">{formatRecordingTime(recordingTime)}</span>
                    </div>
                    <button onClick={cancelRecording} className="text-red-500 hover:text-red-700 text-sm font-medium mr-4">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex-1 bg-white rounded-xl flex items-center px-4 py-3 shadow-sm border border-slate-200">
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Digite uma mensagem" 
                      className="flex-1 bg-transparent outline-none text-slate-700" 
                    />
                  </div>
                )}
                
                {isRecording ? (
                  <button 
                    onClick={stopRecording}
                    className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-full shadow-md transition-transform hover:scale-105">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </button>
                ) : (
                  inputText.trim() ? (
                    <button 
                      onClick={sendMessage}
                      className="bg-[#A59D92] hover:bg-[#A59D92]/90 text-white p-3 rounded-full shadow-md transition-transform hover:scale-105">
                      <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    </button>
                  ) : (
                    <button 
                      onClick={startRecording}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-3 rounded-full shadow-md transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                    </button>
                  )
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
             <div className="text-center text-slate-500">
               <svg className="w-20 h-20 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
               <p className="text-lg font-semibold text-slate-600">Inofarm Vision Chat</p>
               <p className="text-sm">Selecione uma conversa para começar.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
