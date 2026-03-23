#!/usr/bin/env node
'use strict'

/**
 * 多场景测试脚本
 */

const puppeteer = require('puppeteer')

// 测试结果收集
const testResults = {
    passed: 0,
    failed: 0,
    errors: []
}

// 模拟 CafeScraper SDK
function createMockSDK(config) {
    return {
        parameter: {
            getInputJSONObject: async () => config
        },
        log: {
            info: (msg) => console.log(`[INFO] ${msg}`),
            error: (msg) => console.error(`[ERROR] ${msg}`),
            debug: (msg) => {}, // 减少日志
            warn: (msg) => console.warn(`[WARN] ${msg}`)
        },
        result: {
            pushData: async (data) => ({ code: 0, message: 'success' }),
            setTableHeader: async (headers) => ({ code: 0, message: 'success' })
        }
    }
}

// WebScraper 类
const DEFAULT_CONFIG = {
    pageLoadTimeoutSecs: 60,
    maxCrawlingDepth: 1,
    maxPagesPerCrawl: 10,
    waitUntil: 'networkidle2',
    injectJQuery: false,
    ignoreSslErrors: true,
    downloadMedia: false,
    downloadCss: true,
    debugLog: false
}

const LINK_SELECTOR = 'a[href]'

class WebScraper {
    constructor(config, browser, cafesdk) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.browser = browser
        this.cafesdk = cafesdk
        this.pagesProcessed = 0
        this.visitedUrls = new Set()
        this.queue = []
        this.results = []
    }

    parseStartUrls(input) {
        const urls = []
        if (input.url) {
            if (Array.isArray(input.url)) {
                for (const item of input.url) {
                    if (typeof item === 'string') urls.push(item.trim())
                    else if (item.url) urls.push(item.url.trim())
                }
            } else if (typeof input.url === 'string') {
                urls.push(input.url.trim())
            }
        }
        return urls.filter(url => url && url.length > 0)
    }

    async createPage() {
        const page = await this.browser.newPage()
        await page.setRequestInterception(true)
        page.on('request', (request) => {
            const resourceType = request.resourceType()
            if (!this.config.downloadMedia && ['image', 'media', 'font'].includes(resourceType)) {
                request.abort()
                return
            }
            if (!this.config.downloadCss && resourceType === 'stylesheet') {
                request.abort()
                return
            }
            request.continue()
        })
        page.setDefaultTimeout(this.config.pageLoadTimeoutSecs * 1000)
        return page
    }

    async extractData(page) {
        return await page.evaluate(() => {
            return {
                title: document.title || '',
                description: document.querySelector('meta[name="description"]')?.content || '',
                h1: document.querySelector('h1')?.textContent?.trim() || '',
                textLength: (document.body?.innerText || '').length,
                imageCount: document.querySelectorAll('img').length,
                linkCount: document.querySelectorAll('a[href]').length
            }
        })
    }

    async discoverLinks(page, currentDepth, baseUrl) {
        if (currentDepth >= this.config.maxCrawlingDepth) return []
        try {
            const links = await page.evaluate((selector) => {
                return Array.from(document.querySelectorAll(selector)).map(a => ({ url: a.href, text: a.textContent.trim() }))
            }, LINK_SELECTOR)
            
            return links.filter(link => {
                if (!link.url) return false
                try {
                    const url = new URL(link.url, baseUrl)
                    return url.origin === new URL(baseUrl).origin && !this.visitedUrls.has(link.url)
                } catch { return false }
            }).map(link => ({ url: link.url, depth: currentDepth + 1 }))
        } catch { return [] }
    }

    async processPage(url, depth) {
        const page = await this.createPage()
        try {
            await page.goto(url, { waitUntil: this.config.waitUntil, timeout: this.config.pageLoadTimeoutSecs * 1000 })
            const data = await this.extractData(page)
            const newLinks = await this.discoverLinks(page, depth, url)
            for (const link of newLinks) {
                if (!this.visitedUrls.has(link.url)) {
                    this.queue.push(link)
                    this.visitedUrls.add(link.url)
                }
            }
            return { url, depth, success: true, ...data, linksFound: newLinks.length }
        } catch (err) {
            return { url, depth, success: false, error: err.message }
        } finally {
            await page.close()
        }
    }

    async run(startUrls) {
        for (const url of startUrls) {
            this.queue.push({ url, depth: 0 })
            this.visitedUrls.add(url)
        }
        while (this.queue.length > 0) {
            if (this.config.maxPagesPerCrawl > 0 && this.pagesProcessed >= this.config.maxPagesPerCrawl) break
            const { url, depth } = this.queue.shift()
            if (depth > this.config.maxCrawlingDepth) continue
            const result = await this.processPage(url, depth)
            this.results.push(result)
            this.pagesProcessed++
        }
        return this.results
    }
}

