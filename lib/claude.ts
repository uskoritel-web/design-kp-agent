export interface KPItem {
  id: string;
  name: string;
  description: string;
  url: string | null;
  qty: number;
  unit: string;
  price_doc: number | null;
  price_found: number | null;
  price_final: number | null;
  discount_pct: number;
  category: string;
  availability: string | null;
  comparison: { site: string; price: number; url: string }[];
}

export interface KPData {
  id: string;
  created_at: string;
  title: string;
  client_name: string;
  manager_name: string;
  comment: string;
  global_discount: number;
  items: KPItem[];
  status: 'draft' | 'sent';
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey && !orKey) throw new Error('API key not configured');

  if (apiKey) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = msg.content[0];
    return block.type === 'text' ? block.text : '';
  }

  // OpenRouter fallback
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${orKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

export async function extractProducts(text: string, comment: string): Promise<KPItem[]> {
  const prompt = `Ты агент по комплектации интерьеров. Из следующего текста извлеки ВСЕ товары и материалы.

Инструкция менеджера: ${comment || 'нет'}

Текст:
${text}

Верни ТОЛЬКО валидный JSON массив (без markdown, без пояснений). Каждый объект:
{
  "name": "точное название товара",
  "description": "краткое описание 1-2 предложения",
  "url": "ссылка или null",
  "qty": число,
  "unit": "шт/м/м2/рулон/пара",
  "price_doc": число_или_null,
  "category": "освещение/отделка/мебель/двери/сантехника/электрика/другое"
}`;

  const raw = await callClaude(prompt);
  const json = raw.replace(/```json\n?|\n?```/g, '').trim();
  const arr = JSON.parse(json);

  return arr.map((item: Partial<KPItem>, i: number) => ({
    id: `item_${i}`,
    name: item.name ?? '',
    description: item.description ?? '',
    url: item.url ?? null,
    qty: item.qty ?? 1,
    unit: item.unit ?? 'шт',
    price_doc: item.price_doc ?? null,
    price_found: null,
    price_final: item.price_doc ?? null,
    discount_pct: 0,
    category: item.category ?? 'другое',
    availability: null,
    comparison: [],
  }));
}

export async function fetchPriceFromUrl(url: string): Promise<{
  price: number | null;
  availability: string | null;
  site: string;
}> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    const snippet = text.slice(0, 3000);

    const prompt = `Из текста страницы товара извлеки данные. Верни ТОЛЬКО JSON без markdown:
{"price": число_или_null, "availability": "в наличии/нет в наличии/под заказ/null"}

Текст:
${snippet}`;

    const raw = await callClaude(prompt);
    const json = raw.replace(/```json\n?|\n?```/g, '').trim();
    const data = JSON.parse(json);
    const site = new URL(url).hostname.replace('www.', '');
    return { price: data.price ?? null, availability: data.availability ?? null, site };
  } catch {
    return { price: null, availability: null, site: '' };
  }
}
