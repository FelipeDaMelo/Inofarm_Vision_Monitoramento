import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { to, text, replyToMessageId, type = 'text', audioUrl } = await request.json();

    if (!to) {
      return new NextResponse(JSON.stringify({ error: 'Missing destination (to)' }), { status: 400 });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
      return new NextResponse(JSON.stringify({ error: 'Missing WhatsApp credentials in .env' }), { status: 500 });
    }

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: type,
    };

    if (type === 'text') {
      payload.text = {
        preview_url: false,
        body: text
      };
    } else if (type === 'audio') {
      payload.audio = {
        link: audioUrl
      };
    }

    if (replyToMessageId) {
      payload.context = {
        message_id: replyToMessageId
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na API do WhatsApp:', data);
      return new NextResponse(JSON.stringify({ error: 'WhatsApp API error', details: data }), { status: 400 });
    }

    // Salva a mensagem no Firebase para aparecer no frontend
    const msgId = data.messages?.[0]?.id || `out_${Date.now()}`;
    const chatRef = doc(db, 'whatsapp_chats', to);
    
    await setDoc(chatRef, {
      phone: to,
      lastMessage: type === 'audio' ? '🎵 Áudio' : text,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const msgRef = doc(collection(chatRef, 'messages'), msgId);
    await setDoc(msgRef, {
      id: msgId,
      text: type === 'audio' ? '🎵 Áudio' : text,
      type: type,
      sender: 'bot',
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      ...(replyToMessageId && { replyToMessageId }),
      ...(audioUrl && { audioUrl })
    });

    return NextResponse.json({ success: true, messageId: msgId });

  } catch (err: any) {
    console.error('Erro no endpoint de envio:', err);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
