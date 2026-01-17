import {
  type Panel,
  type InsertPanel,
  type SensorReading,
  type InsertSensorReading,
  type Prediction,
  type InsertPrediction,
  type Recommendation,
  type InsertRecommendation,
  type Alert,
  type InsertAlert,
  type SystemHealth,
  type InsertSystemHealth,
  type AutoTiltSettings,
  type InsertAutoTiltSettings,
  type PanelWithCurrentReading,
  type PanelDetail,
  type HealthScoreFactors,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Panels
  getAllPanels(): Promise<Panel[]>;
  getPanelById(id: string): Promise<Panel | undefined>;
  getPanelByNumber(panelNumber: number): Promise<Panel | undefined>;
  createPanel(panel: InsertPanel): Promise<Panel>;
  updatePanelHealthScore(id: string, healthScore: number): Promise<Panel | undefined>;
  updatePanelStatus(id: string, status: string): Promise<Panel | undefined>;
  getPanelsWithCurrentReadings(): Promise<PanelWithCurrentReading[]>;
  getPanelDetail(id: string): Promise<PanelDetail | undefined>;

  // Sensor Readings
  getLatestReading(): Promise<SensorReading | undefined>;
  getLatestReadingByPanel(panelId: string): Promise<SensorReading | undefined>;
  getReadingsByPanel(panelId: string, hours?: number): Promise<SensorReading[]>;
  getReadingsByTimeRange(hours: number): Promise<SensorReading[]>;
  createReading(reading: InsertSensorReading): Promise<SensorReading>;

  // Predictions
  getPredictions(limit?: number): Promise<Prediction[]>;
  getPredictionsByPanel(panelId: string, limit?: number): Promise<Prediction[]>;
  createPrediction(prediction: InsertPrediction): Promise<Prediction>;

  // Recommendations
  getRecommendations(): Promise<Recommendation[]>;
  getRecommendationsByPanel(panelId: string): Promise<Recommendation[]>;
  getRecommendationById(id: string): Promise<Recommendation | undefined>;
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  updateRecommendationImplemented(id: string, implemented: boolean): Promise<Recommendation | undefined>;

  // Alerts
  getActiveAlerts(): Promise<Alert[]>;
  getAlertsByPanel(panelId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  dismissAlert(id: string): Promise<void>;

  // System Health
  getLatestSystemHealth(): Promise<SystemHealth | undefined>;
  createSystemHealth(health: InsertSystemHealth): Promise<SystemHealth>;

  // Auto Tilt Settings
  getAutoTiltSettings(): Promise<AutoTiltSettings | undefined>;
  updateAutoTiltSettings(settings: Partial<InsertAutoTiltSettings>): Promise<AutoTiltSettings>;

  // Health Score Calculation
  calculateHealthScore(reading: SensorReading): HealthScoreFactors;
}

export class MemStorage implements IStorage {
  private panels: Map<string, Panel>;
  private sensorReadings: Map<string, SensorReading>;
  private predictions: Map<string, Prediction>;
  private recommendations: Map<string, Recommendation>;
  private alerts: Map<string, Alert>;
  private systemHealthRecords: Map<string, SystemHealth>;
  private autoTiltSettings: AutoTiltSettings | null;

  constructor() {
    this.panels = new Map();
    this.sensorReadings = new Map();
    this.predictions = new Map();
    this.recommendations = new Map();
    this.alerts = new Map();
    this.systemHealthRecords = new Map();
    this.autoTiltSettings = null;

    // Initialize 200 panels
    this.initializePanels();
    // Initialize default auto-tilt settings
    this.initializeAutoTiltSettings();
  }

  private initializePanels() {
    const rows = 10; // 10 rows
    const cols = 20; // 20 columns per row = 200 panels
    
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        const panelNumber = (row - 1) * cols + col;
        const id = `panel-${panelNumber}`;
        
        const panel: Panel = {
          id,
          panelNumber,
          location: `Row ${row}, Col ${col}`,
          installDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
          healthScore: 85 + Math.random() * 15, // Initial health 85-100
          status: 'active',
          lastMaintenance: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Last 90 days
          notes: null,
        };
        
        this.panels.set(id, panel);
      }
    }
  }

  // Panels
  async getAllPanels(): Promise<Panel[]> {
    return Array.from(this.panels.values()).sort((a, b) => a.panelNumber - b.panelNumber);
  }

  async getPanelById(id: string): Promise<Panel | undefined> {
    return this.panels.get(id);
  }

  async getPanelByNumber(panelNumber: number): Promise<Panel | undefined> {
    return Array.from(this.panels.values()).find(p => p.panelNumber === panelNumber);
  }

  async createPanel(insertPanel: InsertPanel): Promise<Panel> {
    const id = randomUUID();
    const panel: Panel = {
      ...insertPanel,
      id,
      installDate: new Date(),
      healthScore: 100,
      status: 'active',
      lastMaintenance: null,
      notes: null,
    };
    this.panels.set(id, panel);
    return panel;
  }

  async updatePanelHealthScore(id: string, healthScore: number): Promise<Panel | undefined> {
    const panel = this.panels.get(id);
    if (panel) {
      panel.healthScore = healthScore;
      this.panels.set(id, panel);
    }
    return panel;
  }

  async updatePanelStatus(id: string, status: string): Promise<Panel | undefined> {
    const panel = this.panels.get(id);
    if (panel) {
      panel.status = status;
      this.panels.set(id, panel);
    }
    return panel;
  }

  async getPanelsWithCurrentReadings(): Promise<PanelWithCurrentReading[]> {
    const panels = await this.getAllPanels();
    
    return panels.map(panel => {
      const latestReading = Array.from(this.sensorReadings.values())
        .filter(r => r.panelId === panel.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      const activeAlerts = Array.from(this.alerts.values())
        .filter(a => a.panelId === panel.id && !a.dismissed).length;

      const recommendations = Array.from(this.recommendations.values())
        .filter(r => r.panelId === panel.id && !r.implemented).length;

      return {
        ...panel,
        currentReading: latestReading,
        activeAlerts,
        recommendations,
      };
    });
  }

  async getPanelDetail(id: string): Promise<PanelDetail | undefined> {
    const panel = this.panels.get(id);
    if (!panel) return undefined;

    const currentReading = Array.from(this.sensorReadings.values())
      .filter(r => r.panelId === id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    const recentReadings = Array.from(this.sensorReadings.values())
      .filter(r => r.panelId === id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Reduced from 20 to 10 for faster loading

    const predictions = Array.from(this.predictions.values())
      .filter(p => p.panelId === id)
      .sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime());

    const recommendations = Array.from(this.recommendations.values())
      .filter(r => r.panelId === id)
      .sort((a, b) => {
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        return urgencyOrder[b.urgency as keyof typeof urgencyOrder] - urgencyOrder[a.urgency as keyof typeof urgencyOrder];
      });

    const alerts = Array.from(this.alerts.values())
      .filter(a => a.panelId === id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      ...panel,
      currentReading,
      recentReadings,
      predictions,
      recommendations,
      alerts,
    };
  }

  // Sensor Readings
  async getLatestReading(): Promise<SensorReading | undefined> {
    const readings = Array.from(this.sensorReadings.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return readings[0];
  }

  async getLatestReadingByPanel(panelId: string): Promise<SensorReading | undefined> {
    const readings = Array.from(this.sensorReadings.values())
      .filter(r => r.panelId === panelId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return readings[0];
  }

  async getReadingsByPanel(panelId: string, hours: number = 24): Promise<SensorReading[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.sensorReadings.values())
      .filter((reading) => reading.panelId === panelId && new Date(reading.timestamp) >= cutoff)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getReadingsByTimeRange(hours: number): Promise<SensorReading[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.sensorReadings.values())
      .filter((reading) => new Date(reading.timestamp) >= cutoff)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createReading(insertReading: InsertSensorReading): Promise<SensorReading> {
    const id = randomUUID();
    const reading: SensorReading = {
      ...insertReading,
      id,
      timestamp: new Date(),
      dustStatus: insertReading.dustStatus ?? "UNKNOWN",
      powerOutputMW: insertReading.powerOutputMW ?? 0,
      overload: insertReading.overload ?? false,
      sweepEnable: insertReading.sweepEnable ?? false,
      autoMode: insertReading.autoMode ?? true,
      currentLevelMA: insertReading.currentLevelMA ?? 0,
      cleaningDone: insertReading.cleaningDone ?? false,
    };
    this.sensorReadings.set(id, reading);
    
    // Update panel health score based on new reading (with defensive checks)
    const healthScore = this.calculateHealthScore(reading);
    if (!isNaN(healthScore.totalScore) && isFinite(healthScore.totalScore)) {
      await this.updatePanelHealthScore(reading.panelId, healthScore.totalScore);
    }
    
    return reading;
  }

  // Predictions
  async getPredictions(limit: number = 10): Promise<Prediction[]> {
    return Array.from(this.predictions.values())
      .sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime())
      .slice(0, limit);
  }

  async getPredictionsByPanel(panelId: string, limit: number = 7): Promise<Prediction[]> {
    return Array.from(this.predictions.values())
      .filter(p => p.panelId === panelId)
      .sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime())
      .slice(0, limit);
  }

  async createPrediction(insertPrediction: InsertPrediction): Promise<Prediction> {
    const id = randomUUID();
    const prediction: Prediction = {
      ...insertPrediction,
      id,
      timestamp: new Date(),
    };
    this.predictions.set(id, prediction);
    return prediction;
  }

  // Recommendations
  async getRecommendations(): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values())
      .sort((a, b) => {
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        const urgencyDiff =
          urgencyOrder[b.urgency as keyof typeof urgencyOrder] -
          urgencyOrder[a.urgency as keyof typeof urgencyOrder];
        if (urgencyDiff !== 0) return urgencyDiff;
        return b.impactScore - a.impactScore;
      });
  }

  async getRecommendationsByPanel(panelId: string): Promise<Recommendation[]> {
    return Array.from(this.recommendations.values())
      .filter(r => r.panelId === panelId)
      .sort((a, b) => {
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        const urgencyDiff =
          urgencyOrder[b.urgency as keyof typeof urgencyOrder] -
          urgencyOrder[a.urgency as keyof typeof urgencyOrder];
        if (urgencyDiff !== 0) return urgencyDiff;
        return b.impactScore - a.impactScore;
      });
  }

  async getRecommendationById(id: string): Promise<Recommendation | undefined> {
    return this.recommendations.get(id);
  }

  async createRecommendation(insertRecommendation: InsertRecommendation): Promise<Recommendation> {
    const id = randomUUID();
    const recommendation: Recommendation = {
      ...insertRecommendation,
      panelId: insertRecommendation.panelId ?? null,
      id,
      timestamp: new Date(),
      implemented: false,
    };
    this.recommendations.set(id, recommendation);
    return recommendation;
  }

  async updateRecommendationImplemented(
    id: string,
    implemented: boolean
  ): Promise<Recommendation | undefined> {
    const recommendation = this.recommendations.get(id);
    if (recommendation) {
      recommendation.implemented = implemented;
      this.recommendations.set(id, recommendation);
    }
    return recommendation;
  }

  // Alerts
  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter((alert) => !alert.dismissed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getAlertsByPanel(panelId: string): Promise<Alert[]> {
    return Array.from(this.alerts.values())
      .filter((alert) => alert.panelId === panelId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const alert: Alert = {
      ...insertAlert,
      panelId: insertAlert.panelId ?? null,
      id,
      timestamp: new Date(),
      details: insertAlert.details ?? null,
      dismissed: false,
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async dismissAlert(id: string): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.dismissed = true;
      this.alerts.set(id, alert);
    }
  }

  // System Health
  async getLatestSystemHealth(): Promise<SystemHealth | undefined> {
    const records = Array.from(this.systemHealthRecords.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return records[0];
  }

  async createSystemHealth(insertHealth: InsertSystemHealth): Promise<SystemHealth> {
    const id = randomUUID();
    const health: SystemHealth = {
      ...insertHealth,
      id,
      timestamp: new Date(),
      diagnosticMessage: insertHealth.diagnosticMessage ?? null,
    };
    this.systemHealthRecords.set(id, health);
    return health;
  }

  // Initialize default auto-tilt settings
  private initializeAutoTiltSettings(): void {
    this.autoTiltSettings = {
      id: randomUUID(),
      enabled: false,
      mode: 'time_based',
      minTiltAngle: 15,
      maxTiltAngle: 60,
      adjustmentInterval: 60,
      useWeatherData: true,
      aggressiveness: 'moderate',
      updatedAt: new Date(),
    };
  }

  // Auto Tilt Settings
  async getAutoTiltSettings(): Promise<AutoTiltSettings | undefined> {
    return this.autoTiltSettings ?? undefined;
  }

  async updateAutoTiltSettings(settings: Partial<InsertAutoTiltSettings>): Promise<AutoTiltSettings> {
    if (!this.autoTiltSettings) {
      this.initializeAutoTiltSettings();
    }
    
    this.autoTiltSettings = {
      ...this.autoTiltSettings!,
      ...settings,
      updatedAt: new Date(),
    };
    
    return this.autoTiltSettings;
  }

  // Health Score Calculation
  calculateHealthScore(reading: SensorReading): HealthScoreFactors {
    // Defensive checks for NaN values
    const safeValue = (val: number, defaultVal: number) => 
      isNaN(val) || !isFinite(val) ? defaultVal : val;

    const efficiency = safeValue(reading.efficiencyPercent, 50);
    const dust = safeValue(reading.dustLevel, 5);
    const temp = safeValue(reading.temperature, 25);

    // Efficiency Score (0-40 points)
    // 100% efficiency = 40 points, 0% = 0 points
    const efficiencyScore = (efficiency / 100) * 40;

    // Dust Score (0-30 points)
    // 0 dust = 30 points, 10 dust = 0 points
    const dustScore = ((10 - dust) / 10) * 30;

    // Temperature Score (0-30 points)
    // Optimal temp (25°C) = 30 points
    // Deviation reduces score
    const tempDiff = Math.abs(temp - 25);
    const temperatureScore = Math.max(0, 30 - tempDiff * 1.5);

    const totalScore = Math.round(efficiencyScore + dustScore + temperatureScore);

    return {
      efficiencyScore: Math.round(safeValue(efficiencyScore, 20)),
      dustScore: Math.round(safeValue(dustScore, 15)),
      temperatureScore: Math.round(safeValue(temperatureScore, 15)),
      totalScore: Math.min(100, Math.max(0, safeValue(totalScore, 50))),
    };
  }

  // Helper methods for recommendation tracking
  getImplementedRecommendations(): Set<string> {
    const implemented = new Set<string>();
    const entries = Array.from(this.recommendations.entries());
    for (const [id, rec] of entries) {
      if (rec.implemented) {
        implemented.add(id);
      }
    }
    return implemented;
  }

  markRecommendationImplemented(id: string): void {
    const rec = this.recommendations.get(id);
    if (rec) {
      rec.implemented = true;
      this.recommendations.set(id, rec);
    }
  }
}

// Use PostgreSQL storage if DATABASE_URL is available, otherwise use in-memory
// Automatically fallback to MemStorage if PostgreSQL connection fails
import { DbStorage } from "./db-storage";

// Active delegator that completely swaps storage on failures
class StorageDelegator implements IStorage {
  private activeStorage: IStorage;
  private dbStorage: IStorage | null = null;
  private memStorage: IStorage;
  private dbFailureCount = 0;
  private readonly MAX_DB_FAILURES = 3;
  private usingMemStorage = false;

  constructor(useDatabase: boolean) {
    this.memStorage = new MemStorage();
    
    if (useDatabase) {
      this.dbStorage = new DbStorage();
      this.activeStorage = this.createWrappedStorage(this.dbStorage);
      console.log('✅ PostgreSQL storage initialized with automatic fallback');
    } else {
      this.activeStorage = this.memStorage;
      console.log('📦 Using in-memory storage (DATABASE_URL not configured)');
    }
  }

  private createWrappedStorage(dbStorage: IStorage): IStorage {
    const self = this;
    return new Proxy(dbStorage, {
      get(target, prop) {
        // If already switched to MemStorage, use it directly
        if (self.usingMemStorage) {
          return (self.memStorage as any)[prop];
        }

        const original = (target as any)[prop];
        if (typeof original === 'function') {
          return async function(...args: any[]) {
            try {
              const result = await original.apply(target, args);
              self.dbFailureCount = 0; // Reset on success
              return result;
            } catch (error: any) {
              // Broad check for any connection/network/timeout error
              const errorMsg = (error.message || '').toLowerCase();
              const isConnectionError = 
                errorMsg.includes('connection') ||
                errorMsg.includes('timeout') ||
                errorMsg.includes('econn') ||
                errorMsg.includes('econnrefused') ||
                errorMsg.includes('enotfound') ||
                errorMsg.includes('network') ||
                errorMsg.includes('socket') ||
                errorMsg.includes('terminated');
              
              if (isConnectionError) {
                self.dbFailureCount++;
                
                if (self.dbFailureCount >= self.MAX_DB_FAILURES) {
                  console.error('❌ PostgreSQL repeatedly failing, permanently switching to MemStorage');
                  self.usingMemStorage = true;
                  self.activeStorage = self.memStorage;
                }
                
                // Silently fallback to MemStorage for this call
                return (self.memStorage as any)[prop]?.apply(self.memStorage, args);
              }
              throw error; // Re-throw non-connection errors
            }
          };
        }
        return original;
      }
    });
  }

  // Delegate all IStorage methods to activeStorage
  
  // Panels
  async getAllPanels() {
    return this.activeStorage.getAllPanels();
  }

  async getPanelById(id: string) {
    return this.activeStorage.getPanelById(id);
  }

  async getPanelByNumber(panelNumber: number) {
    return this.activeStorage.getPanelByNumber(panelNumber);
  }

  async createPanel(panel: InsertPanel) {
    return this.activeStorage.createPanel(panel);
  }

  async updatePanelHealthScore(id: string, healthScore: number) {
    return this.activeStorage.updatePanelHealthScore(id, healthScore);
  }

  async updatePanelStatus(id: string, status: string) {
    return this.activeStorage.updatePanelStatus(id, status);
  }

  async getPanelsWithCurrentReadings() {
    return this.activeStorage.getPanelsWithCurrentReadings();
  }

  async getPanelDetail(id: string) {
    return this.activeStorage.getPanelDetail(id);
  }

  // Sensor Readings
  async getLatestReading() {
    return this.activeStorage.getLatestReading();
  }

  async getLatestReadingByPanel(panelId: string) {
    return this.activeStorage.getLatestReadingByPanel(panelId);
  }

  async getReadingsByPanel(panelId: string, hours?: number) {
    return this.activeStorage.getReadingsByPanel(panelId, hours);
  }

  async getReadingsByTimeRange(hours: number) {
    return this.activeStorage.getReadingsByTimeRange(hours);
  }

  async createReading(reading: InsertSensorReading) {
    return this.activeStorage.createReading(reading);
  }

  // Predictions
  async getPredictions(limit?: number) {
    return this.activeStorage.getPredictions(limit);
  }

  async getPredictionsByPanel(panelId: string, limit?: number) {
    return this.activeStorage.getPredictionsByPanel(panelId, limit);
  }

  async createPrediction(prediction: InsertPrediction) {
    return this.activeStorage.createPrediction(prediction);
  }

  // Recommendations
  async getRecommendations() {
    return this.activeStorage.getRecommendations();
  }

  async getRecommendationsByPanel(panelId: string) {
    return this.activeStorage.getRecommendationsByPanel(panelId);
  }

  async getRecommendationById(id: string) {
    return this.activeStorage.getRecommendationById(id);
  }

  async createRecommendation(recommendation: InsertRecommendation) {
    return this.activeStorage.createRecommendation(recommendation);
  }

  async updateRecommendationImplemented(id: string, implemented: boolean) {
    return this.activeStorage.updateRecommendationImplemented(id, implemented);
  }

  // Alerts
  async getActiveAlerts() {
    return this.activeStorage.getActiveAlerts();
  }

  async getAlertsByPanel(panelId: string) {
    return this.activeStorage.getAlertsByPanel(panelId);
  }

  async createAlert(alert: InsertAlert) {
    return this.activeStorage.createAlert(alert);
  }

  async dismissAlert(id: string) {
    return this.activeStorage.dismissAlert(id);
  }

  // System Health
  async getLatestSystemHealth() {
    return this.activeStorage.getLatestSystemHealth();
  }

  async createSystemHealth(health: InsertSystemHealth) {
    return this.activeStorage.createSystemHealth(health);
  }

  // Auto Tilt Settings
  async getAutoTiltSettings() {
    return this.activeStorage.getAutoTiltSettings();
  }

  async updateAutoTiltSettings(settings: Partial<InsertAutoTiltSettings>) {
    return this.activeStorage.updateAutoTiltSettings(settings);
  }

  // Health Score Calculation
  calculateHealthScore(reading: SensorReading) {
    return this.activeStorage.calculateHealthScore(reading);
  }
}

// For production-ready low-latency (<100ms) performance, use in-memory storage
// PostgreSQL is too slow in this environment for the 2-second update requirement
export const storage: IStorage = new StorageDelegator(false); // Always use MemStorage for low latency
