#!/usr/bin/env node
'use strict'

/**
 * 完整的本地测试脚本
 * 
 * 此脚本会自动启动一个浏览器进行测试
 * 
 * 使用方法：
 *    node test.js
 */

const puppeteer = require('puppeteer')

// 模拟 CafeScraper SDK
const cafesdk = {
    parameter: {
        getInputJSONObject: async () => ({
            url: [
                { url: 'https://example.com' }
            ],
            maxCrawlingDepth: 1,
            maxPagesPerCrawl: 2,
            pageLoadTimeoutSecs: 30,
            waitUntil: 'networkidle2',
            injectJQuery: false,
            ignoreSslErrors: true,
            downloadMedia: false,
            downloadCss: true,
            debugLog: true
        })
    },
    log: {
        info: (msg) => console.log(`[INFO] ${msg}`),
        error: (msg) => console.error(`[ERROR] ${msg}`),
        debug: (msg) => console.log(`[DEBUG] ${msg}`),
        warn: (msg) => console.warn(`[WARN] ${msg}`)
    },
    result: {
        pushData: async (data) => {
            console.log('[RESULT]', JSON.stringify(data, null, 2))
            return { code: 0, message: 'success' }
        },
        setTableHeader: async (headers) => {
            console.log('[HEADERS]', JSON.stringify(headers, null, 2))
            return { code: 0, message: 'success' }
        }
    }
}

// 替换 SDK
global.cafesdk = cafesdk

// WebScraper 类定义（从 main.js 中提取）
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
    constructor(config, browser) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.browser = browser
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
                    if (typeof item === 'string') {
                        urls.push(item.trim())
                    } else if (item.url) {
                        urls.push(item.url.trim())
                    }
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
            if (!this.config.downloadMedia) {
                if (['image', 'media', 'font'].includes(resourceType)) {
                    request.abort()
                    return
                }
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
        const data = await page.evaluate(() => {
            const title = document.title || ''
            const description = document.querySelector('meta[name="description"]')?.content || ''
            const keywords = document.querySelector('meta[name="keywords"]')?.content || ''
            const h1 = document.querySelector('h1')?.textContent?.trim() || ''
            const h2List = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()).filter(Boolean)
            const bodyText = document.body?.innerText || ''
            const textLength = bodyText.length
            const imageCount = document.querySelectorAll('img').length
            const linkCount = document.querySelectorAll('a[href]').length
            
            return {
                title,
                description,
                keywords,
                h1,
                h2List: h2List.slice(0, 5),
                textLength,
                imageCount,
                linkCount
            }
        })
        return data
    }

    async discoverLinks(page, currentDepth, baseUrl) {
        if (currentDepth >= this.config.maxCrawlingDepth) {
            return []
        }
        try {
            const links = await page.evaluate((selector) => {
                const anchors = document.querySelectorAll(selector)
                return Array.from(anchors).map(a => ({
                    url: a.href,
                    text: a.textContent.trim()
                }))
            }, LINK_SELECTOR)
            
            const newLinks = links.filter(link => {
                if (!link.url) return false
                try {
                    const url = new URL(link.url, baseUrl)
                    return url.origin === new URL(baseUrl).origin
                } catch {
                    return false
                }
            }).filter(link => !this.visitedUrls.has(link.url))
            
            return newLinks.map(link => ({
                url: link.url,
                depth: currentDepth + 1
            }))
        } catch (err) {
            await cafesdk.log.warn(`链接发现失败: ${err.message}`)
            return []
        }
    }

    async processPage(url, depth) {
        const page = await this.createPage()
        const request = { url, depth }
        
        try {
            if (this.config.debugLog) {
                await cafesdk.log.debug(`开始处理页面: ${url} (深度: ${depth})`)
            }
            
            await page.goto(url, {
                waitUntil: this.config.waitUntil,
                timeout: this.config.pageLoadTimeoutSecs * 1000
            })
            
            const data = await this.extractData(page)
            const newLinks = await this.discoverLinks(page, depth, url)
            
            for (const link of newLinks) {
                if (!this.visitedUrls.has(link.url)) {
                    this.queue.push(link)
                    this.visitedUrls.add(link.url)
                }
            }
            
            return {
                url: url,
                depth: depth,
                success: true,
                ...data,
                linksFound: newLinks.length
            }
        } catch (err) {
            await cafesdk.log.error(`处理页面失败 ${url}: ${err.message}`)
            return {
                url: url,
                depth: depth,
                success: false,
                error: err.message,
                title: '',
                description: ''
            }
        } finally {
            await page.close()
        }
    }

    async run(startUrls) {
        if (!startUrls || startUrls.length === 0) {
            throw new Error('未提供起始 URL')
        }
        
        for (const url of startUrls) {
            this.queue.push({ url, depth: 0 })
            this.visitedUrls.add(url)
        }
        
        await cafesdk.log.info(`开始爬取，共 ${startUrls.length} 个起始 URL`)
        
        while (this.queue.length > 0) {
            if (this.config.maxPagesPerCrawl > 0 && this.pagesProcessed >= this.config.maxPagesPerCrawl) {
                await cafesdk.log.info(`已达到最大页面数限制: ${this.config.maxPagesPerCrawl}`)
                break
            }
            
            const { url, depth } = this.queue.shift()
            if (depth > this.config.maxCrawlingDepth) continue
            
            const result = await this.processPage(url, depth)
            this.results.push(result)
            this.pagesProcessed++
            
            if (result.success) {
                await cafesdk.result.pushData(result)
            } else {
                await cafesdk.result.pushData({
                    url: result.url,
                    depth: result.depth,
                    error: result.error,
                    title: '',
                    status: 'failed'
                })
            }
            
            await cafesdk.log.info(`已处理 ${this.pagesProcessed} 页: ${url}`)
        }
        
        return this.results
    }
}

