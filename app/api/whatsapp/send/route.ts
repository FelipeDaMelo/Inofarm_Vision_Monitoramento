import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Readable, PassThrough } from 'stream';
import { Buffer } from 'buffer';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
      try {
        // Baixa do Firebase Storage para o backend da Vercel
        const fileRes = await fetch(audioUrl);
        const fileArrayBuffer = await fileRes.arrayBuffer();

        console.log("Iniciando conversão de áudio WebM para Ogg/Opus...");

        // Stream de entrada
        const inputStream = new Readable();
        inputStream.push(Buffer.from(fileArrayBuffer));
        inputStream.push(null);

        // Stream de saída
        const outputStream = new PassThrough();
        const chunks: Buffer[] = [];
        outputStream.on('data', chunk => chunks.push(chunk));

        // Processamento FFmpeg
        await new Promise((resolve, reject) => {
          ffmpeg(inputStream)
            .toFormat('ogg')
            .audioCodec('libopus')
            .on('end', resolve)
            .on('error', reject)
            .pipe(outputStream);
        });

        const oggBuffer = Buffer.concat(chunks);
        const fileBlob = new Blob([oggBuffer], { type: 'audio/ogg' });
        const file = new File([fileBlob], 'audio.ogg', { type: 'audio/ogg' });
        console.log("Conversão concluída. Tamanho final:", file.size);

        // Envia direto para a API de Mídia da Meta (Para evitar problemas com links do Firebase)
        const form = new FormData();
        form.append('file', file);
        form.append('type', 'audio/ogg');
        form.append('messaging_product', 'whatsapp');

        const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        });

        const uploadData = await uploadRes.json();

        if (uploadData.id) {
          payload.audio = { id: uploadData.id };
        } else {
          console.error('Falha no upload para Meta:', uploadData);
          payload.audio = { link: audioUrl }; // Tenta link como fallback
        }
      } catch (err) {
        console.error('Erro na conversão do áudio para Meta:', err);
        payload.audio = { link: audioUrl };
      }
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
