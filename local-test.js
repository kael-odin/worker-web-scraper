#!/usr/bin/env node
'use strict'

/**
 * 本地测试脚本
 * 
 * 用于在没有 CafeScraper 环境的情况下测试 Web Scraper Worker
 * 
 * 使用方法：
 * 1. 先启动一个带远程调试的 Chrome 浏览器：
 *    Windows: chrome.exe --remote-debugging-port=9222
 *    Mac: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 * 
 * 2. 运行此测试脚本：
 *    node local-test.js
 */

// 设置本地开发模式
process.env.LOCAL_DEV = '1'

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

// 设置环境变量 - CDP endpoint
// 你可以修改这里来使用不同的浏览器
process.env.CDP_ENDPOINT = 'ws://127.0.0.1:9222/devtools/browser/your-browser-id'
// 或者使用环境变量中的值
// process.env.CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'ws://127.0.0.1:9222'

console.log('========================================')
console.log('Web Scraper Worker 本地测试')
console.log('========================================')
console.log('')

// 检查环境变量
if (!process.env.CDP_ENDPOINT) {
    console.error('[ERROR] 未设置 CDP_ENDPOINT 环境变量')
    console.log('')
    console.log('请先启动一个带远程调试的 Chrome 浏览器：')
    console.log('  Windows: chrome.exe --remote-debugging-port=9222')
    console.log('  Mac: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222')
    console.log('')
    console.log('然后访问 http://localhost:9222/json/version 获取 webSocketDebuggerUrl')
    console.log('将其设置为环境变量：')
    console.log('  set CDP_ENDPOINT=ws://127.0.0.1:9222/devtools/browser/xxx')
    console.log('')
    process.exit(1)
}

console.log(`[INFO] CDP Endpoint: ${process.env.CDP_ENDPOINT}`)
console.log('')

// 运行主程序
require('./main.js')
