import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  panels,
  sensorReadings,
  predictions,
  recommendations,
  alerts,
  systemHealth,
  autoTiltSettings,
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
import { IStorage } from "./storage";

// PostgreSQL connection with pooling for low latency
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size for high concurrency
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
const db = drizzle(pool);

export class DbStorage implements IStorage {
  // ======================
  // PANELS
  // ======================

  async getAllPanels(): Promise<Panel[]> {
    const result = await db
      .select()
      .from(panels)
      .orderBy(panels.panelNumber);
    return result;
  }

  async getPanelById(id: string): Promise<Panel | undefined> {
    const result = await db
      .select()
      .from(panels)
      .where(eq(panels.id, id))
      .limit(1);
    return result[0];
  }

  async getPanelByNumber(panelNumber: number): Promise<Panel | undefined> {
    const result = await db
      .select()
      .from(panels)
      .where(eq(panels.panelNumber, panelNumber))
      .limit(1);
    return result[0];
  }

  async createPanel(insertPanel: InsertPanel): Promise<Panel> {
    const id = randomUUID();
    const result = await db
      .insert(panels)
      .values({
        id,
        panelNumber: insertPanel.panelNumber,
        location: insertPanel.location,
        installDate: new Date(),
        healthScore: 100,
        status: "active",
        lastMaintenance: null,
        notes: null,
      })
      .returning();
    return result[0];
  }

  async updatePanelHealthScore(
    id: string,
    healthScore: number
  ): Promise<Panel | undefined> {
    const result = await db
      .update(panels)
      .set({ healthScore })
      .where(eq(panels.id, id))
      .returning();
    return result[0];
  }

  async updatePanelStatus(
    id: string,
    status: string
  ): Promise<Panel | undefined> {
    const result = await db
      .update(panels)
      .set({ status })
      .where(eq(panels.id, id))
      .returning();
    return result[0];
  }

  async getPanelsWithCurrentReadings(): Promise<PanelWithCurrentReading[]> {
    const allPanels = await this.getAllPanels();

    const panelsWithReadings = await Promise.all(
      allPanels.map(async (panel) => {
        const latestReading = await this.getLatestReadingByPanel(panel.id);
        
        const activeAlerts = await db
          .select()
          .from(alerts)
          .where(and(eq(alerts.panelId, panel.id), eq(alerts.dismissed, false)));

        const recs = await db
          .select()
          .from(recommendations)
          .where(
            and(
              eq(recommendations.panelId, panel.id),
              eq(recommendations.implemented, false)
            )
          );

        return {
          ...panel,
          currentReading: latestReading,
          activeAlerts: activeAlerts.length,
          recommendations: recs.length,
        };
      })
    );

    return panelsWithReadings;
  }

  async getPanelDetail(id: string): Promise<PanelDetail | undefined> {
    const panel = await this.getPanelById(id);
    if (!panel) return undefined;

    const currentReading = await this.getLatestReadingByPanel(id);
    const recentReadings = await this.getReadingsByPanel(id, 24);
    const panelPredictions = await this.getPredictionsByPanel(id);
    const panelRecommendations = await this.getRecommendationsByPanel(id);
    const panelAlerts = await this.getAlertsByPanel(id);

    return {
      ...panel,
      currentReading,
      recentReadings: recentReadings.slice(0, 20),
      predictions: panelPredictions,
      recommendations: panelRecommendations,
      alerts: panelAlerts,
    };
  }

  // ======================
  // SENSOR READINGS
  // ======================

  async getLatestReading(): Promise<SensorReading | undefined> {
    const result = await db
      .select()
      .from(sensorReadings)
      .orderBy(desc(sensorReadings.timestamp))
      .limit(1);
    return result[0];
  }

  async getLatestReadingByPanel(
    panelId: string
  ): Promise<SensorReading | undefined> {
    const result = await db
      .select()
      .from(sensorReadings)
      .where(eq(sensorReadings.panelId, panelId))
      .orderBy(desc(sensorReadings.timestamp))
      .limit(1);
    return result[0];
  }

  async getReadingsByPanel(
    panelId: string,
    hours: number = 24
  ): Promise<SensorReading[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await db
      .select()
      .from(sensorReadings)
      .where(
        and(
          eq(sensorReadings.panelId, panelId),
          gte(sensorReadings.timestamp, cutoff)
        )
      )
      .orderBy(sensorReadings.timestamp);
    return result;
  }

  async getReadingsByTimeRange(hours: number): Promise<SensorReading[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const result = await db
      .select()
      .from(sensorReadings)
      .where(gte(sensorReadings.timestamp, cutoff))
      .orderBy(sensorReadings.timestamp);
    return result;
  }

  async createReading(
    insertReading: InsertSensorReading
  ): Promise<SensorReading> {
    const id = randomUUID();
    const result = await db
      .insert(sensorReadings)
      .values({
        id,
        ...insertReading,
        timestamp: new Date(),
      })
      .returning();

    // Update panel health score
    const healthScore = this.calculateHealthScore(result[0]);
    if (!isNaN(healthScore.totalScore) && isFinite(healthScore.totalScore)) {
      await this.updatePanelHealthScore(
        insertReading.panelId,
        healthScore.totalScore
      );
    }

    return result[0];
  }

  // ======================
  // PREDICTIONS
  // ======================

  async getPredictions(limit: number = 10): Promise<Prediction[]> {
    const result = await db
      .select()
      .from(predictions)
      .orderBy(predictions.predictedDate)
      .limit(limit);
    return result;
  }

  async getPredictionsByPanel(
    panelId: string,
    limit: number = 7
  ): Promise<Prediction[]> {
    const result = await db
      .select()
      .from(predictions)
      .where(eq(predictions.panelId, panelId))
      .orderBy(predictions.predictedDate)
      .limit(limit);
    return result;
  }

