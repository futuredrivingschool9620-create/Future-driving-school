import { Response } from 'express';

interface SSEClient {
  id: string;
  adminId: string;
  res: Response;
}

class SSEServiceClass {
  private clients: Map<string, SSEClient> = new Map();
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Send keep-alive comment every 30 seconds to prevent connection drops
    this.keepAliveInterval = setInterval(() => {
      this.broadcastKeepAlive();
    }, 30000);
  }

  public addClient(adminId: string, res: Response): string {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);
    this.clients.set(id, { id, adminId, res });
    
    // Send initial connection success event
    this.sendToClient(id, { type: 'connected', message: 'SSE Connection Established' });
    
    return id;
  }

  public removeClient(id: string): void {
    this.clients.delete(id);
  }

  public sendToClient(id: string, data: any): void {
    const client = this.clients.get(id);
    if (client) {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  public sendToAdmin(adminId: string, data: any): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (client.adminId === adminId) {
        client.res.write(payload);
      }
    }
  }

  public broadcast(data: any): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      client.res.write(payload);
    }
  }

  private broadcastKeepAlive(): void {
    // Send a comment line which is ignored by the EventSource API, 
    // but keeps the connection open through load balancers (like Nginx/Render).
    for (const client of this.clients.values()) {
      client.res.write(':\n\n'); 
    }
  }
}

export const SSEService = new SSEServiceClass();
