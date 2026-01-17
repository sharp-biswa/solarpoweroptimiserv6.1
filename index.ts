import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import { wokwiSimulator } from "./wokwi-integration";
import { RealtimeWebSocketServer } from "./websocket-server";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize PostgreSQL Database
  const { initializeDatabase } = await import('./db');
  try {
    await initializeDatabase();
  } catch (error) {
    log('⚠️ Database initialization failed, continuing with in-memory storage');
  }
  
  // Initialize Wokwi IoT Simulator
  log('🚀 Starting Wokwi IoT Simulator...');
  await wokwiSimulator.connect();
  
  registerRoutes(app);
  const server = createServer(app);
  
  // Initialize WebSocket server for real-time updates
  const wsServer = new RealtimeWebSocketServer(server);
  log('📡 WebSocket server initialized for real-time streaming');

  // Initialize auto-persist service for continuous data saving
  const { autoPersistService } = await import('./auto-persist-service');
  autoPersistService.setWebSocketServer(wsServer);
  await autoPersistService.start();
  log('💾 Auto-persist service started - saving sensor data every 2 seconds');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
