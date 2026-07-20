"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/app/components/Sidebar";
import WaveformPlayer from "@/app/components/WaveformPlayer";
import EmojiPicker from "emoji-picker-react";
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
  imageUrl?: string;
  documentUrl?: string;
  documentName?: string;
  videoUrl?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  reaction?: string;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
}

export default function ChatInbox() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);

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
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Image Upload State
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Document Upload State
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);

  // Video Upload State
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
        const urlParams = new URLSearchParams(window.location.search);
        const phoneParam = urlParams.get('phone');
        
        if (phoneParam) {
          const target = chatList.find(c => (c.phone && c.phone.includes(phoneParam)) || c.id.includes(phoneParam));
          if (target) {
            setActiveChatId(target.id);
          } else {
            setActiveChatId(chatList[0].id);
          }
        } else {
          setActiveChatId(chatList[0].id);
        }
      }
    });

    return () => unsubscribe();
  }, [activeChatId]);

  // Escuta as mensagens do chat ativo
  useEffect(() => {
    if (!activeChatId) return;

    // Reseta as mensagens não lidas deste chat assim que ele é aberto
    updateDoc(doc(db, "whatsapp_chats", activeChatId), { unread: 0 });

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
          imageUrl: data.imageUrl,
          documentUrl: data.documentUrl,
          documentName: data.documentName,
          videoUrl: data.videoUrl,
          status: data.status,
          reaction: data.reaction,
          location: data.location,
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
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
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
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
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
    if (!activeChatId || isSending) return;
    setIsSending(true);
    
    try {
      // 1. Upload to Firebase Storage
      const fileName = `whatsapp_audios/${activeChatId}/out_${Date.now()}.ogg`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, audioBlob, { contentType: 'audio/ogg; codecs=opus' });
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

      setRecordedAudioBlob(null);
      setRecordedAudioUrl(null);
    } catch (err) {
      console.error('Erro ao enviar áudio:', err);
      alert('Erro ao enviar áudio.');
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImageFile(file);
      setSelectedImageUrl(URL.createObjectURL(file));
    }
    // Reseta o input para permitir selecionar a mesma imagem novamente se necessário
    e.target.value = '';
  };

  const sendImageMessage = async () => {
    if (!selectedImageFile || !activeChatId) return;

    setIsSending(true);
    try {
      // 1. Upload to Firebase Storage
      const fileName = `whatsapp_images/${activeChatId}/out_${Date.now()}_${selectedImageFile.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, selectedImageFile);
      const imageUrl = await getDownloadURL(storageRef);

      // 2. Call API
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: activeChatId,
          type: 'image',
          imageUrl: imageUrl,
          replyToMessageId: replyingTo?.id || undefined
        }),
      });

      if (!res.ok) throw new Error("Erro na API");

      setSelectedImageFile(null);
      setSelectedImageUrl(null);
      setReplyingTo(null);
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      alert('Erro ao enviar imagem.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedDocumentFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const sendDocumentMessage = async () => {
    if (!selectedDocumentFile || !activeChatId) return;

    setIsSending(true);
    try {
      // 1. Upload to Firebase Storage
      const fileName = `whatsapp_documents/${activeChatId}/out_${Date.now()}_${selectedDocumentFile.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, selectedDocumentFile);
      const documentUrl = await getDownloadURL(storageRef);

      // 2. Call API
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: activeChatId,
          type: 'document',
          documentUrl: documentUrl,
          documentName: selectedDocumentFile.name,
          replyToMessageId: replyingTo?.id || undefined
        }),
      });

      if (!res.ok) throw new Error("Erro na API");

      setSelectedDocumentFile(null);
      setReplyingTo(null);
    } catch (err) {
      console.error('Erro ao enviar documento:', err);
      alert('Erro ao enviar documento.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedVideoFile(file);
      setSelectedVideoUrl(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const sendVideoMessage = async () => {
    if (!selectedVideoFile || !activeChatId) return;

    setIsSending(true);
    try {
      // 1. Upload to Firebase Storage
      const fileName = `whatsapp_videos/${activeChatId}/out_${Date.now()}_${selectedVideoFile.name}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, selectedVideoFile);
      const videoUrl = await getDownloadURL(storageRef);

      // 2. Call API
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: activeChatId,
          type: 'video',
          videoUrl: videoUrl,
          replyToMessageId: replyingTo?.id || undefined
        }),
      });

      if (!res.ok) throw new Error("Erro na API");

      setSelectedVideoFile(null);
      setSelectedVideoUrl(null);
      setReplyingTo(null);
    } catch (err) {
      console.error('Erro ao enviar vídeo:', err);
      alert('Erro ao enviar vídeo.');
    } finally {
      setIsSending(false);
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
          <h1 className="text-xl font-bold text-[#2C3E50]">WhatsApp INOFARM VISION</h1>
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
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-slate-800 truncate pr-2">{chat.name}</h3>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{chat.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500 truncate pr-2">{chat.lastMessage}</p>
                  {chat.unread > 0 && (
                    <span className="bg-[#2C3E50] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
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
              {messages.map((msg, index) => {
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const showDate = !prevMsg || msg.timestamp.toLocaleDateString() !== prevMsg.timestamp.toLocaleDateString();
                const dateStr = msg.timestamp.toLocaleDateString('pt-BR');
                const today = new Date().toLocaleDateString('pt-BR');
                const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR');
                const dateText = dateStr === today ? 'Hoje' : dateStr === yesterday ? 'Ontem' : dateStr;

                return (
                  <div key={msg.id} className="flex flex-col gap-4">
                    {showDate && (
                      <div className="flex justify-center my-1">
                        <span className="bg-white/90 text-slate-600 text-xs font-medium px-4 py-1.5 rounded-lg shadow-sm border border-slate-200/50">
                          {dateText}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'} group`}>
                      
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
                      <WaveformPlayer url={msg.audioUrl} />
                    ) : msg.type === 'image' && msg.imageUrl ? (
                      <div className="mb-1">
                        <img src={msg.imageUrl} alt="Imagem Recebida" className="max-w-[250px] max-h-[300px] rounded-lg object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.imageUrl, '_blank')} />
                        {msg.text && msg.text !== '📷 Imagem Recebida' && <p className="text-sm whitespace-pre-wrap mt-2">{msg.text}</p>}
                      </div>
                    ) : msg.type === 'document' && msg.documentUrl ? (
                      <div className="mb-1 flex flex-col gap-2">
                        <div className="flex items-center gap-3 bg-slate-100/50 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => window.open(msg.documentUrl, '_blank')}>
                          <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{msg.documentName || 'Documento'}</span>
                        </div>
                        {msg.text && !msg.text.includes('Arquivo Recebido') && <p className="text-sm whitespace-pre-wrap mt-1">{msg.text}</p>}
                      </div>
                    ) : msg.type === 'video' && msg.videoUrl ? (
                      <div className="mb-1">
                        <video controls src={msg.videoUrl} className="max-w-[250px] max-h-[300px] rounded-lg bg-black" />
                        {msg.text && msg.text !== '🎥 Vídeo Recebido' && <p className="text-sm whitespace-pre-wrap mt-2">{msg.text}</p>}
                      </div>
                    ) : msg.type === 'location' && msg.location ? (
                      <div className="mb-1 flex flex-col gap-2">
                        <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100 cursor-pointer hover:bg-red-100 transition-colors" onClick={() => window.open(`https://maps.google.com/?q=${msg.location?.latitude},${msg.location?.longitude}`, '_blank')}>
                          <div className="p-2 bg-red-100 text-red-600 rounded-full">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{msg.location.name || 'Localização Fixa'}</span>
                            <span className="text-xs text-slate-500 truncate max-w-[200px]">{msg.location.address || 'Abrir no Google Maps'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    )}
                    
                    <div className="flex justify-end items-center gap-1 mt-1">
                      <span className="text-[10px] text-slate-400 opacity-80 select-none">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.sender === 'bot' && (
                        <span className={`text-slate-400 flex items-center`}>
                          {msg.status === 'read' ? (
                            <svg className="w-[14px] h-[14px] text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7 M5 17l5 5L20 12"></path></svg>
                          ) : msg.status === 'delivered' ? (
                            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7 M5 17l5 5L20 12"></path></svg>
                          ) : msg.status === 'sent' ? (
                            <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7"></path></svg>
                          ) : (
                            <svg className="w-[14px] h-[14px] opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Reaction Badge */}
                    {msg.reaction && (
                      <div className="absolute -bottom-3 -right-2 bg-white rounded-full border border-slate-200 px-1.5 py-0.5 text-sm shadow-sm select-none">
                        {msg.reaction}
                      </div>
                    )}
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
              </div>
              )})}
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
                ) : recordedAudioUrl ? (
                  <div className="flex-1 bg-white rounded-xl flex items-center px-4 py-2 shadow-sm border border-slate-200 justify-between">
                    <audio controls src={recordedAudioUrl} className="h-10 w-full mr-4" />
                    <button 
                      onClick={() => { setRecordedAudioBlob(null); setRecordedAudioUrl(null); }} 
                      className="text-red-500 hover:text-red-700 p-2"
                      title="Apagar"
                    >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                ) : selectedImageUrl ? (
                  <div className="flex-1 bg-white rounded-xl flex items-center px-4 py-2 shadow-sm border border-slate-200 justify-between">
                    <div className="flex items-center gap-4">
                      <img src={selectedImageUrl} alt="Preview" className="h-14 w-14 object-cover rounded-md border border-slate-200" />
                      <span className="text-sm text-slate-600 font-medium truncate max-w-[200px]">{selectedImageFile?.name}</span>
                    </div>
                    <div className="flex items-center">
                      <button 
                        onClick={() => { setSelectedImageFile(null); setSelectedImageUrl(null); }} 
                        className="text-red-500 hover:text-red-700 p-2 mr-2"
                        title="Cancelar Imagem"
                        disabled={isSending}
                      >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </div>
                ) : selectedDocumentFile ? (
                  <div className="flex-1 bg-white rounded-xl flex items-center px-4 py-2 shadow-sm border border-slate-200 justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-50 text-blue-500 rounded-md">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                      </div>
                      <span className="text-sm text-slate-600 font-medium truncate max-w-[200px]">{selectedDocumentFile.name}</span>
                    </div>
                    <div className="flex items-center">
                      <button 
                        onClick={() => setSelectedDocumentFile(null)} 
                        className="text-red-500 hover:text-red-700 p-2 mr-2"
                        title="Cancelar Documento"
                        disabled={isSending}
                      >
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </div>
                ) : selectedVideoUrl ? (
                  <div className="flex-1 bg-white rounded-xl flex flex-col p-4 shadow-sm border border-slate-200">
                    <div className="relative mb-3 flex justify-center bg-black/5 rounded-lg border border-slate-200 p-2 max-h-[150px]">
                      <video controls src={selectedVideoUrl} className="max-h-[130px] rounded-md" />
                      <button 
                        onClick={() => { setSelectedVideoFile(null); setSelectedVideoUrl(null); }} 
                        className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-colors"
                        title="Remover Vídeo"
                        disabled={isSending}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 bg-white rounded-xl flex items-center px-4 py-3 shadow-sm border border-slate-200">
                    <button className="text-slate-400 hover:text-slate-600 mr-2" title="Anexar Documento" onClick={() => document.getElementById('documentInput')?.click()}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                    </button>
                    <button className="text-slate-400 hover:text-slate-600 mr-2" title="Anexar Imagem" onClick={() => document.getElementById('imageInput')?.click()}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </button>
                    <button className="text-slate-400 hover:text-slate-600 mr-3" title="Anexar Vídeo" onClick={() => document.getElementById('videoInput')?.click()}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    <input type="file" id="imageInput" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <input type="file" id="documentInput" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" onChange={handleDocumentSelect} />
                    <input type="file" id="videoInput" accept="video/mp4,video/3gpp,video/quicktime" className="hidden" onChange={handleVideoSelect} />
                    
                    <button 
                      className="text-slate-400 hover:text-[#2C3E50] mr-2" 
                      title="Emojis" 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>

                    {/* Popover de Emojis */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-xl">
                        <EmojiPicker 
                          onEmojiClick={(emojiData) => {
                            setInputText(prev => prev + emojiData.emoji);
                            setShowEmojiPicker(false);
                          }}
                        />
                      </div>
                    )}

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
                    className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-full shadow-md transition-transform hover:scale-105"
                    title="Concluir Gravação">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </button>
                ) : recordedAudioUrl || selectedImageUrl || selectedDocumentFile || selectedVideoUrl || inputText.trim() ? (
                  <button 
                    onClick={recordedAudioUrl ? () => sendAudioMessage(recordedAudioBlob!) : selectedImageUrl ? sendImageMessage : selectedDocumentFile ? sendDocumentMessage : selectedVideoUrl ? sendVideoMessage : sendMessage}
                    disabled={isSending}
                    className={`${isSending ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#2C3E50] hover:bg-[#2C3E50]/90 hover:scale-105'} text-white p-3 rounded-full shadow-md transition-transform flex items-center justify-center`}
                    title="Enviar">
                    {isSending ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                    )}
                  </button>
                ) : (
                  <button 
                    onClick={startRecording}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-3 rounded-full shadow-md transition-colors"
                    title="Gravar Áudio">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                  </button>
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
