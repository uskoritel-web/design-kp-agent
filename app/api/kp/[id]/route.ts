import { NextRequest, NextResponse } from 'next/server';
import { loadKP, saveKP } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadKP(id);
  if (!data) return NextResponse.json({ error: 'КП не найдено' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await loadKP(id);
  if (!existing) return NextResponse.json({ error: 'КП не найдено' }, { status: 404 });
  const body = await req.json();
  const updated = { ...(existing as object), ...body, id };
  await saveKP(id, updated);
  return NextResponse.json({ ok: true });
}
