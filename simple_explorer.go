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
)

type SimpleExplorer struct {
	ctx           context.Context
	cancel        context.CancelFunc
	outputDir     string
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

func NewSimpleExplorer(outputDir string, headless bool, verbose bool) (*SimpleExplorer, error) {
	// Create output directory structure
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	dirs := []string{"screenshots", "html", "components"}
	for _, dir := range dirs {
		os.MkdirAll(filepath.Join(outputDir, dir), 0755)
	}

	// Browser options - simplified and more robust
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", headless),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-web-security", true),
		chromedp.Flag("disable-features", "VizDisplayCompositor"),
		chromedp.Flag("disable-extensions", true),
		chromedp.Flag("disable-plugins", true),
		chromedp.Flag("disable-images", false),
		chromedp.Flag("disable-javascript", false),
		chromedp.Flag("window-size", "1920,1080"),
		chromedp.Flag("user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)

	// Create context with timeout
	ctx, cancelCtx := context.WithTimeout(allocCtx, 15*time.Minute)

	// Create browser context
	browserCtx, _ := chromedp.NewContext(ctx)

	return &SimpleExplorer{
		ctx:           browserCtx,
		cancel:        func() { cancelCtx(); cancel() },
		outputDir:     outputDir,
		visitedURLs:   make(map[string]bool),
		navigationMap: []NavigationItem{},
		verbose:       verbose,
	}, nil
}

func (e *SimpleExplorer) Close() {
	if e.cancel != nil {
		e.cancel()
	}
}

func (e *SimpleExplorer) Login(loginURL, email, password string) error {
	e.log("🔐 Logging in to: %s", loginURL)

	// Navigate to login page
	if err := chromedp.Run(e.ctx,
		chromedp.Navigate(loginURL),
		chromedp.Sleep(5*time.Second),
	); err != nil {
		return fmt.Errorf("failed to navigate: %w", err)
	}

	e.log("🔑 Filling credentials...")

	// Fill email - try multiple approaches
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
		ioutil.WriteFile(filepath.Join(e.outputDir, "screenshots", "login_failed.png"), buf, 0644)

		return fmt.Errorf("login appears to have failed - still on login page: %s", currentURL)
	}

	e.log("✅ Login successful! Current URL: %s", currentURL)
	return nil
}

func (e *SimpleExplorer) CapturePage(pageName string) error {
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
	screenshotPath := filepath.Join(e.outputDir, "screenshots", sanitize(pageName)+".png")
	chromedp.Run(e.ctx, chromedp.CaptureScreenshot(&screenshot))
	ioutil.WriteFile(screenshotPath, screenshot, 0644)

	// HTML
	htmlPath := filepath.Join(e.outputDir, "html", sanitize(pageName)+".html")
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

func (e *SimpleExplorer) ExploreAllScreens(maxPages int) error {
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
		time.Sleep(2 * time.Second)
	}

	return nil
}

func (e *SimpleExplorer) GenerateReport() error {
	e.log("📝 Generating reports...")

	// Navigation map
	navJSON, _ := json.MarshalIndent(e.navigationMap, "", "  ")
	ioutil.WriteFile(filepath.Join(e.outputDir, "navigation_map.json"), navJSON, 0644)

	// Generate simple rebuild guide
	rebuildGuide := fmt.Sprintf(`# Agicap UI Rebuild Guide

**Generated:** %s
**Pages Captured:** %d

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

---

**Ready to rebuild! 🚀**
`, time.Now().Format("2006-01-02 15:04:05"), len(e.navigationMap), func() string {
		pages := ""
		for _, item := range e.navigationMap {
			pages += fmt.Sprintf("- **%s** - %s\n", item.Title, item.URL)
		}
		return pages
	}())

	ioutil.WriteFile(filepath.Join(e.outputDir, "REBUILD_GUIDE.md"), []byte(rebuildGuide), 0644)

	e.log("✅ Reports generated at: %s", e.outputDir)
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

func (e *SimpleExplorer) log(format string, args ...interface{}) {
	if e.verbose {
		fmt.Printf(format+"\n", args...)
	}
}

func main() {
	fmt.Println("🚀 Simple Agicap UI Explorer")
	fmt.Println("============================\n")

	// Configuration
	loginURL := "https://app.agicap.com/de/app/cashflow/forecast"
	email := "finance@visioneers.io"
	password := "Gottistimmergut2025!"
	outputDir := "./agicap_ui_analysis"
	headless := true
	maxPages := 15

	// Create explorer
	explorer, err := NewSimpleExplorer(outputDir, headless, true)
	if err != nil {
		log.Fatalf("❌ Failed to create explorer: %v", err)
	}
	defer explorer.Close()

	// Step 1: Login
	fmt.Println("Step 1: Logging in...")
	if err := explorer.Login(loginURL, email, password); err != nil {
		log.Fatalf("❌ Login failed: %v", err)
	}

	// Step 2: Explore
	fmt.Println("\nStep 2: Exploring all screens...")
	if err := explorer.ExploreAllScreens(maxPages); err != nil {
		log.Fatalf("❌ Exploration failed: %v", err)
	}

	// Step 3: Generate reports
	fmt.Println("\nStep 3: Generating reports...")
	if err := explorer.GenerateReport(); err != nil {
		log.Fatalf("❌ Report generation failed: %v", err)
	}

	fmt.Println("\n✅ Exploration complete!")
	fmt.Printf("📂 Results: %s\n", outputDir)
	fmt.Println("\n📄 Files generated:")
	fmt.Println("  • REBUILD_GUIDE.md - Rebuild instructions")
	fmt.Println("  • navigation_map.json - Page structure")
	fmt.Println("  • screenshots/ - All screenshots")
	fmt.Println("  • html/ - Page source code")
}
