#!/usr/bin/env node
'use strict'

const cafesdk = require('./sdk')
const puppeteer = require('puppeteer')

/**
 * Web Scraper Worker
 * 
 * 核心功能：
 * 1. 通过 CDP 连接远程指纹浏览器
 * 2. 爬取指定 URL 并提取基本数据
 * 3. 支持链接发现和深度控制
 * 4. 使用 gRPC SDK 与 CafeScraper 平台通信
 * 
 * 注意：由于 CafeScraper 平台限制，本版本不支持自定义 pageFunction
 * 如需自定义提取逻辑，请修改 main.js 中的 extractData 方法
 */

// 默认配置
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

// 默认链接选择器（发现页面中的所有链接）
const LINK_SELECTOR = 'a[href]'

class WebScraper {
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.browser = null
        this.pagesProcessed = 0
        this.visitedUrls = new Set()
        this.queue = []
        this.results = []
    }

    async init() {
        await cafesdk.log.info('初始化 Web Scraper Worker...')
        
        // CafeScraper 平台: 使用 PROXY_AUTH 环境变量构建 CDP 连接地址
        const proxyAuth = process.env.PROXY_AUTH
        let browserWSEndpoint
        
        if (proxyAuth) {
            // CafeScraper 平台环境
            browserWSEndpoint = `ws://${proxyAuth}@chrome-ws-inner.cafescraper.com`
            await cafesdk.log.info('使用 CafeScraper 平台远程浏览器')
        } else if (process.env.CDP_ENDPOINT) {
            // 兼容其他环境变量
            browserWSEndpoint = process.env.CDP_ENDPOINT
            await cafesdk.log.info('使用 CDP_ENDPOINT 环境变量')
        } else if (process.env.BROWSER_WS_ENDPOINT) {
            // 兼容其他环境变量
            browserWSEndpoint = process.env.BROWSER_WS_ENDPOINT
            await cafesdk.log.info('使用 BROWSER_WS_ENDPOINT 环境变量')
        } else {
            throw new Error('未找到浏览器连接配置。请确保环境变量 PROXY_AUTH 已设置（CafeScraper 平台自动注入）')
        }
        
        await cafesdk.log.info(`连接到远程浏览器...`)
        
        // 连接到远程浏览器
        this.browser = await puppeteer.connect({
            browserWSEndpoint: browserWSEndpoint,
            defaultViewport: null,
            ignoreHTTPSErrors: this.config.ignoreSslErrors
        })
        
        await cafesdk.log.info('成功连接到远程浏览器')
    }

    async close() {
        if (this.browser) {
            // 断开连接但不关闭浏览器（浏览器由平台管理）
            this.browser.disconnect()
            await cafesdk.log.info('已断开与浏览器的连接')
        }
    }

    /**
     * 解析输入的 URL 列表
     */
    parseStartUrls(input) {
        const urls = []
        
        // 处理 requestList 格式的输入
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
                // 单个 URL 字符串
                urls.push(input.url.trim())
            }
        }
        
        return urls.filter(url => url && url.length > 0)
    }

    /**
     * 创建新页面并配置
     */
    async createPage() {
        const page = await this.browser.newPage()
        
        // 配置请求拦截
        await page.setRequestInterception(true)
        
        // 阻止不需要的资源
        page.on('request', (request) => {
            const resourceType = request.resourceType()
            // const requestUrl = request.url() // 用于调试
            
            // 阻止媒体资源
            if (!this.config.downloadMedia) {
                if (['image', 'media', 'font'].includes(resourceType)) {
                    request.abort()
                    return
                }
            }
            
            // 阻止 CSS
            if (!this.config.downloadCss && resourceType === 'stylesheet') {
                request.abort()
                return
            }
            
            request.continue()
        })
        
        // 设置超时
        page.setDefaultTimeout(this.config.pageLoadTimeoutSecs * 1000)
        
        return page
    }

    /**
     * 提取页面数据
     * 
     * 如需自定义提取逻辑，请修改此方法
     */
    async extractData(page) {
        // 默认提取逻辑 - 提取基本页面信息
        const data = await page.evaluate(() => {
            // 提取标题
            const title = document.title || ''
            
            // 提取描述
            const description = document.querySelector('meta[name="description"]')?.content || ''
            
            // 提取关键词
            const keywords = document.querySelector('meta[name="keywords"]')?.content || ''
            
            // 提取 H1 标题
            const h1 = document.querySelector('h1')?.textContent?.trim() || ''
            
            // 提取所有 H2 标题
            const h2List = Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()).filter(Boolean)
            
            // 提取页面文本长度
            const bodyText = document.body?.innerText || ''
            const textLength = bodyText.length
            
            // 提取图片数量
            const imageCount = document.querySelectorAll('img').length
            
            // 提取链接数量
            const linkCount = document.querySelectorAll('a[href]').length
            
            return {
                title,
                description,
                keywords,
                h1,
                h2List: h2List.slice(0, 5), // 只取前5个 H2
                textLength,
                imageCount,
                linkCount
            }
        })
        
        return data
    }

    /**
     * 发现页面中的链接
     */
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
            
            // 过滤和去重
            const newLinks = links.filter(link => {
                if (!link.url) return false
                try {
                    const url = new URL(link.url, baseUrl)
                    // 只保留同域名链接（可根据需要修改）
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

    /**
     * 处理单个页面
     */
    async processPage(url, depth) {
        const page = await this.createPage()
        
        try {
            if (this.config.debugLog) {
                await cafesdk.log.debug(`开始处理页面: ${url} (深度: ${depth})`)
            }
            
            // 导航到页面
            await page.goto(url, {
                waitUntil: this.config.waitUntil,
                timeout: this.config.pageLoadTimeoutSecs * 1000
            })
            
            // 提取页面数据
            const data = await this.extractData(page)
            
            // 发现新链接
            const newLinks = await this.discoverLinks(page, depth, url)
            
            // 将新链接加入队列
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

    /**
     * 运行爬虫
     */
    async run(startUrls) {
        if (!startUrls || startUrls.length === 0) {
            throw new Error('未提供起始 URL')
        }
        
        // 初始化队列
        for (const url of startUrls) {
            this.queue.push({ url, depth: 0 })
            this.visitedUrls.add(url)
        }
        
        await cafesdk.log.info(`开始爬取，共 ${startUrls.length} 个起始 URL`)
        
        // 处理队列
        while (this.queue.length > 0) {
            // 检查页面限制
            if (this.config.maxPagesPerCrawl > 0 && this.pagesProcessed >= this.config.maxPagesPerCrawl) {
                await cafesdk.log.info(`已达到最大页面数限制: ${this.config.maxPagesPerCrawl}`)
                break
            }
            
            const { url, depth } = this.queue.shift()
            
            // 检查深度限制
            if (depth > this.config.maxCrawlingDepth) {
                continue
            }
            
            const result = await this.processPage(url, depth)
            this.results.push(result)
            this.pagesProcessed++
            
            // 推送结果
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
    try {
        // 1. 获取输入参数
        const inputJson = await cafesdk.parameter.getInputJSONObject()
        await cafesdk.log.debug(`输入参数: ${JSON.stringify(inputJson)}`)
        
        // 2. 解析配置
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
        
        // 3. 创建爬虫实例
        const scraper = new WebScraper(config)
        
        // 4. 初始化浏览器连接
        await scraper.init()
        
        // 5. 解析起始 URL
        const startUrls = scraper.parseStartUrls(inputJson)
        await cafesdk.log.info(`起始 URL: ${JSON.stringify(startUrls)}`)
        
        if (startUrls.length === 0) {
            throw new Error('未找到有效的起始 URL')
        }
        
        // 6. 运行爬虫
        const results = await scraper.run(startUrls)
        
        // 7. 设置结果表头
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
        
        // 8. 输出统计
        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length
        
        await cafesdk.log.info(`爬取完成! 成功: ${successCount}, 失败: ${failCount}`)
        
        // 9. 清理
        await scraper.close()
        
    } catch (err) {
        await cafesdk.log.error(`脚本执行异常: ${err.message}`)
        await cafesdk.log.error(`堆栈: ${err.stack}`)
        
        // 推送错误结果
        await cafesdk.result.pushData({
            error: err.message,
            status: 'failed',
            timestamp: new Date().toISOString()
        })
        
        throw err
    }
}

// 运行主函数
main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
