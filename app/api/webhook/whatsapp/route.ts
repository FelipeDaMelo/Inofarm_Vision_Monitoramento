import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { doc, setDoc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const VERIFY_TOKEN = 'f2e6l0i1p8e9';

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
          const phone = msg.from; // Número de quem enviou
          const contactName = value.contacts?.[0]?.profile?.name || phone;
          
          let text = '';
          let audioUrl = '';
          let messageType = 'text';

          if (msg.type === 'text') text = msg.text.body;
          if (msg.type === 'button') text = msg.button.text;
          if (msg.type === 'image') text = '[Imagem Recebida]'; // Simplificação
          
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
          
          if (text) {
            const chatRef = doc(db, 'whatsapp_chats', phone);
            await setDoc(chatRef, {
              phone,
              name: contactName,
              lastMessage: messageType === 'audio' ? '🎵 Áudio' : text,
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
              ...(audioUrl && { audioUrl })
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
