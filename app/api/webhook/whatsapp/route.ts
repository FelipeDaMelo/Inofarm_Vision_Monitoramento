import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, collection, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const VERIFY_TOKEN = 'f2e6l0i1p8e9';

/**
 * Limpa e normaliza um número de telefone para o padrão WhatsApp.
 * Remove espaços, '+', '-', '(', ')'.
 * Adiciona o DDI '55' e/ou o dígito '9' para números brasileiros, padronizando em 13 dígitos.
 */
function normalizarTelefone(numero: string | number): string {
  if (!numero) return "";
  
  const numLimpo = String(numero).replace(/\D/g, "");
  
  if (numLimpo.length === 10) {
      return `55${numLimpo.substring(0, 2)}9${numLimpo.substring(2)}`;
  }
  
  if (numLimpo.length === 11 && !numLimpo.startsWith("55")) {
      return `55${numLimpo}`;
  }
  
  if (numLimpo.length === 12 && numLimpo.startsWith("55")) {
      return `55${numLimpo.substring(2, 4)}9${numLimpo.substring(4)}`;
  }
  
  return numLimpo;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return new NextResponse(challenge, { status: 200 });
    }
    return new NextResponse('Forbidden', { status: 403 });
  }
  return new NextResponse('Bad Request', { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.object) {
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value) {
        const value = body.entry[0].changes[0].value;

        // 1. Processar mensagens recebidas (Usuário enviando para o robô)
        if (value.messages && value.messages[0]) {
          const msg = value.messages[0];
          const phone = normalizarTelefone(msg.from); // Número de quem enviou padronizado
          const contactName = value.contacts?.[0]?.profile?.name || msg.from;
          
          let text = '';
          let audioUrl = '';
          let imageUrl = '';
          let documentUrl = '';
          let documentName = '';
          let videoUrl = '';
          let locationData: any = null;
          let isReaction = false;
          let messageType = 'text';

          if (msg.type === 'text') text = msg.text.body;
          if (msg.type === 'button') text = msg.button.text;
          
          if (msg.type === 'image') {
            messageType = 'image';
            text = '📷 Imagem Recebida';
            
            try {
              const token = process.env.WHATSAPP_TOKEN;
              const mediaId = msg.image.id;
              const mimeType = msg.image.mime_type;
              
              // 1. Pega a URL de download na Meta
              const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const metaData = await metaRes.json();
              
              if (metaData.url) {
                // 2. Baixa o arquivo binário da Meta
                const mediaRes = await fetch(metaData.url, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const arrayBuffer = await mediaRes.arrayBuffer();
                
                // 3. Salva no Firebase Storage
                const ext = mimeType.includes('png') ? 'png' : 'jpg';
                const filePath = `whatsapp_images/${phone}/${Date.now()}_${mediaId}.${ext}`;
                const storageRef = ref(storage, filePath);
                
                await uploadBytes(storageRef, arrayBuffer, { contentType: mimeType });
                imageUrl = await getDownloadURL(storageRef);
              }
            } catch (err) {
              console.error('Erro ao processar imagem', err);
            }
          }
          
          if (msg.type === 'audio') {
            messageType = 'audio';
            text = '🎵 Áudio Recebido';
            
            try {
              const token = process.env.WHATSAPP_TOKEN;
              const mediaId = msg.audio.id;
              const mimeType = msg.audio.mime_type;
              
              // 1. Pega a URL de download na Meta
              const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const metaData = await metaRes.json();
              
              if (metaData.url) {
                // 2. Baixa o arquivo binário da Meta
                const mediaRes = await fetch(metaData.url, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const arrayBuffer = await mediaRes.arrayBuffer();
                
                // 3. Salva no Firebase Storage
                const ext = mimeType.includes('ogg') ? 'ogg' : 'mp3';
                const filePath = `whatsapp_audios/${phone}/${Date.now()}_${mediaId}.${ext}`;
                const storageRef = ref(storage, filePath);
                
                await uploadBytes(storageRef, arrayBuffer, { contentType: mimeType });
                audioUrl = await getDownloadURL(storageRef);
              }
            } catch (err) {
              console.error('Erro ao processar áudio', err);
            }
          }
          
          if (msg.type === 'document') {
            messageType = 'document';
            documentName = msg.document.filename || 'documento';
            text = `📄 Arquivo Recebido: ${documentName}`;
            
            try {
              const token = process.env.WHATSAPP_TOKEN;
              const mediaId = msg.document.id;
              const mimeType = msg.document.mime_type;
              
              const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const metaData = await metaRes.json();
              
              if (metaData.url) {
                const mediaRes = await fetch(metaData.url, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const arrayBuffer = await mediaRes.arrayBuffer();
                
                const filePath = `whatsapp_documents/${phone}/${Date.now()}_${documentName}`;
                const storageRef = ref(storage, filePath);
                
                await uploadBytes(storageRef, arrayBuffer, { contentType: mimeType });
                documentUrl = await getDownloadURL(storageRef);
              }
            } catch (err) {
              console.error('Erro ao processar documento', err);
            }
          }

          if (msg.type === 'video') {
            messageType = 'video';
            text = '🎥 Vídeo Recebido';
            
            try {
              const token = process.env.WHATSAPP_TOKEN;
              const mediaId = msg.video.id;
              const mimeType = msg.video.mime_type;
              
              const metaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const metaData = await metaRes.json();
              
              if (metaData.url) {
                const mediaRes = await fetch(metaData.url, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const arrayBuffer = await mediaRes.arrayBuffer();
                
                const ext = mimeType.includes('mp4') ? 'mp4' : '3gp';
                const filePath = `whatsapp_videos/${phone}/${Date.now()}_${mediaId}.${ext}`;
                const storageRef = ref(storage, filePath);
                
                await uploadBytes(storageRef, arrayBuffer, { contentType: mimeType });
                videoUrl = await getDownloadURL(storageRef);
              }
            } catch (err) {
              console.error('Erro ao processar vídeo', err);
            }
          }
          
          if (msg.type === 'location') {
            messageType = 'location';
            text = '📍 Localização';
            locationData = {
              latitude: msg.location.latitude,
              longitude: msg.location.longitude,
              name: msg.location.name || '',
              address: msg.location.address || ''
            };
          }

          if (msg.type === 'reaction') {
            isReaction = true;
            try {
              const originalMsgId = msg.reaction.message_id;
              const emoji = msg.reaction.emoji;
              const msgRef = doc(db, 'whatsapp_chats', phone, 'messages', originalMsgId);
              // If emoji is empty string, it means reaction removed.
              await updateDoc(msgRef, { reaction: emoji });
              console.log(`[WHATSAPP WEBHOOK] Reação de ${phone}: ${emoji || 'removida'}`);
            } catch (err) {
              console.error('Erro ao processar reação', err);
            }
          }
          
          if (text && !isReaction) {
            const chatRef = doc(db, 'whatsapp_chats', phone);
            await setDoc(chatRef, {
              phone,
              name: contactName,
              lastMessage: messageType === 'audio' ? '🎵 Áudio' : messageType === 'image' ? '📷 Imagem' : messageType === 'document' ? '📄 Arquivo' : messageType === 'video' ? '🎥 Vídeo' : messageType === 'location' ? '📍 Localização' : text,
              updatedAt: serverTimestamp(),
              unread: increment(1),
            }, { merge: true });

            const replyToMessageId = msg.context?.id || null;

            const msgRef = doc(collection(chatRef, 'messages'), msg.id);
            await setDoc(msgRef, {
              id: msg.id,
              text,
              type: messageType,
              sender: 'user',
              timestamp: new Date(parseInt(msg.timestamp) * 1000),
              createdAt: serverTimestamp(),
              ...(replyToMessageId && { replyToMessageId }),
              ...(audioUrl && { audioUrl }),
              ...(imageUrl && { imageUrl }),
              ...(documentUrl && { documentUrl, documentName }),
              ...(videoUrl && { videoUrl }),
              ...(locationData && { location: locationData })
            });
            console.log(`[WHATSAPP WEBHOOK] Mensagem de ${phone}: ${text}`);
          }
        }
        
        // 2. Processar status de entrega
        if (value.statuses && value.statuses[0]) {
          const status = value.statuses[0];
          console.log(`[WHATSAPP STATUS] Status: ${status.status}, Recipient: ${status.recipient_id}`);
          if (status.errors) {
            console.error(`[WHATSAPP ERROR] Meta Error details:`, JSON.stringify(status.errors, null, 2));
          } else {
            try {
              const phone = normalizarTelefone(status.recipient_id);
              const msgId = status.id;
              const msgRef = doc(db, 'whatsapp_chats', phone, 'messages', msgId);
              // setDoc with merge in case the message hasn't been fully written yet (race condition)
              await setDoc(msgRef, { status: status.status }, { merge: true });
            } catch (err) {
              console.error('Erro ao atualizar status da mensagem:', err);
            }
          }
        }
      }
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    } else {
      return new NextResponse('Not Found', { status: 404 });
    }
  } catch (err) {
    console.error('Erro no Webhook:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
