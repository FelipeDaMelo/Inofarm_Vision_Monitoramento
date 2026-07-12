import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Caminho para a pasta inofarm_ia a partir do diretório raiz do projeto Next.js
    const rootDir = process.cwd();
    const inofarmIaDir = path.join(rootDir, 'inofarm_ia');

    if (!fs.existsSync(inofarmIaDir)) {
      return NextResponse.json({ error: 'Diretório inofarm_ia não encontrado' }, { status: 404 });
    }

    // Lê apenas os diretórios dentro de inofarm_ia
    const items = fs.readdirSync(inofarmIaDir, { withFileTypes: true });
    const folders = items
      .filter(item => item.isDirectory())
      .map(item => item.name);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Erro ao listar pastas:', error);
    return NextResponse.json({ error: 'Erro interno ao listar pastas' }, { status: 500 });
  }
}
