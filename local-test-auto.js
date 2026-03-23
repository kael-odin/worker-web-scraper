#!/usr/bin/env node
'use strict'

/**
 * 简化版本地测试脚本
 * 
 * 自动检测本地 Chrome 浏览器
 * 
 * 使用方法：
 *    node local-test-auto.js
 */

const http = require('http')

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

async function getBrowserWebSocketUrl() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json/version', (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                try {
                    const json = JSON.parse(data)
                    resolve(json.webSocketDebuggerUrl)
                } catch (err) {
                    reject(new Error('无法解析浏览器信息'))
                }
            })
        }).on('error', (err) => {
            reject(new Error('无法连接到浏览器，请确保已启动 Chrome 并开启远程调试端口 9222'))
        })
    })
}

async function main() {
    console.log('========================================')
    console.log('Web Scraper Worker 本地测试')
    console.log('========================================')
    console.log('')
    
    // 检测浏览器
    let wsUrl = process.env.CDP_ENDPOINT || process.env.BROWSER_WS_ENDPOINT
    
    if (!wsUrl) {
        console.log('[INFO] 正在检测本地浏览器...')
        try {
            wsUrl = await getBrowserWebSocketUrl()
            console.log(`[INFO] 检测到浏览器: ${wsUrl}`)
        } catch (err) {
            console.error(`[ERROR] ${err.message}`)
            console.log('')
            console.log('请先启动一个带远程调试的 Chrome 浏览器：')
            console.log('  Windows: chrome.exe --remote-debugging-port=9222')
            console.log('  Mac: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222')
            console.log('')
            process.exit(1)
        }
    }
    
    process.env.CDP_ENDPOINT = wsUrl
    console.log(`[INFO] 使用 CDP Endpoint: ${wsUrl}`)
    console.log('')
    
    // 运行主程序
    require('./main.js')
}

main().catch(err => {
    console.error('[FATAL]', err)
    process.exit(1)
})
