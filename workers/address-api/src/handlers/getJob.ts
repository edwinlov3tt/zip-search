import { Env, AddressJob, JobStatusResponse, Address, AddressResultBatch } from '../types';

/**
 * Handle GET /api/address-search/:jobId
 * Returns job status and paginated results
 *
 * Supports three storage types:
 * - chunks: Results stored in address_results table in batches
 * - r2: Results stored in R2 bucket
 * - inline: Legacy - results stored in job record
 */
export async function handleGetJob(
  jobId: string,
  env: Env,
  cursor: string | null,
  limit: number = 100
): Promise<JobStatusResponse | null> {
  // Fetch job from database
  const result = await env.DB.prepare(`
    SELECT * FROM address_jobs WHERE id = ?
  `).bind(jobId).first<AddressJob>();

  if (!result) {
    return null;
  }

  // Clamp limit
  const safeLimit = Math.min(Math.max(limit, 1), 500);

  // Get results based on storage type
  const { results: pageResults, nextCursor } = await getResults(
    env,
    result,
    cursor,
    safeLimit
  );

  return {
    jobId: result.id,
    status: result.status as JobStatusResponse['status'],
    progress: result.progress,
    totalFound: result.total_found,
    results: pageResults,
    nextCursor,
    error: result.error
  };
}

/**
 * Get results based on storage type
 */
async function getResults(
  env: Env,
  job: AddressJob,
  cursor: string | null,
  limit: number
): Promise<{ results: Address[]; nextCursor: string | null }> {
  const storageType = job.storage_type || 'inline';

  if (storageType === 'chunks') {
    return getChunkedResults(env, job.id, cursor, limit);
  } else if (storageType === 'r2' && job.r2_key) {
    return getR2Results(env, job.r2_key, cursor, limit);
  } else {
    // Legacy inline storage
    return getInlineResults(job, cursor, limit);
  }
}

/**
 * Get results from chunked storage (address_results table)
 */
async function getChunkedResults(
  env: Env,
  jobId: string,
  cursor: string | null,
  limit: number
): Promise<{ results: Address[]; nextCursor: string | null }> {
  // Cursor format: "batch:index" (e.g., "3:250")
  let batchNumber = 0;
  let indexInBatch = 0;

  if (cursor) {
    try {
      const decoded = atob(cursor);
      const [b, i] = decoded.split(':').map(Number);
      batchNumber = b;
      indexInBatch = i;
    } catch {
      batchNumber = 0;
      indexInBatch = 0;
    }
  }

  const results: Address[] = [];
  let currentBatch = batchNumber;
  let currentIndex = indexInBatch;

  // Fetch batches until we have enough results
  while (results.length < limit) {
    const batch = await env.DB.prepare(`
      SELECT * FROM address_results
      WHERE job_id = ? AND batch_number = ?
    `).bind(jobId, currentBatch).first<AddressResultBatch>();

    if (!batch) {
      // No more batches
      break;
    }

    const addresses: Address[] = JSON.parse(batch.addresses);
    const remaining = limit - results.length;
    const toAdd = addresses.slice(currentIndex, currentIndex + remaining);
    results.push(...toAdd);

    if (currentIndex + remaining >= addresses.length) {
      // Move to next batch
      currentBatch++;
      currentIndex = 0;
    } else {
      currentIndex += remaining;
    }
  }

  // Calculate next cursor
  let nextCursor: string | null = null;
  if (results.length === limit) {
    // Check if there are more results
    const nextBatch = await env.DB.prepare(`
      SELECT 1 FROM address_results
      WHERE job_id = ? AND batch_number >= ?
      LIMIT 1
    `).bind(jobId, currentBatch).first();

    if (nextBatch) {
      nextCursor = btoa(`${currentBatch}:${currentIndex}`);
    }
  }

  return { results, nextCursor };
}

/**
 * Get results from R2 storage
 */
async function getR2Results(
  env: Env,
  r2Key: string,
  cursor: string | null,
  limit: number
): Promise<{ results: Address[]; nextCursor: string | null }> {
  // Fetch from R2
  const object = await env.R2.get(r2Key);
  if (!object) {
    console.error(`R2 object not found: ${r2Key}`);
    return { results: [], nextCursor: null };
  }

  const data = await object.text();
  const allResults: Address[] = JSON.parse(data);

  // Handle pagination
  let startIndex = 0;
  if (cursor) {
    try {
      startIndex = parseInt(atob(cursor), 10);
    } catch {
      startIndex = 0;
    }
  }

  const pageResults = allResults.slice(startIndex, startIndex + limit);
  const nextIndex = startIndex + limit;
  const nextCursor = nextIndex < allResults.length
    ? btoa(nextIndex.toString())
    : null;

  return { results: pageResults, nextCursor };
}

/**
 * Get results from inline storage (legacy)
 */
async function getInlineResults(
  job: AddressJob,
  cursor: string | null,
  limit: number
): Promise<{ results: Address[]; nextCursor: string | null }> {
  let allResults: Address[] = [];
  try {
    if (job.results) {
      allResults = JSON.parse(job.results);
    }
  } catch (e) {
    console.error('Failed to parse results:', e);
  }

  // Handle pagination
  let startIndex = 0;
  if (cursor) {
    try {
      startIndex = parseInt(atob(cursor), 10);
    } catch {
      startIndex = 0;
    }
  }

  const pageResults = allResults.slice(startIndex, startIndex + limit);
  const nextIndex = startIndex + limit;
  const nextCursor = nextIndex < allResults.length
    ? btoa(nextIndex.toString())
    : null;

  return { results: pageResults, nextCursor };
}
