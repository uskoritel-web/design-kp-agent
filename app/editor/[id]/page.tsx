'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { KPData, KPItem } from '@/lib/claude';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowTotal(item: KPItem) {
  const price = item.price_final ?? 0;
  const subtotal = price * item.qty;
  return subtotal * (1 - item.discount_pct / 100);
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [kp, setKP] = useState<KPData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/kp/${id}`)
      .then(r => r.json())
      .then(data => setKP(data))
      .catch(() => setError('КП не найдено'));
  }, [id]);

  const updateItem = useCallback((itemId: string, field: keyof KPItem, value: unknown) => {
    setKP(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId ? { ...item, [field]: value } : item
        ),
      };
    });
  }, []);

  const addItem = useCallback(() => {
    setKP(prev => {
      if (!prev) return prev;
      const newItem: KPItem = {
        id: `item_${Date.now()}`,
        name: 'Новая позиция',
        description: '',
        url: null,
        qty: 1,
        unit: 'шт',
        price_doc: null,
        price_found: null,
        price_final: null,
        discount_pct: 0,
        category: 'другое',
        availability: null,
        comparison: [],
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setKP(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter(i => i.id !== itemId) };
    });
  }, []);

  async function save() {
    if (!kp) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kp/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kp),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!kp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Загрузка КП...
        </div>
      </div>
    );
  }

  const grandTotal = kp.items.reduce((s, i) => s + rowTotal(i), 0);
  const grandTotalWithDiscount = grandTotal * (1 - kp.global_discount / 100);
  const clientUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/kp/${id}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ← Новое КП
            </button>
            <input
              type="text"
              value={kp.title}
              onChange={e => setKP(p => p ? { ...p, title: e.target.value } : p)}
              className="font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={addItem}
              className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
            >
              + Позиция
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-gray-900 text-white rounded-lg px-4 py-1.5 hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : saved ? '✓ Сохранено' : 'Сохранить'}
            </button>
            <button
              onClick={async () => { await save(); window.open(`/kp/${id}`, '_blank'); }}
              className="text-sm bg-blue-600 text-white rounded-lg px-4 py-1.5 hover:bg-blue-700"
            >
              Открыть КП клиента →
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Meta */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Клиент</label>
            <input
              type="text"
              value={kp.client_name}
              onChange={e => setKP(p => p ? { ...p, client_name: e.target.value } : p)}
              placeholder="Имя клиента"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Менеджер</label>
            <input
              type="text"
              value={kp.manager_name}
              onChange={e => setKP(p => p ? { ...p, manager_name: e.target.value } : p)}
              placeholder="Имя менеджера"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Общая скидка %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={kp.global_discount}
              onChange={e => setKP(p => p ? { ...p, global_discount: Number(e.target.value) } : p)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Ссылка для клиента */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 flex items-center gap-3">
          <span className="text-sm text-blue-700 font-medium">Ссылка для клиента:</span>
          <a href={clientUrl} target="_blank" className="text-sm text-blue-600 underline truncate flex-1">
            {clientUrl}
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(clientUrl)}
            className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100 shrink-0"
          >
            Копировать
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-8">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Наименование</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500 w-16">Кол-во</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500 w-16">Ед.</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500 w-32">Цена ₽</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500 w-20">Скидка %</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500 w-32">Сумма</th>
                  <th className="text-center px-2 py-3 font-medium text-gray-400 w-10 text-xs">🌐</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {kp.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 group">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        className="w-full bg-transparent focus:outline-none font-medium text-gray-900"
                      />
                      {item.url && (
                        <a href={item.url} target="_blank" className="text-xs text-blue-500 truncate block max-w-xs">
                          {item.url}
                        </a>
                      )}
                      {item.availability && (
                        <span className={`text-xs ${item.availability.includes('наличии') ? 'text-green-600' : 'text-orange-500'}`}>
                          {item.availability}
                        </span>
                      )}
                      {item.comparison.length > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Нашли на: {item.comparison.map(c => `${c.site} — ${fmt(c.price)} ₽`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={e => updateItem(item.id, 'qty', Number(e.target.value))}
                        className="w-full text-center bg-transparent focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={item.unit}
                        onChange={e => updateItem(item.id, 'unit', e.target.value)}
                        className="w-full text-center bg-transparent focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price_final ?? ''}
                        onChange={e => updateItem(item.id, 'price_final', e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full text-right bg-transparent focus:outline-none font-medium"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_pct}
                        onChange={e => updateItem(item.id, 'discount_pct', Number(e.target.value))}
                        className="w-full text-center bg-transparent focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">
                      {fmt(rowTotal(item))} ₽
                    </td>
                    <td className="px-2 py-3 text-center">
                      {item.price_found != null ? (
                        <a
                          href={item.url ?? '#'}
                          target="_blank"
                          title={`На сайте: ${fmt(item.price_found)} ₽`}
                          className="inline-flex items-center justify-center w-6 h-6 rounded bg-green-50 text-green-600 hover:bg-green-100 text-xs"
                        >
                          ₽
                        </a>
                      ) : (
                        <span className="text-gray-200 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={7} className="px-4 py-3 text-right font-semibold text-gray-700">
                    {kp.global_discount > 0
                      ? `Итого со скидкой ${kp.global_discount}%:`
                      : 'Итого:'}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900 text-base">
                    {fmt(grandTotalWithDiscount)} ₽
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
