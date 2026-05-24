// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import type { DeliveryStop } from '../types';
import { db } from '../db/db';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function parsePdfToStops(files: File[]): Promise<{ stops: DeliveryStop[], rawText: string[] }> {
  try {
    const allStops: DeliveryStop[] = [];
    const rawTextRows: string[] = [];
    let currentServiceGroup = 'Unknown';
    let globalStopIndex = 0;

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const items = textContent.items.map((item: any) => ({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5]
        }));

        // Sort by Y descending (top to bottom), then by X ascending (left to right)
        items.sort((a, b) => {
          if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
          return a.x - b.x;
        });

        const lines: string[] = [];
        let lastY: number | null = null;
        let currentLine = '';

        for (const item of items) {
          if (lastY === null) { lastY = item.y; }
          if (lastY !== null && Math.abs(lastY - item.y) > 5) {
            lines.push(currentLine.trim());
            currentLine = '';
            lastY = item.y;
          }
          currentLine += item.str + ' ';
        }
        if (currentLine) lines.push(currentLine.trim());

        // Simple heuristic state machine
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          rawTextRows.push(`[${file.name} - Pg ${pageNum}] ${line}`);
          
          if (line.includes('Servicio   E') || line.includes('Servicio   EU') || line.includes('Servicio   EZ')) {
            const match = line.match(/Servicio\s+([^S]+)Driver/);
            if (match && match[1]) {
              currentServiceGroup = match[1].trim();
            } else {
              const parts = line.split('Servicio');
              if (parts[1]) {
                currentServiceGroup = parts[1].split('Driver')[0].trim();
              }
            }
          }

          const rowMatch = line.match(/^([A-Z0-9]+)\s+([A-Z])\s+(.*)$/);
          
          if (rowMatch) {
            const customerCode = rowMatch[1];
            let rest = rowMatch[3];
            
            let deliveryStart = '0:00:00';
            let deliveryEnd = '0:00:00';
            
            const timeMatch = rest.match(/(\d{1,2}:\d{2}:\d{2})\s+(\d{1,2}:\d{2}:\d{2})$/);
            if (timeMatch) {
              deliveryStart = timeMatch[1];
              deliveryEnd = timeMatch[2];
              rest = rest.substring(0, rest.length - timeMatch[0].length).trim();
            }
            
            let paymentMatches = rest.match(/\s+(GIRO|A LA VISTA|TRANSF)$/);
            if (paymentMatches) {
              rest = rest.substring(0, rest.length - paymentMatches[0].length).trim();
            }

            let postalCode = '';
            let pcMatch = rest.match(/\s+(\d{5})$/);
            if (pcMatch) {
              postalCode = pcMatch[1];
              rest = rest.substring(0, rest.length - pcMatch[0].length).trim();
            }

            let city = '';
            let lastSpace = rest.lastIndexOf('   '); 
            if (lastSpace > -1) {
              city = rest.substring(lastSpace).trim();
              rest = rest.substring(0, lastSpace).trim();
            } else {
              if (rest.endsWith('BILBAO')) { city = 'BILBAO'; rest = rest.substring(0, rest.length - 6).trim(); }
              else if (rest.endsWith('BILBO')) { city = 'BILBO'; rest = rest.substring(0, rest.length - 5).trim(); }
            }
            
            let name = '';
            let address = '';
            
            lastSpace = rest.indexOf('   ');
            if (lastSpace > -1) {
               name = rest.substring(0, lastSpace).trim();
               address = rest.substring(lastSpace).trim();
            } else {
               // Improve Regex for addresses: Look for C/, CALLE, AVDA, AVENIDA, Bº, BARRIO, POL, PLAZA, PZ
               const addressRegex = /\s+(C\/|CALLE|AVDA|AVENIDA|Bº|BARRIO|POL|POLIGONO|PLAZA|PZ|PZA|CARRETERA|CRTA)\b/i;
               const addrMatch = rest.match(addressRegex);
               if (addrMatch && addrMatch.index !== undefined) {
                 name = rest.substring(0, addrMatch.index).trim();
                 address = rest.substring(addrMatch.index).trim();
               } else {
                 name = rest;
                 address = rest; // Still Needs manual review
               }
            }
            
            if(city.toUpperCase() === 'BILBO') city = 'BILBAO';
            
            allStops.push({
              id: `stop_${globalStopIndex++}_${Date.now()}`,
              routeGroup: currentServiceGroup,
              customerCode,
              customerName: name.substring(0, 100),
              address: address.substring(0, 150),
              city: city,
              postalCode: postalCode,
              deliveryStart,
              deliveryEnd,
              pageNumber: pageNum,
              originalText: line,
              extraServiceTime: 5,
              priority: false,
              fixedFirst: false,
              fixedLast: false,
              excluded: false,
              geocodeStatus: 'pending'
            });
          }
        }
      }
    }
    
    // Now cross-reference with our Dexie Database to automatically populate geo and corrections!
    for (const stop of allStops) {
      if (stop.customerCode) {
        const knownCustomer = await db.customers.get(stop.customerCode);
        if (knownCustomer) {
          // Inherit saved details
          stop.address = knownCustomer.address;
          stop.city = knownCustomer.city;
          stop.postalCode = knownCustomer.postalCode;
          stop.extraServiceTime = knownCustomer.extraServiceTime ?? 5;
          
          if (knownCustomer.lat && knownCustomer.lng && knownCustomer.geocodeStatus === 'success') {
             stop.lat = knownCustomer.lat;
             stop.lng = knownCustomer.lng;
             stop.geocodeStatus = 'success';
          }
        }
      }
    }
    
    // De-duplicate stops by customerCode
    const uniqueStops: DeliveryStop[] = [];
    const seenCodes = new Set<string>();
    for (const stop of allStops) {
       if (stop.customerCode && !seenCodes.has(stop.customerCode)) {
           seenCodes.add(stop.customerCode);
           uniqueStops.push(stop);
       } else if (!stop.customerCode) {
           uniqueStops.push(stop); // No client code, add anyway (manual or parsing failure)
       }
    }

    return { stops: uniqueStops, rawText: rawTextRows };
  } catch (error) {
    console.error('Error parsing PDFs', error);
    throw error;
  }
}
