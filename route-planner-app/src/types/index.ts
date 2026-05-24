export interface DeliveryStop {
  id: string; // unique internal identifier
  routeGroup: string;
  customerCode: string;
  customerName: string;
  address: string;
  city: string;
  postalCode: string;
  deliveryStart: string; // HH:mm:ss or "0:00:00"
  deliveryEnd: string;
  pageNumber: number;
  originalText: string;
  assignedDriverId?: string;
  
  // Editable / Metadata fields
  extraServiceTime: number; // in minutes
  priority: boolean;
  fixedFirst: boolean;
  fixedLast: boolean;
  excluded: boolean;
  
  // Custom properties
  boxCount?: number;
  weight?: number;
  userNotesActive?: boolean;
  userNotes?: string;
  status?: 'pending' | 'delivered';
  paymentMethod?: 'efectivo' | 'firma' | null;
  hasIncidents?: boolean;
  incidents?: string;
  
  // Geocoding & Optimization
  lat?: number;
  lng?: number;
  geocodeStatus: 'pending' | 'success' | 'failed';
  
  // Optimization output
  optimizedOrder?: number;
  eta?: string; // Estimated Time of Arrival
  estimatedServiceFinish?: string;
  distanceFromPrevious?: number;
  durationFromPrevious?: number;
}

export interface Driver {
  id: string;
  name: string;
  color: string;
}

export interface RouteSession {
  id: string;
  fileName: string;
  importedAt: number;
  drivers?: Driver[];
  stops: DeliveryStop[];
  status: 'imported' | 'reviewing' | 'optimized' | 'navigating';
  currentStopId?: string;
  notes: string;

  // Custom Starting and Ending Points
  startAddress?: string;
  startLat?: number;
  startLng?: number;
  startGeocodeStatus?: 'pending' | 'success' | 'failed' | 'idle';

  endAddress?: string;
  endLat?: number;
  endLng?: number;
  endGeocodeStatus?: 'pending' | 'success' | 'failed' | 'idle';
}

