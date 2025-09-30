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

type AgicapExplorer struct {
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

type UIComponent struct {
	Page       string                 `json:"page"`
	Type       string                 `json:"type"`
	Selector   string                 `json:"selector"`
	HTML       string                 `json:"html"`
	CSS        string                 `json:"css"`
	Text       string                 `json:"text"`
	Attributes map[string]interface{} `json:"attributes"`
}

type PageAnalysis struct {
	Components []UIComponent `json:"components"`
	Layout     LayoutInfo    `json:"layout"`
	Colors     []string      `json:"colors"`
	Fonts      []string      `json:"fonts"`
}

type LayoutInfo struct {
	HasHeader  bool   `json:"hasHeader"`
	HasSidebar bool   `json:"hasSidebar"`
	HasFooter  bool   `json:"hasFooter"`
	GridSystem string `json:"gridSystem"`
}

func NewAgicapExplorer(outputDir string, headless bool, verbose bool) (*AgicapExplorer, error) {
	// Create output directory structure
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	dirs := []string{"screenshots", "html", "components", "styles"}
	for _, dir := range dirs {
		os.MkdirAll(filepath.Join(outputDir, dir), 0755)
	}

	// Browser options
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", headless),
		chromedp.Flag("disable-gpu", false),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("window-size", "1920,1080"),
		chromedp.UserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
	)

	allocCtx, cancel := chromedp.NewExecAllocator(context.Background(), opts...)
	ctx, _ := chromedp.NewContext(allocCtx)

	if verbose {
		ctx, _ = chromedp.NewContext(allocCtx, chromedp.WithLogf(log.Printf))
	}

	return &AgicapExplorer{
		ctx:           ctx,
		cancel:        cancel,
		outputDir:     outputDir,
		visitedURLs:   make(map[string]bool),
		navigationMap: []NavigationItem{},
		verbose:       verbose,
	}, nil
}

func (e *AgicapExplorer) Close() {
	if e.cancel != nil {
		e.cancel()
	}
}

