
import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { SensorReading, Recommendation, Prediction } from '../shared/schema';

interface ReportData {
  currentReading: SensorReading;
  recommendations: Recommendation[];
  predictions: any;
  historicalData: SensorReading[];
  costAnalysis: any;
  weatherData: any;
}

export class PDFReportGenerator {
  private chartRenderer: ChartJSNodeCanvas;
  private pageNumber: number = 1;

  constructor() {
    this.chartRenderer = new ChartJSNodeCanvas({
      width: 800,
      height: 400,
      backgroundColour: 'white'
    });
  }

  async generateReport(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addCoverPage(doc, data);
      this.addKeyHighlights(doc, data);
      this.addExecutiveSummary(doc, data);
      this.addCurrentMetrics(doc, data.currentReading);
      this.addRecommendations(doc, data.recommendations);
      this.addPredictiveAnalysis(doc, data.predictions);
      this.addCostBenefitAnalysis(doc, data.costAnalysis);
      this.addActionPlan(doc, data);
      this.addFooterDisclaimer(doc);

      doc.end();
    });
  }

  private addCoverPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const efficiency = data.currentReading.efficiencyPercent;
    const status = efficiency >= 75 ? 'Optimal' : efficiency >= 50 ? 'Warning' : 'Critical';
    const statusColor = efficiency >= 75 ? '#10b981' : efficiency >= 50 ? '#f59e0b' : '#ef4444';

    doc.rect(0, 0, 595, 842).fill('#f8fafc');

    doc.rect(0, 0, 595, 250).fill('#1e40af');

    doc
      .fontSize(36)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text('Solar Panel', 50, 80, { align: 'center' })
      .text('Performance Report', 50, 125, { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#e0e7ff')
      .font('Helvetica')
      .text(`Generated: ${new Date().toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, 50, 180, { align: 'center' });

    const cardY = 280;
    
    doc.rect(75, cardY, 445, 180).fill('#ffffff');
    doc.rect(75, cardY, 445, 180).lineWidth(1).strokeColor('#e2e8f0').stroke();

    doc
      .fontSize(18)
      .fillColor('#1e293b')
      .font('Helvetica-Bold')
      .text('System Status Overview', 50, cardY + 25, { align: 'center' });

    const statusY = cardY + 70;
    doc
      .fontSize(48)
      .fillColor(statusColor)
      .font('Helvetica-Bold')
      .text(`${efficiency.toFixed(1)}%`, 50, statusY, { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#64748b')
      .font('Helvetica')
      .text('Current Efficiency', 50, statusY + 55, { align: 'center' });

    doc.rect(220, statusY + 80, 155, 35).fill(statusColor);
    doc
      .fontSize(14)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text(status.toUpperCase(), 220, statusY + 90, { width: 155, align: 'center' });

    doc
      .fontSize(10)
      .fillColor('#94a3b8')
      .font('Helvetica')
      .text('AI-Powered Analytics & Insights', 50, 750, { align: 'center' })
      .text('Comprehensive Performance & Cost Analysis', 50, 765, { align: 'center' });
  }

  private addKeyHighlights(doc: PDFKit.PDFDocument, data: ReportData) {
    doc.addPage();
    this.pageNumber++;

    this.addSectionHeader(doc, 'Key Highlights', '#1e40af');

    const highlights = [
      {
        title: 'Energy Output',
        value: `${data.currentReading.energyOutput.toFixed(2)} W`,
        icon: '⚡',
        status: data.currentReading.energyOutput >= 200 ? 'good' : 'warning'
      },
      {
        title: 'System Efficiency',
        value: `${data.currentReading.efficiencyPercent.toFixed(1)}%`,
        icon: '📊',
        status: data.currentReading.efficiencyPercent >= 75 ? 'good' : 'warning'
      },
      {
        title: 'Dust Accumulation',
        value: `${data.currentReading.dustLevel.toFixed(1)}/10`,
        icon: '🌫️',
        status: data.currentReading.dustLevel <= 5 ? 'good' : 'warning'
      },
      {
        title: 'Priority Actions',
        value: `${data.recommendations.filter(r => r.urgency === 'high').length} High Priority`,
        icon: '⚠️',
        status: 'info'
      }
    ];

    let yPos = doc.y + 10;
    const boxWidth = 220;
    const boxHeight = 100;
    const gap = 15;

    highlights.forEach((highlight, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 50 + col * (boxWidth + gap);
      const y = yPos + row * (boxHeight + gap);

      const bgColor = highlight.status === 'good' ? '#f0fdf4' : 
                      highlight.status === 'warning' ? '#fef3c7' : '#eff6ff';
      const borderColor = highlight.status === 'good' ? '#10b981' : 
                          highlight.status === 'warning' ? '#f59e0b' : '#3b82f6';

      doc.rect(x, y, boxWidth, boxHeight).fill(bgColor);
      doc.rect(x, y, boxWidth, boxHeight).lineWidth(2).strokeColor(borderColor).stroke();

      doc
        .fontSize(11)
        .fillColor('#64748b')
        .font('Helvetica')
        .text(highlight.title, x + 15, y + 20, { width: boxWidth - 30 });

      doc
        .fontSize(24)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text(highlight.value, x + 15, y + 45, { width: boxWidth - 30 });
    });

    doc.y = yPos + 2 * (boxHeight + gap) + 20;
  }

  private addSectionHeader(doc: PDFKit.PDFDocument, title: string, color: string = '#1e40af') {
    if (doc.y > 700) {
      doc.addPage();
      this.pageNumber++;
    }

    doc.rect(50, doc.y, 495, 35).fill(color);
    
    doc
      .fontSize(16)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text(title, 65, doc.y + 10);

    doc.y += 45;
  }

  private addExecutiveSummary(doc: PDFKit.PDFDocument, data: ReportData) {
    this.addSectionHeader(doc, 'Executive Summary', '#1e40af');

    const efficiency = data.currentReading.efficiencyPercent;
    const status = efficiency >= 75 ? 'Optimal' : efficiency >= 50 ? 'Moderate' : 'Critical';
    
    const summaryText = `This comprehensive analysis evaluates the current performance of your solar panel system. ` +
      `The system is currently operating at ${efficiency.toFixed(1)}% efficiency, which is classified as ${status}. ` +
      `Based on AI-powered analysis of sensor data and environmental conditions, we have identified key optimization opportunities.`;

    doc.rect(50, doc.y, 495, 100).fill('#f8fafc');
    doc.rect(50, doc.y, 495, 100).lineWidth(1).strokeColor('#e2e8f0').stroke();

    doc
      .fontSize(11)
      .fillColor('#334155')
      .font('Helvetica')
      .text(summaryText, 65, doc.y + 20, { width: 465, align: 'justify', lineGap: 3 });

    doc.y += 120;

    this.addInfoBox(doc, 'Quick Stats', [
      `Temperature: ${data.currentReading.temperature.toFixed(1)}°C`,
      `Sunlight Intensity: ${data.currentReading.sunlightIntensity.toFixed(1)} W/m²`,
      `Panel Tilt: ${data.currentReading.tiltAngle.toFixed(1)}°`,
      `Weather Condition: ${data.weatherData?.condition || 'Clear'}`
    ]);
  }

  private addInfoBox(doc: PDFKit.PDFDocument, title: string, items: string[]) {
    if (doc.y > 650) {
      doc.addPage();
      this.pageNumber++;
    }

    const boxHeight = 30 + items.length * 20 + 10;
    
    doc.rect(50, doc.y, 495, boxHeight).fill('#ffffff');
    doc.rect(50, doc.y, 495, boxHeight).lineWidth(1).strokeColor('#cbd5e1').stroke();
    doc.rect(50, doc.y, 495, 30).fill('#f1f5f9');

    doc
      .fontSize(12)
      .fillColor('#1e293b')
      .font('Helvetica-Bold')
      .text(title, 65, doc.y + 10);

    let yPos = doc.y + 40;
    items.forEach(item => {
      doc
        .fontSize(10)
        .fillColor('#475569')
        .font('Helvetica')
        .text(`• ${item}`, 65, yPos, { width: 465 });
      yPos += 20;
    });

    doc.y = doc.y + boxHeight + 15;
  }

  private addCurrentMetrics(doc: PDFKit.PDFDocument, reading: SensorReading) {
    if (doc.y > 500) {
      doc.addPage();
      this.pageNumber++;
    }

    this.addSectionHeader(doc, 'Current Performance Metrics', '#059669');

    const metrics = [
      { 
        label: 'Energy Output', 
        value: `${reading.energyOutput.toFixed(2)} W`, 
        description: 'Current power generation',
        color: '#3b82f6',
        status: reading.energyOutput >= 200 ? '✓' : '⚠'
      },
      { 
        label: 'Efficiency', 
        value: `${reading.efficiencyPercent.toFixed(1)}%`, 
        description: 'System efficiency rating',
        color: reading.efficiencyPercent >= 75 ? '#10b981' : '#f59e0b',
        status: reading.efficiencyPercent >= 75 ? '✓' : '⚠'
      },
      { 
        label: 'Temperature', 
        value: `${reading.temperature.toFixed(1)}°C`, 
        description: 'Panel surface temperature',
        color: '#ef4444',
        status: reading.temperature <= 45 ? '✓' : '⚠'
      },
      { 
        label: 'Dust Level', 
        value: `${reading.dustLevel.toFixed(1)}/10`, 
        description: 'Surface contamination',
        color: reading.dustLevel > 7 ? '#ef4444' : '#10b981',
        status: reading.dustLevel <= 5 ? '✓' : '⚠'
      },
      { 
        label: 'Tilt Angle', 
        value: `${reading.tiltAngle.toFixed(1)}°`, 
        description: 'Panel inclination',
        color: '#8b5cf6',
        status: '✓'
      },
      { 
        label: 'Sunlight', 
        value: `${reading.sunlightIntensity.toFixed(1)} W/m²`, 
        description: 'Solar irradiance',
        color: '#f59e0b',
        status: reading.sunlightIntensity >= 600 ? '✓' : '⚠'
      }
    ];

    const tableY = doc.y;
    const rowHeight = 50;
    const colWidth = 247.5;

    doc.rect(50, tableY, 495, rowHeight * 3 + 25).lineWidth(1).strokeColor('#e2e8f0').stroke();
    doc.rect(50, tableY, 495, 25).fill('#f1f5f9');

    doc
      .fontSize(11)
      .fillColor('#1e293b')
      .font('Helvetica-Bold')
      .text('Metric', 65, tableY + 8, { width: 150 })
      .text('Value', 265, tableY + 8, { width: 100 })
      .text('Status', 465, tableY + 8, { width: 60 });

    metrics.forEach((metric, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const y = tableY + 25 + row * rowHeight;
      const x = 50 + col * colWidth;

      if (col === 0) {
        doc.rect(x, y, colWidth, rowHeight).lineWidth(1).strokeColor('#e2e8f0').stroke();
      } else {
        doc.rect(x, y, colWidth, rowHeight).lineWidth(1).strokeColor('#e2e8f0').stroke();
      }

      doc
        .fontSize(10)
        .fillColor('#64748b')
        .font('Helvetica')
        .text(metric.label, x + 15, y + 12, { width: 100 });

      doc
        .fontSize(16)
        .fillColor(metric.color)
        .font('Helvetica-Bold')
        .text(metric.value, x + 15, y + 28, { width: 150 });

      doc
        .fontSize(14)
        .fillColor(metric.status === '✓' ? '#10b981' : '#f59e0b')
        .text(metric.status, x + colWidth - 40, y + 18);
    });

    doc.y = tableY + rowHeight * 3 + 40;
  }

  private addRecommendations(doc: PDFKit.PDFDocument, recommendations: Recommendation[]) {
    doc.addPage();
    this.pageNumber++;

    this.addSectionHeader(doc, 'AI-Powered Recommendations', '#7c3aed');

    const topRecs = recommendations.slice(0, 5);

    topRecs.forEach((rec, index) => {
      if (doc.y > 650) {
        doc.addPage();
        this.pageNumber++;
      }

      const urgencyColor = rec.urgency === 'high' ? '#ef4444' : 
                          rec.urgency === 'medium' ? '#f59e0b' : '#10b981';
      const urgencyBg = rec.urgency === 'high' ? '#fef2f2' : 
                        rec.urgency === 'medium' ? '#fef3c7' : '#f0fdf4';

      const boxHeight = 110;
      doc.rect(50, doc.y, 495, boxHeight).fill('#ffffff');
      doc.rect(50, doc.y, 495, boxHeight).lineWidth(2).strokeColor(urgencyColor).stroke();

      doc.rect(50, doc.y, 495, 35).fill(urgencyBg);

      doc
        .fontSize(13)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${rec.title}`, 65, doc.y + 10, { width: 350 });

      doc.rect(450, doc.y + 5, 80, 22).fill(urgencyColor);
      doc
        .fontSize(9)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text(rec.urgency.toUpperCase(), 450, doc.y + 10, { width: 80, align: 'center' });

      const contentY = doc.y + 40;
      doc
        .fontSize(10)
        .fillColor('#475569')
        .font('Helvetica')
        .text(rec.description, 65, contentY, { width: 465, lineGap: 2 });

      doc.rect(50, doc.y + 100, 495, 1).fill('#e2e8f0');

      doc
        .fontSize(9)
        .fillColor('#64748b')
        .font('Helvetica')
        .text(`Impact Score: ${rec.impactScore}/100`, 65, doc.y + 88, { width: 200 })
        .text(`AI Confidence: High`, 280, doc.y + 88, { width: 200 });

      doc.y += boxHeight + 12;
    });
  }

  private addPredictiveAnalysis(doc: PDFKit.PDFDocument, predictions: any) {
    doc.addPage();
    this.pageNumber++;
    
    this.addSectionHeader(doc, '7-Day Efficiency Forecast', '#0891b2');

    if (predictions?.forecast) {
      const tableY = doc.y;
      const rowHeight = 35;
      const headerHeight = 30;

      doc.rect(50, tableY, 495, headerHeight).fill('#f1f5f9');
      doc.rect(50, tableY, 495, headerHeight + rowHeight * predictions.forecast.length).lineWidth(1).strokeColor('#e2e8f0').stroke();

      doc
        .fontSize(10)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('Day', 70, tableY + 10, { width: 80 })
        .text('Date', 170, tableY + 10, { width: 120 })
        .text('Efficiency', 310, tableY + 10, { width: 100 })
        .text('Confidence', 430, tableY + 10, { width: 100 });

      predictions.forecast.forEach((day: any, index: number) => {
        const y = tableY + headerHeight + index * rowHeight;
        const date = new Date(day.date).toLocaleDateString('en-IN', { 
          day: 'numeric', 
          month: 'short' 
        });
        const efficiency = day.efficiency;
        const color = efficiency >= 75 ? '#10b981' : efficiency >= 50 ? '#f59e0b' : '#ef4444';

        if (index % 2 === 0) {
          doc.rect(50, y, 495, rowHeight).fill('#fafafa');
        }

        doc
          .fontSize(10)
          .fillColor('#334155')
          .font('Helvetica')
          .text(`Day ${index + 1}`, 70, y + 10, { width: 80 })
          .text(date, 170, y + 10, { width: 120 });

        doc
          .fontSize(12)
          .fillColor(color)
          .font('Helvetica-Bold')
          .text(`${efficiency.toFixed(1)}%`, 310, y + 10, { width: 100 });

        doc
          .fontSize(10)
          .fillColor('#64748b')
          .font('Helvetica')
          .text(`${day.confidence.toFixed(1)}%`, 430, y + 10, { width: 100 });
      });

      doc.y = tableY + headerHeight + rowHeight * predictions.forecast.length + 20;
    }

    const riskColor = predictions?.degradationRisk === 'high' ? '#ef4444' : 
                      predictions?.degradationRisk === 'medium' ? '#f59e0b' : '#10b981';
    const riskBg = predictions?.degradationRisk === 'high' ? '#fef2f2' : 
                   predictions?.degradationRisk === 'medium' ? '#fef3c7' : '#f0fdf4';

    doc.rect(50, doc.y, 495, 90).fill(riskBg);
    doc.rect(50, doc.y, 495, 90).lineWidth(2).strokeColor(riskColor).stroke();

    doc
      .fontSize(13)
      .fillColor('#1e293b')
      .font('Helvetica-Bold')
      .text('Degradation Risk Assessment', 65, doc.y + 15);

    doc.rect(400, doc.y + 10, 130, 25).fill(riskColor);
    doc
      .fontSize(11)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text((predictions?.degradationRisk?.toUpperCase() || 'LOW') + ' RISK', 400, doc.y + 17, { width: 130, align: 'center' });

    doc
      .fontSize(10)
      .fillColor('#475569')
      .font('Helvetica')
      .text(`Next Recommended Cleaning: ${new Date(predictions?.nextCleaningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 65, doc.y + 50, { width: 465 })
      .text(`Expected Efficiency Recovery: ${predictions?.estimatedRecovery?.toFixed(1)}% after maintenance`, 65, doc.y + 68, { width: 465 });

    doc.y += 110;
  }

  private addCostBenefitAnalysis(doc: PDFKit.PDFDocument, costAnalysis: any) {
    if (doc.y > 500) {
      doc.addPage();
      this.pageNumber++;
    }

    this.addSectionHeader(doc, 'Financial Analysis & ROI', '#dc2626');

    if (costAnalysis?.monthlyAnalysis) {
      const analysis = costAnalysis.monthlyAnalysis;

      doc.rect(50, doc.y, 495, 180).fill('#f8fafc');
      doc.rect(50, doc.y, 495, 180).lineWidth(1).strokeColor('#e2e8f0').stroke();

      const startY = doc.y;

      doc
        .fontSize(12)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('Monthly Financial Overview', 65, startY + 15);

      const dataY = startY + 45;
      const lineHeight = 22;

      const financialData = [
        { label: 'Potential Monthly Revenue', value: `₹${analysis.potentialRevenue.toFixed(2)}`, color: '#64748b' },
        { label: 'Actual Monthly Revenue', value: `₹${analysis.actualRevenue.toFixed(2)}`, color: '#3b82f6' },
        { label: 'Energy Loss', value: `₹${analysis.energyLoss.toFixed(2)}`, color: '#ef4444' },
        { label: 'Maintenance Cost', value: `₹${analysis.cleaningCost.toFixed(2)}`, color: '#f59e0b' },
        { label: 'Net Monthly Savings', value: `₹${analysis.netSavings.toFixed(2)}`, color: '#10b981' },
      ];

      financialData.forEach((item, index) => {
        const y = dataY + index * lineHeight;
        
        doc
          .fontSize(10)
          .fillColor('#64748b')
          .font('Helvetica')
          .text(item.label, 65, y, { width: 250 });

        doc
          .fontSize(11)
          .fillColor(item.color)
          .font('Helvetica-Bold')
          .text(item.value, 340, y, { width: 180, align: 'right' });
      });

      doc.rect(50, dataY + 5 * lineHeight + 10, 495, 1).fill('#cbd5e1');

      doc.rect(65, dataY + 5 * lineHeight + 25, 455, 35).fill('#10b981');
      doc
        .fontSize(11)
        .fillColor('#ffffff')
        .font('Helvetica')
        .text('Return on Investment (ROI)', 80, dataY + 5 * lineHeight + 33);

      doc
        .fontSize(18)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text(`${analysis.roi}%`, 340, dataY + 5 * lineHeight + 33, { width: 165, align: 'right' });

      doc.y = startY + 195;
    }

    if (costAnalysis?.recommendations) {
      this.addInfoBox(doc, 'Optimization Recommendations', [
        `Optimal Cleaning Frequency: ${costAnalysis.recommendations.optimalCleaningFrequency} times per month`,
        `Estimated Annual Savings: ₹${costAnalysis.recommendations.estimatedAnnualSavings.toFixed(2)}`,
        `Payback Period: ${costAnalysis.recommendations.optimalCleaningFrequency > 0 ? '~' + Math.ceil(12 / costAnalysis.recommendations.optimalCleaningFrequency) : 'N/A'} months for full optimization`
      ]);
    }
  }

  private addActionPlan(doc: PDFKit.PDFDocument, data: ReportData) {
    doc.addPage();
    this.pageNumber++;

    this.addSectionHeader(doc, 'Recommended Action Plan', '#ea580c');

    const highPriorityRecs = data.recommendations.filter(r => r.urgency === 'high').slice(0, 3);
    const mediumPriorityRecs = data.recommendations.filter(r => r.urgency === 'medium').slice(0, 2);

    if (highPriorityRecs.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('Immediate Actions (High Priority)', 50, doc.y);
      
      doc.y += 10;

      highPriorityRecs.forEach((rec, index) => {
        doc.rect(50, doc.y, 495, 45).fill('#fef2f2');
        doc.rect(50, doc.y, 495, 45).lineWidth(1).strokeColor('#ef4444').stroke();

        doc.rect(50, doc.y, 8, 45).fill('#ef4444');

        doc
          .fontSize(11)
          .fillColor('#1e293b')
          .font('Helvetica-Bold')
          .text(`${index + 1}. ${rec.title}`, 70, doc.y + 10, { width: 460 });

        doc
          .fontSize(9)
          .fillColor('#64748b')
          .font('Helvetica')
          .text(`Impact: ${rec.impactScore}/100`, 70, doc.y + 28, { width: 460 });

        doc.y += 55;
      });
    }

    if (mediumPriorityRecs.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#1e293b')
        .font('Helvetica-Bold')
        .text('Short-term Actions (Medium Priority)', 50, doc.y);
      
      doc.y += 10;

      mediumPriorityRecs.forEach((rec, index) => {
        doc.rect(50, doc.y, 495, 45).fill('#fef3c7');
        doc.rect(50, doc.y, 495, 45).lineWidth(1).strokeColor('#f59e0b').stroke();

        doc.rect(50, doc.y, 8, 45).fill('#f59e0b');

        doc
          .fontSize(11)
          .fillColor('#1e293b')
          .font('Helvetica-Bold')
          .text(`${index + 1}. ${rec.title}`, 70, doc.y + 10, { width: 460 });

        doc
          .fontSize(9)
          .fillColor('#64748b')
          .font('Helvetica')
          .text(`Impact: ${rec.impactScore}/100`, 70, doc.y + 28, { width: 460 });

        doc.y += 55;
      });
    }

    doc.y += 20;

    const summaryText = `This action plan prioritizes recommendations based on urgency and potential impact. ` +
      `Implementing high-priority actions first will yield the most significant improvements in system efficiency. ` +
      `Regular monitoring and maintenance according to this schedule will optimize your solar panel performance and maximize ROI.`;

    doc.rect(50, doc.y, 495, 80).fill('#eff6ff');
    doc.rect(50, doc.y, 495, 80).lineWidth(1).strokeColor('#3b82f6').stroke();

    doc
      .fontSize(10)
      .fillColor('#1e3a8a')
      .font('Helvetica-Bold')
      .text('📌 Important Note', 65, doc.y + 15);

    doc
      .fontSize(9)
      .fillColor('#1e40af')
      .font('Helvetica')
      .text(summaryText, 65, doc.y + 35, { width: 465, align: 'justify', lineGap: 2 });
  }

  private addFooterDisclaimer(doc: PDFKit.PDFDocument) {
    const pageCount = this.pageNumber;
    
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .font('Helvetica')
      .text(`Report Generated: ${new Date().toLocaleDateString('en-IN')} | Total Pages: ${pageCount}`, 50, 770, { align: 'center', width: 495 })
      .text('AI-Powered Solar Optimizer | Predictive Analytics & Performance Monitoring', 50, 785, { align: 'center', width: 495 });

    doc
      .fontSize(7)
      .fillColor('#cbd5e1')
      .text('Disclaimer: This report provides AI-generated recommendations based on simulated sensor data. Consult certified professionals for critical decisions.', 50, 800, { align: 'center', width: 495 });
  }
}

export const pdfGenerator = new PDFReportGenerator();
