
// Wokwi IoT Simulator Integration
// Simulates real hardware sensors using virtual ESP32/Arduino

import { EventEmitter } from 'events';

export interface WokwiSensorData {
  panelId: string;
  energyOutput: number;
  sunlightIntensity: number;
  temperature: number;
  dustLevel: number;
  tiltAngle: number;
  voltage: number;
  current: number;
  timestamp: Date;
}

export class WokwiSimulator extends EventEmitter {
  private isConnected: boolean = false;
  private simulationInterval: NodeJS.Timeout | null = null;
  private panels: Map<string, WokwiSensorData> = new Map();

  constructor() {
    super();
  }

  // Connect to Wokwi virtual hardware
  async connect(): Promise<void> {
    console.log('🔌 Connecting to Wokwi IoT Simulator...');
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.isConnected = true;
    console.log('✅ Connected to Wokwi IoT Simulator');
    
    // Start real-time data streaming
    this.startDataStream();
  }

  // Simulate real hardware sensor readings from ESP32/Arduino
  private generateHardwareSensorData(panelId: string): WokwiSensorData {
    const hour = new Date().getHours();
    
    // Simulate actual hardware ADC readings (0-4095 for ESP32)
    const adcSunlight = hour >= 6 && hour <= 18 
      ? 2000 + Math.random() * 2000 
      : Math.random() * 200;
    
    const adcVoltage = 2500 + Math.random() * 1500; // 12V solar panel
    const adcCurrent = 1000 + Math.random() * 500;  // Current sensor
    const adcTemp = 1800 + Math.random() * 400;     // LM35 temperature
    const adcDust = Math.random() * 1000;           // Dust sensor
    
    // Convert ADC readings to actual values (like real hardware would)
    const sunlightIntensity = (adcSunlight / 4095) * 1000; // W/m²
    const voltage = (adcVoltage / 4095) * 20;              // Volts
    const current = (adcCurrent / 4095) * 5;               // Amperes
    const temperature = (adcTemp / 4095) * 100;            // Celsius
    const dustLevel = (adcDust / 4095) * 10;               // 0-10 scale
    
    const energyOutput = voltage * current; // P = V * I
    const efficiencyPercent = (energyOutput / 250) * 100; // Based on 250W nominal
    
    return {
      panelId,
      energyOutput: Math.max(0, energyOutput),
      sunlightIntensity: Math.max(0, sunlightIntensity),
      temperature: Math.max(15, Math.min(60, temperature)),
      dustLevel: Math.max(0, Math.min(10, dustLevel)),
      tiltAngle: 32 + (Math.random() - 0.5) * 2,
      voltage: Math.max(0, voltage),
      current: Math.max(0, current),
      timestamp: new Date(),
    };
  }

  // Start streaming data from virtual hardware
  private startDataStream(): void {
    // Simulate real-time sensor updates every 2 seconds (like actual IoT devices)
    this.simulationInterval = setInterval(() => {
      if (!this.isConnected) return;
      
      // Update all panels
      for (let i = 1; i <= 200; i++) {
        const panelId = `panel-${i}`;
        const sensorData = this.generateHardwareSensorData(panelId);
        this.panels.set(panelId, sensorData);
        
        // Emit real-time event
        this.emit('sensorData', sensorData);
      }
    }, 10000); // Update every 10 seconds instead of 2 seconds to reduce CPU load
  }

  // Get current sensor reading for a panel
  getSensorData(panelId: string): WokwiSensorData | undefined {
    return this.panels.get(panelId);
  }

  // Get all panels data
  getAllSensorData(): WokwiSensorData[] {
    return Array.from(this.panels.values());
  }

  // Disconnect from simulator
  disconnect(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.isConnected = false;
    console.log('🔌 Disconnected from Wokwi IoT Simulator');
  }

  // Check connection status
  isSimulatorConnected(): boolean {
    return this.isConnected;
  }
}

export const wokwiSimulator = new WokwiSimulator();