func (e *AgicapExplorer) Login(loginURL, email, password string) error {
	e.log("🔐 Logging in to: %s", loginURL)

	// Navigate to login page
	if err := chromedp.Run(e.ctx,
		chromedp.Navigate(loginURL),
		chromedp.Sleep(3*time.Second),
	); err != nil {
		return fmt.Errorf("failed to navigate: %w", err)
	}

	// Analyze login page structure
	var loginInfo string
	chromedp.Run(e.ctx,
		chromedp.Evaluate(`JSON.stringify({
			title: document.title,
			url: window.location.href,
			forms: Array.from(document.querySelectorAll('form')).map(f => ({
				action: f.action,
				method: f.method,
				id: f.id,
				className: f.className
			})),
			emailInputs: Array.from(document.querySelectorAll('input[type="email"], input[name*="email"], input[id*="email"], input[placeholder*="email" i]')).map(i => ({
				id: i.id,
				name: i.name,
				type: i.type,
				placeholder: i.placeholder,
				className: i.className
			})),
			passwordInputs: Array.from(document.querySelectorAll('input[type="password"]')).map(i => ({
				id: i.id,
				name: i.name,
				className: i.className
			})),
			submitButtons: Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"], button')).map(b => ({
				id: b.id,
				className: b.className,
				text: b.textContent.trim(),
				type: b.type
			}))
		}, null, 2)`, &loginInfo),
	)

	e.log("Login page structure:\n%s", loginInfo)

	// Save login analysis
	ioutil.WriteFile(filepath.Join(e.outputDir, "login_analysis.json"), []byte(loginInfo), 0644)

	// Try to fill login form
	e.log("🔑 Filling credentials...")

	// Fill email/username
	if err := chromedp.Run(e.ctx,
		chromedp.Sleep(2*time.Second),
		chromedp.WaitVisible(`input[type="email"], input[name*="email"], input[id*="email"], input[name*="username"]`, chromedp.ByQuery),
		chromedp.SendKeys(`input[type="email"], input[name*="email"], input[id*="email"], input[name*="username"]`, email, chromedp.ByQuery),
		chromedp.Sleep(500*time.Millisecond),
	); err != nil {
		return fmt.Errorf("failed to fill email: %w", err)
	}

	// Fill password
	if err := chromedp.Run(e.ctx,
		chromedp.SendKeys(`input[type="password"]`, password, chromedp.ByQuery),
		chromedp.Sleep(500*time.Millisecond),
	); err != nil {
		return fmt.Errorf("failed to fill password: %w", err)
	}

	// Submit form
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

func (e *AgicapExplorer) CapturePage(pageName string) error {
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

	// Analyze components
	e.analyzeComponents(pageName)

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

func (e *AgicapExplorer) analyzeComponents(pageName string) {
	var analysis string
	chromedp.Run(e.ctx,
		chromedp.Evaluate(`
		(function() {
			const components = [];
			const colors = new Set();
			const fonts = new Set();

			// Helper to get computed styles
			function getStyles(el) {
				const styles = window.getComputedStyle(el);
				return {
					backgroundColor: styles.backgroundColor,
					color: styles.color,
					fontSize: styles.fontSize,
					fontFamily: styles.fontFamily,
					fontWeight: styles.fontWeight,
					padding: styles.padding,
					margin: styles.margin,
					border: styles.border,
					borderRadius: styles.borderRadius,
					boxShadow: styles.boxShadow,
					display: styles.display,
					width: styles.width,
					height: styles.height
				};
			}

			// Analyze header/nav
			document.querySelectorAll('header, nav, [role="banner"], [role="navigation"]').forEach(el => {
				const styles = getStyles(el);
				components.push({
					type: 'navigation',
					selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ')[0] : ''),
					html: el.outerHTML.substring(0, 500),
					css: styles,
					text: el.textContent.trim().substring(0, 200)
				});
				if (styles.backgroundColor) colors.add(styles.backgroundColor);
				if (styles.color) colors.add(styles.color);
				if (styles.fontFamily) fonts.add(styles.fontFamily);
			});

			// Analyze buttons
			document.querySelectorAll('button, .btn, [role="button"], input[type="button"], input[type="submit"]').forEach((el, i) => {
				if (i < 30) {
					const styles = getStyles(el);
					components.push({
						type: 'button',
						selector: el.className || el.id || el.tagName,
						html: el.outerHTML,
						css: styles,
						text: el.textContent.trim()
					});
					if (styles.backgroundColor) colors.add(styles.backgroundColor);
					if (styles.color) colors.add(styles.color);
				}
			});

			// Analyze cards/panels
			document.querySelectorAll('.card, .panel, [class*="Card"], [class*="Panel"], [class*="card"], [class*="panel"]').forEach((el, i) => {
				if (i < 20) {
					const styles = getStyles(el);
					components.push({
						type: 'card',
						selector: el.className,
						html: el.outerHTML.substring(0, 500),
						css: styles,
						text: el.textContent.trim().substring(0, 200)
					});
					if (styles.backgroundColor) colors.add(styles.backgroundColor);
					if (styles.borderRadius) colors.add(styles.borderRadius);
				}
			});

			// Analyze forms
			document.querySelectorAll('form, input, select, textarea').forEach((el, i) => {
				if (i < 20) {
					const styles = getStyles(el);
					components.push({
						type: 'form-element',
						selector: el.name || el.id || el.className,
						html: el.outerHTML,
						css: styles,
						text: el.placeholder || el.value || ''
					});
				}
			});

			// Analyze tables/grids
			document.querySelectorAll('table, [role="grid"], .table, .data-grid, [class*="Table"], [class*="Grid"]').forEach((el, i) => {
				if (i < 10) {
					const styles = getStyles(el);
					components.push({
						type: 'table',
						selector: el.className || el.id,
						html: el.outerHTML.substring(0, 1000),
						css: styles
					});
				}
			});

			// Analyze layout structure
			const layout = {
				hasHeader: document.querySelector('header, [role="banner"]') !== null,
				hasSidebar: document.querySelector('aside, .sidebar, [class*="Sidebar"]') !== null,
				hasFooter: document.querySelector('footer, [role="contentinfo"]') !== null,
				gridSystem: document.querySelector('[class*="grid"]') ? 'grid' :
							document.querySelector('[class*="flex"]') ? 'flexbox' : 'unknown'
			};

			return JSON.stringify({
				components: components,
				layout: layout,
				colors: Array.from(colors),
				fonts: Array.from(fonts)
			}, null, 2);
		})()
		`, &analysis),
	)

	componentsPath := filepath.Join(e.outputDir, "components", sanitize(pageName)+"_analysis.json")
	ioutil.WriteFile(componentsPath, []byte(analysis), 0644)
}

func (e *AgicapExplorer) ExploreAllScreens(maxPages int) error {
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
				'header a'
			];

			selectors.forEach(sel => {
				document.querySelectorAll(sel).forEach(el => {
					const text = el.textContent.trim();
					const href = el.href;
					if (text && href && !href.includes('javascript:') && !href.includes('#')) {
						items.push({
							text: text,
							href: href,
							selector: el.className || el.id
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
		time.Sleep(1 * time.Second)
	}

	return nil
}

func (e *AgicapExplorer) GenerateReport() error {
	e.log("📝 Generating reports...")

	// Navigation map
	navJSON, _ := json.MarshalIndent(e.navigationMap, "", "  ")
	ioutil.WriteFile(filepath.Join(e.outputDir, "navigation_map.json"), navJSON, 0644)

	// HTML Report
	htmlReport := e.generateHTMLReport()
	ioutil.WriteFile(filepath.Join(e.outputDir, "report.html"), []byte(htmlReport), 0644)

	// Technical documentation
	techDoc := e.generateTechDoc()
	ioutil.WriteFile(filepath.Join(e.outputDir, "REBUILD_GUIDE.md"), []byte(techDoc), 0644)

	e.log("✅ Reports generated at: %s", e.outputDir)
	return nil
}

func (e *AgicapExplorer) generateHTMLReport() string {
	html := `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>UI Exploration Report</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; }
		.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
		.container { max-width: 1400px; margin: 0 auto; padding: 30px 20px; }
		.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
		.stat-card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
		.stat-card h3 { color: #667eea; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
		.stat-card .number { font-size: 36px; font-weight: bold; color: #2d3748; }
		.page-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 30px; margin-top: 30px; }
		.page-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: transform 0.3s; }
		.page-card:hover { transform: translateY(-5px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
		.page-card img { width: 100%; height: 250px; object-fit: cover; border-bottom: 3px solid #667eea; }
		.page-card .content { padding: 20px; }
		.page-card h3 { color: #2d3748; margin-bottom: 10px; font-size: 18px; }
		.page-card .url { color: #667eea; font-size: 13px; word-break: break-all; margin-bottom: 10px; }
		.page-card .meta { color: #718096; font-size: 12px; }
		.nav-links { background: #f7fafc; padding: 15px; border-radius: 8px; margin-top: 15px; max-height: 200px; overflow-y: auto; }
		.nav-links p { font-size: 12px; color: #4a5568; margin: 5px 0; padding: 5px; background: white; border-radius: 4px; }
		details { margin-top: 10px; }
		summary { cursor: pointer; color: #667eea; font-weight: 600; padding: 10px; background: #f7fafc; border-radius: 4px; }
		summary:hover { background: #edf2f7; }
	</style>
</head>
<body>
	<div class="header">
		<h1>🎨 UI Exploration Report</h1>
		<p style="margin-top: 10px; opacity: 0.9;">Generated: ` + time.Now().Format("January 2, 2006 at 3:04 PM") + `</p>
	</div>

	<div class="container">
		<div class="stats">
			<div class="stat-card">
				<h3>Pages Captured</h3>
				<div class="number">` + fmt.Sprintf("%d", len(e.navigationMap)) + `</div>
			</div>
			<div class="stat-card">
				<h3>Unique URLs</h3>
				<div class="number">` + fmt.Sprintf("%d", len(e.visitedURLs)) + `</div>
			</div>
			<div class="stat-card">
				<h3>Screenshots</h3>
				<div class="number">` + fmt.Sprintf("%d", len(e.navigationMap)) + `</div>
			</div>
		</div>

		<h2 style="margin-top: 40px; color: #2d3748;">📱 Captured Screens</h2>
		<div class="page-grid">`

	for i, item := range e.navigationMap {
		html += fmt.Sprintf(`
			<div class="page-card">
				<img src="%s" alt="%s" loading="lazy">
				<div class="content">
					<h3>%d. %s</h3>
					<div class="url">%s</div>
					<div class="meta">Captured: %s</div>
					<details>
						<summary>Navigation Links (%d)</summary>
						<div class="nav-links">%s</div>
					</details>
				</div>
			</div>`,
			"screenshots/"+filepath.Base(item.Screenshot),
			item.Title,
			i+1,
			item.Title,
			item.URL,
			item.Timestamp,
			len(item.Navigation),
			formatLinks(item.Navigation, 20))
	}

	html += `
		</div>
	</div>
</body>
</html>`

	return html
}

func (e *AgicapExplorer) generateTechDoc() string {
	// Build routes string
	routes := ""
	for i, item := range e.navigationMap {
		if i < 10 {
			routes += fmt.Sprintf("  { path: '%s', title: '%s' },\n", item.URL, item.Title)
		}
	}

	return fmt.Sprintf("# UI Rebuild Guide\n\n**Generated:** %s\n\n## 📋 Overview\n\nThis guide provides everything you need to rebuild the UI in your own project.\n\n## 📁 Files Generated\n\n- **report.html** - Visual report with all screenshots\n- **navigation_map.json** - Complete navigation structure\n- **screenshots/** - PNG screenshots of each page\n- **html/** - Raw HTML source of each page\n- **components/** - Extracted UI component analysis\n\n## 🎨 Design System Extraction\n\n### Step 1: Extract Colors\n\nOpen any component analysis JSON file and look for the colors array. Common colors found:\n\n```json\n{\n  \"colors\": [\"rgb(255, 255, 255)\", \"rgb(102, 126, 234)\", ...]\n}\n```\n\nCreate a color palette:\n\n```css\n:root {\n  --primary: %s;\n  --secondary: %s;\n  --background: %s;\n  --text: %s;\n  --border: %s;\n}\n```\n\n### Step 2: Extract Typography\n\nLook at fonts in component JSON files:\n\n```css\n:root {\n  --font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n  --font-size-base: 16px;\n  --font-weight-normal: 400;\n  --font-weight-semibold: 600;\n  --font-weight-bold: 700;\n}\n```\n\n### Step 3: Extract Spacing & Layout\n\nFrom component CSS:\n\n```css\n:root {\n  --spacing-xs: 4px;\n  --spacing-sm: 8px;\n  --spacing-md: 16px;\n  --spacing-lg: 24px;\n  --spacing-xl: 32px;\n  --border-radius: 8px;\n  --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);\n  --shadow-md: 0 4px 12px rgba(0,0,0,0.15);\n}\n```\n\n## 🏗️ Component Library\n\n### Buttons\n\nFrom the button components extracted, create:\n\n```jsx\n// Button.tsx\nexport const Button = ({ children, variant = 'primary', ...props }) => {\n  return (\n    <button\n      className={`btn btn-${variant}`}\n      {...props}\n    >\n      {children}\n    </button>\n  );\n};\n```\n\n### Cards\n\n```jsx\n// Card.tsx\nexport const Card = ({ children, title }) => {\n  return (\n    <div className=\"card\">\n      {title && <h3>{title}</h3>}\n      <div className=\"card-content\">{children}</div>\n    </div>\n  );\n};\n```\n\n### Forms\n\n```jsx\n// Input.tsx\nexport const Input = ({ label, ...props }) => {\n  return (\n    <div className=\"form-group\">\n      {label && <label>{label}</label>}\n      <input className=\"form-input\" {...props} />\n    </div>\n  );\n};\n```\n\n## 🗺️ Application Structure\n\n### Recommended Tech Stack\n\n- **Framework:** Next.js 14+ (React)\n- **Styling:** Tailwind CSS or styled-components\n- **State:** Zustand or Redux Toolkit\n- **Forms:** React Hook Form\n- **Tables:** TanStack Table\n- **Charts:** Recharts or Chart.js\n\n### Page Structure\n\nBased on navigation_map.json, create these routes:\n\n```javascript\n// routes.js\nconst routes = [\n%s  // ... etc\n];\n```\n\n### Layout Components\n\n1. **App Layout** - Main wrapper\n2. **Header** - Top navigation\n3. **Sidebar** - Side navigation (if present)\n4. **Content Area** - Main content\n5. **Footer** - Bottom section\n\n## 🔧 Implementation Steps\n\n### 1. Setup Project\n\n```bash\nnpx create-next-app@latest my-app\ncd my-app\nnpm install tailwindcss @headlessui/react recharts zustand\n```\n\n### 2. Create Design System\n\nCreate styles/design-system.css with extracted colors, fonts, spacing.\n\n### 3. Build Component Library\n\nCreate reusable components based on extracted analysis:\n- components/ui/Button.tsx\n- components/ui/Card.tsx\n- components/ui/Input.tsx\n- components/ui/Table.tsx\n\n### 4. Implement Layouts\n\n- components/layouts/AppLayout.tsx\n- components/layouts/Header.tsx\n- components/layouts/Sidebar.tsx\n\n### 5. Build Pages\n\nCreate pages matching the navigation structure:\n- app/dashboard/page.tsx\n- app/cashflow/page.tsx\n- etc.\n\n### 6. Add Interactivity\n\n- Form validation\n- API integration\n- State management\n- Routing\n\n## 📊 Data Flow\n\nStudy the HTML files to understand:\n- How data is structured\n- What API endpoints might be called\n- What state is needed\n\n## 🎯 Next Steps\n\n1. ✅ Review all screenshots\n2. ✅ Extract design tokens (colors, fonts, spacing)\n3. ✅ Identify reusable components\n4. ✅ Create component library\n5. ✅ Build layouts\n6. ✅ Implement pages\n7. ✅ Add functionality\n8. ✅ Polish and optimize\n\n## 📚 Resources\n\n- React: https://react.dev\n- Next.js: https://nextjs.org\n- Tailwind CSS: https://tailwindcss.com\n- Component Libraries: Shadcn UI, Material-UI, Ant Design\n\n---\n\n**Total Pages:** %d\n**Total Screenshots:** %d\n**Components Analyzed:** Check individual JSON files in components/ directory\n", time.Now().Format("2006-01-02 15:04:05"), "#667eea", "#764ba2", "#f5f7fa", "#2d3748", "#e2e8f0", routes, len(e.navigationMap), len(e.navigationMap))
}

func formatLinks(links []string, max int) string {
	html := ""
	for i, link := range links {
		if i >= max {
			html += fmt.Sprintf("<p><em>... and %d more</em></p>", len(links)-max)
			break
		}
		html += "<p>" + link + "</p>"
	}
	return html
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

func (e *AgicapExplorer) log(format string, args ...interface{}) {
	if e.verbose {
		fmt.Printf(format+"\n", args...)
	}
}

func main() {
	fmt.Println("🚀 Agicap UI Explorer")
	fmt.Println("=====================\n")

	// Configuration
	loginURL := "https://app.agicap.com/de/app/cashflow/forecast"
	email := "finance@visioneers.io"
	password := "Gottistimmergut2025!"
	outputDir := "./agicap_ui_analysis"
	headless := false // Set true to run in background
	maxPages := 30    // Maximum pages to explore

	// Create explorer
	explorer, err := NewAgicapExplorer(outputDir, headless, true)
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
	fmt.Println("  • report.html - Visual report")
	fmt.Println("  • REBUILD_GUIDE.md - Technical guide")
	fmt.Println("  • navigation_map.json - Navigation structure")
	fmt.Println("  • screenshots/ - All screenshots")
	fmt.Println("  • html/ - Page source code")
	fmt.Println("  • components/ - Component analysis")

	fmt.Println("\n⏳ Browser stays open for 60 seconds for inspection...")
	time.Sleep(60 * time.Second)
}
