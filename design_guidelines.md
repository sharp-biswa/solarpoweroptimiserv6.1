# Solar Panel Efficiency Optimizer - Design Guidelines

## Design Approach

**Selected Framework**: Material Design 3 with dashboard specialization
**Rationale**: This utility-focused application requires information-dense layouts, real-time data visualization, and clear alert systems. Material Design excels at creating hierarchical data displays while maintaining clarity and usability across web and mobile platforms.

---

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary: 142 71% 45% (Renewable energy green - vibrant, trustworthy)
- Secondary: 45 95% 55% (Solar yellow - energetic, optimistic)
- Surface: 0 0% 98% (Clean background)
- Error/Alert: 4 90% 58% (Critical warnings)
- Warning: 38 92% 50% (Performance warnings)
- Success: 142 76% 36% (Optimal performance)

**Dark Mode:**
- Primary: 142 65% 55% (Softer green for dark backgrounds)
- Secondary: 45 90% 60% (Warm solar accent)
- Surface: 240 10% 12% (Deep charcoal)
- Surface Variant: 240 6% 18% (Card backgrounds)
- Error: 4 85% 63%
- Warning: 38 90% 55%
- Success: 142 70% 45%

**Data Visualization Colors:**
- Energy Output: 142 71% 45% (Green gradient)
- Temperature: 4 85% 58% (Red-orange gradient)
- Dust Levels: 38 65% 50% (Amber)
- Sunlight Intensity: 45 95% 55% (Yellow)
- Efficiency Trend: 199 89% 48% (Blue)

### B. Typography

**Font Stack**: 
- Primary: 'Inter' from Google Fonts (excellent for dashboards and data)
- Monospace (for metrics): 'JetBrains Mono' (sensor readings, timestamps)

**Type Scale:**
- Dashboard Title: 2.5rem / font-bold / tracking-tight
- Section Headers: 1.5rem / font-semibold
- Metric Labels: 0.875rem / font-medium / uppercase / tracking-wide
- Metric Values: 2rem / font-bold / monospace
- Body Text: 1rem / font-normal
- Small/Helper Text: 0.75rem / font-normal

### C. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6 to p-8
- Section spacing: mb-8 to mb-12
- Card gaps: gap-6
- Dashboard grid gaps: gap-4

**Grid Structure:**
- Desktop: 12-column grid with gap-6
- Tablet: 8-column grid with gap-4
- Mobile: 4-column grid with gap-4

**Dashboard Layout:**
- Sidebar Navigation: Fixed 280px width (desktop), collapsible drawer (mobile)
- Main Content: Fluid with max-w-screen-2xl
- Widget Cards: Responsive grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)

### D. Component Library

**Navigation:**
- Top App Bar: Fixed, elevated, contains alerts badge and user menu
- Side Navigation: Vertical rail with icons + labels, sections for Dashboard, Analytics, Recommendations, System Health, Settings
- Active state: Bold text with accent border-l-4

**Data Display Components:**

1. **Metric Cards**
   - Elevated cards (shadow-lg) with rounded-2xl
   - Large metric value at top in monospace
   - Trend indicator (up/down arrow with percentage)
   - Mini sparkline chart below metric
   - Color-coded left border (4px) based on status

2. **Real-Time Gauges**
   - Circular progress indicators for efficiency percentage
   - Color transitions: red (0-50%), amber (50-75%), green (75-100%)
   - Center value in large bold text
   - Label below in smaller text

3. **Time-Series Charts**
   - Line charts with smooth curves for trends
   - Area fills with 20% opacity below lines
   - Grid lines at 25% opacity
   - Interactive tooltips on hover
   - Time range selector (1H, 6H, 24H, 7D, 30D)

4. **Alert Banners**
   - Full-width banners at top of content area
   - Icon + Message + Timestamp + Action button
   - Color-coded backgrounds: Error (red/10%), Warning (amber/10%), Info (blue/10%)
   - Dismissible with X button

5. **Recommendation Cards**
   - Stacked list with priority badges
   - Impact score visualization (horizontal bars)
   - Urgency indicators (High/Medium/Low chips)
   - Expand/collapse for AI explanation
   - Action buttons at card footer

6. **Status Indicators**
   - Small circular badges with pulse animation for "live" data
   - Color states: Green (optimal), Yellow (warning), Red (critical), Gray (offline)

**Forms & Controls:**
- Threshold sliders with value display
- Toggle switches for automation features
- Date/time pickers for scheduling
- All inputs with clear labels and helper text
- Focus states with 2px accent border

**AI Explainability Module:**
- Expandable panels showing "Why this recommendation?"
- Feature importance bars (horizontal stacked)
- Natural language explanation in readable paragraphs
- "Learn More" links to documentation

### E. Animations

**Minimal, Purposeful Motion:**
- Data updates: Smooth number transitions (300ms ease-out)
- Chart animations: Fade-in on load (500ms)
- Alert entry: Slide down from top (200ms)
- Card hover: Subtle lift (transform scale 1.01, 150ms)
- Navigation drawer: Slide transition (250ms)

**Loading States:**
- Skeleton screens for chart areas
- Shimmer effect on metric cards during data fetch
- Linear progress bar for background operations

---

## Dashboard Sections

### 1. Overview Dashboard (Home)
- 4 key metric cards in top row (Energy Output, Efficiency %, Sunlight Intensity, System Status)
- 2-column layout below: Left = Real-time line chart, Right = Live gauges
- Alert banner section if any warnings exist
- Quick actions panel (Manual refresh, Download report)

### 2. Predictive Analytics
- Performance forecast graph (7-day ahead)
- Degradation risk indicators
- Maintenance calendar with predicted cleaning dates
- Historical comparison charts

### 3. Smart Recommendations
- Priority-sorted list of recommendations
- Filter controls (By Impact, By Type, By Urgency)
- Each card shows: Title, Description, Impact score, Urgency, AI Explanation (expandable)
- "Apply" or "Schedule" action buttons

### 4. System Health
- Panel grid showing each sensor status
- Offline/Online indicators
- Last update timestamps
- Diagnostic logs section

---

## Images

**Dashboard does not include traditional hero images.** Instead:
- Use illustrated icons for empty states (e.g., "No alerts - system optimal")
- Weather-appropriate solar panel illustrations in background of certain cards (subtle, 10% opacity)
- SVG icons from Heroicons for all UI elements
- Animated SVG for cleaning process visualization

---

## Responsive Behavior

**Mobile (< 768px):**
- Hamburger menu for navigation
- Metric cards stack vertically (grid-cols-1)
- Charts display in portrait aspect ratio
- Bottom navigation bar for quick access

**Tablet (768px - 1024px):**
- 2-column grid for metrics
- Side drawer navigation (toggle)
- Charts adapt to landscape

**Desktop (> 1024px):**
- Full 3-column dashboard layout
- Persistent side navigation
- Multi-chart views side-by-side

---

## Accessibility & Dark Mode

- All text maintains 4.5:1 contrast ratio minimum
- Focus indicators on all interactive elements
- ARIA labels for charts and dynamic content
- Dark mode toggle in user menu (persisted to localStorage)
- Reduced motion respect for users with vestibular disorders
- Screen reader announcements for alert changes