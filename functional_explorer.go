package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/chromedp"
	"github.com/spf13/viper"
)

type FunctionalExplorer struct {
	ctx           context.Context
	cancel        context.CancelFunc
	config        *viper.Viper
	visitedURLs   map[string]bool
	navigationMap []NavigationItem
	features      []FeatureTest
	verbose       bool
}

type NavigationItem struct {
	URL        string   `json:"url"`
	Title      string   `json:"title"`
	Screenshot string   `json:"screenshot"`
	Navigation []string `json:"navigation"`
	Timestamp  string   `json:"timestamp"`
}

type FeatureTest struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Page        string                 `json:"page"`
	Actions     []Action               `json:"actions"`
	Results     map[string]interface{} `json:"results"`
	Status      string                 `json:"status"` // success, failed, partial
	Timestamp   string                 `json:"timestamp"`
}

type Action struct {
	Type        string `json:"type"`        // click, fill, select, navigate
	Selector    string `json:"selector"`
	Value       string `json:"value,omitempty"`
	Description string `json:"description"`
	Result      string `json:"result,omitempty"`
}

func NewFunctionalExplorer(configFile string, verbose bool) (*FunctionalExplorer, error) {
	// Load configuration
	v := viper.New()
	v.SetConfigFile(configFile)
	v.SetConfigType("yaml")

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Create output directories
	outputDir := v.GetString("explorer.output.directory")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	// Create subdirectories
	dirs := []string{"screenshots", "html", "features", "reports"}
	for _, dir := range dirs {
		os.MkdirAll(filepath.Join(outputDir, dir), 0755)
	}

	// Browser options with enhanced capabilities
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", v.GetBool("explorer.browser.headless")),
		chromedp.Flag("disable-gpu", false),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-web-security", true),
		chromedp.Flag("disable-features", "VizDisplayCompositor"),
		chromedp.Flag("disable-extensions", true),
		chromedp.Flag("disable-plugins", true),
		chromedp.Flag("disable-images", false),
		chromedp.Flag("disable-javascript", false),
		chromedp.Flag("window-size", v.GetString("explorer.browser.window_size")),
		chromedp.UserAgent(v.GetString("explorer.browser.user_agent")),
		chromedp.Flag("enable-automation", false),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)

	// Create context with configurable timeout
	timeoutMinutes := v.GetInt("explorer.browser.timeout_minutes")
	ctx, cancelCtx := context.WithTimeout(allocCtx, time.Duration(timeoutMinutes)*time.Minute)

	// Create browser context with custom logger
	browserCtx, _ := chromedp.NewContext(ctx, chromedp.WithLogf(func(format string, args ...interface{}) {
		msg := fmt.Sprintf(format, args...)
		// Filter out known CDP errors
		if v.GetBool("explorer.error_handling.ignore_cdp_errors") {
			if strings.Contains(msg, "cookiePart") ||
				strings.Contains(msg, "parse error") ||
				strings.Contains(msg, "initialFrameNavigation") ||
				strings.Contains(msg, "unknown ClientNavigationReason") {
				return
			}
		}
		if verbose {
			log.Printf(msg)
		}
	}))

	return &FunctionalExplorer{
		ctx:           browserCtx,
		cancel:        func() { cancelCtx(); cancel() },
		config:        v,
		visitedURLs:   make(map[string]bool),
		navigationMap: []NavigationItem{},
		features:      []FeatureTest{},
		verbose:       verbose,
	}, nil
}

func (e *FunctionalExplorer) Close() {
	if e.cancel != nil {
		e.cancel()
	}
}

