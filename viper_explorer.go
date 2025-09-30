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

type ViperExplorer struct {
	ctx           context.Context
	cancel        context.CancelFunc
	config        *viper.Viper
	visitedURLs   map[string]bool
	navigationMap []NavigationItem
	verbose       bool
}

type NavigationItem struct {
	URL        string   `json:"url"`
	Title      string   `json:"title"`
	Screenshot string   `json:"screenshot"`
	Navigation []string `json:"navigation"`
	Timestamp  string   `json:"timestamp"`
}

func NewViperExplorer(configFile string, verbose bool) (*ViperExplorer, error) {
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

	dirs := v.GetStringSlice("explorer.output.create_directories")
	for _, dir := range dirs {
		os.MkdirAll(filepath.Join(outputDir, dir), 0755)
	}

	// Browser options
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", v.GetBool("explorer.browser.headless")),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-web-security", true),
		chromedp.Flag("disable-features", "VizDisplayCompositor"),
		chromedp.Flag("disable-extensions", true),
		chromedp.Flag("disable-plugins", true),
		chromedp.Flag("disable-images", false),
		chromedp.Flag("disable-javascript", false),
		chromedp.Flag("window-size", v.GetString("explorer.browser.window_size")),
		chromedp.Flag("user-agent", v.GetString("explorer.browser.user_agent")),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)

	// Create context with configurable timeout
	timeoutMinutes := v.GetInt("explorer.browser.timeout_minutes")
	ctx, cancelCtx := context.WithTimeout(allocCtx, time.Duration(timeoutMinutes)*time.Minute)

	// Create browser context with custom logger that filters CDP errors
	browserCtx, _ := chromedp.NewContext(ctx, chromedp.WithLogf(func(format string, args ...interface{}) {
		msg := fmt.Sprintf(format, args...)
		// Filter out known CDP errors if configured to do so
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

	return &ViperExplorer{
		ctx:           browserCtx,
		cancel:        func() { cancelCtx(); cancel() },
		config:        v,
		visitedURLs:   make(map[string]bool),
		navigationMap: []NavigationItem{},
		verbose:       verbose,
	}, nil
}

func (e *ViperExplorer) Close() {
	if e.cancel != nil {
		e.cancel()
	}
}

func (e *ViperExplorer) Login() error {
	loginURL := e.config.GetString("explorer.login_url")
	email := e.config.GetString("explorer.credentials.email")
	password := e.config.GetString("explorer.credentials.password")

	e.log("🔐 Logging in to: %s", loginURL)

	// Navigate to login page with retry
	retryAttempts := e.config.GetInt("explorer.error_handling.retry_attempts")
	retryDelay := e.config.GetInt("explorer.error_handling.retry_delay")

	var err error
	for i := 0; i < retryAttempts; i++ {
		err = chromedp.Run(e.ctx,
			chromedp.Navigate(loginURL),
			chromedp.Sleep(5*time.Second),
		)
		if err == nil {
			break
		}
		e.log("⚠️ Navigation attempt %d failed: %v", i+1, err)
		time.Sleep(time.Duration(retryDelay) * time.Second)
	}

	if err != nil {
		return fmt.Errorf("failed to navigate after %d attempts: %w", retryAttempts, err)
	}

	e.log("🔑 Filling credentials...")

	// Fill email with multiple selector attempts
	emailSelectors := []string{
		`input[type="email"]`,
		`input[name*="email"]`,
		`input[id*="email"]`,
		`input[name*="username"]`,
		`input[placeholder*="email" i]`,
		`input[placeholder*="E-Mail" i]`,
	}

	for _, selector := range emailSelectors {
		if err := chromedp.Run(e.ctx,
			chromedp.WaitVisible(selector, chromedp.ByQuery, chromedp.NodeVisible),
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(1*time.Second),
			chromedp.SendKeys(selector, email, chromedp.ByQuery),
			chromedp.Sleep(1*time.Second),
		); err == nil {
			e.log("✅ Email filled with selector: %s", selector)
			break
		}
	}

	// Fill password
	passwordSelectors := []string{
		`input[type="password"]`,
		`input[name*="password"]`,
		`input[id*="password"]`,
	}

	for _, selector := range passwordSelectors {
		if err := chromedp.Run(e.ctx,
			chromedp.WaitVisible(selector, chromedp.ByQuery, chromedp.NodeVisible),
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(1*time.Second),
			chromedp.SendKeys(selector, password, chromedp.ByQuery),
			chromedp.Sleep(1*time.Second),
		); err == nil {
			e.log("✅ Password filled with selector: %s", selector)
			break
		}
	}

	// Submit form
	e.log("📤 Submitting login form...")
	submitSelectors := []string{
		`button[type="submit"]`,
		`input[type="submit"]`,
		`button:contains("Login")`,
		`button:contains("Sign in")`,
		`button:contains("Anmelden")`,
		`[role="button"]:contains("Login")`,
	}

	for _, selector := range submitSelectors {
		if err := chromedp.Run(e.ctx,
			chromedp.Click(selector, chromedp.ByQuery),
			chromedp.Sleep(3*time.Second),
		); err == nil {
			e.log("✅ Form submitted with selector: %s", selector)
			break
		}
	}

	// Verify login
	var currentURL string
	chromedp.Run(e.ctx, chromedp.Evaluate("window.location.href", &currentURL))

	if strings.Contains(currentURL, "login") || strings.Contains(currentURL, "signin") || strings.Contains(currentURL, "sign_in") {
		// Take screenshot for debugging
		var buf []byte
		chromedp.Run(e.ctx, chromedp.CaptureScreenshot(&buf))
		outputDir := e.config.GetString("explorer.output.directory")
		ioutil.WriteFile(filepath.Join(outputDir, "screenshots", "login_failed.png"), buf, 0644)

		return fmt.Errorf("login appears to have failed - still on login page: %s", currentURL)
	}

	e.log("✅ Login successful! Current URL: %s", currentURL)
	return nil
}

func (e *ViperExplorer) CapturePage(pageName string) error {
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

	// Screenshot
	var screenshot []byte
	outputDir := e.config.GetString("explorer.output.directory")
	screenshotPath := filepath.Join(outputDir, "screenshots", sanitize(pageName)+".png")
	chromedp.Run(e.ctx, chromedp.CaptureScreenshot(&screenshot))
	ioutil.WriteFile(screenshotPath, screenshot, 0644)

	// HTML
	htmlPath := filepath.Join(outputDir, "html", sanitize(pageName)+".html")
	ioutil.WriteFile(htmlPath, []byte(pageHTML), 0644)

	// Extract navigation
	var navLinks []string
	chromedp.Run(e.ctx,
		chromedp.Evaluate(`Array.from(document.querySelectorAll('a[href], button, [role="link"], [role="button"]'))
			.map(el => ({text: el.textContent.trim(), href: el.href || el.getAttribute('onclick') || ''}))
			.filter(l => l.text && l.text.length < 100)
			.map(l => l.text + ' → ' + l.href)
		`, &navLinks),
	)

	// Save navigation item
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

func (e *ViperExplorer) ExploreAllScreens() error {
	maxPages := e.config.GetInt("explorer.exploration.max_pages")
	delayBetweenPages := e.config.GetInt("explorer.exploration.delay_between_pages")

	e.log("🗺️ Exploring application (max %d pages)...", maxPages)

	// Capture initial page
	e.CapturePage("01_initial_page")

	// Find all navigation items
	var navItems []map[string]interface{}
	chromedp.Run(e.ctx,
		chromedp.Evaluate(`
		(function() {
			const items = [];
			const selectors = [
				'nav a',
				'[role="navigation"] a',
				'.sidebar a',
				'.menu a',
				'[class*="Nav"] a',
				'[class*="Menu"] a',
				'[class*="Sidebar"] a',
				'header a',
				'.tab', '[role="tab"]',
				'.dropdown-item', '.menu-item'
			];

			selectors.forEach(sel => {
				document.querySelectorAll(sel).forEach(el => {
					const text = el.textContent.trim();
					const href = el.href || el.getAttribute('data-href') || el.getAttribute('onclick');
					if (text && href && !href.includes('javascript:') && !href.includes('#') && text.length < 50) {
						items.push({
							text: text,
							href: href,
							selector: el.className || el.id,
							type: el.tagName.toLowerCase()
						});
					}
				});
			});

			// Remove duplicates
			const unique = [];
			const seen = new Set();
			items.forEach(item => {
				if (!seen.has(item.href)) {
					seen.add(item.href);
					unique.push(item);
				}
			});

			return unique;
		})()
		`, &navItems),
	)

	e.log("Found %d navigation items", len(navItems))

	// Visit each page
	count := 1
	for i, item := range navItems {
		if i >= maxPages {
			break
		}

		text := item["text"].(string)
		href := item["href"].(string)

		// Skip if already visited
		if e.visitedURLs[href] {
			e.log("⏭️ Skipping (already visited): %s", text)
			continue
		}

		e.log("🔄 [%d/%d] Navigating to: %s", i+1, len(navItems), text)

		// Navigate
		if err := chromedp.Run(e.ctx,
			chromedp.Navigate(href),
			chromedp.Sleep(3*time.Second),
		); err != nil {
			e.log("⚠️ Failed to navigate to %s: %v", href, err)
			continue
		}

		// Capture
		count++
		pageName := fmt.Sprintf("%02d_%s", count, sanitize(text))
		e.CapturePage(pageName)

		// Delay between pages
		time.Sleep(time.Duration(delayBetweenPages) * time.Second)
	}

	return nil
}

func (e *ViperExplorer) GenerateReport() error {
	e.log("📝 Generating reports...")

	outputDir := e.config.GetString("explorer.output.directory")

	// Navigation map
	navJSON, _ := json.MarshalIndent(e.navigationMap, "", "  ")
	ioutil.WriteFile(filepath.Join(outputDir, "navigation_map.json"), navJSON, 0644)

	// Generate comprehensive rebuild guide
	rebuildGuide := fmt.Sprintf(`# 🚀 Agicap 1:1 Rebuild Guide

**Generated:** %s
**Pages Captured:** %d
**Configuration:** Viper-based with robust error handling

## 📱 Captured Pages

%s

## 🎯 Next Steps

1. Review screenshots in ./screenshots/
2. Analyze HTML source in ./html/
3. Use navigation_map.json for page structure
4. Build components based on captured UI

## 📚 Files Generated

- **navigation_map.json** - Complete page structure
- **screenshots/** - All page screenshots
- **html/** - Page source code
- **reports/** - Analysis reports

## ⚙️ Configuration Used

- **Max Pages:** %d
- **Headless Mode:** %t
- **Timeout:** %d minutes
- **Error Handling:** CDP errors filtered

---

**Ready to rebuild Agicap 1:1! 🚀**
`, time.Now().Format("2006-01-02 15:04:05"),
	len(e.navigationMap),
	func() string {
		pages := ""
		for _, item := range e.navigationMap {
			pages += fmt.Sprintf("- **%s** - %s\n", item.Title, item.URL)
		}
		return pages
	}(),
	e.config.GetInt("explorer.exploration.max_pages"),
	e.config.GetBool("explorer.browser.headless"),
	e.config.GetInt("explorer.browser.timeout_minutes"))

	ioutil.WriteFile(filepath.Join(outputDir, "REBUILD_GUIDE.md"), []byte(rebuildGuide), 0644)

	e.log("✅ Reports generated at: %s", outputDir)
	return nil
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

func (e *ViperExplorer) log(format string, args ...interface{}) {
	if e.verbose {
		fmt.Printf(format+"\n", args...)
	}
}

func main() {
	fmt.Println("🚀 Viper-Based Agicap UI Explorer")
	fmt.Println("==================================\n")

	// Load configuration
	configFile := "config.yaml"
	if len(os.Args) > 1 {
		configFile = os.Args[1]
	}

	// Create explorer
	explorer, err := NewViperExplorer(configFile, true)
	if err != nil {
		log.Fatalf("❌ Failed to create explorer: %v", err)
	}
	defer explorer.Close()

	// Step 1: Login
	fmt.Println("Step 1: Logging in...")
	if err := explorer.Login(); err != nil {
		log.Fatalf("❌ Login failed: %v", err)
	}

	// Step 2: Explore
	fmt.Println("\nStep 2: Exploring all screens...")
	if err := explorer.ExploreAllScreens(); err != nil {
		log.Fatalf("❌ Exploration failed: %v", err)
	}

	// Step 3: Generate reports
	fmt.Println("\nStep 3: Generating reports...")
	if err := explorer.GenerateReport(); err != nil {
		log.Fatalf("❌ Report generation failed: %v", err)
	}

	fmt.Println("\n✅ Exploration complete!")
	outputDir := explorer.config.GetString("explorer.output.directory")
	fmt.Printf("📂 Results: %s\n", outputDir)
	fmt.Println("\n📄 Files generated:")
	fmt.Println("  • REBUILD_GUIDE.md - Rebuild instructions")
	fmt.Println("  • navigation_map.json - Page structure")
	fmt.Println("  • screenshots/ - All screenshots")
	fmt.Println("  • html/ - Page source code")
}
