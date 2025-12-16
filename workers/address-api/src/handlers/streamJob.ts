import { Env, AddressJob, Address } from '../types';

/**
 * Handle GET /api/address-search/:jobId/stream
 * Server-Sent Events streaming endpoint
 */
export function handleStreamJob(
  jobId: string,
  env: Env,
  origin: string
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastProgress = -1;
      let lastResultCount = 0;
      let retries = 0;
      const maxRetries = 120; // 2 minutes max (polling every second)
      const startTime = Date.now();

      // Helper to send SSE event
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Poll for updates
      const poll = async () => {
        try {
          const result = await env.DB.prepare(`
            SELECT * FROM address_jobs WHERE id = ?
          `).bind(jobId).first<AddressJob>();

          if (!result) {
            sendEvent('error', { message: 'Job not found', code: 'NOT_FOUND' });
            controller.close();
            return;
          }

          // Send progress update if changed
          if (result.progress !== lastProgress) {
            lastProgress = result.progress;
            sendEvent('progress', {
              progress: result.progress,
              found: result.total_found
            });
          }

          // Check if job is complete or failed
          if (result.status === 'complete') {
            // Send all results in batches
            let allResults: Address[] = [];
            try {
              if (result.results) {
                allResults = JSON.parse(result.results);
              }
            } catch (e) {
              console.error('Failed to parse results:', e);
            }

            // Send results in batches of 100
            const batchSize = 100;
            for (let i = 0; i < allResults.length; i += batchSize) {
              const batch = allResults.slice(i, i + batchSize);
              sendEvent('batch', {
                addresses: batch,
                count: batch.length
              });
            }

            // Send complete event
            const duration = Date.now() - startTime;
            sendEvent('complete', {
              totalFound: result.total_found,
              duration
            });

            controller.close();
            return;
          }

          if (result.status === 'failed') {
            sendEvent('error', {
              message: result.error || 'Job failed',
              code: 'FAILED'
            });
            controller.close();
            return;
          }

          // Continue polling
          retries++;
          if (retries >= maxRetries) {
            sendEvent('error', {
              message: 'Job timed out',
              code: 'TIMEOUT'
            });
            controller.close();
            return;
          }

          // Poll again in 1 second
          await new Promise(resolve => setTimeout(resolve, 1000));
          await poll();

        } catch (error) {
          console.error('Stream poll error:', error);
          sendEvent('error', {
            message: error instanceof Error ? error.message : 'Stream error',
            code: 'ERROR'
          });
          controller.close();
        }
      };

      // Start polling
      await poll();
    }
  });

  // Build CORS headers
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  const corsOrigin = allowedOrigins.includes(origin) ? origin : '';

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
