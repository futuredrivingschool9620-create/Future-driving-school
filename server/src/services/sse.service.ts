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

  private safeWrite(id: string, client: SSEClient, payload: string): boolean {
    try {
      if (client.res.destroyed || client.res.writableEnded) {
        this.clients.delete(id);
        return false;
      }
      client.res.write(payload);
      return true;
    } catch {
      this.clients.delete(id);
      return false;
    }
  }

  public sendToClient(id: string, data: any): void {
    const client = this.clients.get(id);
    if (client) {
      this.safeWrite(id, client, `data: ${JSON.stringify(data)}\n\n`);
    }
  }

  public sendToAdmin(adminId: string, data: any): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      if (client.adminId === adminId) {
        this.safeWrite(id, client, payload);
      }
    }
  }

  public broadcast(data: any): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      this.safeWrite(id, client, payload);
    }
  }

  private broadcastKeepAlive(): void {
    // Send comment line to keep connection open through reverse proxies
    for (const [id, client] of this.clients.entries()) {
      this.safeWrite(id, client, ':\n\n');
    }
  }
}

export const SSEService = new SSEServiceClass();
