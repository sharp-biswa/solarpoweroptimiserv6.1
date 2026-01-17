
// WebSocket Server for Real-time Data Streaming
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { wokwiSimulator } from './wokwi-integration';

export class RealtimeWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/api/realtime' });
    
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔗 New WebSocket client connected');
      this.clients.add(ws);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Real-time connection established',
        timestamp: new Date().toISOString(),
      }));
    });

    // Listen to Wokwi sensor data events
    wokwiSimulator.on('sensorData', (data) => {
      this.broadcastSensorData(data);
    });
  }

  private handleClientMessage(ws: WebSocket, data: any): void {
    if (data.type === 'subscribe') {
      // Client wants to subscribe to specific panel
      ws.send(JSON.stringify({
        type: 'subscribed',
        panelId: data.panelId,
      }));
    }
  }

  private broadcastSensorData(sensorData: any): void {
    const message = JSON.stringify({
      type: 'sensorUpdate',
      data: sensorData,
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Broadcast alert to all connected clients
  broadcastAlert(alert: any): void {
    const message = JSON.stringify({
      type: 'alert',
      data: alert,
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Public method to broadcast custom data
  broadcast(data: any): void {
    const message = JSON.stringify(data);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }
}
