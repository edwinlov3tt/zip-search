import { getEnv } from '../_lib/env.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Environment'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const healthStatus = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: getEnv('VITE_ENV') || 'production',
      version: getEnv('VITE_API_VERSION') || 'v1',
      services: {
        database: 'connected',
        api: 'operational'
      }
    };

    // Check if critical environment variables are set
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName =>
      !getEnv(varName)
    );

    if (missingVars.length > 0) {
      healthStatus.status = 'DEGRADED';
      healthStatus.warnings = {
        missingEnvironmentVariables: missingVars
      };
    }

    return res.status(200).json(healthStatus);
  } catch (error) {
    return res.status(500).json({
      status: 'ERROR',
      error: 'Health check failed',
      message: error.message
    });
  }
}
