'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(pageText);
  }
  return pages.join('\n\n');
}

type InputMode = 'pdf' | 'text' | 'links';

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<InputMode>('pdf');
  const [pdfInfo, setPdfInfo] = useState<{ name: string; pages: number; chars: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extractedText, setExtractedText] = useState('');
  const [form, setForm] = useState({
    title: '',
    client_name: '',
    manager_name: '',
    text: '',
    comment: '',
  });

  const handlePDF = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf')) { setError('Поддерживаются только PDF файлы'); return; }
    setPdfLoading(true);
    setError('');
    try {
      const text = await extractTextFromPDF(file);
      const pageCount = text.split('\n\n').length;
      setPdfInfo({ name: file.name, pages: pageCount, chars: text.length });
      setExtractedText(text.trim());
      setForm(f => ({ ...f, text: text.trim() }));
    } catch {
      setError('Не удалось прочитать PDF. Попробуйте другой файл или переключитесь на ввод текста.');
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePDF(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePDF(file);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) { setError('Нет данных для обработки'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
      router.push(`/editor/${data.id}`);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  }

  const modeTab = (m: InputMode, label: string) => (
    <button
      type="button"
      onClick={() => { setMode(m); if (m !== 'pdf') { setPdfInfo(null); setExtractedText(''); } }}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Новое коммерческое предложение</h1>
          <p className="mt-1 text-gray-400 text-sm">ИИ-агент извлечёт позиции и найдёт актуальные цены</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Название КП</label>
              <input type="text" placeholder="КП № 2607" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Клиент</label>
              <input type="text" placeholder="Имя клиента" value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Менеджер</label>
            <input type="text" placeholder="Ваше имя" value={form.manager_name}
              onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Mode switcher */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Источник данных</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {modeTab('pdf', '📄 PDF файл')}
              {modeTab('links', '🔗 Ссылки')}
              {modeTab('text', '✏️ Текст')}
            </div>
          </div>

          {/* PDF mode */}
          {mode === 'pdf' && !pdfInfo && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                ${pdfLoading ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
              {pdfLoading ? (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-sm">Читаю PDF...</span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Перетащите PDF или нажмите для выбора</p>
                    <p className="text-xs text-gray-400 mt-1">Поддерживаются КП, прайсы, спецификации</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PDF loaded state */}
          {mode === 'pdf' && pdfInfo && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">{pdfInfo.name}</p>
                    <p className="text-xs text-green-600 mt-0.5">{pdfInfo.pages} страниц · {Math.round(pdfInfo.chars / 1000)}K символов — готово к обработке</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setPdfInfo(null); setExtractedText(''); setForm(f => ({ ...f, text: '' })); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-xs text-green-700 hover:text-green-900 underline shrink-0">
                  Заменить
                </button>
              </div>
              {extractedText && (
                <details className="mt-3">
                  <summary className="text-xs text-green-700 cursor-pointer hover:text-green-900 select-none">Посмотреть извлечённый текст</summary>
                  <textarea readOnly value={extractedText} rows={6}
                    className="mt-2 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-gray-600 font-mono resize-none focus:outline-none" />
                </details>
              )}
            </div>
          )}

          {/* Links mode */}
          {mode === 'links' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Ссылки на товары <span className="text-red-400">*</span>
              </label>
              <textarea required={mode === 'links'} rows={8}
                placeholder={"По одной ссылке на строку:\n\nhttps://minimir.ru/catalog/...\nhttps://market.yandex.ru/product/...\nhttps://leroy-merlin.ru/..."}
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              <p className="text-xs text-gray-400 mt-1">Агент откроет каждую страницу и извлечёт название, цену и наличие</p>
            </div>
          )}

          {/* Text mode */}
          {mode === 'text' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Список товаров <span className="text-red-400">*</span>
              </label>
              <textarea required={mode === 'text'} rows={10}
                placeholder={"Вставьте в любом формате:\n\nСветильник встраиваемый Elektrostandard, 9шт, 3599 руб\nТрековая система Slim Magnetic 2м — 10шт\nhttps://minimir.ru/catalog/... — 5шт"}
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Задание агенту</label>
            <input type="text"
              placeholder="Например: только светильники и освещение, актуализировать цены"
              value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={loading || pdfLoading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Агент обрабатывает...
              </span>
            ) : 'Создать КП →'}
          </button>
        </form>
      </div>
    </div>
  );
}
