import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { detectColumns, normalizeHeader, parseExcelFile, rowsToStops } from './excelParser';

describe('Excel import', () => {
  it('normalizes accents, punctuation and casing in headers', () => {
    expect(normalizeHeader('  CÓD. Postal ')).toBe('cod postal');
  });

  it('detects practical Spanish and English aliases', () => {
    expect(detectColumns(['Nº Pedido', 'Razón Social', 'Dirección entrega', 'ZIP', 'Boxes'])).toEqual({
      customerCode: 'Nº Pedido', customerName: 'Razón Social', address: 'Dirección entrega', postalCode: 'ZIP', boxCount: 'Boxes'
    });
  });

  it('creates valid stops and parses localized numbers', () => {
    const columns = detectColumns(['Pedido', 'Cliente', 'Dirección', 'Población', 'Peso', 'Bultos', 'Latitud', 'Longitud']);
    const result = rowsToStops([{
      Pedido: 'PED-1', Cliente: 'Tienda Norte', Dirección: 'Gran Vía 45', Población: 'Bilbao', Peso: '1.234,50 kg', Bultos: '8', Latitud: '43,263', Longitud: '-2,935'
    }], columns, 'ruta.xlsx');
    expect(result.skippedRows).toEqual([]);
    expect(result.stops[0]).toMatchObject({ customerCode: 'PED-1', customerName: 'Tienda Norte', weight: 1234.5, boxCount: 8, lat: 43.263, lng: -2.935, geocodeStatus: 'success' });
  });

  it('skips malformed rows instead of fabricating customer or location', () => {
    const columns = detectColumns(['Cliente', 'Dirección']);
    const result = rowsToStops([
      { Cliente: '', Dirección: 'Calle Uno' },
      { Cliente: 'Sin ubicación', Dirección: '' },
      { Cliente: 'Correcto', Dirección: 'Calle Dos' }
    ], columns);
    expect(result.stops).toHaveLength(1);
    expect(result.skippedRows.map(item => item.row)).toEqual([2, 3]);
  });

  it('reads an in-memory xlsx workbook through the real file boundary', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { Pedido: 'PED-9', Cliente: 'Cliente real', Dirección: 'Calle Mayor 1', Población: 'Bilbao' }
    ]), 'Reparto');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const file = { name: 'prueba.xlsx', arrayBuffer: async () => bytes } as File;
    const result = await parseExcelFile(file);
    expect(result.sheetName).toBe('Reparto');
    expect(result.stops[0]).toMatchObject({ customerCode: 'PED-9', customerName: 'Cliente real', city: 'Bilbao' });
  });
});
