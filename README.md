<h1 align="center">🕷️ Web Scraper Worker</h1>

<p align="center">
  <strong>Universal Web Scraper | 通用网页爬虫</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#output">Output</a> •
  <a href="#功能特性">中文文档</a>
</p>

---

## 🇺🇸 English

### Overview

A powerful and flexible web scraper that automatically crawls websites, extracts structured data, and discovers new links. Built for CafeScraper platform with remote browser support via CDP (Chrome DevTools Protocol).

Perfect for:
- 📊 **Data Collection** - Extract titles, descriptions, keywords, headings, and more
- 🔗 **Link Discovery** - Automatically find and crawl related pages
- 📈 **SEO Analysis** - Gather page metadata and structure information
- 🗂️ **Content Monitoring** - Track changes across multiple pages

### Features

| Feature | Description |
|---------|-------------|
| 🔗 **Link Discovery** | Automatically discovers and crawls links within the same domain |
| 📏 **Depth Control** | Configurable crawling depth (starting page = depth 0) |
| 📊 **Page Limit** | Set maximum pages per crawl to control costs |
| 🚀 **Resource Control** | Optionally block media/CSS for faster crawling |
| 🔧 **jQuery Injection** | Optional jQuery injection for easier data extraction |
| 🔐 **SSL Support** | Ignore SSL errors for self-signed certificates |
| 🌐 **Remote Browser** | Connects to CafeScraper's fingerprint browser via CDP |

### Usage

1. **Add Starting URLs** - Enter the URLs you want to crawl
2. **Configure Options** - Set depth, page limit, and other parameters
3. **Run & Monitor** - Start the crawler and watch results in real-time
4. **Export Data** - Download results in JSON format

### Configuration

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | array | ✅ Yes | - | Starting URLs to crawl |
| `maxCrawlingDepth` | integer | Yes | 1 | Maximum crawl depth (0 = starting page only) |
| `maxPagesPerCrawl` | integer | No | 10 | Maximum pages to crawl (0 = unlimited) |
| `pageLoadTimeoutSecs` | integer | No | 60 | Page load timeout in seconds |
| `waitUntil` | string | No | `networkidle2` | Navigation completion condition |
| `injectJQuery` | boolean | No | `false` | Inject jQuery library into pages |
| `ignoreSslErrors` | boolean | No | `true` | Ignore SSL certificate errors |
| `downloadMedia` | boolean | No | `false` | Download images/videos |
| `downloadCss` | boolean | No | `true` | Download CSS stylesheets |
| `debugLog` | boolean | No | `false` | Enable detailed debug logging |

### Output

Each crawled page produces the following data:

```json
{
  "url": "https://example.com/page",
  "depth": 1,
  "title": "Page Title",
  "description": "Meta description text",
  "keywords": "keyword1, keyword2",
  "h1": "Main Heading",
  "h2List": ["Subheading 1", "Subheading 2"],
  "textLength": 5000,
  "imageCount": 12,
  "linkCount": 45
}
```

### Use Cases

<details>
<summary>📈 SEO Audit</summary>

Analyze multiple pages for SEO optimization:
- Check title tags and meta descriptions
- Verify heading structure (H1, H2)
- Count images and links
- Monitor content length

</details>

<details>
<summary>🔍 Competitor Analysis</summary>

Gather intelligence from competitor websites:
- Extract product information
- Monitor pricing and descriptions
- Track content changes over time

</details>

<details>
<summary>📰 Content Aggregation</summary>

Collect content from multiple sources:
- News articles
- Blog posts
- Product listings

</details>

---

## 🇨🇳 中文

### 概述

一款强大灵活的网页爬虫工具，可自动爬取网站、提取结构化数据并发现新链接。专为 CafeScraper 平台构建，通过 CDP（Chrome DevTools Protocol）连接远程指纹浏览器。

适用场景：
- 📊 **数据采集** - 提取标题、描述、关键词、标题等
- 🔗 **链接发现** - 自动发现并爬取相关页面
- 📈 **SEO 分析** - 收集页面元数据和结构信息
- 🗂️ **内容监控** - 跟踪多个页面的变化

### 功能特性

| 功能 | 描述 |
|------|------|
| 🔗 **链接发现** | 自动发现并爬取同域名内的链接 |
| 📏 **深度控制** | 可配置爬取深度（起始页深度为 0） |
| 📊 **页面限制** | 设置每次爬取的最大页面数，控制成本 |
| 🚀 **资源控制** | 可选择阻止媒体/CSS，加快爬取速度 |
| 🔧 **jQuery 注入** | 可选注入 jQuery 库，方便数据提取 |
| 🔐 **SSL 支持** | 忽略自签名证书的 SSL 错误 |
| 🌐 **远程浏览器** | 通过 CDP 连接 CafeScraper 指纹浏览器 |

### 使用方法

1. **添加起始 URL** - 输入要爬取的网址
2. **配置选项** - 设置深度、页面限制等参数
3. **运行监控** - 启动爬虫，实时查看结果
4. **导出数据** - 下载 JSON 格式的结果

