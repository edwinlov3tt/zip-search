// Environment bindings
export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ALLOWED_ORIGINS: string;
}

// Storage type for results
export type StorageType = 'chunks' | 'r2' | 'inline';

// Search modes
export type SearchMode = 'polygon' | 'radius' | 'zips';

// Job status
export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed';

// Coordinate point
export interface Coordinate {
  lat: number;
  lng: number;
}

// Address search request
export interface AddressSearchRequest {
  mode: SearchMode;
  // For polygon mode
  coordinates?: Coordinate[];
  // For radius mode
  center?: Coordinate;
  radius?: number; // miles
  // For ZIP mode
  zips?: string[];
  // Options
  limit?: number;
  streaming?: boolean;
}

// Job record from D1
export interface AddressJob {
  id: string;
  created_at: string;
  status: JobStatus;
  mode: SearchMode;
  params: string; // JSON
  progress: number;
  total_found: number;
  results: string | null; // JSON array (deprecated - use chunks/R2)
  error: string | null;
  completed_at: string | null;
  storage_type: StorageType;
  r2_key: string | null;
}

// Chunked result batch from D1
export interface AddressResultBatch {
  id: number;
  job_id: string;
  batch_number: number;
  addresses: string; // JSON array
  count: number;
  created_at: string;
}

// API response for job creation
export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  estimatedCount: number | null;
  pollUrl: string;
  streamUrl: string;
}

// API response for job status
export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  totalFound: number;
  results: Address[];
  nextCursor: string | null;
  error: string | null;
}

// Parsed address from Overpass
export interface Address {
  id: number;
  type: 'node' | 'way';
  housenumber: string;
  street: string;
  unit?: string;
  city?: string;
  state?: string;
  postcode?: string;
  lat: number;
  lng: number;
  building?: string;
  name?: string;
}

// SSE event types
export type SSEEventType = 'progress' | 'batch' | 'complete' | 'error';

export interface SSEProgressEvent {
  progress: number;
  found: number;
}

export interface SSEBatchEvent {
  addresses: Address[];
  count: number;
}

export interface SSECompleteEvent {
  totalFound: number;
  duration: number;
}

export interface SSEErrorEvent {
  message: string;
  code: string;
}
