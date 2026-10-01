import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, FileSpreadsheet, X } from 'lucide-react';
import type { Driver } from '../types';
import { parseExcelFile, type ExcelImportResult } from '../utils/excelParser';

interface Props {
  file: File;
  drivers: Driver[];
  onCancel: () => void;
  onConfirm: (file: File, result: ExcelImportResult, drivers: Driver[]) => void;
}

export function ExcelImportWizard({ file, drivers, onCancel, onConfirm }: Props) {
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    parseExcelFile(file)
      .then(value => active && setResult(value))
      .catch(reason => active && setError(reason instanceof Error ? reason.message : 'No se pudo leer el Excel.'));
    return () => { active = false; };
  }, [file]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-start justify-between rounded-t-3xl z-10">
          <div className="flex gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600"><FileSpreadsheet className="w-6 h-6" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-emerald-600">Importación guiada · Paso 2 de 3</p>
              <h2 className="font-black text-slate-900">Revisa tu Excel antes de importarlo</h2>
              <p className="text-xs text-slate-500 mt-1 break-all">{file.name}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-100" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </header>

        <div className="p-5 space-y-5">
          {!result && !error && <p className="text-sm text-slate-500 animate-pulse">Detectando columnas y validando filas…</p>}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex gap-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" /><div><strong>No se puede importar.</strong><p>{error}</p></div>
            </div>
          )}
          {result && (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100"><p className="text-2xl font-black text-emerald-700">{result.stops.length}</p><p className="text-xs text-emerald-700">paradas válidas</p></div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100"><p className="text-2xl font-black text-amber-700">{result.skippedRows.length}</p><p className="text-xs text-amber-700">filas omitidas</p></div>
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100"><p className="text-sm font-black text-blue-700 truncate">{result.sheetName}</p><p className="text-xs text-blue-700">hoja detectada</p></div>
              </div>

              <section>
                <h3 className="font-bold text-sm text-slate-800 mb-2">Columnas detectadas automáticamente</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.detectedColumns).map(([field, header]) => (
                    <span key={field} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700"><strong>{header}</strong> → {field}</span>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-bold text-sm text-slate-800 mb-2">Vista previa</h3>
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-3">Pedido</th><th className="text-left p-3">Cliente</th><th className="text-left p-3">Dirección</th><th className="text-right p-3">Bultos</th></tr></thead>
                    <tbody>{result.stops.slice(0, 5).map(stop => <tr key={stop.id} className="border-t border-slate-100"><td className="p-3">{stop.customerCode}</td><td className="p-3 font-semibold">{stop.customerName}</td><td className="p-3">{[stop.address, stop.postalCode, stop.city].filter(Boolean).join(', ')}</td><td className="p-3 text-right">{stop.boxCount}</td></tr>)}</tbody>
                  </table>
                </div>
                {result.stops.length > 5 && <p className="text-[11px] text-slate-400 mt-2">Mostrando 5 de {result.stops.length} paradas.</p>}
              </section>

              {result.skippedRows.length > 0 && (
                <section className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <div className="flex gap-2 font-bold mb-2"><AlertTriangle className="w-4 h-4" /> Filas que no se importarán</div>
                  {result.skippedRows.slice(0, 8).map(item => <p key={item.row}>Fila {item.row}: {item.reason}</p>)}
                </section>
              )}

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 text-xs flex gap-2"><CheckCircle className="w-4 h-4 shrink-0" />Al confirmar, estas paradas entrarán en el mismo editor, geocodificación y optimización que las importadas desde PDF.</div>
            </>
          )}
        </div>

        <footer className="sticky bottom-0 bg-white border-t border-slate-100 p-5 flex gap-3 justify-end rounded-b-3xl">
          <button onClick={onCancel} className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">Cancelar</button>
          <button disabled={!result} onClick={() => result && onConfirm(file, result, drivers)} className="px-5 py-3 rounded-xl text-xs font-bold bg-emerald-600 text-white disabled:opacity-40">Paso 3 · Importar {result?.stops.length ?? 0} paradas</button>
        </footer>
      </div>
    </div>
  );
}
