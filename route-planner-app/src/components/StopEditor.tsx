import React from 'react';
import type { DeliveryStop } from '../types';

interface StopEditorProps {
  stop: DeliveryStop;
  onUpdate: (updated: DeliveryStop) => void;
  onDelete: (id: string) => void;
}

export const StopEditor: React.FC<StopEditorProps> = ({ stop, onUpdate, onDelete }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    if (type === 'number') val = val ? parseFloat(val) : 0;
    onUpdate({ ...stop, [name]: val });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col gap-3">
      <div className="flex justify-between items-center mb-1">
        <h4 className="font-bold text-gray-800 text-lg">#{stop.customerCode}</h4>
        <div className="flex gap-2">
          {stop.geocodeStatus === 'success' && <span className="text-green-600 font-bold text-sm bg-green-100 px-2 py-1 rounded">✔ Geocoded</span>}
          {stop.geocodeStatus === 'failed' && <span className="text-red-600 font-bold text-sm bg-red-100 px-2 py-1 rounded">X Failed</span>}
          {stop.geocodeStatus === 'pending' && <span className="text-yellow-600 font-bold text-sm bg-yellow-100 px-2 py-1 rounded">Pending</span>}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-sm font-medium text-gray-600">Client Code</label>
          <input name="customerCode" value={stop.customerCode} onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600">Name</label>
          <input name="customerName" value={stop.customerName} onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-4">
          <label className="block text-sm font-medium text-gray-600">Address</label>
          <input name="address" value={stop.address} onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-600">City</label>
          <input name="city" value={stop.city} onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600">Time Start</label>
          <input name="deliveryStart" value={stop.deliveryStart} placeholder="0:00:00" onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600">Time End</label>
          <input name="deliveryEnd" value={stop.deliveryEnd} placeholder="0:00:00" onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600">Time (min)</label>
          <input type="number" name="extraServiceTime" value={stop.extraServiceTime} onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
           <label className="block text-sm font-medium text-gray-600">Boxes (Qty)</label>
           <input type="number" name="boxCount" value={stop.boxCount || 0} onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none" />
        </div>
        <div>
           <label className="block text-sm font-medium text-gray-600">Weight (kg)</label>
           <input type="number" name="weight" value={stop.weight || 0} onChange={handleChange} className="w-full mt-1 px-3 py-2 border rounded shadow-sm outline-none" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-2">
        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input type="checkbox" name="excluded" checked={stop.excluded} onChange={handleChange} className="form-checkbox text-blue-600" />
          <span>Exclude</span>
        </label>
        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input type="checkbox" name="fixedFirst" checked={stop.fixedFirst} onChange={handleChange} className="form-checkbox text-blue-600" />
          <span>Fixed First</span>
        </label>
        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input type="checkbox" name="fixedLast" checked={stop.fixedLast} onChange={handleChange} className="form-checkbox text-blue-600" />
          <span>Fixed Last</span>
        </label>
      </div>

      <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
        <strong>Raw:</strong> {stop.originalText}
      </div>

      <button onClick={() => onDelete(stop.id)} className="mt-2 self-start px-3 py-1 bg-red-100 text-red-700 font-semibold rounded hover:bg-red-200 transition">
        Delete Row
      </button>
    </div>
  );
};
