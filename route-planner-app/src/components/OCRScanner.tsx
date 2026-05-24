import React, { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import Tesseract from 'tesseract.js';
import { Camera as CameraIcon, Upload, Loader2 } from 'lucide-react';
import type { DeliveryStop } from '../types';

interface OCRScannerProps {
  onAddScannedStop: (stop: DeliveryStop) => void;
  onCancel: () => void;
}

export const OCRScanner: React.FC<OCRScannerProps> = ({ onAddScannedStop, onCancel }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [scanResult, setScanResult] = useState<string>('');

  const captureImage = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      if (photo.dataUrl) {
         setImage(photo.dataUrl);
         processImage(photo.dataUrl);
      }
    } catch (e) {
      console.error("Camera error", e);
    }
  };

  const processImage = async (dataUrl: string) => {
    setLoading(true);
    setProgress('Initializing engine...');
    try {
      const result = await Tesseract.recognize(
        dataUrl,
        'eng+spa',
        {
          logger: m => {
             if (m.status === 'recognizing text') {
                 setProgress(`Reading: ${Math.floor(m.progress * 100)}%`);
             } else {
                 setProgress(m.status);
             }
          }
        }
      );
      setScanResult(result.data.text);
      
      // Basic heuristic to create a stop from typical albarán text
      // We look for postal codes, basic keywords
      const text = result.data.text;
      
      let newStop: DeliveryStop = {
        id: `scanned_${Date.now()}`,
        routeGroup: 'MANUAL',
        customerCode: `SCAN-${Math.floor(Math.random()*10000)}`,
        customerName: 'Scanned Client',
        address: 'Unknown Address',
        city: 'Unknown City',
        postalCode: '',
        deliveryStart: '0:00:00',
        deliveryEnd: '0:00:00',
        pageNumber: 0,
        originalText: text.substring(0, 200),
        extraServiceTime: 5,
        priority: true,
        fixedFirst: false,
        fixedLast: false,
        excluded: false,
        geocodeStatus: 'pending'
      };

      // Extract Postal Code
      const pcMatch = text.match(/\b(48\d{3}|01\d{3}|20\d{3})\b/); // typical basque postal codes
      if (pcMatch) newStop.postalCode = pcMatch[1];
      
      // Basic lines array to look for address
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      for(let line of lines) {
         if (line.match(/C\/|CALLE|AVDA|AVENIDA|Bº|BARRIO|POLIGONO|PLAZA|PZ/i)) {
             newStop.address = line;break;
         }
      }
      
      if (lines.length > 0) newStop.customerName = lines[0].substring(0, 50);

      onAddScannedStop(newStop);

    } catch (e) {
      console.error(e);
      alert("Error scanning image");
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        if(ev.target?.result && typeof ev.target.result === 'string') {
            setImage(ev.target.result);
            processImage(ev.target.result);
        }
    };
    reader.readAsDataURL(e.target.files[0]);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <CameraIcon className="w-6 h-6 text-blue-600" />
        Scan Delivery Note (Albarán)
      </h2>
      
      {!loading && !image && (
         <div className="flex flex-col gap-4">
           <button onClick={captureImage} className="bg-blue-600 text-white p-4 rounded shadow font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
             <CameraIcon className="w-5 h-5"/> Use Camera
           </button>
           <label className="bg-gray-100 text-gray-700 p-4 rounded shadow border border-gray-300 font-bold hover:bg-gray-200 flex items-center justify-center gap-2 cursor-pointer text-center">
             <Upload className="w-5 h-5"/> Upload Image
             <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
           </label>
           <button onClick={onCancel} className="text-gray-500 font-semibold p-2 mt-2">
              Cancel
           </button>
         </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
           <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
           <p className="text-blue-800 font-semibold">{progress}</p>
        </div>
      )}

      {!loading && image && (
        <div className="flex flex-col items-center gap-4 mt-4">
           <img src={image} className="w-48 rounded shadow-md border" alt="Scanned" />
           <div className="text-sm bg-gray-50 p-2 border rounded w-full overflow-y-auto max-h-32 text-gray-600 font-mono">
             {scanResult || "No text detected."}
           </div>
           {/* If processing works, it auto-adds to list. This acts as a fallback */}
           <button onClick={onCancel} className="bg-gray-300 text-gray-800 px-4 py-2 rounded shadow font-bold hover:bg-gray-400">
             Close
           </button>
        </div>
      )}
    </div>
  );
};
