// User and Authentication Types
export interface User {
  id: number;
  name: string;
  email: string;
  profile_picture?: string;
  department?: string;
  license_number?: string;
  license_type?: string; // Philippine DL codes: A, A1, B, B1, B2, C, D, BE, CE
  role: 'driver' | 'regular' | 'director' | 'assistant' | 'procurement' | 'admin';
  can_approve_travel: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Additional fields from database migrations
  google_id?: string;
  avatar?: string;
  provider?: 'local' | 'google';
  email_verified_at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: string;
  department?: string;
  license_number?: string;
}

// Vehicle Types
export interface Vehicle {
  id: number;
  driver_id: number;
  plate_number: string;
  type: string;
  model: string;
  year: number;
  capacity: number;
  fuel_type?: string;
  color?: string;
  status: 'Available' | 'In Use' | 'Maintenance' | 'Out of Service';
  created_at: string;
  updated_at: string;
  // Fuel tank tracking
  fuel_tank_capacity?: number; // in liters
  current_fuel_level?: number; // in liters
  last_refuel_date?: string;
  last_refuel_location?: string;
}

// Fuel Tracking Types
export interface VehicleFuelStatus {
  vehicle_id: number;
  vehicle: Vehicle;
  current_fuel_level: number; // liters
  fuel_tank_capacity: number; // liters
  fuel_percentage: number; // 0-100
  last_refuel_date?: string;
  last_refuel_location?: string;
  last_refuel_amount?: number;
  estimated_range_km?: number;
}

export interface VehicleFormData {
  plate_number: string;
  type: string;
  model: string;
  year: number;
  capacity: number;
  fuel_type?: string;
  color?: string;
  status: string;
}

export interface VehicleStats {
  total: number;
  available: number;
  in_use: number;
  maintenance: number;
}

// Trip Types
export interface TripLog {
  id: number;
  driver_id: number;
  vehicle_id: number;
  trip_ticket_id?: number;
  vehicle?: Vehicle;
  tripTicket?: TripTicket;
  date: string;
  departure_time_office: string;
  arrival_time_office: string;
  route?: string;
  purpose: string;
  distance: number;
  fuel_used: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TripLogFormData {
  trip_ticket_id: number;
  vehicle_id?: number;
  date: string;
  departure_time?: string; // Backend compatibility field (24-hour format)
  arrival_time?: string; // Backend compatibility field (24-hour format)
  departure_time_office: string;
  arrival_time_destination?: string;
  departure_time_destination?: string;
  arrival_time_office?: string;
  destination: string;
  distance: number;
  fuel_balance_start?: number;
  fuel_issued_office?: number;
  fuel_purchased_trip?: number;
  fuel_total?: number;
  fuel_used?: number;
  fuel_balance_end?: number;
  gear_oil?: number;
  lubrication_oil?: number;
  brake_fluid?: number;
  grease?: number;
  speedometer_start?: number;
  speedometer_end?: number;
  speedometer_distance?: number;
  odometer_start?: number;
  odometer_end?: number;
  purpose?: string;
  notes?: string;
}

export interface TripStats {
  total_trips: number;
  total_distance: number;
  total_fuel: number;
}

// Refuel Record Types
export interface RefuelRecord {
  id: number;
  vehicle_id: number;
  driver_id: number;
  trip_ticket_id?: number;
  pos_control_number?: string;
  liters_added: number;
  cost?: number;
  fuel_type?: string;
  refuel_date: string;
  location?: string;
  odometer_reading?: number;
  gas_station?: string;
  receipt_photo?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Relationships
  vehicle?: Vehicle;
  driver?: User;
  tripTicket?: TripTicket;
}

export interface RefuelFormData {
  vehicle_id: number;
  trip_ticket_id?: number;
  pos_control_number?: string;
  liters_added: number;
  cost?: number;
  fuel_type?: string;
  location?: string;
  odometer_reading?: number;
  gas_station?: string;
  notes?: string;
}

export interface FuelHistoryItem {
  id: number;
  type: 'refuel' | 'consumption';
  date: string;
  amount: number; // liters (positive for refuel, negative for consumption)
  location?: string;
  trip_ticket_number?: string;
  pos_control_number?: string;
  notes?: string;
}

// Trip Ticket Types
export interface TravelRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date?: string;
  departure_time?: string;
  return_time?: string;
  purpose: string;
  destinations?: string[] | string; // Can be JSON array or string
  details?: string;
  passengers?: any[]; // JSON array of passenger objects
  status: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
  approved_by?: number;
  rejection_reason?: string;
  processed_at?: string;
  procurement_notes?: string;
  is_emergency?: boolean;
  emergency_reason?: string;
  created_at: string;
  updated_at: string;
  
  // Relationships
  user?: User;
  approver?: User;
  tripTicket?: TripTicket;
}

export interface TripTicket {
  id: number;
  ticket_number: string;
  travel_request_id: number;
  driver_id?: number;
  vehicle_id?: number;
  driver_name: string;
  driver_license?: string;
  passenger_name?: string;
  purpose?: string;
  destination?: string;
  issued_by: number;
  issued_at: string;
  pos_generated_at?: string;
  pos_generated_by?: number;
  pos_receipt_image?: string;
  pos_receipt_uploaded_at?: string;
  started_at?: string;
  completed_at?: string;
  end_mileage?: number;
  fuel_consumed?: number;
  completion_notes?: string;
  status: 'active' | 'ready_for_trip' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Relationships
  travelRequest?: TravelRequest;
  driver?: User;
  vehicle?: Vehicle;
  issuedBy?: User;
}

// Dashboard Types
export interface DriverStats {
  vehicles_count: number;
  trips_today: number;
  monthly_fuel: string;
  monthly_distance: string;
  active_trips: number;
  total_tickets?: number;
  completed_tickets?: number;
  cancelled_tickets?: number;
  // Director stats
  pending_requests?: number;
  approved_today?: number;
  my_requests?: number;
  my_pending?: number;
  // Regular user stats
  total_trips_today?: number;
}

export interface DashboardData {
  user: User;
  vehicles: Vehicle[];
  recent_trips: TripTicket[];
  stats: DriverStats;
  active_trips: TripTicket[];
  // Director specific
  pending_requests?: any[];
  my_requests?: any[];
}

// Notification Types
export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  errors?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// Location Types
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationUpdate {
  trip_ticket_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Dashboard: undefined;
  Vehicles: undefined;
  VehicleForm: { vehicle?: Vehicle };
  Trips: undefined;
  TripLogForm: { trip?: TripLog };
  TripTickets: undefined;
  TripTicketDetails: { tripTicketId: number };
  Profile: undefined;
  Notifications: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Trips: undefined;
  Vehicles: undefined;
  TripTickets: undefined;
  Profile: undefined;
};

// Form validation types
export interface FormErrors {
  [key: string]: string[];
}

export interface ValidationError {
  message: string;
  errors: FormErrors;
}

// Filter types
export interface TripFilters {
  date_from?: string;
  date_to?: string;
  vehicle_id?: number;
  page?: number;
}