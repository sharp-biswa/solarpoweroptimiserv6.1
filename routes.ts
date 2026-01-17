
import type { Express, Request, Response } from "express";
import { sensorSimulator } from "./sensor-simulator";
import { wokwiSimulator } from "./wokwi-integration";
import { AIEngine } from "./ai-engine";
import { storage } from "./storage";
import { pdfGenerator } from "./pdf-generator";
import type { SensorReading, Recommendation, Alert } from "../shared/schema";

const aiEngine = new AIEngine();

// Weather API integration (OpenWeatherMap - free tier)
async function fetchWeatherData(lat: number = 28.6139, lon: number = 77.2090) {
  try {
    const apiKey = process.env.WEATHER_API_KEY || 'demo';
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    
    if (!response.ok) {
      return {
        temperature: 30 + Math.random() * 10,
        humidity: 40 + Math.random() * 30,
        dustFactor: Math.random() * 5,
        windSpeed: 5 + Math.random() * 10,
        condition: 'Clear',
      };
    }
    
    const data = await response.json();
    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      dustFactor: data.main.pressure < 1010 ? 3 : 1,
      windSpeed: data.wind.speed,
      condition: data.weather[0]?.main || 'Clear',
    };
  } catch (error) {
    return {
      temperature: 30 + Math.random() * 10,
      humidity: 40 + Math.random() * 30,
      dustFactor: Math.random() * 5,
      windSpeed: 5 + Math.random() * 10,
      condition: 'Clear',
    };
  }
}