// 测试用例
const testCases = [
    {
        name: '测试1: 单个URL爬取',
        config: {
            url: [{ url: 'https://example.com' }],
            maxCrawlingDepth: 0,
            maxPagesPerCrawl: 1
        },
        expected: { minPages: 1, requireSuccess: true }
    },
    {
        name: '测试2: 多个URL爬取',
        config: {
            url: [{ url: 'https://example.com' }, { url: 'https://example.org' }],
            maxCrawlingDepth: 0,
            maxPagesPerCrawl: 2
        },
        expected: { minPages: 2, requireSuccess: true }
    },
    {
        name: '测试3: 链接发现（深度爬取）',
        config: {
            url: [{ url: 'https://books.toscrape.com' }],
            maxCrawlingDepth: 1,
            maxPagesPerCrawl: 3
        },
        expected: { minPages: 2, requireSuccess: true }
    },
    {
        name: '测试4: 资源阻止测试',
        config: {
            url: [{ url: 'https://example.com' }],
            maxCrawlingDepth: 0,
            maxPagesPerCrawl: 1,
            downloadMedia: false,
            downloadCss: false
        },
        expected: { minPages: 1, requireSuccess: true }
    },
    {
        name: '测试5: 字符串格式URL',
        config: {
            url: 'https://example.com',  // 字符串格式
            maxCrawlingDepth: 0,
            maxPagesPerCrawl: 1
        },
        expected: { minPages: 1, requireSuccess: true }
    }
]

async function runTest(browser, testCase) {
    console.log(`\n----------------------------------------`)
    console.log(`运行: ${testCase.name}`)
    console.log(`----------------------------------------`)
    
    const mockSdk = createMockSDK(testCase.config)
    const scraper = new WebScraper(testCase.config, browser, mockSdk)
    
    const startUrls = scraper.parseStartUrls(testCase.config)
    console.log(`起始URL数量: ${startUrls.length}`)
    
    if (startUrls.length === 0) {
        throw new Error('未能解析起始URL')
    }
    
    const results = await scraper.run(startUrls)
    
    const successCount = results.filter(r => r.success).length
    console.log(`爬取结果: ${successCount}/${results.length} 成功`)
    
    // 验证结果
    if (results.length < testCase.expected.minPages) {
        throw new Error(`页面数量不足: 期望至少 ${testCase.expected.minPages}, 实际 ${results.length}`)
    }
    
    if (testCase.expected.requireSuccess && successCount === 0) {
        throw new Error('没有成功的爬取结果')
    }
    
    // 打印第一个成功结果
    const firstSuccess = results.find(r => r.success)
    if (firstSuccess) {
        console.log(`示例结果: title="${firstSuccess.title}", linkCount=${firstSuccess.linkCount}`)
    }
    
    return true
}

async function main() {
    console.log('========================================')
    console.log('Web Scraper Worker 多场景测试')
    console.log('========================================')
    
    let browser = null
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        })
        
        for (const testCase of testCases) {
            try {
                await runTest(browser, testCase)
                testResults.passed++
                console.log(`✅ 通过`)
            } catch (err) {
                testResults.failed++
                testResults.errors.push({ name: testCase.name, error: err.message })
                console.log(`❌ 失败: ${err.message}`)
            }
        }
        
    } finally {
        if (browser) await browser.close()
    }
    
    console.log('\n========================================')
    console.log('测试结果汇总')
    console.log('========================================')
    console.log(`✅ 通过: ${testResults.passed}`)
    console.log(`❌ 失败: ${testResults.failed}`)
    
    if (testResults.errors.length > 0) {
        console.log('\n失败详情:')
        testResults.errors.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.name}: ${e.error}`)
        })
    }
    
    process.exit(testResults.failed > 0 ? 1 : 0)
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
