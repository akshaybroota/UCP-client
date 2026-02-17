export interface UCPLogEntry {
  id: string;
  method: string;
  url: string;
  requestHeaders?: any;
  requestBody?: any;
  responseBody?: any;
  status?: number;
  timestamp: number;
}

export class UCPClient {
  private static instance: UCPClient;
  private baseUrl = '';
  private logs: UCPLogEntry[] = [];
  private onLogUpdate?: (logs: UCPLogEntry[]) => void;

  private constructor() {}

  public static getInstance(): UCPClient {
    if (!UCPClient.instance) {
      UCPClient.instance = new UCPClient();
    }
    return UCPClient.instance;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  public setLogListener(listener: (logs: UCPLogEntry[]) => void) {
    this.onLogUpdate = listener;
  }

  private async log(entry: Partial<UCPLogEntry>) {
    const fullEntry: UCPLogEntry = {
      id: Math.random().toString(36).substring(7),
      method: entry.method || 'GET',
      url: entry.url || '',
      requestHeaders: entry.requestHeaders,
      requestBody: entry.requestBody,
      responseBody: entry.responseBody,
      status: entry.status,
      timestamp: Date.now(),
    };
    this.logs = [fullEntry, ...this.logs];
    this.onLogUpdate?.(this.logs);
  }

  private async request(method: string, path: string, body?: any) {
    const ucpHeaders: Record<string, string> = {};

    const isUcpEndpoint = path.startsWith('/checkout-sessions') || path.startsWith('/orders');
    
    if (method !== 'GET' || isUcpEndpoint) {
      if (method !== 'GET') {
        ucpHeaders['Content-Type'] = 'application/json';
      }
      ucpHeaders['UCP-Agent'] = 'profile="https://ucp-chat-client/profile"';
      ucpHeaders['Idempotency-Key'] = Math.random().toString(36).substring(7);
      ucpHeaders['Request-Id'] = Math.random().toString(36).substring(7);
      ucpHeaders['Request-Signature'] = 'mock-signature';
    }

    const logEntry: Partial<UCPLogEntry> = { 
      method, 
      url: `${this.baseUrl}${path}`, 
      requestHeaders: ucpHeaders,
      requestBody: body 
    };
    
    try {
      const response = await fetch('/api/ucp/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          path,
          body,
          headers: ucpHeaders,
          baseUrl: this.baseUrl
        }),
      });

      const proxyResponse = await response.json();
      const data = proxyResponse.data || proxyResponse;
      
      logEntry.status = response.status;
      logEntry.responseBody = data;
      this.log(logEntry);
      
      if (!response.ok) {
        throw new Error(data?.error?.message || `API Error: ${response.status}`);
      }
      return data;
    } catch (error: any) {
      console.error("UCP Proxy Request Error:", error);
      logEntry.status = logEntry.status || 500;
      logEntry.responseBody = { error: error.message };
      this.log(logEntry);
      throw error;
    }
  }

  // UCP Methods
  public async getCatalog(filters?: Record<string, string>) {
    let path = '/catalog';
    if (filters && Object.keys(filters).length > 0) {
      const params = new URLSearchParams(filters);
      path += `?${params.toString()}`;
    }
    return this.request('GET', path);
  }

  public async createCheckout(currency: string, lineItems: any[], buyer: any) {
    const formattedLineItems = lineItems.map((li: any) => ({
      item: {
        id: li.item_id || li.item?.id
      },
      quantity: li.quantity
    }));

    return this.request('POST', '/checkout-sessions', {
      currency,
      line_items: formattedLineItems,
      buyer
    });
  }

  public async getCheckout(id: string) {
    return this.request('GET', `/checkout-sessions/${id}`);
  }

  public async updateCheckout(id: string, updates: any) {
    return this.request('PUT', `/checkout-sessions/${id}`, updates);
  }

  public async completeCheckout(id: string, payment: any) {
    return this.request('POST', `/checkout-sessions/${id}/complete`, { payment });
  }

  public async cancelCheckout(id: string) {
    return this.request('POST', `/checkout-sessions/${id}/cancel`);
  }

  public async getOrder(id: string) {
    return this.request('GET', `/orders/${id}`);
  }

  public async getMerchantInfo() {
    return this.request('GET', '/.well-known/ucp');
  }
}

export const ucp = UCPClient.getInstance();
