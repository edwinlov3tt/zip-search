class ApiClient {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    this.version = import.meta.env.VITE_API_VERSION || 'v1';
    this.timeout = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;
    this.env = import.meta.env.VITE_ENV || 'development';
  }

  getFullUrl(endpoint) {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    // Ensure version is included if not already in endpoint
    if (!cleanEndpoint.startsWith(this.version)) {
      return `${this.baseURL}/${this.version}/${cleanEndpoint}`;
    }
    return `${this.baseURL}/${cleanEndpoint}`;
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = this.getFullUrl(endpoint);

      const defaultHeaders = {
        'Content-Type': 'application/json',
        'X-Environment': this.env,
      };

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this.handleError(response);
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  async handleError(response) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response is not JSON, use default message
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    error.statusText = response.statusText;
    return error;
  }

  // Convenience methods
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // File upload method
  async upload(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // Add additional data to form
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type, let browser set it with boundary
      },
    });
  }

  // Retry logic for critical requests
  async retryRequest(endpoint, options = {}, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }

    throw lastError;
  }

  // Health check
  async healthCheck() {
    try {
      // Use a simple fetch instead of the full request method
      // to avoid JSON parsing errors when the endpoint returns HTML
      const url = this.getFullUrl('health');
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return { status: 'error', message: 'API returned non-JSON response' };
      }

      if (!response.ok) {
        return { status: 'error', message: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Don't log as error - health check failures are expected when API is unavailable
      return { status: 'error', message: error.message };
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;
export { ApiClient };