### 配置参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | array | ✅ 是 | - | 起始 URL 列表 |
| `maxCrawlingDepth` | integer | 是 | 1 | 最大爬取深度（0 表示仅爬起始页） |
| `maxPagesPerCrawl` | integer | 否 | 10 | 最大爬取页面数（0 表示不限制） |
| `pageLoadTimeoutSecs` | integer | 否 | 60 | 页面加载超时时间（秒） |
| `waitUntil` | string | 否 | `networkidle2` | 页面导航完成条件 |
| `injectJQuery` | boolean | 否 | `false` | 是否注入 jQuery 库 |
| `ignoreSslErrors` | boolean | 否 | `true` | 忽略 SSL 证书错误 |
| `downloadMedia` | boolean | 否 | `false` | 是否下载图片/视频 |
| `downloadCss` | boolean | 否 | `true` | 是否下载 CSS 样式表 |
| `debugLog` | boolean | 否 | `false` | 启用详细调试日志 |

### 输出示例

每个爬取的页面将输出以下数据：

```json
{
  "url": "https://example.com/page",
  "depth": 1,
  "title": "页面标题",
  "description": "页面描述文本",
  "keywords": "关键词1, 关键词2",
  "h1": "主标题",
  "h2List": ["副标题1", "副标题2"],
  "textLength": 5000,
  "imageCount": 12,
  "linkCount": 45
}
```

### 应用场景

<details>
<summary>📈 SEO 审计</summary>

分析多个页面的 SEO 优化情况：
- 检查标题标签和元描述
- 验证标题结构（H1、H2）
- 统计图片和链接数量
- 监控内容长度

</details>

<details>
<summary>🔍 竞品分析</summary>

收集竞品网站的情报信息：
- 提取产品信息
- 监控定价和描述
- 跟踪内容变化

</details>

<details>
<summary>📰 内容聚合</summary>

从多个来源收集内容：
- 新闻文章
- 博客帖子
- 产品列表

</details>

---

## 🔧 Customization | 自定义

<details>
<summary>Modify Data Extraction (修改数据提取)</summary>

To customize data extraction logic, modify the `extractData` method in `main.js`:

如需自定义数据提取逻辑，请修改 `main.js` 中的 `extractData` 方法：

```javascript
async extractData(page) {
    const data = await page.evaluate(() => {
        return {
            // Add your custom fields | 添加自定义字段
            price: document.querySelector('.price')?.textContent,
            author: document.querySelector('.author')?.textContent,
            date: document.querySelector('.date')?.textContent
        }
    })
    return data
}
```

</details>

<details>
<summary>Modify Link Selector (修改链接选择器)</summary>

To change the link discovery selector, modify `LINK_SELECTOR` in `main.js`:

如需更改链接发现选择器，请修改 `main.js` 中的 `LINK_SELECTOR`：

```javascript
// Only discover links in specific area | 仅发现特定区域的链接
const LINK_SELECTOR = '.content a[href]'

// Only discover links with specific class | 仅发现特定类名的链接
const LINK_SELECTOR = 'a.article-link[href]'
```

</details>

---

## ❓ FAQ | 常见问题

<details>
<summary>"Network error" when saving configuration</summary>

Check that `input_schema.json` uses supported editor types. The `input` and `textarea` editors may cause issues on CafeScraper platform.

</details>

<details>
<summary>保存配置时出现 "Network error"</summary>

检查 `input_schema.json` 是否使用了支持的编辑器类型。`input` 和 `textarea` 编辑器在 CafeScraper 平台可能存在问题。

</details>

<details>
<summary>CDP Connection Failed | CDP 连接失败</summary>

Ensure the environment variable `CDP_ENDPOINT` or `BROWSER_WS_ENDPOINT` is correctly set. Contact platform support if the issue persists.

确保环境变量 `CDP_ENDPOINT` 或 `BROWSER_WS_ENDPOINT` 已正确设置。如问题持续，请联系平台支持。

</details>

<details>
<summary>Page Timeout | 页面超时</summary>

Increase the `pageLoadTimeoutSecs` parameter value, or try a different `waitUntil` condition such as `domcontentloaded`.

增加 `pageLoadTimeoutSecs` 参数值，或尝试不同的 `waitUntil` 条件如 `domcontentloaded`。

</details>

---

## 📋 Technical Details | 技术细节

| Item | Value |
|------|-------|
| Platform | CafeScraper |
| Communication | gRPC (127.0.0.1:20086) |
| Browser | Remote Fingerprint Browser via CDP |
| Runtime | Node.js |
| Dependencies | puppeteer, @grpc/grpc-js, google-protobuf |

---

## 📝 Changelog | 更新日志

### v1.0.0 (2024-01)
- ✅ Initial release | 初始版本
- ✅ Link discovery support | 链接发现支持
- ✅ Depth control | 深度控制
- ✅ Resource blocking | 资源阻止
- ✅ Basic data extraction | 基础数据提取

---

<p align="center">
  <sub>Built with ❤️ for CafeScraper | 为 CafeScraper 用心构建</sub>
</p>