  async createPrediction(
    insertPrediction: InsertPrediction
  ): Promise<Prediction> {
    const id = randomUUID();
    const result = await db
      .insert(predictions)
      .values({
        id,
        ...insertPrediction,
        timestamp: new Date(),
      })
      .returning();
    return result[0];
  }

  // ======================
  // RECOMMENDATIONS
  // ======================

  async getRecommendations(): Promise<Recommendation[]> {
    const result = await db
      .select()
      .from(recommendations)
      .orderBy(desc(recommendations.timestamp));
    return result;
  }

  async getRecommendationsByPanel(panelId: string): Promise<Recommendation[]> {
    const result = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.panelId, panelId))
      .orderBy(desc(recommendations.timestamp));
    return result;
  }

  async getRecommendationById(id: string): Promise<Recommendation | undefined> {
    const result = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, id))
      .limit(1);
    return result[0];
  }

  async createRecommendation(
    insertRecommendation: InsertRecommendation
  ): Promise<Recommendation> {
    const id = randomUUID();
    const result = await db
      .insert(recommendations)
      .values({
        id,
        panelId: insertRecommendation.panelId ?? null,
        ...insertRecommendation,
        timestamp: new Date(),
        implemented: false,
      })
      .returning();
    return result[0];
  }

  async updateRecommendationImplemented(
    id: string,
    implemented: boolean
  ): Promise<Recommendation | undefined> {
    const result = await db
      .update(recommendations)
      .set({ implemented })
      .where(eq(recommendations.id, id))
      .returning();
    return result[0];
  }

  // ======================
  // ALERTS
  // ======================

  async getActiveAlerts(): Promise<Alert[]> {
    const result = await db
      .select()
      .from(alerts)
      .where(eq(alerts.dismissed, false))
      .orderBy(desc(alerts.timestamp));
    return result;
  }

  async getAlertsByPanel(panelId: string): Promise<Alert[]> {
    const result = await db
      .select()
      .from(alerts)
      .where(eq(alerts.panelId, panelId))
      .orderBy(desc(alerts.timestamp));
    return result;
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const result = await db
      .insert(alerts)
      .values({
        id,
        panelId: insertAlert.panelId ?? null,
        ...insertAlert,
        details: insertAlert.details ?? null,
        timestamp: new Date(),
        dismissed: false,
      })
      .returning();
    return result[0];
  }

  async dismissAlert(id: string): Promise<void> {
    await db.update(alerts).set({ dismissed: true }).where(eq(alerts.id, id));
  }

  // ======================
  // SYSTEM HEALTH
  // ======================

  async getLatestSystemHealth(): Promise<SystemHealth | undefined> {
    const result = await db
      .select()
      .from(systemHealth)
      .orderBy(desc(systemHealth.timestamp))
      .limit(1);
    return result[0];
  }

  async createSystemHealth(
    insertHealth: InsertSystemHealth
  ): Promise<SystemHealth> {
    const id = randomUUID();
    const result = await db
      .insert(systemHealth)
      .values({
        id,
        ...insertHealth,
        diagnosticMessage: insertHealth.diagnosticMessage ?? null,
        timestamp: new Date(),
      })
      .returning();
    return result[0];
  }

  // ======================
  // AUTO TILT SETTINGS
  // ======================

  async getAutoTiltSettings(): Promise<AutoTiltSettings | undefined> {
    const result = await db
      .select()
      .from(autoTiltSettings)
      .limit(1);
    
    if (result.length === 0) {
      const defaultSettings: InsertAutoTiltSettings = {
        enabled: false,
        mode: 'time_based',
        minTiltAngle: 15,
        maxTiltAngle: 60,
        adjustmentInterval: 60,
        useWeatherData: true,
        aggressiveness: 'moderate',
      };
      return this.updateAutoTiltSettings(defaultSettings);
    }
    
    return result[0];
  }

  async updateAutoTiltSettings(settings: Partial<InsertAutoTiltSettings>): Promise<AutoTiltSettings> {
    const existing = await db.select().from(autoTiltSettings).limit(1);
    
    if (existing.length === 0) {
      const id = randomUUID();
      const result = await db
        .insert(autoTiltSettings)
        .values({
          id,
          enabled: settings.enabled ?? false,
          mode: settings.mode ?? 'time_based',
          minTiltAngle: settings.minTiltAngle ?? 15,
          maxTiltAngle: settings.maxTiltAngle ?? 60,
          adjustmentInterval: settings.adjustmentInterval ?? 60,
          useWeatherData: settings.useWeatherData ?? true,
          aggressiveness: settings.aggressiveness ?? 'moderate',
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    } else {
      const result = await db
        .update(autoTiltSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(autoTiltSettings.id, existing[0].id))
        .returning();
      return result[0];
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  calculateHealthScore(reading: SensorReading): HealthScoreFactors {
    const safeValue = (val: number, defaultVal: number) =>
      isNaN(val) || !isFinite(val) ? defaultVal : val;

    const efficiency = safeValue(reading.efficiencyPercent, 50);
    const dust = safeValue(reading.dustLevel, 5);
    const temp = safeValue(reading.temperature, 25);

    const efficiencyScore = (efficiency / 100) * 40;
    const dustScore = ((10 - dust) / 10) * 30;
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
    // This is synchronous in MemStorage but needs to be async for DB
    // For now, return empty set - will be called differently
    return new Set<string>();
  }

  async getImplementedRecommendationsAsync(): Promise<Set<string>> {
    const implemented = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.implemented, true));
    return new Set(implemented.map((r) => r.id));
  }

  markRecommendationImplemented(id: string): void {
    // Make this async call in routes instead
    this.updateRecommendationImplemented(id, true);
  }
}