async function main() {
    let browser = null
    
    try {
        console.log('========================================')
        console.log('Web Scraper Worker 本地测试')
        console.log('========================================')
        console.log('')
        
        // 获取输入参数
        const inputJson = await cafesdk.parameter.getInputJSONObject()
        await cafesdk.log.debug(`输入参数: ${JSON.stringify(inputJson)}`)
        
        // 解析配置
        const config = {
            pageLoadTimeoutSecs: inputJson.pageLoadTimeoutSecs || DEFAULT_CONFIG.pageLoadTimeoutSecs,
            maxCrawlingDepth: inputJson.maxCrawlingDepth || DEFAULT_CONFIG.maxCrawlingDepth,
            maxPagesPerCrawl: inputJson.maxPagesPerCrawl || DEFAULT_CONFIG.maxPagesPerCrawl,
            waitUntil: inputJson.waitUntil || DEFAULT_CONFIG.waitUntil,
            injectJQuery: inputJson.injectJQuery || DEFAULT_CONFIG.injectJQuery,
            ignoreSslErrors: inputJson.ignoreSslErrors !== false,
            downloadMedia: inputJson.downloadMedia || DEFAULT_CONFIG.downloadMedia,
            downloadCss: inputJson.downloadCss !== false,
            debugLog: inputJson.debugLog || DEFAULT_CONFIG.debugLog
        }
        
        await cafesdk.log.info(`配置: ${JSON.stringify(config)}`)
        
        // 启动浏览器
        await cafesdk.log.info('正在启动浏览器...')
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        })
        await cafesdk.log.info('浏览器启动成功')
        
        // 创建爬虫实例
        const scraper = new WebScraper(config, browser)
        
        // 解析起始 URL
        const startUrls = scraper.parseStartUrls(inputJson)
        await cafesdk.log.info(`起始 URL: ${JSON.stringify(startUrls)}`)
        
        if (startUrls.length === 0) {
            throw new Error('未找到有效的起始 URL')
        }
        
        // 运行爬虫
        const results = await scraper.run(startUrls)
        
        // 设置结果表头
        const headers = [
            { label: 'URL', key: 'url', format: 'text' },
            { label: '深度', key: 'depth', format: 'number' },
            { label: '标题', key: 'title', format: 'text' },
            { label: '描述', key: 'description', format: 'text' },
            { label: 'H1', key: 'h1', format: 'text' },
            { label: '文本长度', key: 'textLength', format: 'number' },
            { label: '图片数', key: 'imageCount', format: 'number' },
            { label: '链接数', key: 'linkCount', format: 'number' }
        ]
        await cafesdk.result.setTableHeader(headers)
        
        // 输出统计
        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length
        
        console.log('')
        console.log('========================================')
        console.log(`爬取完成! 成功: ${successCount}, 失败: ${failCount}`)
        console.log('========================================')
        
    } catch (err) {
        await cafesdk.log.error(`脚本执行异常: ${err.message}`)
        await cafesdk.log.error(`堆栈: ${err.stack}`)
        throw err
    } finally {
        if (browser) {
            await browser.close()
            await cafesdk.log.info('浏览器已关闭')
        }
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
