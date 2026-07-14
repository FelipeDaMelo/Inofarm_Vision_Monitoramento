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
    const { to, text, replyToMessageId, type = 'text', audioUrl, imageUrl, documentUrl, documentName, videoUrl } = await request.json();

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
        // Baixa do Firebase Storage
        const fileRes = await fetch(audioUrl);
        const fileArrayBuffer = await fileRes.arrayBuffer();

        console.log("Iniciando conversão de áudio WebM para Ogg/Opus...");
        
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        
        const tempInput = path.join(os.tmpdir(), `input_${Date.now()}.webm`);
        const tempOutput = path.join(os.tmpdir(), `output_${Date.now()}.ogg`);
        
        fs.writeFileSync(tempInput, Buffer.from(fileArrayBuffer));

        // Processamento FFmpeg via arquivos temporários
        await new Promise((resolve, reject) => {
          ffmpeg(tempInput)
            .toFormat('ogg')
            .audioCodec('libopus')
            .audioChannels(1)
            .audioFrequency(16000)
            .on('end', resolve)
            .on('error', reject)
            .save(tempOutput);
        });

        const oggBuffer = fs.readFileSync(tempOutput);
        const fileBlob = new Blob([oggBuffer], { type: 'audio/ogg; codecs=opus' });
        const file = new File([fileBlob], 'audio.ogg', { type: 'audio/ogg; codecs=opus' });
        console.log("Conversão concluída. Tamanho final:", file.size);
        
        // Limpa arquivos temporários
        try {
          fs.unlinkSync(tempInput);
          fs.unlinkSync(tempOutput);
        } catch(e) {}

        // Envia direto para a API de Mídia da Meta (Para evitar problemas com links do Firebase)
        const form = new FormData();
        form.append('file', fileBlob, 'audio.ogg');
        form.append('type', 'audio/ogg; codecs=opus');
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
      } catch (err: any) {
        console.error('Erro na conversão do áudio para Meta:', err.message || err);
        payload.audio = { link: audioUrl };
      }
    } else if (type === 'image') {
      try {
        const fileRes = await fetch(imageUrl);
        const fileBlob = await fileRes.blob();
        
        const ext = fileBlob.type.includes('png') ? 'png' : 'jpg';
        const file = new File([fileBlob], `image.${ext}`, { type: fileBlob.type });
        const form = new FormData();
        form.append('file', file);
        form.append('type', fileBlob.type);
        form.append('messaging_product', 'whatsapp');

        const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        });

        const uploadData = await uploadRes.json();

        if (uploadData.id) {
          payload.image = { id: uploadData.id };
        } else {
          console.error('Falha no upload de imagem para Meta:', uploadData);
          payload.image = { link: imageUrl }; // Fallback
        }
      } catch (err) {
        console.error('Erro na conversão da imagem para Meta:', err);
        payload.image = { link: imageUrl };
      }
    } else if (type === 'document') {
      try {
        const fileRes = await fetch(documentUrl);
        const fileBlob = await fileRes.blob();
        
        const ext = documentName.split('.').pop() || 'pdf';
        const file = new File([fileBlob], documentName, { type: fileBlob.type });
        const form = new FormData();
        form.append('file', file);
        form.append('type', fileBlob.type);
        form.append('messaging_product', 'whatsapp');

        const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        });

        const uploadData = await uploadRes.json();

        if (uploadData.id) {
          payload.document = { id: uploadData.id, filename: documentName };
        } else {
          console.error('Falha no upload do documento para Meta:', uploadData);
          payload.document = { link: documentUrl, filename: documentName }; // Fallback
        }
      } catch (err) {
        console.error('Erro na conversão do documento para Meta:', err);
        payload.document = { link: documentUrl, filename: documentName };
      }
    } else if (type === 'video') {
      try {
        const fileRes = await fetch(videoUrl);
        const fileBlob = await fileRes.blob();
        
        const ext = fileBlob.type.includes('mp4') ? 'mp4' : '3gp';
        const file = new File([fileBlob], `video.${ext}`, { type: fileBlob.type });
        const form = new FormData();
        form.append('file', file);
        form.append('type', fileBlob.type);
        form.append('messaging_product', 'whatsapp');

        const uploadRes = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        });

        const uploadData = await uploadRes.json();

        if (uploadData.id) {
          payload.video = { id: uploadData.id };
        } else {
          console.error('Falha no upload de vídeo para Meta:', uploadData);
          payload.video = { link: videoUrl }; // Fallback
        }
      } catch (err) {
        console.error('Erro na conversão do vídeo para Meta:', err);
        payload.video = { link: videoUrl };
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
      lastMessage: type === 'audio' ? '🎵 Áudio' : type === 'image' ? '📷 Imagem' : type === 'document' ? '📄 Arquivo' : type === 'video' ? '🎥 Vídeo' : text,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const msgRef = doc(collection(chatRef, 'messages'), msgId);
    await setDoc(msgRef, {
      id: msgId,
      text: type === 'audio' ? '🎵 Áudio' : type === 'image' ? '📷 Imagem' : type === 'document' ? '📄 Arquivo' : type === 'video' ? '🎥 Vídeo' : (text || ''),
      type: type,
      sender: 'bot',
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      ...(replyToMessageId && { replyToMessageId }),
      ...(audioUrl && { audioUrl }),
      ...(imageUrl && { imageUrl }),
      ...(documentUrl && { documentUrl, documentName }),
      ...(videoUrl && { videoUrl })
    });

    return NextResponse.json({ success: true, messageId: msgId });

  } catch (err: any) {
    console.error('Erro no endpoint de envio:', err);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
