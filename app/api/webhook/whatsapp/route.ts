import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';

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
          if (msg.type === 'text') text = msg.text.body;
          if (msg.type === 'button') text = msg.button.text;
          if (msg.type === 'image') text = '[Imagem Recebida]'; // Simplificação
          
          if (text) {
            const chatRef = doc(db, 'whatsapp_chats', phone);
            await setDoc(chatRef, {
              phone,
              name: contactName,
              lastMessage: text,
              updatedAt: serverTimestamp(),
            }, { merge: true });

            const msgRef = doc(collection(chatRef, 'messages'), msg.id);
            await setDoc(msgRef, {
              id: msg.id,
              text,
              sender: 'user',
              timestamp: new Date(parseInt(msg.timestamp) * 1000),
              createdAt: serverTimestamp()
            });
            console.log(`[WHATSAPP WEBHOOK] Mensagem de ${phone}: ${text}`);
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
