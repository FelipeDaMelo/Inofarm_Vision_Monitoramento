import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CAMERAS_CONFIG_FILE = path.join(process.cwd(), 'config_cameras.json');
const SYSTEM_CONFIG_FILE = path.join(process.cwd(), 'system_config.json');

export async function GET() {
    try {
        if (!fs.existsSync(CAMERAS_CONFIG_FILE)) {
            return NextResponse.json({ error: 'Arquivo config_cameras.json não encontrado' }, { status: 404 });
        }
        const data = fs.readFileSync(CAMERAS_CONFIG_FILE, 'utf8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json({ error: 'Falha ao ler config_cameras.json' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // 1. Salvar as novas configurações de câmeras
        fs.writeFileSync(CAMERAS_CONFIG_FILE, JSON.stringify(body, null, 2));

        // 2. Atualizar o updatedAt no system_config.json para forçar o recarregamento no Python
        if (fs.existsSync(SYSTEM_CONFIG_FILE)) {
            const sysData = fs.readFileSync(SYSTEM_CONFIG_FILE, 'utf8');
            const sysConfig = JSON.parse(sysData);
            sysConfig.updatedAt = new Date().toISOString();
            fs.writeFileSync(SYSTEM_CONFIG_FILE, JSON.stringify(sysConfig, null, 2));
        } else {
             const sysConfig = { mode: 'development', updatedAt: new Date().toISOString() };
             fs.writeFileSync(SYSTEM_CONFIG_FILE, JSON.stringify(sysConfig, null, 2));
        }

        return NextResponse.json({ success: true, message: 'Configurações atualizadas com sucesso' });
    } catch (error) {
        return NextResponse.json({ error: 'Falha ao atualizar config_cameras.json' }, { status: 500 });
    }
}
