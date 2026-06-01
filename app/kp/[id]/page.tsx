import { loadKP } from '@/lib/storage';
import { KPData, KPItem } from '@/lib/claude';
import { notFound } from 'next/navigation';

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowTotal(item: KPItem): number {
  const price = item.price_final ?? 0;
  return price * item.qty * (1 - item.discount_pct / 100);
}

export default async function KPPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kp = (await loadKP(id)) as KPData | null;
  if (!kp) notFound();

  const grandTotal = kp.items.reduce((s, i) => s + rowTotal(i), 0);
  const grandTotalWithDiscount = grandTotal * (1 - kp.global_discount / 100);
  const savings = grandTotal - grandTotalWithDiscount;
  const dateStr = new Date(kp.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Print button */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => window.print()}
          className="bg-white border border-gray-200 shadow-sm rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Скачать PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 print:py-6">
        {/* Header */}
        <div className="mb-10 border-b border-gray-200 pb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">
                Коммерческое предложение
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{kp.title}</h1>
              <p className="text-gray-500 mt-1">{dateStr}</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              {kp.client_name && <p className="font-semibold text-gray-900">{kp.client_name}</p>}
              {kp.manager_name && <p className="text-gray-500">Менеджер: {kp.manager_name}</p>}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="mb-8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-900">
                <th className="text-left py-3 pr-4 font-semibold text-gray-900 w-8">#</th>
                <th className="text-left py-3 pr-4 font-semibold text-gray-900">Наименование</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-900 w-16">Кол</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-900 w-12">Ед.</th>
                <th className="text-right py-3 px-3 font-semibold text-gray-900 w-28">Цена</th>
                {kp.items.some(i => i.discount_pct > 0) && (
                  <th className="text-center py-3 px-3 font-semibold text-gray-900 w-20">Скидка</th>
                )}
                <th className="text-right py-3 pl-3 font-semibold text-gray-900 w-28">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {kp.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 pr-4 text-gray-400 align-top">{idx + 1}</td>
                  <td className="py-4 pr-4 align-top">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</div>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {item.availability && (
                        <span className={`text-xs font-medium ${item.availability.includes('наличии') ? 'text-green-600' : 'text-orange-500'}`}>
                          {item.availability}
                        </span>
                      )}
                      {item.url && (
                        <a href={item.url} target="_blank" className="text-xs text-blue-500 hover:underline print:hidden">
                          Посмотреть на сайте →
                        </a>
                      )}
                      {item.comparison.length > 0 && (
                        <span className="text-xs text-gray-400">
                          Проверено: {item.comparison.map(c => `${c.site} — ${fmt(c.price)} ₽`).join(' · ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center align-top">{item.qty}</td>
                  <td className="py-4 px-3 text-center text-gray-500 align-top">{item.unit}</td>
                  <td className="py-4 px-3 text-right align-top">{fmt(item.price_final)} ₽</td>
                  {kp.items.some(i => i.discount_pct > 0) && (
                    <td className="py-4 px-3 text-center align-top text-gray-500">
                      {item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}
                    </td>
                  )}
                  <td className="py-4 pl-3 text-right font-semibold text-gray-900 align-top">
                    {fmt(rowTotal(item))} ₽
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            {kp.global_discount > 0 && (
              <>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Итого до скидки</span>
                  <span>{fmt(grandTotal)} ₽</span>
                </div>
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Скидка {kp.global_discount}%</span>
                  <span>−{fmt(savings)} ₽</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>ИТОГО</span>
              <span>{fmt(grandTotalWithDiscount)} ₽</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-xs text-gray-400 text-center">
          <p>Предложение действительно в течение 10 дней с даты составления.</p>
          {kp.manager_name && (
            <p className="mt-1">По вопросам обращайтесь к менеджеру: {kp.manager_name}</p>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          @page { margin: 20mm; }
        }
      `}</style>
    </div>
  );
}