export function registerRoutes(app: Express) {
  //==============================================
  // INITIALIZATION ROUTE
  //==============================================

  // Initialize 200 panels if they don't exist
  app.post("/api/init/panels", async (req: Request, res: Response) => {
    try {
      const existingPanels = await storage.getAllPanels();
      
      if (existingPanels.length >= 200) {
        return res.json({ 
          message: "Panels already initialized",
          count: existingPanels.length 
        });
      }

        // Create 200 panels
      for (let i = 1; i <= 200; i++) {
        // Determine location based on grid layout (20x10 grid)
        const row = Math.ceil(i / 20);
        const col = ((i - 1) % 20) + 1;
        const location = `Row ${String(row).padStart(2, '0')}, Col ${String(col).padStart(2, '0')}`;
        
        // Determine status (most active, some in maintenance)
        let status: 'active' | 'maintenance' | 'offline' | 'damaged' = 'active';
        const rand = Math.random();
        if (rand < 0.05) status = 'maintenance';
        else if (rand < 0.07) status = 'offline';
        else if (rand < 0.08) status = 'damaged';

        const panel = await storage.createPanel({
          panelNumber: i,
          location,
        });
        
        // Update status if not active
        if (status !== 'active') {
          await storage.updatePanelStatus(panel.id, status);
        }
      }

      res.json({ 
        message: "Successfully initialized 200 panels",
        count: 200 
      });
    } catch (error) {
      console.error('Error initializing panels:', error);
      res.status(500).json({ error: "Failed to initialize panels" });
    }
  });

  //==============================================
  // BLYNK POLLING SERVICE
  //==============================================
  const BLYNK_TOKEN = "a-g0bQ4pZWknhT_DZZDSDrqWpYq1Q4CK";
  let lastDustLevel = 0;
  let lastCurrentLevelMA = 0;
  let lastEnergyOutput = 0;
  let lastTiltValue = 90;
  let lastLightIntensity = 0;
  let lastCleaningStatus = false;

  const blynkPins = [
    { pin: 'v1', setter: (v: number) => lastDustLevel = v },
    { pin: 'v2', setter: (v: number) => lastCurrentLevelMA = v },
    { pin: 'v3', setter: (v: number) => lastEnergyOutput = v },
    { pin: 'v4', setter: (v: number) => lastTiltValue = v },
    { pin: 'v6', setter: (v: number) => lastLightIntensity = v }
  ];

  setInterval(async () => {
    try {
      console.log(`[Blynk] Polling data at ${new Date().toISOString()}`);
      
      // Fetch all pins in parallel
      const results = await Promise.all(blynkPins.map(async ({ pin, setter }) => {
        try {
          const response = await fetch(`https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&${pin}`);
          if (response.ok) {
            const val = await response.text();
            const numericVal = parseFloat(val);
            if (!isNaN(numericVal)) {
              setter(numericVal);
              return { pin, val: numericVal, success: true };
            }
          }
          return { pin, success: false, status: response.status };
        } catch (e) {
          return { pin, success: false, error: e };
        }
      }));

      console.log(`[Blynk] Polling Results:`, results);

      // Handle cleaning logic (V0) based on V1
      const cleaningState = lastDustLevel > 70 ? "1" : "0";
      lastCleaningStatus = lastDustLevel > 70;
      await fetch(`https://blynk.cloud/external/api/update?token=${BLYNK_TOKEN}&v0=${cleaningState}`);
      
    } catch (error) {
      console.error("[Blynk] Polling catch error:", error);
    }
  }, 5000); 

  //==============================================
  // PANEL MANAGEMENT ROUTES
  //==============================================

  // Get all panels with current readings (Grid View)
  app.get("/api/panels", async (req: Request, res: Response) => {
    try {
      const panels = await storage.getPanelsWithCurrentReadings();
      
      // Calculate summary stats
      const summary = {
        total: panels.length,
        active: panels.filter(p => p.status === 'active').length,
        maintenance: panels.filter(p => p.status === 'maintenance').length,
        offline: panels.filter(p => p.status === 'offline').length,
        damaged: panels.filter(p => p.status === 'damaged').length,
        averageHealth: panels.reduce((sum, p) => sum + p.healthScore, 0) / panels.length,
        averageEfficiency: panels.reduce((sum, p) => sum + (p.currentReading?.efficiencyPercent || 0), 0) / panels.length,
      };

      res.json({ panels, summary });
    } catch (error) {
      console.error('Error fetching panels:', error);
      res.status(500).json({ error: "Failed to fetch panels" });
    }
  });

  // Get individual panel details
  app.get("/api/panels/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const panelDetail = await storage.getPanelDetail(id);

      if (!panelDetail) {
        return res.status(404).json({ error: "Panel not found" });
      }

      // Use the last polled levels instead of a new fetch to be more efficient
      if (panelDetail.currentReading) {
        panelDetail.currentReading.dustLevel = lastDustLevel;
        panelDetail.currentReading.currentLevelMA = lastCurrentLevelMA;
        panelDetail.currentReading.energyOutput = lastEnergyOutput;
        panelDetail.currentReading.sunlightIntensity = lastLightIntensity;
        panelDetail.currentReading.tiltAngle = lastTiltValue;
        panelDetail.currentReading.sweepEnable = lastCleaningStatus;
      }

      res.json(panelDetail);
    } catch (error) {
      console.error('Error fetching panel detail:', error);
      res.status(500).json({ error: "Failed to fetch panel details" });
    }
  });

  // Generate sensor reading for a specific panel (Using Wokwi Simulator)
  app.post("/api/panels/:id/reading", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const panel = await storage.getPanelById(id);
      
      if (!panel) {
        return res.status(404).json({ error: "Panel not found" });
      }

      // Get real-time data from Wokwi IoT Simulator
      const wokwiData = wokwiSimulator.getSensorData(id);
      
      if (!wokwiData) {
        return res.status(503).json({ error: "Wokwi simulator not ready" });
      }

      const weatherData = await fetchWeatherData();
      
      // Calculate efficiency from hardware data
      const efficiencyPercent = (wokwiData.energyOutput / 250) * 100;

      const reading = await storage.createReading({
        panelId: id,
        energyOutput: lastEnergyOutput,
        sunlightIntensity: wokwiData.sunlightIntensity,
        temperature: wokwiData.temperature,
        dustLevel: lastDustLevel,
        dustStatus: lastDustLevel > 2000 ? "DUSTY / NIGHT" : "CLEAN / DAY",
        tiltAngle: wokwiData.tiltAngle,
        efficiencyPercent: Math.min(100, Math.max(0, efficiencyPercent)),
        currentLevelMA: lastCurrentLevelMA,
        powerOutputMW: lastEnergyOutput * 1000,
        overload: lastCurrentLevelMA > 800,
        sweepEnable: lastDustLevel > 2000,
        autoMode: true,
      });

      res.json(reading);
    } catch (error) {
      console.error('Error creating panel reading:', error);
      res.status(500).json({ error: "Failed to create panel reading" });
    }
  });

  // Get real-time Wokwi simulator status
  app.get("/api/wokwi/status", (req: Request, res: Response) => {
    res.json({
      connected: wokwiSimulator.isSimulatorConnected(),
      timestamp: new Date().toISOString(),
      message: "Wokwi IoT Simulator Status",
    });
  });

  // Generate readings for all panels
  app.post("/api/panels/readings/generate-all", async (req: Request, res: Response) => {
    try {
      const panels = await storage.getAllPanels();
      const weatherData = await fetchWeatherData();
      const createdReadings = [];

      for (const panel of panels) {
        const sensorData = sensorSimulator.generateSensorData(panel.id);
        
        sensorData.temperature = weatherData.temperature + (Math.random() - 0.5) * 3;
        sensorData.dustLevel = Math.min(10, sensorData.dustLevel + weatherData.dustFactor * 0.3);

        const reading = await storage.createReading({
          panelId: panel.id,
          energyOutput: sensorData.energyOutput,
          sunlightIntensity: sensorData.sunlightIntensity,
          temperature: sensorData.temperature,
          dustLevel: sensorData.dustLevel,
          dustStatus: sensorData.dustStatus,
          tiltAngle: sensorData.tiltAngle,
          efficiencyPercent: sensorData.efficiencyPercent,
          currentLevelMA: sensorData.currentLevelMA,
          powerOutputMW: sensorData.powerOutputMW,
          overload: sensorData.overload,
          sweepEnable: sensorData.sweepEnable,
          autoMode: sensorData.autoMode,
        });

        createdReadings.push(reading);
      }

      res.json({ 
        message: `Generated ${createdReadings.length} readings`,
        count: createdReadings.length,
      });
    } catch (error) {
      console.error('Error generating all panel readings:', error);
      res.status(500).json({ error: "Failed to generate panel readings" });
    }
  });

  //==============================================
  // DASHBOARD ROUTES (Farm-wide Overview)
  //==============================================

  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      const weatherData = await fetchWeatherData();
      const panels = await storage.getPanelsWithCurrentReadings();
      
      // Calculate farm-wide averages
      const totalEnergyOutput = panels.reduce((sum, p) => 
        sum + (p.currentReading?.energyOutput || 0), 0);
      const avgEfficiency = panels.reduce((sum, p) => 
        sum + (p.currentReading?.efficiencyPercent || 0), 0) / panels.length;
      const avgHealthScore = panels.reduce((sum, p) => sum + p.healthScore, 0) / panels.length;
      
      // Count panels needing maintenance
      const panelsNeedingMaintenance = panels.filter(p => 
        p.healthScore < 70 || (p.currentReading?.dustLevel || 0) > 7
      ).length;

      const activePanels = panels.filter(p => p.status === 'active').length;

      // Create a farm-wide "reading" for compatibility
      const farmReading: SensorReading = {
        id: 'farm-wide',
        panelId: 'farm-wide',
        timestamp: new Date(),
        energyOutput: lastEnergyOutput || 0,
        sunlightIntensity: lastLightIntensity || 0,
        temperature: weatherData.temperature,
        dustLevel: lastDustLevel || 0,
        dustStatus: lastDustLevel > 70 ? "DUSTY / NIGHT" : "CLEAN / DAY",
        tiltAngle: lastTiltValue || 32,
        efficiencyPercent: avgEfficiency,
        currentLevelMA: lastCurrentLevelMA || 0,
        powerOutputMW: (lastEnergyOutput || 0) * 1000,
        overload: lastCurrentLevelMA > 800,
        sweepEnable: lastCleaningStatus,
        autoMode: true,
        cleaningDone: false,
      };

      // Generate alerts for critical panels
      const activeAlerts: any[] = [];
      const criticalPanels = panels.filter(p => (p.currentReading?.efficiencyPercent || 100) < 50);
      if (criticalPanels.length > 0) {
        activeAlerts.push({
          id: "alert-efficiency-critical",
          panelId: null,
          level: "error",
          type: "efficiency",
          title: `${criticalPanels.length} Panels with Critical Efficiency`,
          message: `${criticalPanels.length} panels are operating below 50% efficiency.`,
          details: "Immediate inspection recommended",
          timestamp: new Date(),
          dismissed: false,
        });
      }

      const dustyPanels = panels.filter(p => (p.currentReading?.dustLevel || 0) > 7);
      if (dustyPanels.length > 0) {
        activeAlerts.push({
          id: "alert-dust-high",
          panelId: null,
          level: "warning",
          type: "dust",
          title: `${dustyPanels.length} Panels Need Cleaning`,
          message: `${dustyPanels.length} panels have high dust accumulation.`,
          details: "Schedule cleaning within 24 hours",
          timestamp: new Date(),
          dismissed: false,
        });
      }

      // Get top recommendations
      const recommendations = aiEngine.generateRecommendations(farmReading, weatherData);
      const topRecommendations = recommendations.slice(0, 3).map(rec => ({
        id: rec.id,
        panelId: null,
        timestamp: new Date(),
        title: rec.title,
        description: rec.description,
        type: rec.type,
        urgency: rec.urgency,
        impactScore: rec.impactScore,
        aiExplanation: rec.aiExplanation,
        implemented: false,
      }));

      const stats = {
        currentReading: farmReading,
        todayAverage: {
          energyOutput: totalEnergyOutput * 0.95,
          efficiency: avgEfficiency * 0.97,
          sunlightIntensity: farmReading.sunlightIntensity * 0.96,
        },
        activeAlerts,
        topRecommendations,
        totalPanels: panels.length,
        activePanels,
        panelsNeedingMaintenance,
        averageHealthScore: avgHealthScore,
      };

      res.json(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/history", async (req: Request, res: Response) => {
    try {
      const timeRange = parseInt(req.query.range as string) || 24;
      const panelId = req.query.panelId as string;
      
      if (panelId) {
        // Get history for a specific panel
        const readings = await storage.getReadingsByPanel(panelId, timeRange);
        res.json({ readings });
      } else {
        // Get aggregated history for all panels
        const weatherData = await fetchWeatherData();
        const readings: SensorReading[] = [];

        for (let i = 0; i < 30; i++) {
          const timestamp = new Date(Date.now() - (timeRange * 60 * 60 * 1000 * i) / 30);
          const sensorData = sensorSimulator.generateSensorData();
          
          readings.push({
            id: `reading-${timestamp.getTime()}`,
            panelId: 'farm-average',
            timestamp,
            energyOutput: lastEnergyOutput * 200, // Scale for 200 panels
            sunlightIntensity: lastLightIntensity,
            temperature: weatherData.temperature + (Math.random() - 0.5) * 5,
            dustLevel: lastDustLevel,
            dustStatus: lastDustLevel > 70 ? "DUSTY / NIGHT" : "CLEAN / DAY",
            tiltAngle: lastTiltValue,
            efficiencyPercent: (lastEnergyOutput / (lastLightIntensity || 1000)) * 100,
            currentLevelMA: lastCurrentLevelMA,
            powerOutputMW: lastEnergyOutput * 1000,
            overload: lastCurrentLevelMA > 800,
            sweepEnable: lastCleaningStatus,
            autoMode: true,
            cleaningDone: false,
          } as SensorReading);
        }

        res.json({ readings: readings.reverse() });
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      res.status(500).json({ error: "Failed to fetch historical data" });
    }
  });

  //==============================================
  // PREDICTIONS & ANALYTICS
  //==============================================

  app.get("/api/predictions/forecast", async (req: Request, res: Response) => {
    try {
      const panelId = req.query.panelId as string;
      const weatherData = await fetchWeatherData();
      
      if (panelId) {
        // Get forecast for a specific panel
        const latestReading = await storage.getLatestReadingByPanel(panelId);
        if (!latestReading) {
          return res.status(404).json({ error: "No readings found for panel" });
        }
        
        const predictions = aiEngine.generatePredictions(latestReading, weatherData);
        res.json(predictions);
      } else {
        // Get farm-wide forecast
        const panels = await storage.getPanelsWithCurrentReadings();
        const avgEfficiency = panels.reduce((sum, p) => 
          sum + (p.currentReading?.efficiencyPercent || 0), 0) / panels.length;
        
        const farmReading = {
          efficiencyPercent: avgEfficiency,
          dustLevel: panels.reduce((sum, p) => 
            sum + (p.currentReading?.dustLevel || 0), 0) / panels.length,
          temperature: weatherData.temperature,
          dustStatus: "UNKNOWN",
          powerOutputMW: 0,
          overload: false,
          sweepEnable: false,
          autoMode: true,
        };
        
        const predictions = aiEngine.generatePredictions(farmReading as any, weatherData);
        res.json(predictions);
      }
    } catch (error) {
      console.error('Error generating predictions:', error);
      res.status(500).json({ error: "Failed to generate predictions" });
    }
  });

  app.get("/api/analytics", async (req: Request, res: Response) => {
    try {
      const weatherData = await fetchWeatherData();
      const panels = await storage.getPanelsWithCurrentReadings();
      
      const avgEfficiency = panels.reduce((sum, p) => 
        sum + (p.currentReading?.efficiencyPercent || 0), 0) / panels.length;
      
      const farmReading = {
        efficiencyPercent: avgEfficiency,
        dustLevel: panels.reduce((sum, p) => 
          sum + (p.currentReading?.dustLevel || 0), 0) / panels.length,
        temperature: weatherData.temperature,
        energyOutput: panels.reduce((sum, p) => 
          sum + (p.currentReading?.energyOutput || 0), 0),
        sunlightIntensity: panels.reduce((sum, p) => 
          sum + (p.currentReading?.sunlightIntensity || 0), 0) / panels.length,
        dustStatus: "UNKNOWN",
        powerOutputMW: 0,
        overload: false,
        sweepEnable: false,
        autoMode: true,
      };

      // Generate 7-day predictions
      const predictions = [];
      for (let i = 0; i < 7; i++) {
        const prediction = aiEngine.generatePredictions(farmReading as any, weatherData);
        predictions.push({
          ...prediction,
          id: `pred-${i}-${Date.now()}`,
          panelId: null,
          predictedDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        });
      }

      // Calculate degradation risk summary
      const degradationRiskSummary = {
        low: predictions.filter(p => p.degradationRisk === 'low').length,
        medium: predictions.filter(p => p.degradationRisk === 'medium').length,
        high: predictions.filter(p => p.degradationRisk === 'high').length,
      };

      // Performance trend data
      const performanceTrend = predictions.map((pred, index) => ({
        date: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString(),
        efficiency: pred.predictedEfficiency,
      }));

      res.json({
        predictions,
        performanceTrend,
        degradationRiskSummary,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ error: "Failed to fetch analytics data" });
    }
  });

  //==============================================
  // RECOMMENDATIONS
  //==============================================

  app.get("/api/recommendations", async (req: Request, res: Response) => {
    try {
      const panelId = req.query.panelId as string;
      const weatherData = await fetchWeatherData();
      
      if (panelId) {
        // Get recommendations for a specific panel
        const latestReading = await storage.getLatestReadingByPanel(panelId);
        if (!latestReading) {
          return res.status(404).json({ recommendations: [] });
        }
        
        const recommendations = aiEngine.generateRecommendations(latestReading, weatherData);
        
        const enrichedRecommendations = recommendations.map(rec => ({
          id: rec.id,
          panelId,
          timestamp: new Date(),
          title: rec.title,
          description: rec.description,
          type: rec.type,
          urgency: rec.urgency,
          impactScore: rec.impactScore,
          aiExplanation: rec.aiExplanation,
          implemented: false // AI-generated recommendations start as not implemented
        }));

        res.json({ recommendations: enrichedRecommendations });
      } else {
        // Get farm-wide recommendations
        const panels = await storage.getPanelsWithCurrentReadings();
        const farmReading = {
          dustLevel: panels.reduce((sum, p) => 
            sum + (p.currentReading?.dustLevel || 0), 0) / panels.length,
          temperature: weatherData.temperature,
          tiltAngle: 32,
          efficiencyPercent: panels.reduce((sum, p) => 
            sum + (p.currentReading?.efficiencyPercent || 0), 0) / panels.length,
          sunlightIntensity: panels.reduce((sum, p) => 
            sum + (p.currentReading?.sunlightIntensity || 0), 0) / panels.length,
        };
        
        const recommendations = aiEngine.generateRecommendations(farmReading, weatherData);
        
        const enrichedRecommendations = recommendations.map(rec => ({
          id: rec.id,
          panelId: null,
          timestamp: new Date(),
          title: rec.title,
          description: rec.description,
          type: rec.type,
          urgency: rec.urgency,
          impactScore: rec.impactScore,
          aiExplanation: rec.aiExplanation,
          implemented: false // AI-generated recommendations start as not implemented
        }));

        res.json({ recommendations: enrichedRecommendations });
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.patch("/api/recommendations/:id/implement", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      await storage.updateRecommendationImplemented(id, true);
      res.json({ success: true, message: "Recommendation marked as implemented" });
    } catch (error) {
      res.status(500).json({ error: "Failed to implement recommendation" });
    }
  });

  //==============================================
  // ALERTS
  //==============================================

  app.get("/api/alerts", async (req: Request, res: Response) => {
    try {
      const panelId = req.query.panelId as string;
      const weatherData = await fetchWeatherData();
      const panels = await storage.getPanelsWithCurrentReadings();
      
      const alerts: Alert[] = [];

      if (panelId) {
        // Get alerts for a specific panel
        const panel = panels.find(p => p.id === panelId);
        if (panel && panel.currentReading) {
          if (panel.currentReading.efficiencyPercent < 50) {
            alerts.push({
              id: `alert-efficiency-${panelId}`,
              panelId,
              level: "error",
              type: "efficiency",
              title: "Critical: Low Panel Efficiency",
              message: `Panel ${panel.panelNumber} efficiency at ${panel.currentReading.efficiencyPercent.toFixed(1)}%.`,
              details: "Immediate inspection recommended",
              timestamp: new Date(),
              dismissed: false,
            });
          }

          if (panel.currentReading.dustLevel > 7) {
            alerts.push({
              id: `alert-dust-${panelId}`,
              panelId,
              level: "warning",
              type: "dust",
              title: "High Dust Accumulation",
              message: `Panel ${panel.panelNumber} dust level at ${panel.currentReading.dustLevel.toFixed(1)}/10.`,
              details: "Schedule cleaning within 24 hours",
              timestamp: new Date(),
              dismissed: false,
            });
          }

          if (panel.currentReading.temperature > 40) {
            alerts.push({
              id: `alert-temp-${panelId}`,
              panelId,
              level: "warning",
              type: "temperature",
              title: "High Temperature",
              message: `Panel ${panel.panelNumber} temperature at ${panel.currentReading.temperature.toFixed(1)}°C.`,
              details: "Consider cooling or ventilation",
              timestamp: new Date(),
              dismissed: false,
            });
          }
        }
      } else {
        // Get farm-wide alerts
        const criticalPanels = panels.filter(p => (p.currentReading?.efficiencyPercent || 100) < 50);
        if (criticalPanels.length > 0) {
          alerts.push({
            id: "alert-efficiency-critical",
            panelId: null,
            level: "error",
            type: "efficiency",
            title: `${criticalPanels.length} Panels with Critical Efficiency`,
            message: `${criticalPanels.length} panels are operating below 50% efficiency.`,
            details: `Panels: ${criticalPanels.slice(0, 5).map(p => p.panelNumber).join(', ')}${criticalPanels.length > 5 ? '...' : ''}`,
            timestamp: new Date(),
            dismissed: false,
          });
        }

        const dustyPanels = panels.filter(p => (p.currentReading?.dustLevel || 0) > 7);
        if (dustyPanels.length > 0) {
          alerts.push({
            id: "alert-dust-high",
            panelId: null,
            level: "warning",
            type: "dust",
            title: `${dustyPanels.length} Panels Need Cleaning`,
            message: `${dustyPanels.length} panels have high dust accumulation.`,
            details: `Panels: ${dustyPanels.slice(0, 5).map(p => p.panelNumber).join(', ')}${dustyPanels.length > 5 ? '...' : ''}`,
            timestamp: new Date(),
            dismissed: false,
          });
        }

        const hotPanels = panels.filter(p => (p.currentReading?.temperature || 0) > 40);
        if (hotPanels.length > 0) {
          alerts.push({
            id: "alert-temperature-high",
            panelId: null,
            level: "warning",
            type: "temperature",
            title: `${hotPanels.length} Panels Running Hot`,
            message: `${hotPanels.length} panels are operating above 40°C.`,
            details: `Panels: ${hotPanels.slice(0, 5).map(p => p.panelNumber).join(', ')}${hotPanels.length > 5 ? '...' : ''}`,
            timestamp: new Date(),
            dismissed: false,
          });
        }
      }

      res.json({ alerts });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  //==============================================
  // SENSORS
  //==============================================

  app.get("/api/sensors/latest", async (req: Request, res: Response) => {
    try {
      const panelId = req.query.panelId as string;
      const weatherData = await fetchWeatherData();
      
      if (panelId) {
        const latestReading = await storage.getLatestReadingByPanel(panelId);
        if (!latestReading) {
          return res.status(404).json({ error: "No readings found for panel" });
        }
        res.json(latestReading);
      } else {
        // Get farm-wide average
        const panels = await storage.getPanelsWithCurrentReadings();
        const farmReading = {
          id: 'farm-average',
          panelId: 'farm-average',
          timestamp: new Date(),
          energyOutput: panels.reduce((sum, p) => 
            sum + (p.currentReading?.energyOutput || 0), 0),
          sunlightIntensity: panels.reduce((sum, p) => 
            sum + (p.currentReading?.sunlightIntensity || 0), 0) / panels.length,
          temperature: weatherData.temperature,
          dustLevel: panels.reduce((sum, p) => 
            sum + (p.currentReading?.dustLevel || 0), 0) / panels.length,
          tiltAngle: 32,
          efficiencyPercent: panels.reduce((sum, p) => 
            sum + (p.currentReading?.efficiencyPercent || 0), 0) / panels.length,
        };
        res.json(farmReading);
      }
    } catch (error) {
      console.error('Error fetching latest sensor data:', error);
      res.status(500).json({ error: "Failed to fetch latest sensor reading" });
    }
  });

  //==============================================
  // SYSTEM HEALTH
  //==============================================

  app.get("/api/system-health", (req: Request, res: Response) => {
    try {
      const health = {
        sensors: {
          energyMeter: { status: "online", lastUpdate: new Date().toISOString() },
          irradianceSensor: { status: "online", lastUpdate: new Date().toISOString() },
          temperatureSensor: { status: "online", lastUpdate: new Date().toISOString() },
          dustSensor: { status: Math.random() > 0.1 ? "online" : "offline", lastUpdate: new Date().toISOString() },
          tiltSensor: { status: "online", lastUpdate: new Date().toISOString() },
          weatherAPI: { status: "online", lastUpdate: new Date().toISOString() },
        },
        systemUptime: Math.floor(Math.random() * 720) + 1,
        dataQuality: 95 + Math.random() * 5,
      };

      res.json(health);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  //==============================================
  // AUTO TILT SETTINGS
  //==============================================

  app.get("/api/settings/auto-tilt", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getAutoTiltSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching auto-tilt settings:', error);
      res.status(500).json({ error: "Failed to fetch auto-tilt settings" });
    }
  });

  app.put("/api/settings/auto-tilt", async (req: Request, res: Response) => {
    try {
      const settings = req.body;
      const updated = await storage.updateAutoTiltSettings(settings);
      res.json(updated);
    } catch (error) {
      console.error('Error updating auto-tilt settings:', error);
      res.status(500).json({ error: "Failed to update auto-tilt settings" });
    }
  });

  //==============================================
  // COST-BENEFIT ANALYSIS
  //==============================================

  app.get("/api/analytics/cost-benefit", async (req: Request, res: Response) => {
    try {
      const weatherData = await fetchWeatherData();
      const panels = await storage.getPanelsWithCurrentReadings();
      
      const totalCurrentOutput = panels.reduce((sum, p) => 
        sum + (p.currentReading?.energyOutput || 0), 0);
      const avgEnergyOutput = 250; // watts average per panel
      const totalPotentialOutput = avgEnergyOutput * panels.length;
      
      const costPerUnit = 8; // ₹8 per kWh
      const hoursPerDay = 8;
      const daysPerMonth = 30;
      
      const potentialMonthlyGeneration = (totalPotentialOutput * hoursPerDay * daysPerMonth) / 1000;
      const actualMonthlyGeneration = (totalCurrentOutput * hoursPerDay * daysPerMonth) / 1000;
      const monthlyLoss = (potentialMonthlyGeneration - actualMonthlyGeneration) * costPerUnit;
      
      // Calculate cleaning cost based on panels needing cleaning
      const panelsNeedingCleaning = panels.filter(p => (p.currentReading?.dustLevel || 0) > 5).length;
      const cleaningCostPerPanel = 50; // ₹50 per panel
      const totalCleaningCost = panelsNeedingCleaning * cleaningCostPerPanel;
      
      const netSavings = monthlyLoss - totalCleaningCost;

      res.json({
        monthlyAnalysis: {
          potentialRevenue: potentialMonthlyGeneration * costPerUnit,
          actualRevenue: actualMonthlyGeneration * costPerUnit,
          energyLoss: monthlyLoss,
          cleaningCost: totalCleaningCost,
          netSavings: Math.max(0, netSavings),
          roi: netSavings > 0 ? ((netSavings / totalCleaningCost) * 100).toFixed(1) : "0"
        },
        recommendations: {
          optimalCleaningFrequency: Math.ceil(panelsNeedingCleaning / panels.length * 4), // times per month
          estimatedAnnualSavings: netSavings * 12,
          panelsNeedingCleaning,
        }
      });
    } catch (error) {
      console.error('Error calculating cost-benefit:', error);
      res.status(500).json({ error: "Failed to calculate cost-benefit analysis" });
    }
  });

  //==============================================
  // PDF REPORT GENERATION
  //==============================================

  app.get("/api/reports/generate", async (req: Request, res: Response) => {
    try {
      const weatherData = await fetchWeatherData();
      const panels = await storage.getPanelsWithCurrentReadings();
      
      // Use farm-wide averages for the report
      const farmReading: SensorReading = {
        id: 'farm-wide',
        panelId: 'farm-wide',
        timestamp: new Date(),
        energyOutput: panels.reduce((sum, p) => 
          sum + (p.currentReading?.energyOutput || 0), 0),
        sunlightIntensity: panels.reduce((sum, p) => 
          sum + (p.currentReading?.sunlightIntensity || 0), 0) / panels.length,
        temperature: weatherData.temperature,
        dustLevel: panels.reduce((sum, p) => 
          sum + (p.currentReading?.dustLevel || 0), 0) / panels.length,
        tiltAngle: 32,
        efficiencyPercent: panels.reduce((sum, p) => 
          sum + (p.currentReading?.efficiencyPercent || 0), 0) / panels.length,
        currentLevelMA: 0,
      };

      const predictions = aiEngine.generatePredictions(farmReading, weatherData);
      const recommendations = aiEngine.generateRecommendations(farmReading, weatherData);
      
      // Add panel-specific recommendations for high-priority panels
      const criticalPanels = panels
        .filter(p => p.healthScore < 70 || (p.currentReading?.efficiencyPercent || 100) < 60)
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 10);

      const panelRecommendations = criticalPanels.map(p => ({
        id: `rec-panel-${p.id}`,
        panelId: p.id,
        timestamp: new Date(),
        type: 'maintenance' as const,
        title: `Panel ${p.panelNumber} Needs Attention`,
        description: `Health Score: ${p.healthScore.toFixed(0)}%. Efficiency: ${(p.currentReading?.efficiencyPercent || 0).toFixed(1)}%. Located at ${p.location}.`,
        urgency: p.healthScore < 50 ? 'high' as const : 'medium' as const,
        impactScore: 100 - p.healthScore,
        aiExplanation: `Panel ${p.panelNumber} is underperforming based on health metrics.`,
        implemented: false,
      }));

      const allRecommendations = [
        ...recommendations.map(rec => ({
          id: rec.id,
          panelId: null,
          timestamp: new Date(),
          type: rec.type,
          title: rec.title,
          description: rec.description,
          urgency: rec.urgency,
          impactScore: rec.impactScore,
          aiExplanation: rec.aiExplanation,
          implemented: false,
        })),
        ...panelRecommendations,
      ].sort((a, b) => {
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return b.impactScore - a.impactScore;
      });

      // Historical data (simplified for performance)
      const historicalData: SensorReading[] = [];
      for (let i = 0; i < 30; i++) {
        const timestamp = new Date(Date.now() - (24 * 60 * 60 * 1000 * i) / 30);
        const sensorData = sensorSimulator.generateSensorData();
        historicalData.push({
          id: `reading-${i}`,
          panelId: 'farm-wide',
          timestamp,
          energyOutput: sensorData.energyOutput,
          sunlightIntensity: sensorData.sunlightIntensity,
          temperature: sensorData.temperature,
          dustLevel: sensorData.dustLevel,
          tiltAngle: sensorData.tiltAngle,
          efficiencyPercent: sensorData.efficiencyPercent,
          currentLevelMA: 0,
        });
      }

      // Cost analysis
      const totalCurrentOutput = panels.reduce((sum, p) => 
        sum + (p.currentReading?.energyOutput || 0), 0);
      const avgEnergyOutput = 250 * panels.length;
      const costPerUnit = 8;
      const hoursPerDay = 8;
      const daysPerMonth = 30;
      
      const potentialMonthlyGeneration = (avgEnergyOutput * hoursPerDay * daysPerMonth) / 1000;
      const actualMonthlyGeneration = (totalCurrentOutput * hoursPerDay * daysPerMonth) / 1000;
      const monthlyLoss = (potentialMonthlyGeneration - actualMonthlyGeneration) * costPerUnit;
      
      const panelsNeedingCleaning = panels.filter(p => (p.currentReading?.dustLevel || 0) > 5).length;
      const cleaningCostPerPanel = 50;
      const totalCleaningCost = panelsNeedingCleaning * cleaningCostPerPanel;
      const netSavings = monthlyLoss - totalCleaningCost;

      const costAnalysis = {
        monthlyAnalysis: {
          potentialRevenue: potentialMonthlyGeneration * costPerUnit,
          actualRevenue: actualMonthlyGeneration * costPerUnit,
          energyLoss: monthlyLoss,
          cleaningCost: totalCleaningCost,
          netSavings: Math.max(0, netSavings),
          roi: netSavings > 0 ? ((netSavings / totalCleaningCost) * 100).toFixed(1) : "0"
        },
        recommendations: {
          optimalCleaningFrequency: Math.ceil(panelsNeedingCleaning / panels.length * 4),
          estimatedAnnualSavings: netSavings * 12
        }
      };

      const reportData = {
        currentReading: farmReading,
        recommendations: allRecommendations.slice(0, 10),
        predictions: {
          ...predictions,
          forecast: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
            efficiency: predictions.predictedEfficiency - i * 0.5,
            confidence: predictions.confidenceScore * (1 - i * 0.05),
          })),
          degradationRisk: predictions.degradationRisk,
          nextCleaningDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          estimatedRecovery: 15,
        },
        historicalData,
        costAnalysis,
        weatherData: {
          ...weatherData,
          condition: weatherData.condition || 'Clear',
        }
      };

      const pdfBuffer = await pdfGenerator.generateReport(reportData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=solar-farm-report-${Date.now()}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  });
}