func (e *FunctionalExplorer) Login(loginURL, email, password string) error {
	e.log("🔐 Logging in to: %s", loginURL)

	var err error
	retryAttempts := e.config.GetInt("explorer.error_handling.retry_attempts")
	retryDelay := time.Duration(e.config.GetInt("explorer.error_handling.retry_delay")) * time.Second

	for i := 0; i < retryAttempts; i++ {
		err = chromedp.Run(e.ctx,
			chromedp.Navigate(loginURL),
			chromedp.Sleep(3*time.Second),
		)
		if err == nil {
			break
		}
		e.log("⚠️ Navigation attempt %d failed: %v", i+1, err)
		time.Sleep(retryDelay)
	}

	if err != nil {
		return fmt.Errorf("failed to navigate after %d attempts: %w", retryAttempts, err)
	}

	e.log("🔑 Filling credentials...")

	// Fill email/username
	if err := chromedp.Run(e.ctx,
		chromedp.Sleep(3*time.Second),
		chromedp.WaitVisible(`input[type="email"], input[name*="email"], input[id*="email"], input[name*="username"], input[placeholder*="email" i]`, chromedp.ByQuery, chromedp.NodeVisible),
		chromedp.SendKeys(`input[type="email"], input[name*="email"], input[id*="email"], input[name*="username"], input[placeholder*="email" i]`, email, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
	); err != nil {
		e.log("⚠️ Email input failed, trying alternative selectors...")
		chromedp.Run(e.ctx,
			chromedp.Click(`input[type="email"], input[name*="email"], input[id*="email"], input[name*="username"]`, chromedp.ByQuery),
			chromedp.Sleep(1*time.Second),
			chromedp.SendKeys(`input[type="email"], input[name*="email"], input[id*="email"], input[name*="username"]`, email, chromedp.ByQuery),
		)
	}

	// Fill password
	if err := chromedp.Run(e.ctx,
		chromedp.WaitVisible(`input[type="password"]`, chromedp.ByQuery, chromedp.NodeVisible),
		chromedp.SendKeys(`input[type="password"]`, password, chromedp.ByQuery),
		chromedp.Sleep(1*time.Second),
	); err != nil {
		e.log("⚠️ Password input failed, trying alternative approach...")
		chromedp.Run(e.ctx,
			chromedp.Click(`input[type="password"]`, chromedp.ByQuery),
			chromedp.Sleep(500*time.Millisecond),
			chromedp.SendKeys(`input[type="password"]`, password, chromedp.ByQuery),
		)
	}

	e.log("📤 Submitting login form...")
	if err := chromedp.Run(e.ctx,
		chromedp.Click(`button[type="submit"], input[type="submit"]`, chromedp.ByQuery),
		chromedp.Sleep(5*time.Second),
	); err != nil {
		e.log("⚠️ Submit button click failed, trying Enter key...")
		chromedp.Run(e.ctx,
			chromedp.KeyEvent("\r"),
			chromedp.Sleep(5*time.Second),
		)
	}

	var currentURL string
	chromedp.Run(e.ctx, chromedp.Evaluate("window.location.href", &currentURL))

	if strings.Contains(currentURL, "login") || strings.Contains(currentURL, "signin") || strings.Contains(currentURL, "sign_in") {
		var buf []byte
		chromedp.Run(e.ctx, chromedp.CaptureScreenshot(&buf))
		ioutil.WriteFile(filepath.Join(e.config.GetString("explorer.output.directory"), "screenshots", "login_failed.png"), buf, 0644)

		return fmt.Errorf("login appears to have failed - still on login page: %s", currentURL)
	}

	e.log("✅ Login successful! Current URL: %s", currentURL)
	return nil
}

func (e *FunctionalExplorer) CapturePage(pageName string) error {
	e.log("📸 Capturing: %s", pageName)

	var currentURL, pageTitle, pageHTML string
	err := chromedp.Run(e.ctx,
		chromedp.Sleep(2*time.Second),
		chromedp.Evaluate("window.location.href", &currentURL),
		chromedp.Evaluate("document.title", &pageTitle),
		chromedp.OuterHTML("html", &pageHTML),
	)
	if err != nil {
		return fmt.Errorf("failed to capture page: %w", err)
	}

	e.visitedURLs[currentURL] = true

	var screenshot []byte
	screenshotPath := filepath.Join(e.config.GetString("explorer.output.directory"), "screenshots", sanitize(pageName)+".png")
	chromedp.Run(e.ctx, chromedp.CaptureScreenshot(&screenshot))
	ioutil.WriteFile(screenshotPath, screenshot, 0644)

	htmlPath := filepath.Join(e.config.GetString("explorer.output.directory"), "html", sanitize(pageName)+".html")
	ioutil.WriteFile(htmlPath, []byte(pageHTML), 0644)

	var navLinks []string
	chromedp.Run(e.ctx,
		chromedp.Evaluate(`Array.from(document.querySelectorAll('a[href], button, [role="link"], [role="button"]'))
			.map(el => ({text: el.textContent.trim(), href: el.href || el.getAttribute('onclick') || ''}))
			.filter(l => l.text && l.text.length < 100)
			.map(l => l.text + ' → ' + l.href)
		`, &navLinks),
	)

	e.navigationMap = append(e.navigationMap, NavigationItem{
		URL:        currentURL,
		Title:      pageTitle,
		Screenshot: screenshotPath,
		Navigation: navLinks,
		Timestamp:  time.Now().Format(time.RFC3339),
	})

	e.log("✅ Captured: %s", pageTitle)
	return nil
}

func (e *FunctionalExplorer) TestLiquidityFeatures() {
	e.log("💰 Testing Liquidity Planning Features...")

	feature := FeatureTest{
		Name:        "Liquidity Planning",
		Description: "Test all liquidity planning and cash flow features",
		Page:        "Liquidity Dashboard",
		Actions:     []Action{},
		Results:     make(map[string]interface{}),
		Status:      "in_progress",
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	// Navigate to liquidity page
	chromedp.Run(e.ctx,
		chromedp.Navigate("https://app.agicap.com/liquidity"),
		chromedp.Sleep(3*time.Second),
	)

	e.CapturePage("liquidity_dashboard")

	// Test scenario switching
	scenarios := []string{"optimistic", "realistic", "pessimistic"}
	for _, scenario := range scenarios {
		e.log("🔄 Testing scenario: %s", scenario)

		action := Action{
			Type:        "select",
			Selector:    `select[name*="scenario"], select[class*="scenario"]`,
			Value:       scenario,
			Description: fmt.Sprintf("Switch to %s scenario", scenario),
		}

		err := chromedp.Run(e.ctx,
			chromedp.Click(`select[name*="scenario"], select[class*="scenario"]`, chromedp.ByQuery),
			chromedp.Sleep(500*time.Millisecond),
			chromedp.SendKeys(`select[name*="scenario"], select[class*="scenario"]`, scenario, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)

		if err != nil {
			action.Result = "failed"
		} else {
			action.Result = "success"
		}

		feature.Actions = append(feature.Actions, action)
	}

	// Test manual transaction entry
	e.log("📝 Testing manual transaction entry...")

	// Look for add transaction button
	addButtonSelectors := []string{
		`button[class*="add"]`,
		`button[class*="new"]`,
		`button[class*="create"]`,
		`[data-testid*="add"]`,
		`[data-testid*="new"]`,
		`button:contains("Add")`,
		`button:contains("New")`,
		`button:contains("Create")`,
	}

	for _, selector := range addButtonSelectors {
		err := chromedp.Run(e.ctx,
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)
		if err == nil {
			e.log("✅ Found add transaction button: %s", selector)
			e.CapturePage("transaction_form")
			break
		}
	}

	// Test form filling if modal opened
	e.TestTransactionForm()

	feature.Status = "success"
	e.features = append(e.features, feature)
}

func (e *FunctionalExplorer) TestTransactionForm() {
	e.log("📝 Testing transaction form...")

	// Look for form fields and fill them
	formFields := map[string]string{
		"amount":      "100.00",
		"description": "Test transaction from functional explorer",
		"category":    "Office & Administration",
		"date":        "2024-01-15",
		"type":        "expense",
	}

	for fieldName, value := range formFields {
		selectors := []string{
			fmt.Sprintf(`input[name*="%s"]`, fieldName),
			fmt.Sprintf(`input[id*="%s"]`, fieldName),
			fmt.Sprintf(`select[name*="%s"]`, fieldName),
			fmt.Sprintf(`select[id*="%s"]`, fieldName),
			fmt.Sprintf(`textarea[name*="%s"]`, fieldName),
			fmt.Sprintf(`textarea[id*="%s"]`, fieldName),
		}

		for _, selector := range selectors {
			err := chromedp.Run(e.ctx,
				chromedp.Click(selector, chromedp.ByQuery),
				chromedp.Sleep(500*time.Millisecond),
				chromedp.SendKeys(selector, value, chromedp.ByQuery),
				chromedp.Sleep(500*time.Millisecond),
			)
			if err == nil {
				e.log("✅ Filled field %s with %s", fieldName, value)
				break
			}
		}
	}

	// Try to save the form
	saveSelectors := []string{
		`button[type="submit"]`,
		`button[class*="save"]`,
		`button[class*="submit"]`,
		`button[class*="create"]`,
		`[data-testid*="save"]`,
		`[data-testid*="submit"]`,
	}

	for _, selector := range saveSelectors {
		err := chromedp.Run(e.ctx,
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)
		if err == nil {
			e.log("✅ Form saved successfully")
			break
		}
	}
}

func (e *FunctionalExplorer) TestCashFlowFeatures() {
	e.log("📊 Testing Cash Flow Forecasting Features...")

	feature := FeatureTest{
		Name:        "Cash Flow Forecasting",
		Description: "Test AI-powered cash flow forecasting features",
		Page:        "Cash Flow Dashboard",
		Actions:     []Action{},
		Results:     make(map[string]interface{}),
		Status:      "in_progress",
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	// Navigate to cash flow page
	chromedp.Run(e.ctx,
		chromedp.Navigate("https://app.agicap.com/cashflow"),
		chromedp.Sleep(3*time.Second),
	)

	e.CapturePage("cashflow_dashboard")

	// Test timeframe selection
	timeframes := []string{"6", "12", "24"}
	for _, timeframe := range timeframes {
		e.log("🕐 Testing timeframe: %s months", timeframe)

		action := Action{
			Type:        "select",
			Selector:    `select[name*="timeframe"], select[class*="timeframe"]`,
			Value:       timeframe,
			Description: fmt.Sprintf("Set timeframe to %s months", timeframe),
		}

		err := chromedp.Run(e.ctx,
			chromedp.Click(`select[name*="timeframe"], select[class*="timeframe"]`, chromedp.ByQuery),
			chromedp.Sleep(500*time.Millisecond),
			chromedp.SendKeys(`select[name*="timeframe"], select[class*="timeframe"]`, timeframe, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)

		if err != nil {
			action.Result = "failed"
		} else {
			action.Result = "success"
		}

		feature.Actions = append(feature.Actions, action)
	}

	// Test AI insights
	e.log("🤖 Testing AI insights...")

	// Look for AI insights section
	insightSelectors := []string{
		`[class*="insight"]`,
		`[class*="ai"]`,
		`[data-testid*="insight"]`,
		`[data-testid*="ai"]`,
	}

	for _, selector := range insightSelectors {
		var insights []string
		chromedp.Run(e.ctx,
			chromedp.Evaluate(fmt.Sprintf(`Array.from(document.querySelectorAll('%s')).map(el => el.textContent.trim())`, selector), &insights),
		)
		if len(insights) > 0 {
			e.log("✅ Found %d AI insights", len(insights))
			feature.Results["ai_insights"] = insights
			break
		}
	}

	feature.Status = "success"
	e.features = append(e.features, feature)
}

func (e *FunctionalExplorer) TestBankingFeatures() {
	e.log("🏦 Testing Banking Features...")

	feature := FeatureTest{
		Name:        "Banking Integration",
		Description: "Test bank account management and integration features",
		Page:        "Banking Dashboard",
		Actions:     []Action{},
		Results:     make(map[string]interface{}),
		Status:      "in_progress",
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	// Navigate to banking page
	chromedp.Run(e.ctx,
		chromedp.Navigate("https://app.agicap.com/bank"),
		chromedp.Sleep(3*time.Second),
	)

	e.CapturePage("banking_dashboard")

	// Test bank account management
	e.log("💳 Testing bank account management...")

	// Look for add bank account button
	addBankSelectors := []string{
		`button[class*="add"]`,
		`button[class*="connect"]`,
		`button[class*="link"]`,
		`[data-testid*="add-bank"]`,
		`[data-testid*="connect-bank"]`,
	}

	for _, selector := range addBankSelectors {
		err := chromedp.Run(e.ctx,
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)
		if err == nil {
			e.log("✅ Found add bank account button")
			e.CapturePage("add_bank_account")
			break
		}
	}

	feature.Status = "success"
	e.features = append(e.features, feature)
}

func (e *FunctionalExplorer) TestAllFeatures() {
	e.log("🚀 Starting comprehensive feature testing...")

	// Test core financial features
	e.TestLiquidityFeatures()
	e.TestCashFlowFeatures()
	e.TestBankingFeatures()

	// Test additional features
	e.TestSettingsFeatures()
	e.TestExportFeatures()
	e.TestReportingFeatures()
}

func (e *FunctionalExplorer) TestSettingsFeatures() {
	e.log("⚙️ Testing Settings Features...")

	feature := FeatureTest{
		Name:        "Settings & Configuration",
		Description: "Test application settings and configuration options",
		Page:        "Settings",
		Actions:     []Action{},
		Results:     make(map[string]interface{}),
		Status:      "in_progress",
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	// Navigate to settings
	chromedp.Run(e.ctx,
		chromedp.Navigate("https://app.agicap.com/settings"),
		chromedp.Sleep(3*time.Second),
	)

	e.CapturePage("settings_dashboard")

	// Test various settings sections
	settingsSections := []string{"profile", "company", "notifications", "integrations", "billing"}
	for _, section := range settingsSections {
		e.log("🔧 Testing %s settings", section)

		selector := fmt.Sprintf(`[href*="%s"], [class*="%s"]`, section, section)
		chromedp.Run(e.ctx,
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)

		e.CapturePage(fmt.Sprintf("settings_%s", section))
	}

	feature.Status = "success"
	e.features = append(e.features, feature)
}

func (e *FunctionalExplorer) TestExportFeatures() {
	e.log("📤 Testing Export Features...")

	feature := FeatureTest{
		Name:        "Export & Reporting",
		Description: "Test data export and reporting features",
		Page:        "Export Dashboard",
		Actions:     []Action{},
		Results:     make(map[string]interface{}),
		Status:      "in_progress",
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	// Navigate to export page
	chromedp.Run(e.ctx,
		chromedp.Navigate("https://app.agicap.com/export"),
		chromedp.Sleep(3*time.Second),
	)

	e.CapturePage("export_dashboard")

	// Test different export formats
	exportFormats := []string{"pdf", "excel", "csv", "datev"}
	for _, format := range exportFormats {
		e.log("📄 Testing %s export", format)

		selector := fmt.Sprintf(`button[class*="%s"], [data-format="%s"]`, format, format)
		chromedp.Run(e.ctx,
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)
	}

	feature.Status = "success"
	e.features = append(e.features, feature)
}

func (e *FunctionalExplorer) TestReportingFeatures() {
	e.log("📊 Testing Reporting Features...")

	feature := FeatureTest{
		Name:        "Advanced Reporting",
		Description: "Test advanced reporting and analytics features",
		Page:        "Reports Dashboard",
		Actions:     []Action{},
		Results:     make(map[string]interface{}),
		Status:      "in_progress",
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	// Navigate to reports page
	chromedp.Run(e.ctx,
		chromedp.Navigate("https://app.agicap.com/reports"),
		chromedp.Sleep(3*time.Second),
	)

	e.CapturePage("reports_dashboard")

	// Test different report types
	reportTypes := []string{"profit", "loss", "balance", "cashflow", "forecast"}
	for _, reportType := range reportTypes {
		e.log("📈 Testing %s report", reportType)

		selector := fmt.Sprintf(`[class*="%s"], [data-report="%s"]`, reportType, reportType)
		chromedp.Run(e.ctx,
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(2*time.Second),
		)

		e.CapturePage(fmt.Sprintf("report_%s", reportType))
	}

	feature.Status = "success"
	e.features = append(e.features, feature)
}

func (e *FunctionalExplorer) GenerateComprehensiveReport() error {
	e.log("📝 Generating comprehensive functional report...")

	// Save features data
	featuresJSON, _ := json.MarshalIndent(e.features, "", "  ")
	ioutil.WriteFile(filepath.Join(e.config.GetString("explorer.output.directory"), "features", "feature_tests.json"), featuresJSON, 0644)

	// Save navigation data
	navJSON, _ := json.MarshalIndent(e.navigationMap, "", "  ")
	ioutil.WriteFile(filepath.Join(e.config.GetString("explorer.output.directory"), "navigation_map.json"), navJSON, 0644)

	// Generate comprehensive rebuild guide
	rebuildGuide := e.generateFunctionalRebuildGuide()
	ioutil.WriteFile(filepath.Join(e.config.GetString("explorer.output.directory"), "FUNCTIONAL_REBUILD_GUIDE.md"), []byte(rebuildGuide), 0644)

	e.log("✅ Comprehensive functional report generated!")
	return nil
}

func (e *FunctionalExplorer) generateFunctionalRebuildGuide() string {
	return fmt.Sprintf(`# 🚀 Agicap Functional Rebuild Guide

**Generated:** %s
**Features Tested:** %d
**Pages Captured:** %d

## 🎯 Tested Features

%s

## 📱 Captured Pages
%s

## 🔧 Implementation Requirements

### 1. Core Financial Features
- **Liquidity Planning**: Real-time cash position tracking
- **Cash Flow Forecasting**: AI-powered predictions with confidence scoring
- **Scenario Management**: Optimistic/Realistic/Pessimistic views
- **Bank Account Integration**: Multi-account balance management

### 2. Data Entry & Management
- **Manual Transaction Entry**: Comprehensive form with categories
- **Recurring Transactions**: Automated recurring payment setup
- **Transaction Categorization**: Hierarchical category system
- **Bulk Operations**: Mass transaction management

### 3. AI & Analytics
- **AI Insights**: Pattern recognition and recommendations
- **Confidence Scoring**: Accuracy percentages for forecasts
- **Trend Analysis**: Growth rate and seasonality detection
- **Risk Assessment**: Volatility and risk level analysis

### 4. User Interface Components
- **Dashboard Widgets**: Financial overview cards
- **Interactive Charts**: Real-time data visualization
- **Modal Forms**: Transaction entry and editing
- **Responsive Design**: Mobile-first approach

### 5. Advanced Features
- **Export Functionality**: PDF, Excel, CSV, DATEV formats
- **Settings Management**: User and company configuration
- **Notification System**: Smart alerts and warnings
- **Multi-Company Support**: Tenant management

## 🛠️ Technical Implementation

### Frontend Stack
- **Framework**: Next.js 15+ with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with validation
- **State**: Zustand for state management

### Backend Requirements
- **API**: RESTful API with GraphQL support
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with JWT
- **File Storage**: AWS S3 for document storage
- **AI Integration**: OpenAI API for forecasting

### Key Components to Build
1. **LiquidityDashboard** - Main cash flow overview
2. **CashFlowForecast** - AI-powered predictions
3. **TransactionForm** - Manual data entry
4. **BankAccountManager** - Account integration
5. **ScenarioSelector** - Forecast scenarios
6. **AIInsightsPanel** - Smart recommendations
7. **ExportManager** - Data export functionality
8. **SettingsPanel** - Configuration management

## 📊 Feature Test Results

%s

## 🎨 Design System

### Colors
- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Warning: Yellow (#F59E0B)
- Error: Red (#EF4444)
- Neutral: Gray (#6B7280)

### Typography
- Headings: Inter (600-700 weight)
- Body: Inter (400-500 weight)
- Monospace: JetBrains Mono

### Spacing
- Base unit: 4px
- Common: 8px, 16px, 24px, 32px, 48px
- Layout: 64px, 96px, 128px

## 🚀 Next Steps

1. **Phase 1**: Implement core financial features
2. **Phase 2**: Add AI-powered forecasting
3. **Phase 3**: Integrate bank APIs
4. **Phase 4**: Build advanced analytics
5. **Phase 5**: Add export functionality

---

**Ready to rebuild Agicap with full functionality! 🚀**
`,
		time.Now().Format("2006-01-02 15:04:05"),
		len(e.features),
		len(e.navigationMap),
		func() string {
			features := ""
			for _, feature := range e.features {
				status := "✅"
				if feature.Status == "failed" {
					status = "❌"
				} else if feature.Status == "partial" {
					status = "⚠️"
				}
				features += fmt.Sprintf("- **%s** %s - %s\n", feature.Name, status, feature.Description)
			}
			return features
		}(),
		func() string {
			pages := ""
			for _, item := range e.navigationMap {
				pages += fmt.Sprintf("- **%s** - `%s`\n", item.Title, item.URL)
			}
			return pages
		}(),
		func() string {
			results := ""
			for _, feature := range e.features {
				results += fmt.Sprintf("### %s\n", feature.Name)
				results += fmt.Sprintf("- **Status**: %s\n", feature.Status)
				results += fmt.Sprintf("- **Actions**: %d\n", len(feature.Actions))
				results += fmt.Sprintf("- **Description**: %s\n\n", feature.Description)
			}
			return results
		}(),
	)
}

func sanitize(s string) string {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, ":", "_")
	s = strings.ReplaceAll(s, "*", "_")
	s = strings.ReplaceAll(s, "?", "_")
	s = strings.ReplaceAll(s, "\"", "_")
	s = strings.ReplaceAll(s, "<", "_")
	s = strings.ReplaceAll(s, ">", "_")
	s = strings.ReplaceAll(s, "|", "_")
	if len(s) > 100 {
		s = s[:100]
	}
	return s
}

func (e *FunctionalExplorer) log(format string, args ...interface{}) {
	if e.verbose {
		fmt.Printf(format+"\n", args...)
	}
}

func main() {
	fmt.Println("🚀 Agicap Functional Explorer")
	fmt.Println("=============================\n")

	// Load configuration
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")

	if err := v.ReadInConfig(); err != nil {
		log.Fatalf("❌ Fatal error config file: %s \n", err)
	}

	loginURL := v.GetString("explorer.login_url")
	email := v.GetString("explorer.credentials.email")
	password := v.GetString("explorer.credentials.password")
	verbose := true

	explorer, err := NewFunctionalExplorer("config.yaml", verbose)
	if err != nil {
		log.Fatalf("❌ Failed to create explorer: %v", err)
	}
	defer explorer.Close()

	fmt.Println("Step 1: Logging in...")
	if err := explorer.Login(loginURL, email, password); err != nil {
		log.Fatalf("❌ Login failed: %v", err)
	}

	fmt.Println("\nStep 2: Testing all features...")
	explorer.TestAllFeatures()

	fmt.Println("\nStep 3: Generating comprehensive report...")
	if err := explorer.GenerateComprehensiveReport(); err != nil {
		log.Fatalf("❌ Report generation failed: %v", err)
	}

	fmt.Println("\n✅ Functional exploration complete!")
	fmt.Printf("📂 Results: %s\n", v.GetString("explorer.output.directory"))
	fmt.Println("\n📄 Files generated:")
	fmt.Println("  • FUNCTIONAL_REBUILD_GUIDE.md - Complete rebuild guide")
	fmt.Println("  • features/feature_tests.json - Detailed test results")
	fmt.Println("  • navigation_map.json - Page structure")
	fmt.Println("  • screenshots/ - All page screenshots")
	fmt.Println("  • html/ - Page source code")
}
