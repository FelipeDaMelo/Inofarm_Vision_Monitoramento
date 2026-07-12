import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Caminho do arquivo de configuração na raiz do projeto
const CONFIG_FILE = path.join(process.cwd(), 'system_config.json');

// Função auxiliar para ler a config com segurança
const getSystemConfig = () => {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            const defaultConfig = { mode: 'development', postosPorLado: 8, updatedAt: new Date().toISOString() };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        if (config.postosPorLado === undefined) config.postosPorLado = 8;
        return config;
    } catch (error) {
        return { mode: 'development', postosPorLado: 8, error: 'Falha ao ler config' };
    }
};

export async function GET() {
    const config = getSystemConfig();
    return NextResponse.json(config);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { mode, postosPorLado } = body;

        const currentConfig = getSystemConfig();

        if (mode && mode !== 'development' && mode !== 'production') {
            return NextResponse.json({ error: 'Modo inválido' }, { status: 400 });
        }

        const newConfig = {
            ...currentConfig,
            mode: mode || currentConfig.mode,
            postosPorLado: postosPorLado !== undefined ? postosPorLado : currentConfig.postosPorLado,
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
        
        return NextResponse.json(newConfig);
    } catch (error) {
        return NextResponse.json({ error: 'Falha ao atualizar config' }, { status: 500 });
    }
}
