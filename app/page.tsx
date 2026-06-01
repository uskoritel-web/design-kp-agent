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
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfName, setPdfName] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    client_name: '',
    manager_name: '',
    text: '',
    comment: '',
  });

  const handlePDF = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setError('Поддерживаются только PDF файлы');
      return;
    }
    setPdfLoading(true);
    setError('');
    try {
      const text = await extractTextFromPDF(file);
      setPdfName(file.name);
      setForm(f => ({ ...f, text: text.trim() }));
    } catch {
      setError('Не удалось прочитать PDF. Попробуйте другой файл или вставьте текст вручную.');
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Создать коммерческое предложение</h1>
          <p className="mt-2 text-gray-500 text-sm">
            Загрузите PDF или вставьте список товаров — ссылками, текстом, смешанно
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Название КП</label>
              <input
                type="text"
                placeholder="КП № 2607 от 02.06.2025"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Клиент</label>
              <input
                type="text"
                placeholder="ИП Чурина Елизавета"
                value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Менеджер</label>
            <input
              type="text"
              placeholder="Ваше имя"
              value={form.manager_name}
              onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PDF файл <span className="text-gray-400 font-normal">(необязательно)</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`
                relative flex items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors
                ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                ${pdfLoading ? 'opacity-60 pointer-events-none' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {pdfLoading ? (
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Читаю PDF...
                </span>
              ) : pdfName ? (
                <span className="flex items-center gap-2 text-sm text-green-700">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {pdfName} — текст извлечён, можно редактировать ниже
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Перетащите PDF или нажмите для выбора
                </span>
              )}
            </div>
          </div>

          {/* Text area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Список товаров{' '}
              {!pdfName && <span className="text-red-500">*</span>}
              {pdfName && <span className="text-gray-400 font-normal">— извлечено из PDF, можно дополнить</span>}
            </label>
            <textarea
              required
              rows={12}
              placeholder={`Вставьте любым удобным способом:\n\n— Названия товаров\n— Ссылки на товары (по одной на строку)\n— Текст из таблицы или документа\n— Смешанный формат\n\nПример:\nhttps://minimir.ru/catalog/...\nСветильник встраиваемый Elektrostandard, 9шт\nТрековая система Slim Magnetic 2м, 10шт`}
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Комментарий для агента
            </label>
            <input
              type="text"
              placeholder="Например: только светильники, освещение для квартиры в Екатеринбурге"
              value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pdfLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Агент обрабатывает список...
              </span>
            ) : (
              'Обработать и создать КП →'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Агент извлечёт позиции и найдёт актуальные цены автоматически
        </p>
      </div>
    </div>
  );
}
