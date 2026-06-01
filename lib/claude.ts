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

async function callClaude(prompt: string, maxTokens = 8192): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey && !orKey) throw new Error('API key not configured');

  if (apiKey) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = msg.content[0];
    return block.type === 'text' ? block.text : '';
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${orKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

function parseJSON(raw: string): unknown[] {
  // strip markdown fences
  let s = raw.replace(/```json\s*|\s*```/g, '').trim();
  // extract first JSON array from response
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s);
}

// Split large text into chunks and process each, then merge
async function extractChunk(chunk: string, comment: string, chunkIndex: number): Promise<KPItem[]> {
  const prompt = `Ты агент по комплектации интерьеров. Из текста извлеки ВСЕ товары и материалы.
${comment ? `Инструкция: ${comment}` : ''}
${chunkIndex > 0 ? 'Это продолжение документа — извлекай все позиции, не повторяй те что могли быть в начале.' : ''}

Текст:
${chunk}

Верни ТОЛЬКО валидный JSON массив (без markdown, без пояснений). Каждый объект строго:
{"name":"название","description":"1-2 предложения","url":"ссылка или null","qty":число,"unit":"шт/м/м2/рулон","price_doc":число_или_null,"category":"освещение/отделка/мебель/двери/сантехника/электрика/другое"}`;

  const raw = await callClaude(prompt, 8192);
  const arr = parseJSON(raw) as Partial<KPItem>[];
  return arr.map((item, i) => ({
    id: `item_${chunkIndex}_${i}`,
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

export async function extractProducts(text: string, comment: string): Promise<KPItem[]> {
  const CHUNK_SIZE = 12000;

  if (text.length <= CHUNK_SIZE) {
    const items = await extractChunk(text, comment, 0);
    return items.map((item, i) => ({ ...item, id: `item_${i}` }));
  }

  // Split into chunks at paragraph boundaries
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', CHUNK_SIZE);
    if (splitAt < CHUNK_SIZE * 0.5) splitAt = CHUNK_SIZE;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }

  const results = await Promise.all(chunks.map((chunk, i) => extractChunk(chunk, comment, i)));
  const merged = results.flat();
  return merged.map((item, i) => ({ ...item, id: `item_${i}` }));
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
    const pageText = await res.text();
    const snippet = pageText.slice(0, 3000);

    const prompt = `Из текста страницы товара извлеки данные. Верни ТОЛЬКО JSON без markdown:
{"price": число_или_null, "availability": "в наличии/нет в наличии/под заказ"}

Текст:
${snippet}`;

    const raw = await callClaude(prompt, 256);
    const s = raw.replace(/```json\s*|\s*```/g, '').trim();
    const data = JSON.parse(s);
    const site = new URL(url).hostname.replace('www.', '');
    return { price: data.price ?? null, availability: data.availability ?? null, site };
  } catch {
    return { price: null, availability: null, site: '' };
  }
}
