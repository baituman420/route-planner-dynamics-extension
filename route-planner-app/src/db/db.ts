import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { RouteSession } from '../types';

export interface CustomerIndex {
  customerCode: string; // Primary key
  customerName: string;
  address: string;
  city: string;
  postalCode: string;
  lat?: number;
  lng?: number;
  geocodeStatus: 'pending' | 'success' | 'failed';
  extraServiceTime: number;
  lastSeenAt: number;
}

export class RoutePlannerDB extends Dexie {
  sessions!: Table<RouteSession, string>; 
  customers!: Table<CustomerIndex, string>;

  constructor() {
    super('RoutePlannerDB');
    this.version(1).stores({
      sessions: 'id, importedAt, status',
      customers: 'customerCode, customerName, city, lastSeenAt'
    });
  }
}

export const db = new RoutePlannerDB();
