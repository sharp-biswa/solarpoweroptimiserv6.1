import { wokwiSimulator } from "./wokwi-integration";
import { storage } from "./storage";
import type { RealtimeWebSocketServer } from "./websocket-server";

export class AutoPersistService {
  private wsServer: RealtimeWebSocketServer | null = null;
  private persistInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isPersisting: boolean = false; // Reentrancy guard

  constructor() {
    console.log('📊 Auto-persist service initialized');
  }

  setWebSocketServer(wsServer: RealtimeWebSocketServer): void {
    this.wsServer = wsServer;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Auto-persist service already running');
      return;
    }

    console.log('🚀 Starting auto-persist service with 2-second interval...');
    this.isRunning = true;

    // Persist Wokwi sensor data every 2 seconds with reentrancy guard
    this.persistInterval = setInterval(async () => {
      if (this.isPersisting) {
        console.warn('⚠️ Previous persist cycle still running, skipping this interval');
        return;
      }

      try {
        this.isPersisting = true;
        await this.persistAllSensorData();
      } catch (error) {
        console.error('❌ Error persisting sensor data:', error);
      } finally {
        this.isPersisting = false;
      }
    }, 30000); // 30-second interval to reduce CPU load

    console.log('✅ Auto-persist service started - saving data every 2 seconds');
  }

  private async persistAllSensorData(): Promise<void> {
    // Get all sensor data from Wokwi simulator
    const allSensorData = wokwiSimulator.getAllSensorData();

    if (allSensorData.length === 0) {
      return; // No data to persist yet
    }

    // Persist to storage (in batches for efficiency)
    const savedReadings = [];
    
    for (const sensorData of allSensorData) {
      try {
        // Calculate efficiency
        const efficiencyPercent = (sensorData.energyOutput / 250) * 100;

        // Save to storage
        const reading = await storage.createReading({
          panelId: sensorData.panelId,
          energyOutput: sensorData.energyOutput,
          sunlightIntensity: sensorData.sunlightIntensity,
          temperature: sensorData.temperature,
          dustLevel: sensorData.dustLevel,
          tiltAngle: sensorData.tiltAngle,
          efficiencyPercent: Math.min(100, Math.max(0, efficiencyPercent)),
        });

        savedReadings.push(reading);
      } catch (error) {
        console.error(`Error saving reading for ${sensorData.panelId}:`, error);
      }
    }

    // Broadcast real-time updates via WebSocket
    if (this.wsServer && savedReadings.length > 0) {
      // Send aggregated data for dashboard
      const totalEnergy = savedReadings.reduce((sum, r) => sum + r.energyOutput, 0);
      const avgEfficiency = savedReadings.reduce((sum, r) => sum + r.efficiencyPercent, 0) / savedReadings.length;

      // Broadcast aggregated sensor data via WebSocket
      this.wsServer.broadcast({
        type: 'aggregatedUpdate',
        data: {
          timestamp: new Date().toISOString(),
          totalPanels: savedReadings.length,
          totalEnergyOutput: totalEnergy,
          averageEfficiency: avgEfficiency,
          latestReadings: savedReadings.slice(0, 10), // Send sample of latest readings
        }
      });
    }

    console.log(`💾 Persisted ${savedReadings.length} sensor readings to storage`);
  }

  stop(): void {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Auto-persist service stopped');
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export const autoPersistService = new AutoPersistService();
