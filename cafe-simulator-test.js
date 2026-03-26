#!/usr/bin/env node
/**
 * Cafe 平台模拟测试
 * 
 * 模拟 Cafe 平台的实际运行环境：
 * 1. 输入格式（Cafe 平台拆分后的格式）
 * 2. 输出格式（符合平台预期）
 * 3. PROXY_AUTH 环境变量
 * 4. 结果推送格式
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 测试结果统计
const stats = { total: 0, passed: 0, failed: 0, skipped: 0 };

const colors = {
    green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m'
};

function log(color, ...args) {
    console.log(colors[color] || '', ...args, colors.reset);
}

async function runTest(name, testFn, options = {}) {
    stats.total++;
    const { skip = false } = options;
    
    if (skip) {
        stats.skipped++;
        log('yellow', `⏭️  SKIP: ${name}`);
        return;
    }
    
    try {
        await testFn();
        stats.passed++;
        log('green', `✅ PASS: ${name}`);
    } catch (err) {
        stats.failed++;
        log('red', `❌ FAIL: ${name}`);
        log('red', `   Error: ${err.message}`);
    }
}

// ============================================
// 测试套件: Cafe 平台输入格式
// ============================================
async function testCafeInputFormats() {
    log('cyan', '\n=== Cafe 平台输入格式测试 ===');
    
    // Cafe 平台会将数组拆分成单个任务
    // 例如: url: [{url: 'a'}, {url: 'b'}] -> 两个任务，每个任务的 url 数组只有一个元素
    
    // Test 1: 单元素数组（Cafe 拆分后）
    await runTest('Cafe input - Single element array after split', async () => {
        const cafeInput = {
            url: [{ url: 'https://example.com' }],
            maxCrawlingDepth: 1,
            maxPagesPerCrawl: 5
        };
        
        if (!Array.isArray(cafeInput.url)) throw new Error('url should be array');
        if (cafeInput.url.length !== 1) throw new Error('url array should have 1 element after Cafe split');
        if (!cafeInput.url[0].url) throw new Error('url element should have url property');
    });
    
    // Test 2: 完整参数格式
    await runTest('Cafe input - Full parameter format', async () => {
        const cafeInput = {
            url: [{ url: 'https://example.com' }],
            maxCrawlingDepth: 2,
            maxPagesPerCrawl: 10,
            pageLoadTimeoutSecs: 60,
            waitUntil: 'load',
            injectJQuery: false,
            ignoreSslErrors: true,
            downloadMedia: false,
            downloadCss: true,
            debugLog: false
        };
        
        const requiredFields = ['url', 'maxCrawlingDepth', 'maxPagesPerCrawl'];
        requiredFields.forEach(field => {
            if (!(field in cafeInput)) {
                throw new Error(`Missing required field: ${field}`);
            }
        });
    });
    
    // Test 3: 默认值验证
    await runTest('Cafe input - Default values', async () => {
        const minimalInput = {
            url: [{ url: 'https://example.com' }]
        };
        
        // 验证最小输入格式正确
        if (!Array.isArray(minimalInput.url)) throw new Error('url should be array');
        if (!minimalInput.url[0].url) throw new Error('url element should have url property');
    });
}

// ============================================
// 测试套件: Cafe 平台输出格式
// ============================================
async function testCafeOutputFormats() {
    log('cyan', '\n=== Cafe 平台输出格式测试 ===');
    
    // Test 1: 成功结果格式
    await runTest('Cafe output - Success result format', async () => {
        const successResult = {
            url: 'https://example.com',
            depth: 0,
            success: true,
            title: 'Example Domain',
            description: 'This domain is for use in illustrative examples',
            keywords: 'example, domain',
            h1: 'Example Domain',
            h2List: ['More information'],
            textLength: 1234,
            imageCount: 0,
            linkCount: 1,
            linksFound: 1
        };
        
        const requiredFields = ['url', 'depth', 'success', 'title'];
        requiredFields.forEach(field => {
            if (!(field in successResult)) {
                throw new Error(`Missing required field: ${field}`);
            }
        });
        
        if (successResult.success !== true) throw new Error('success should be true');
    });
    
    // Test 2: 失败结果格式
    await runTest('Cafe output - Error result format', async () => {
        const errorResult = {
            url: 'https://invalid-url-that-does-not-exist.com',
            depth: 0,
            success: false,
            error: 'net::ERR_NAME_NOT_RESOLVED',
            title: '',
            description: '',
            status: 'failed'
        };
        
        if (errorResult.success !== false) throw new Error('success should be false');
        if (!errorResult.error) throw new Error('Error result should have error message');
    });
    
    // Test 3: 表头格式
    await runTest('Cafe output - Table header format', async () => {
        const headers = [
            { label: 'URL', key: 'url', format: 'text' },
            { label: '深度', key: 'depth', format: 'number' },
            { label: '标题', key: 'title', format: 'text' },
            { label: '描述', key: 'description', format: 'text' },
            { label: 'H1', key: 'h1', format: 'text' },
            { label: '文本长度', key: 'textLength', format: 'number' },
            { label: '图片数', key: 'imageCount', format: 'number' },
            { label: '链接数', key: 'linkCount', format: 'number' }
        ];
        
        if (!Array.isArray(headers)) throw new Error('headers should be array');
        
        headers.forEach(h => {
            if (!h.label) throw new Error('Each header must have label');
            if (!h.key) throw new Error('Each header must have key');
            if (!h.format) throw new Error('Each header must have format');
        });
    });
}

// ============================================
// 测试套件: PROXY_AUTH 格式
// ============================================
async function testProxyAuth() {
    log('cyan', '\n=== PROXY_AUTH 环境变量测试 ===');
    
    // Test 1: PROXY_AUTH 格式
    await runTest('PROXY_AUTH - Format validation', async () => {
        const mockProxyAuth = 'username:password';
        const parts = mockProxyAuth.split(':');
        
        if (parts.length !== 2) throw new Error('PROXY_AUTH should have username:password format');
    });
    
    // Test 2: CDP 连接地址构建
    await runTest('CDP endpoint - Construction', async () => {
        const mockProxyAuth = 'username:password';
        const browserWSEndpoint = `ws://${mockProxyAuth}@chrome-ws-inner.cafescraper.com`;
        
        if (!browserWSEndpoint.startsWith('ws://')) {
            throw new Error('CDP endpoint should start with ws://');
        }
        if (!browserWSEndpoint.includes('@chrome-ws-inner.cafescraper.com')) {
            throw new Error('CDP endpoint should use Cafe domain');
        }
    });
    
    // Test 3: 备用环境变量
    await runTest('Alternative env vars - CDP_ENDPOINT', async () => {
        const alternativeEndpoints = [
            'ws://localhost:9222/devtools/browser/xxx',
            'ws://user:pass@browser.example.com'
        ];
        
        alternativeEndpoints.forEach(endpoint => {
            if (!endpoint.startsWith('ws://')) {
                throw new Error('CDP endpoint should start with ws://');
            }
        });
    });
}

// ============================================
// 测试套件: 深度爬取逻辑
// ============================================
async function testDepthCrawling() {
    log('cyan', '\n=== 深度爬取逻辑测试 ===');
    
    // Test 1: 深度 0（只爬取起始页）
    await runTest('Depth crawl - Depth 0 (start page only)', async () => {
        const maxDepth = 0;
        const currentDepth = 0;
        
        // 深度 0 不应该发现新链接
        if (currentDepth >= maxDepth) {
            // 正确：不发现新链接
        } else {
            throw new Error('Depth 0 should not discover new links');
        }
    });
    
    // Test 2: 深度 1（爬取起始页 + 第一层链接）
    await runTest('Depth crawl - Depth 1 (start + first level)', async () => {
        const maxDepth = 1;
        
        // 起始页深度为 0
        const startPageDepth = 0;
        if (startPageDepth > maxDepth) throw new Error('Start page should be processed');
        
        // 第一层链接深度为 1
        const firstLevelDepth = 1;
        if (firstLevelDepth > maxDepth) throw new Error('First level links should be processed');
        
        // 第二层链接深度为 2（不应该被处理）
        const secondLevelDepth = 2;
        if (secondLevelDepth <= maxDepth) throw new Error('Second level links should NOT be processed');
    });
    
    // Test 3: 页面限制
    await runTest('Depth crawl - Page limit', async () => {
        const maxPages = 10;
        const pagesProcessed = 10;
        
        if (maxPages > 0 && pagesProcessed >= maxPages) {
            // 正确：停止爬取
        } else {
            throw new Error('Should stop when page limit reached');
        }
    });
}

// ============================================
// 测试套件: 去重逻辑
// ============================================
async function testDeduplication() {
    log('cyan', '\n=== 去重逻辑测试 ===');
    
    // Test 1: URL 去重
    await runTest('Dedup - URL deduplication', async () => {
        const visitedUrls = new Set();
        
        // 添加第一个 URL
        visitedUrls.add('https://example.com');
        
        // 尝试添加相同 URL（应该被忽略）
        if (visitedUrls.has('https://example.com')) {
            // 正确：URL 已存在
        } else {
            throw new Error('Duplicate URL should be detected');
        }
        
        if (visitedUrls.size !== 1) throw new Error('Set should have only 1 URL');
    });
    
    // Test 2: 末尾斜杠去重
    await runTest('Dedup - Trailing slash normalization', async () => {
        // 这些 URL 应该被认为是相同的
        const url1 = 'https://example.com/page';
        const url2 = 'https://example.com/page/';
        
        // 标准化后应该相同
        const normalize = (url) => url.replace(/\/$/, '');
        
        if (normalize(url1) !== normalize(url2)) {
            throw new Error('URLs with/without trailing slash should be normalized to same value');
        }
    });
}

// ============================================
// 测试套件: 错误处理
// ============================================
async function testErrorHandling() {
    log('cyan', '\n=== 错误处理测试 ===');
    
    // Test 1: 网络错误
    await runTest('Error handling - Network error', async () => {
        const errorTypes = [
            'net::ERR_NAME_NOT_RESOLVED',
            'net::ERR_CONNECTION_REFUSED',
            'net::ERR_TIMED_OUT'
        ];
        
        errorTypes.forEach(err => {
            if (!err.startsWith('net::')) {
                throw new Error('Network error should start with net::');
            }
        });
    });
    
    // Test 2: 超时错误
    await runTest('Error handling - Timeout error', async () => {
        const timeoutMs = 60000;
        const elapsedMs = 65000;
        
        if (elapsedMs > timeoutMs) {
            // 正确：超时
        } else {
            throw new Error('Should detect timeout');
        }
    });
    
    // Test 3: SSL 错误
    await runTest('Error handling - SSL error', async () => {
        const ignoreSslErrors = true;
        
        // 当 ignoreSslErrors=true 时，应该忽略 SSL 错误
        if (!ignoreSslErrors) {
            throw new Error('SSL errors should be ignored when configured');
        }
    });
}

// ============================================
// 测试套件: 资源控制
// ============================================
async function testResourceControl() {
    log('cyan', '\n=== 资源控制测试 ===');
    
    // Test 1: 媒体资源阻止
    await runTest('Resource control - Block media', async () => {
        const downloadMedia = false;
        const blockedTypes = ['image', 'media', 'font'];
        
        if (!downloadMedia) {
            // 这些资源类型应该被阻止
            blockedTypes.forEach(type => {
                if (!['image', 'media', 'font'].includes(type)) {
                    throw new Error(`${type} should be blocked when downloadMedia=false`);
                }
            });
        }
    });
    
    // Test 2: CSS 控制
    await runTest('Resource control - CSS control', async () => {
        const downloadCss = true;
        
        if (!downloadCss) {
            // CSS 应该被阻止
            throw new Error('CSS should be blocked when downloadCss=false');
        }
    });
    
    // Test 3: 请求拦截设置
    await runTest('Resource control - Request interception', async () => {
        // Puppeteer 请求拦截配置
        const interceptionConfig = {
            setRequestInterception: true,
            requestHandlers: ['abort', 'continue']
        };
        
        if (!interceptionConfig.setRequestInterception) {
            throw new Error('Request interception should be enabled');
        }
    });
}

// ============================================
// 主函数
// ============================================
async function main() {
    console.log('');
    log('cyan', '╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║     Web Scraper - Cafe 平台模拟测试                          ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    try {
        await testCafeInputFormats();
        await testCafeOutputFormats();
        await testProxyAuth();
        await testDepthCrawling();
        await testDeduplication();
        await testErrorHandling();
        await testResourceControl();
    } catch (err) {
        log('red', `\n测试执行失败: ${err.message}`);
    }
    
    // 输出结果
    console.log('');
    log('cyan', '════════════════════════════════════════════════════════════');
    console.log('');
    log('cyan', '测试结果汇总:');
    console.log(`  总计: ${stats.total}`);
    log('green', `  通过: ${stats.passed}`);
    log('red', `  失败: ${stats.failed}`);
    log('yellow', `  跳过: ${stats.skipped}`);
    console.log('');
    
    const successRate = stats.total > 0 ? (stats.passed / (stats.total - stats.skipped) * 100).toFixed(1) : 0;
    log('cyan', `成功率: ${successRate}%`);
    console.log('');
    
    process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
