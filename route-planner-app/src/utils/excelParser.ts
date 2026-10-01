import * as XLSX from 'xlsx';
import type { DeliveryStop } from '../types';

export type ExcelField =
  | 'customerCode' | 'customerName' | 'address' | 'postalCode' | 'city'
  | 'weight' | 'boxCount' | 'lat' | 'lng' | 'deliveryStart' | 'deliveryEnd';

export interface ExcelImportResult {
  stops: DeliveryStop[];
  headers: string[];
  detectedColumns: Partial<Record<ExcelField, string>>;
  skippedRows: { row: number; reason: string }[];
  sheetName: string;
  totalRows: number;
}

const aliases: Record<ExcelField, string[]> = {
  customerCode: ['pedido', 'numero pedido', 'n pedido', 'referencia', 'ref', 'order', 'order id', 'codigo cliente', 'customer code'],
  customerName: ['cliente', 'nombre cliente', 'razon social', 'customer', 'customer name', 'name', 'nombre'],
  address: ['direccion', 'direccion entrega', 'domicilio', 'calle', 'address', 'delivery address'],
  postalCode: ['codigo postal', 'cod postal', 'cp', 'postal code', 'zip', 'zipcode'],
  city: ['poblacion', 'localidad', 'municipio', 'ciudad', 'city', 'town'],
  weight: ['peso', 'peso kg', 'kg', 'weight', 'weight kg'],
  boxCount: ['bultos', 'cajas', 'paquetes', 'unidades', 'boxes', 'packages', 'box count'],
  lat: ['latitud', 'latitude', 'lat'],
  lng: ['longitud', 'longitude', 'lng', 'lon'],
  deliveryStart: ['hora desde', 'inicio entrega', 'ventana inicio', 'delivery start', 'from'],
  deliveryEnd: ['hora hasta', 'fin entrega', 'ventana fin', 'delivery end', 'to']
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function detectColumns(headers: string[]): Partial<Record<ExcelField, string>> {
  const normalized = new Map(headers.map(header => [normalizeHeader(header), header]));
  const result: Partial<Record<ExcelField, string>> = {};
  (Object.keys(aliases) as ExcelField[]).forEach(field => {
    const match = aliases[field].map(normalizeHeader).find(alias => normalized.has(alias));
    if (match) result[field] = normalized.get(match);
  });
  return result;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return undefined;
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '')
    : raw.replace(',', '.');
  const parsed = Number(normalized.replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const seconds = Math.round(value * 86400);
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }
  const raw = text(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}:${match[3] ?? '00'}` : fallback;
}

export function rowsToStops(
  rows: Record<string, unknown>[],
  columns: Partial<Record<ExcelField, string>>,
  fileName = 'Excel'
): Pick<ExcelImportResult, 'stops' | 'skippedRows' | 'totalRows'> {
  const stops: DeliveryStop[] = [];
  const skippedRows: { row: number; reason: string }[] = [];
  const get = (row: Record<string, unknown>, field: ExcelField) => columns[field] ? row[columns[field]!] : undefined;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (Object.values(row).every(value => text(value) === '')) return;
    const customerName = text(get(row, 'customerName'));
    const address = text(get(row, 'address'));
    const postalCode = text(get(row, 'postalCode'));
    const city = text(get(row, 'city'));
    const lat = parseNumber(get(row, 'lat'));
    const lng = parseNumber(get(row, 'lng'));
    const hasCoordinates = lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!customerName) {
      skippedRows.push({ row: rowNumber, reason: 'Falta el cliente/nombre.' });
      return;
    }
    if (!address && !hasCoordinates) {
      skippedRows.push({ row: rowNumber, reason: 'Falta una dirección o coordenadas válidas.' });
      return;
    }
    const customerCode = text(get(row, 'customerCode')) || `EXCEL-${rowNumber}`;
    const fullAddress = [address, postalCode, city].filter(Boolean).join(', ');
    stops.push({
      id: `excel_${Date.now()}_${rowNumber}`,
      routeGroup: 'EXCEL',
      customerCode,
      customerName: customerName.slice(0, 100),
      address: (address || fullAddress).slice(0, 150),
      city: city.slice(0, 80),
      postalCode: postalCode.slice(0, 20),
      deliveryStart: normalizeTime(get(row, 'deliveryStart'), '08:00:00'),
      deliveryEnd: normalizeTime(get(row, 'deliveryEnd'), '18:00:00'),
      pageNumber: 1,
      originalText: `Importado de ${fileName}, fila ${rowNumber}`,
      extraServiceTime: 5,
      priority: false,
      fixedFirst: false,
      fixedLast: false,
      excluded: false,
      geocodeStatus: hasCoordinates ? 'success' : 'pending',
      lat: hasCoordinates ? lat : undefined,
      lng: hasCoordinates ? lng : undefined,
      weight: parseNumber(get(row, 'weight')) ?? 0,
      boxCount: parseNumber(get(row, 'boxCount')) ?? 0,
      status: 'pending'
    });
  });
  return { stops, skippedRows, totalRows: rows.length };
}

export async function parseExcelFile(file: File): Promise<ExcelImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const headerIndex = matrix.findIndex(row => Array.isArray(row) && row.some(cell => text(cell) !== ''));
    if (headerIndex < 0) continue;
    const headers = (matrix[headerIndex] as unknown[]).map(text);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerIndex, defval: '' });
    const detectedColumns = detectColumns(headers);
    if (!detectedColumns.customerName || (!detectedColumns.address && !(detectedColumns.lat && detectedColumns.lng))) {
      throw new Error('No se detectaron las columnas mínimas: Cliente y Dirección, o Cliente + Latitud + Longitud.');
    }
    const parsed = rowsToStops(rows, detectedColumns, file.name);
    if (!parsed.stops.length) throw new Error('El Excel no contiene filas utilizables. Revisa los errores y las columnas obligatorias.');
    return { ...parsed, headers, detectedColumns, sheetName };
  }
  throw new Error('El libro Excel no contiene ninguna hoja con datos.');
}

export function createExcelTemplate(): Blob {
  const sheet = XLSX.utils.json_to_sheet([
    { Pedido: 'PED-001', Cliente: 'Cliente ejemplo', Dirección: 'Gran Vía 45', CP: '48011', Población: 'Bilbao', Peso: 42.5, Bultos: 8, 'Hora desde': '09:00', 'Hora hasta': '13:00' }
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Ruta');
  return new Blob([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
