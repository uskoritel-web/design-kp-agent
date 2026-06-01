import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { extractProducts, fetchPriceFromUrl, KPData } from '@/lib/claude';
import { saveKP } from '@/lib/storage';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, comment, title, manager_name, client_name } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Текст не может быть пустым' }, { status: 400 });
    }

    const items = await extractProducts(text, comment ?? '');

    // Для позиций с URL — тянем актуальную цену параллельно
    await Promise.all(
      items.map(async (item) => {
        if (!item.url) return;
        const result = await fetchPriceFromUrl(item.url);
        if (result.price) {
          item.price_found = result.price;
          item.price_final = result.price;
          item.availability = result.availability;
          if (result.site) {
            item.comparison = [{ site: result.site, price: result.price, url: item.url }];
          }
        }
      })
    );

    const id = uuidv4();
    const kpData: KPData = {
      id,
      created_at: new Date().toISOString(),
      title: title || 'Коммерческое предложение',
      client_name: client_name || '',
      manager_name: manager_name || '',
      comment: comment || '',
      global_discount: 0,
      items,
      status: 'draft',
    };

    await saveKP(id, kpData);

    return NextResponse.json({ id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
