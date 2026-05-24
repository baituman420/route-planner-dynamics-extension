import React from 'react';
import type { DeliveryStop } from '../types';
import { Trash2, CheckCircle2, AlertCircle, HelpCircle, Eye, EyeOff } from 'lucide-react';

interface StopEditorProps {
  stop: DeliveryStop;
  onUpdate: (updated: DeliveryStop) => void;
  onDelete: (id: string) => void;
}

export const StopEditor: React.FC<StopEditorProps> = ({ stop, onUpdate, onDelete }) => {
  const [showRaw, setShowRaw] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let val: any = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    if (type === 'number') val = val ? parseFloat(val) : 0;
    onUpdate({ ...stop, [name]: val });
  };

  const getStatusBadge = () => {
    switch (stop.geocodeStatus) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <CheckCircle2 className="w-3 h-3" /> Geocodificado
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 animate-pulse">
            <AlertCircle className="w-3 h-3" /> Fallido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
            <HelpCircle className="w-3 h-3" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className={`premium-card p-5 animate-fade-in relative overflow-hidden ${stop.excluded ? 'opacity-60 bg-gray-50/50' : ''}`}>
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-gray-400">ID:</span>
          <h4 className="font-black text-gray-800 text-sm tracking-tight">{stop.customerCode || 'M-NEW'}</h4>
          {getStatusBadge()}
        </div>
        <button 
          onClick={() => onDelete(stop.id)} 
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
          title="Eliminar parada"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Código de Cliente</label>
          <input 
            name="customerCode" 
            value={stop.customerCode} 
            onChange={handleChange} 
            className="premium-input font-mono text-xs" 
            placeholder="M-0000"
          />
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Nombre Comercial</label>
          <input 
            name="customerName" 
            value={stop.customerName} 
            onChange={handleChange} 
            className="premium-input text-xs font-semibold" 
            placeholder="Nombre de empresa/cliente"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-3.5">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Dirección postal</label>
          <input 
            name="address" 
            value={stop.address} 
            onChange={handleChange} 
            className="premium-input text-xs" 
            placeholder="Calle, número, piso..."
          />
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Municipio</label>
          <input 
            name="city" 
            value={stop.city} 
            onChange={handleChange} 
            className="premium-input text-xs font-semibold" 
            placeholder="Ciudad"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Inicio Ventana</label>
          <input 
            name="deliveryStart" 
            value={stop.deliveryStart} 
            placeholder="0:00:00" 
            onChange={handleChange} 
            className="premium-input text-xs text-center" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Fin Ventana</label>
          <input 
            name="deliveryEnd" 
            value={stop.deliveryEnd} 
            placeholder="0:00:00" 
            onChange={handleChange} 
            className="premium-input text-xs text-center" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Servicio (min)</label>
          <input 
            type="number" 
            name="extraServiceTime" 
            value={stop.extraServiceTime} 
            onChange={handleChange} 
            className="premium-input text-xs text-center" 
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Cantidad Cajas</label>
          <input 
            type="number" 
            name="boxCount" 
            value={stop.boxCount || 0} 
            onChange={handleChange} 
            className="premium-input text-xs text-center" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-extrabold text-gray-450 uppercase tracking-wider mb-1">Peso Carga (kg)</label>
          <input 
            type="number" 
            name="weight" 
            value={stop.weight || 0} 
            onChange={handleChange} 
            className="premium-input text-xs text-center" 
          />
        </div>
      </div>

      {/* CHECKBOXES TOGGLES */}
      <div className="flex flex-wrap gap-4 py-2 border-t border-b border-gray-100 mb-3 text-xs">
        <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
          <input 
            type="checkbox" 
            name="excluded" 
            checked={!!stop.excluded} 
            onChange={handleChange} 
            className="premium-checkbox" 
          />
          <span>Excluir</span>
        </label>
        <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
          <input 
            type="checkbox" 
            name="fixedFirst" 
            checked={!!stop.fixedFirst} 
            onChange={handleChange} 
            className="premium-checkbox" 
          />
          <span>Primero en Ruta</span>
        </label>
        <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
          <input 
            type="checkbox" 
            name="fixedLast" 
            checked={!!stop.fixedLast} 
            onChange={handleChange} 
            className="premium-checkbox" 
          />
          <span>Último en Ruta</span>
        </label>
      </div>

      {/* RAW DATA LOG ACCORDION */}
      {stop.originalText && (
        <div className="space-y-1.5">
          <button 
            type="button" 
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition"
          >
            {showRaw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showRaw ? 'Ocultar Texto Escaneado' : 'Mostrar Texto Escaneado'}
          </button>
          {showRaw && (
            <div className="text-[10px] bg-gray-50 text-gray-600 p-2.5 rounded-xl whitespace-pre-wrap font-mono border border-gray-100 max-h-24 overflow-y-auto leading-relaxed">
              {stop.originalText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
