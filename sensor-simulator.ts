// Simulates IoT sensor data for solar panels
// Generates realistic sensor readings with environmental variations

export class SensorSimulator {
  private baselineEnergy: number = 250; // Base energy output in Watts
  private baselineSunlight: number = 800; // Base sunlight intensity in W/m²
  private panelVariations: Map<string, number> = new Map(); // Store panel-specific variations

  // Simple hash function to generate consistent numbers from panel IDs
  private hashPanelId(panelId: string): number {
    let hash = 0;
    for (let i = 0; i < panelId.length; i++) {
      const char = panelId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // Generate real-time sensor data for a specific panel
  generateSensorData(panelId?: string): {
    energyOutput: number;
    sunlightIntensity: number;
    temperature: number;
    dustLevel: number;
    dustStatus: string;
    tiltAngle: number;
    efficiencyPercent: number;
    currentLevelMA: number;
    powerOutputMW: number;
    overload: boolean;
    sweepEnable: boolean;
    autoMode: boolean;
  } {
    const hour = new Date().getHours();

    // Get panel-specific variation factor
    const panelVariation = panelId ? this.getPanelVariation(panelId) : 1.0;

    // Sunlight intensity varies by time of day
    const sunlightIntensity = this.calculateSunlightIntensity(hour, panelVariation);

    // Temperature correlates with sunlight but has its own pattern
    const temperature = this.calculateTemperature(hour, panelVariation);

    // Dust accumulates gradually over time (varies by panel)
    const dustLevel = this.calculateDustLevel(panelId);

    // Tilt angle (mostly static, but could be adjusted)
    const tiltAngle = 32 + (Math.random() - 0.5) * 2; // 31-33 degrees

    // Calculate effective sunlight after dust reduction
    const effectiveIntensity = sunlightIntensity * (1 - dustLevel / 10);

    // Calculate energy output based on conditions
    let energyOutput = this.baselineEnergy * (effectiveIntensity / this.baselineSunlight);

    // Temperature affects efficiency (optimal: 25°C, -0.5% per degree above)
    if (temperature > 25) {
      energyOutput *= 1 - ((temperature - 25) * 0.005);
    }

    // Add panel-specific variation
    energyOutput *= panelVariation;

    // Add some realistic noise
    energyOutput *= 1 + (Math.random() - 0.5) * 0.05; // +/- 2.5%

    // Calculate efficiency percentage
    const maxPossibleOutput = this.baselineEnergy * panelVariation;
    const efficiencyPercent = (energyOutput / maxPossibleOutput) * 100;

    // Defensive checks to prevent NaN
    const safeValue = (val: number, defaultVal: number) => 
      isNaN(val) || !isFinite(val) ? defaultVal : val;

    // Simulation of ESP32 logic
    const dustThreshold = 2000;
    const currentLimit = 800.0;
    
    // ESP32 dust detection simulation
    const dust = safeValue(Math.max(0, Math.min(4095, dustLevel * 400)), 1500); 
    const dustStatus = dust > dustThreshold ? "DUSTY / NIGHT" : "CLEAN / DAY";
    
    // Power and current simulation
    const current_mA = safeValue(Math.max(0, (energyOutput / 12) * 1000), 0); // Assuming 12V system
    const power_mW = safeValue(energyOutput * 1000, 0);
    const overload = current_mA > currentLimit;
    
    // Control logic
    const autoMode = true;
    const sweepEnable = autoMode && !overload && dust > dustThreshold;

    return {
      energyOutput: safeValue(Math.max(0, energyOutput), 0),
      sunlightIntensity: safeValue(Math.max(0, sunlightIntensity), 0),
      temperature: safeValue(Math.max(15, Math.min(50, temperature)), 25),
      dustLevel: dust,
      dustStatus: dustStatus,
      tiltAngle: safeValue(Math.max(0, Math.min(90, tiltAngle)), 32),
      efficiencyPercent: safeValue(Math.max(0, Math.min(100, efficiencyPercent)), 50),
      currentLevelMA: current_mA,
      powerOutputMW: power_mW,
      overload: overload,
      sweepEnable: sweepEnable,
      autoMode: autoMode,
    };
  }

  // Get or create panel-specific variation factor
  private getPanelVariation(panelId: string): number {
    if (!this.panelVariations.has(panelId)) {
      // Use hash to create a consistent variation for this panel (0.85 to 1.05)
      const hash = this.hashPanelId(panelId);
      const variation = 0.85 + (hash % 200) / 1000; // 0.85 to 1.05
      this.panelVariations.set(panelId, variation);
    }
    return this.panelVariations.get(panelId)!;
  }

  // Calculate sunlight intensity based on time of day
  private calculateSunlightIntensity(hour: number, variation: number = 1.0): number {
    // Peak sunlight at noon (12:00), minimal at night
    if (hour < 6 || hour >= 20) {
      return 0; // Night time
    }

    // Calculate sun elevation (simplified)
    const hoursFromNoon = Math.abs(hour - 12);
    const sunElevationFactor = Math.cos((hoursFromNoon / 6) * (Math.PI / 2));

    // Base intensity with sun elevation
    let intensity = this.baselineSunlight * sunElevationFactor;

    // Add weather variations (cloudy days, etc.)
    const weatherVariation = 1 + (Math.random() - 0.5) * 0.3; // +/- 15%
    intensity *= weatherVariation;

    // Add atmospheric effects
    const atmosphericNoise = (Math.random() - 0.5) * 50; // +/- 25 W/m²
    intensity += atmosphericNoise;

    // Apply panel-specific variation
    intensity *= variation;

    return Math.max(0, intensity);
  }

  // Calculate temperature based on time of day and season
  private calculateTemperature(hour: number, variation: number = 1.0): number {
    // Base temperature (varies by season - simplified)
    const baseTemp = 25;

    // Daily variation (warmer in afternoon)
    let dailyVariation = 0;
    if (hour >= 6 && hour < 12) {
      // Morning: gradually warming
      dailyVariation = ((hour - 6) / 6) * 10;
    } else if (hour >= 12 && hour < 18) {
      // Afternoon: peak heat then cooling
      dailyVariation = 10 - ((hour - 12) / 6) * 6;
    } else if (hour >= 18 && hour < 22) {
      // Evening: cooling down
      dailyVariation = 4 - ((hour - 18) / 4) * 4;
    } else {
      // Night: cool
      dailyVariation = -2;
    }

    // Random weather variations
    const randomVariation = (Math.random() - 0.5) * 5; // +/- 2.5°C

    // Panel-specific variation (some panels run hotter)
    const panelTempVariation = (variation - 1) * 5;

    return baseTemp + dailyVariation + randomVariation + panelTempVariation;
  }

  // Calculate dust level (accumulates over time, random events)
  private calculateDustLevel(panelId?: string): number {
    // Simulate gradual dust accumulation
    const baseDust = 2;
    
    // Panel-specific dust accumulation rate
    let dustMultiplier = 1.0;
    if (panelId) {
      // Use hash to create consistent but varied dust levels
      const hash = this.hashPanelId(panelId);
      dustMultiplier = 0.7 + (hash % 90) / 100; // 0.7 to 1.6
    }
    
    const randomDust = Math.random() * 4 * dustMultiplier;

    // Occasional dust events (wind, pollution)
    if (Math.random() < 0.05) {
      return Math.min(10, baseDust + randomDust + 3); // Dust event
    }

    return Math.min(10, baseDust + randomDust);
  }

  // Alias method for backward compatibility
  generateReading(panelId?: string) {
    return this.generateSensorData(panelId);
  }

  // Generate historical data for charts for a specific panel
  generateHistoricalData(hours: number, panelId?: string): Array<{
    timestamp: Date;
    energyOutput: number;
    sunlightIntensity: number;
    temperature: number;
    dustLevel: number;
    tiltAngle: number;
    efficiencyPercent: number;
  }> {
    const data = [];
    const now = new Date();
    const panelVariation = panelId ? this.getPanelVariation(panelId) : 1.0;

    for (let i = hours * 12; i >= 0; i--) {
      // Generate data every 5 minutes
      const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000);
      const hour = timestamp.getHours();

      // Generate sensor data for that time
      const sunlightIntensity = this.calculateSunlightIntensity(hour, panelVariation);
      const temperature = this.calculateTemperature(hour, panelVariation);
      const dustLevel = this.calculateDustLevel(panelId);
      const tiltAngle = 32 + (Math.random() - 0.5) * 2;

      const effectiveIntensity = sunlightIntensity * (1 - dustLevel / 10);
      let energyOutput = this.baselineEnergy * (effectiveIntensity / this.baselineSunlight);

      if (temperature > 25) {
        energyOutput *= 1 - ((temperature - 25) * 0.005);
      }

      energyOutput *= panelVariation;
      energyOutput *= 1 + (Math.random() - 0.5) * 0.05;

      const maxPossibleOutput = this.baselineEnergy * panelVariation;
      const efficiencyPercent = (energyOutput / maxPossibleOutput) * 100;

      data.push({
        timestamp,
        energyOutput: Math.max(0, energyOutput),
        sunlightIntensity: Math.max(0, sunlightIntensity),
        temperature: Math.max(15, Math.min(50, temperature)),
        dustLevel: Math.max(0, Math.min(10, dustLevel)),
        tiltAngle: Math.max(0, Math.min(90, tiltAngle)),
        efficiencyPercent: Math.max(0, Math.min(100, efficiencyPercent)),
      });
    }

    return data;
  }

  // Generate readings for specific panel IDs (accepts actual panel IDs from storage)
  generateReadingsForPanels(panelIds: string[]): Map<string, ReturnType<typeof this.generateSensorData>> {
    const readings = new Map();
    
    for (const panelId of panelIds) {
      readings.set(panelId, this.generateSensorData(panelId));
    }
    
    return readings;
  }
}

export const sensorSimulator = new SensorSimulator();
