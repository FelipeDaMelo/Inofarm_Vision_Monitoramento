import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { script, folder, args } = await request.json();
    
    const rootDir = process.cwd();
    let cwd = path.join(rootDir, 'edge_ai');
    
    // Se o script pertencer à pasta inofarm_ia, ajusta o diretório
    if (script === 'extrator_video_continuo.py') {
      cwd = path.join(rootDir, 'inofarm_ia');
    }
    
    const pythonArgs = [script];
    
    if (folder) {
      pythonArgs.push('--pasta');
      pythonArgs.push(folder);
    }
    
    if (args && Array.isArray(args)) {
      pythonArgs.push(...args);
    }

    // Cria um stream para enviar o output do Python em tempo real
    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;
        const safeEnqueue = (text: string) => {
          if (!isClosed) {
            try { controller.enqueue(new TextEncoder().encode(text)); } catch (e) { isClosed = true; }
          }
        };

        safeEnqueue(`Executando: python ${pythonArgs.join(' ')}\n\n`);

        const child = spawn('python', pythonArgs, {
          cwd: cwd,
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        // Guardamos uma referência para o cancel() poder matar o processo
        (this as any)._child = child;

        child.stdout?.on('data', (data) => safeEnqueue(data.toString()));
        child.stderr?.on('data', (data) => safeEnqueue(`ERRO: ${data.toString()}`));

        child.on('close', (code) => {
          safeEnqueue(`\nProcesso finalizado com código ${code}`);
          if (!isClosed) {
            try { controller.close(); } catch (e) {}
            isClosed = true;
          }
        });

        child.on('error', (err) => {
          safeEnqueue(`\nErro ao iniciar processo: ${err.message}`);
          if (!isClosed) {
            try { controller.close(); } catch (e) {}
            isClosed = true;
          }
        });
      },
      cancel() {
        if ((this as any)._child) (this as any)._child.kill();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });

  } catch (error) {
    console.error('Erro ao executar script:', error);
    return NextResponse.json({ error: 'Erro interno ao executar script' }, { status: 500 });
  }
}
