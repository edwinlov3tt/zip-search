import { Env, AddressSearchRequest, CreateJobResponse, Address, StorageType } from '../types';
import {
  searchByRadius,
  searchByPolygon,
  searchByZips,
  calculatePolygonArea,
  chunkPolygon,
  searchByBbox,
  deduplicateAddresses
} from '../services/overpass';

// Batch size for saving results to D1
const BATCH_SIZE = 1000;
// Threshold for using R2 storage (addresses)
const R2_THRESHOLD = 50000;

/**
 * Generate a short unique job ID
 */
function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `addr_${timestamp}${random}`;
}

/**
 * Handle POST /api/address-search
 * Creates a new address search job and starts processing
 */
export async function handleCreateJob(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<CreateJobResponse> {
  const body = await request.json() as AddressSearchRequest;

  // Validate request
  if (!body.mode) {
    throw new Error('Missing required field: mode');
  }

  if (body.mode === 'polygon' && (!body.coordinates || body.coordinates.length < 3)) {
    throw new Error('Polygon mode requires at least 3 coordinates');
  }

  if (body.mode === 'radius' && (!body.center || !body.radius)) {
    throw new Error('Radius mode requires center and radius');
  }

  if (body.mode === 'zips' && (!body.zips || body.zips.length === 0)) {
    throw new Error('ZIP mode requires at least one ZIP code');
  }

  // Generate job ID
  const jobId = generateJobId();

  // Create job record with chunked storage type
  await env.DB.prepare(`
    INSERT INTO address_jobs (id, status, mode, params, progress, total_found, storage_type)
    VALUES (?, 'processing', ?, ?, 0, 0, 'chunks')
  `).bind(
    jobId,
    body.mode,
    JSON.stringify(body)
  ).run();

  // Start processing in the background using ctx.waitUntil
  // This allows the response to return immediately while processing continues
  ctx.waitUntil(processJob(jobId, body, env));

  return {
    jobId,
    status: 'processing',
    estimatedCount: null,
    pollUrl: `/api/address-search/${jobId}`,
    streamUrl: `/api/address-search/${jobId}/stream`
  };
}

/**
 * Process the address search job with chunked storage
 */
async function processJob(
  jobId: string,
  params: AddressSearchRequest,
  env: Env
): Promise<void> {
  const startTime = Date.now();
  let addresses: Address[] = [];
  let error: string | null = null;
  let batchNumber = 0;

  try {
    // Update status to processing
    await updateJobProgress(env, jobId, 10, 0);

    // Execute search based on mode
    if (params.mode === 'radius' && params.center && params.radius) {
      addresses = await searchByRadius(params.center, params.radius);
      // Save results in batches
      batchNumber = await saveBatches(env, jobId, addresses, batchNumber);
      await updateJobProgress(env, jobId, 100, addresses.length);

    } else if (params.mode === 'polygon' && params.coordinates) {
      // Check if polygon is too large and needs chunking
      const area = calculatePolygonArea(params.coordinates);

      if (area > 100) {
        throw new Error('Polygon too large. Maximum area is 100 square miles.');
      }

      if (area > 20) {
        // Chunk large polygons
        const chunks = chunkPolygon(params.coordinates, 20);
        const totalChunks = chunks.length;
        let processedChunks = 0;

        for (const chunk of chunks) {
          try {
            const chunkAddresses = await searchByBbox(
              chunk.minLat,
              chunk.minLng,
              chunk.maxLat,
              chunk.maxLng
            );

            // Save each chunk's results immediately to avoid timeout
            batchNumber = await saveBatches(env, jobId, chunkAddresses, batchNumber);
            addresses.push(...chunkAddresses);
            processedChunks++;

            const progress = Math.round((processedChunks / totalChunks) * 90) + 10;
            await updateJobProgress(env, jobId, progress, addresses.length);
          } catch (chunkError) {
            console.error(`Chunk error:`, chunkError);
            // Continue with other chunks
          }
        }

        // Note: Deduplication happens at retrieval time for chunked storage
      } else {
        // Small polygon - query directly
        await updateJobProgress(env, jobId, 30, 0);
        addresses = await searchByPolygon(params.coordinates);
        batchNumber = await saveBatches(env, jobId, addresses, batchNumber);
      }

      await updateJobProgress(env, jobId, 100, addresses.length);

    } else if (params.mode === 'zips' && params.zips) {
      await updateJobProgress(env, jobId, 30, 0);
      addresses = await searchByZips(params.zips);
      batchNumber = await saveBatches(env, jobId, addresses, batchNumber);
      await updateJobProgress(env, jobId, 100, addresses.length);
    }

  } catch (err) {
    console.error('Job processing error:', err);
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  // Determine storage type and optionally save to R2
  let storageType: StorageType = 'chunks';
  let r2Key: string | null = null;

  if (!error && addresses.length >= R2_THRESHOLD) {
    // For very large results, also save to R2 as backup
    try {
      r2Key = `jobs/${jobId}/results.json`;
      await env.R2.put(r2Key, JSON.stringify(addresses), {
        customMetadata: {
          jobId,
          totalFound: addresses.length.toString(),
          createdAt: new Date().toISOString()
        }
      });
      storageType = 'r2';
      console.log(`Saved ${addresses.length} addresses to R2: ${r2Key}`);
    } catch (r2Error) {
      console.error('R2 save failed, falling back to chunks:', r2Error);
      storageType = 'chunks';
      r2Key = null;
    }
  }

  // Update job as complete (results stored in chunks table or R2)
  const duration = Date.now() - startTime;
  await env.DB.prepare(`
    UPDATE address_jobs
    SET status = ?,
        progress = 100,
        total_found = ?,
        storage_type = ?,
        r2_key = ?,
        error = ?,
        completed_at = datetime('now')
    WHERE id = ?
  `).bind(
    error ? 'failed' : 'complete',
    addresses.length,
    storageType,
    r2Key,
    error,
    jobId
  ).run();

  console.log(`Job ${jobId} completed in ${duration}ms with ${addresses.length} addresses (storage: ${storageType})`);
}

/**
 * Save addresses in batches to the address_results table
 */
async function saveBatches(
  env: Env,
  jobId: string,
  addresses: Address[],
  startBatchNumber: number
): Promise<number> {
  let batchNumber = startBatchNumber;

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);

    await env.DB.prepare(`
      INSERT INTO address_results (job_id, batch_number, addresses, count)
      VALUES (?, ?, ?, ?)
    `).bind(
      jobId,
      batchNumber,
      JSON.stringify(batch),
      batch.length
    ).run();

    batchNumber++;
  }

  return batchNumber;
}

/**
 * Update job progress in database
 */
async function updateJobProgress(
  env: Env,
  jobId: string,
  progress: number,
  totalFound: number
): Promise<void> {
  await env.DB.prepare(`
    UPDATE address_jobs
    SET progress = ?, total_found = ?
    WHERE id = ?
  `).bind(progress, totalFound, jobId).run();
}
