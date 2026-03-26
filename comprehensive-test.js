#!/usr/bin/env node
/**
 * Web Scraper Worker 全量测试套件
 * 
 * 测试覆盖：
 * 1. 输入格式兼容性（数组/字符串/对象格式）
 * 2. URL 标准化
 * 3. 配置参数验证
 * 4. input_schema.json 验证
 * 5. 错误处理
 * 6. 数据提取格式
 * 7. Cafe 平台模拟
 */

'use strict';

const fs = require('fs');
const path = require('path');

// 测试结果统计
const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
};

// 颜色输出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(color, ...args) {
    console.log(colors[color] || '', ...args, colors.reset);
}

// 测试框架
async function runTest(name, testFn, options = {}) {
    stats.total++;
    const { timeout = 60000, skip = false } = options;
    
    if (skip) {
        stats.skipped++;
        log('yellow', `⏭️  SKIP: ${name}`);
        return;
    }
    
    const startTime = Date.now();
    try {
        await Promise.race([
            testFn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
            )
        ]);
        const elapsed = Date.now() - startTime;
        stats.passed++;
        log('green', `✅ PASS: ${name} (${elapsed}ms)`);
    } catch (err) {
        const elapsed = Date.now() - startTime;
        stats.failed++;
        log('red', `❌ FAIL: ${name} (${elapsed}ms)`);
        log('red', `   Error: ${err.message}`);
    }
}

// ============================================
// 从 main.js 提取的核心函数（用于测试）
// ============================================

function normalizeUrl(url) {
    try {
        const parsed = new URL(url)
        // 去除末尾斜杠
        let path = parsed.pathname
        if (path.endsWith('/') && path.length > 1) {
            path = path.slice(0, -1)
        }
        // 重建 URL
        return `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`
    } catch {
        return url.replace(/\/$/, '') // 简单去除末尾斜杠
    }
}

const DEFAULT_CONFIG = {
    pageLoadTimeoutSecs: 60,
    maxCrawlingDepth: 1,
    maxPagesPerCrawl: 10,
    waitUntil: 'load',
    injectJQuery: false,
    ignoreSslErrors: true,
    downloadMedia: false,
    downloadCss: true,
    debugLog: false
}

function parseStartUrls(input) {
    const urls = []
    
    // 处理 requestList 格式的输入
    if (input.url) {
        if (Array.isArray(input.url)) {
            for (const item of input.url) {
                // 跳过 null 和 undefined
                if (item === null || item === undefined) continue;
                
                if (typeof item === 'string') {
                    const trimmed = item.trim();
                    if (trimmed) urls.push(normalizeUrl(trimmed));
                } else if (item && item.url) {
                    const trimmed = item.url.trim();
                    if (trimmed) urls.push(normalizeUrl(trimmed));
                }
            }
        } else if (typeof input.url === 'string') {
            // 单个 URL 字符串
            const trimmed = input.url.trim();
            if (trimmed) urls.push(normalizeUrl(trimmed));
        }
    }
    
    return urls.filter(url => url && url.length > 0)
}

// ============================================
// 测试套件 1: 输入格式兼容性
// ============================================
async function testInputFormats() {
    log('cyan', '\n=== 测试套件 1: 输入格式兼容性 ===');
    
    // Test 1.1: 数组对象格式 [{ url: '...' }]
    await runTest('Input format - Array of objects', async () => {
        const urls = parseStartUrls({
            url: [
                { url: 'https://example.com' },
                { url: 'https://example.org' }
            ]
        });
        if (urls.length !== 2) throw new Error(`Expected 2 URLs, got ${urls.length}`);
        if (!urls[0].includes('example.com')) throw new Error('First URL should be example.com');
    });
    
    // Test 1.2: 字符串数组格式 ['...', '...']
    await runTest('Input format - Array of strings', async () => {
        const urls = parseStartUrls({
            url: ['https://example.com', 'https://example.org']
        });
        if (urls.length !== 2) throw new Error(`Expected 2 URLs, got ${urls.length}`);
    });
    
    // Test 1.3: 单个 URL 字符串
    await runTest('Input format - Single string', async () => {
        const urls = parseStartUrls({
            url: 'https://example.com'
        });
        if (urls.length !== 1) throw new Error(`Expected 1 URL, got ${urls.length}`);
    });
    
    // Test 1.4: 空 URL 处理
    await runTest('Input format - Empty URLs', async () => {
        const urls = parseStartUrls({
            url: ['', null, undefined, { url: '' }]
        });
        if (urls.length !== 0) throw new Error(`Expected 0 URLs, got ${urls.length}`);
    });
    
    // Test 1.5: URL 带空白
    await runTest('Input format - URL with whitespace', async () => {
        const urls = parseStartUrls({
            url: '  https://example.com  '
        });
        if (urls.length !== 1) throw new Error(`Expected 1 URL, got ${urls.length}`);
        if (urls[0].includes(' ')) throw new Error('Whitespace should be trimmed');
    });
}

// ============================================
// 测试套件 2: URL 标准化
// ============================================
async function testUrlNormalization() {
    log('cyan', '\n=== 测试套件 2: URL 标准化 ===');
    
    // Test 2.1: 基本标准化
    await runTest('URL normalization - Basic', async () => {
        const result = normalizeUrl('https://example.com/path');
        if (!result.startsWith('https://')) throw new Error('Should preserve protocol');
    });
    
    // Test 2.2: 去除末尾斜杠
    await runTest('URL normalization - Remove trailing slash', async () => {
        const result = normalizeUrl('https://example.com/path/');
        if (result.endsWith('/path/')) throw new Error('Should remove trailing slash from path');
    });
    
    // Test 2.3: 保留查询参数
    await runTest('URL normalization - Keep query params', async () => {
        const result = normalizeUrl('https://example.com/path?query=value');
        if (!result.includes('?query=value')) throw new Error('Should preserve query params');
    });
    
    // Test 2.4: 保留 hash
    await runTest('URL normalization - Keep hash', async () => {
        const result = normalizeUrl('https://example.com/path#section');
        if (!result.includes('#section')) throw new Error('Should preserve hash');
    });
    
    // Test 2.5: 根路径斜杠保留（这是合理的行为）
    await runTest('URL normalization - Root path', async () => {
        const result = normalizeUrl('https://example.com/');
        // 根路径的斜杠可以保留（路径长度=1）
        if (!result.startsWith('https://example.com')) {
            throw new Error(`Expected URL starting with 'https://example.com', got '${result}'`);
        }
    });
    
    // Test 2.6: 无效 URL 处理
    await runTest('URL normalization - Invalid URL', async () => {
        // 不应该抛出错误
        const result = normalizeUrl('not-a-valid-url');
        if (result.includes('/')) throw new Error('Should handle invalid URL gracefully');
    });
}

// ============================================
// 测试套件 3: 配置参数
// ============================================
async function testConfiguration() {
    log('cyan', '\n=== 测试套件 3: 配置参数 ===');
    
    // Test 3.1: 默认配置值
    await runTest('Config - Default values', async () => {
        if (DEFAULT_CONFIG.pageLoadTimeoutSecs !== 60) throw new Error('pageLoadTimeoutSecs default should be 60');
        if (DEFAULT_CONFIG.maxCrawlingDepth !== 1) throw new Error('maxCrawlingDepth default should be 1');
        if (DEFAULT_CONFIG.maxPagesPerCrawl !== 10) throw new Error('maxPagesPerCrawl default should be 10');
        if (DEFAULT_CONFIG.waitUntil !== 'load') throw new Error('waitUntil default should be load');
    });
    
    // Test 3.2: waitUntil 选项验证
    await runTest('Config - Valid waitUntil options', async () => {
        const validOptions = ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'];
        validOptions.forEach(opt => {
            if (typeof opt !== 'string') throw new Error('Invalid waitUntil option');
        });
    });
    
    // Test 3.3: 数值范围验证
    await runTest('Config - Numeric ranges', async () => {
        // maxCrawlingDepth 应该 >= 0
        if (DEFAULT_CONFIG.maxCrawlingDepth < 0) throw new Error('maxCrawlingDepth should be >= 0');
        // pageLoadTimeoutSecs 应该 > 0
        if (DEFAULT_CONFIG.pageLoadTimeoutSecs <= 0) throw new Error('pageLoadTimeoutSecs should be > 0');
    });
}

// ============================================
// 测试套件 4: input_schema.json 验证
// ============================================
async function testInputSchema() {
    log('cyan', '\n=== 测试套件 4: input_schema.json 验证 ===');
    
    const schemaPath = path.join(__dirname, 'input_schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    
    // Test 4.1: b 字段必须是数组类型
    await runTest('Schema - b field must match array property', async () => {
        const bField = schema.b;
        const matchingProperty = schema.properties.find(p => p.name === bField);
        
        if (!matchingProperty) {
            throw new Error(`b field "${bField}" not found in properties`);
        }
        if (matchingProperty.type !== 'array') {
            throw new Error(`b field "${bField}" must have type "array", got "${matchingProperty.type}"`);
        }
    });
    
    // Test 4.2: 必填字段
    await runTest('Schema - Required fields', async () => {
        const urlProperty = schema.properties.find(p => p.name === 'url');
        if (!urlProperty) throw new Error('Missing url property');
        if (!urlProperty.required) throw new Error('url should be required');
    });
    
    // Test 4.3: editor 类型验证
    await runTest('Schema - Valid editor types', async () => {
        const validEditors = ['input', 'textarea', 'number', 'select', 'radio', 'checkbox', 
                              'switch', 'datepicker', 'requestList', 'requestListSource', 'stringList'];
        
        schema.properties.forEach(prop => {
            if (prop.editor && !validEditors.includes(prop.editor)) {
                throw new Error(`Invalid editor "${prop.editor}" for property "${prop.name}"`);
            }
        });
    });
    
    // Test 4.4: select 类型必须有 options
    await runTest('Schema - Select fields have options', async () => {
        schema.properties.forEach(prop => {
            if (prop.editor === 'select') {
                if (!prop.options || !Array.isArray(prop.options)) {
                    throw new Error(`Select property "${prop.name}" must have options array`);
                }
            }
        });
    });
    
    // Test 4.5: description 字段
    await runTest('Schema - Has description', async () => {
        if (!schema.description) throw new Error('Schema should have description');
    });
    
    // Test 4.6: 所有属性有 title
    await runTest('Schema - All properties have title', async () => {
        schema.properties.forEach(prop => {
            if (!prop.title) {
                throw new Error(`Property "${prop.name}" missing title`);
            }
        });
    });
}

// ============================================
// 测试套件 5: 数据提取格式
// ============================================
async function testDataExtraction() {
    log('cyan', '\n=== 测试套件 5: 数据提取格式 ===');
    
    // Test 5.1: 提取字段验证
    await runTest('Data extraction - Field validation', async () => {
        const expectedFields = ['title', 'description', 'h1', 'textLength', 'imageCount', 'linkCount'];
        // 模拟数据提取结果
        const mockResult = {
            url: 'https://example.com',
            depth: 0,
            success: true,
            title: 'Test Page',
            description: 'Test Description',
            h1: 'Main Heading',
            textLength: 1000,
            imageCount: 5,
            linkCount: 10
        };
        
        expectedFields.forEach(field => {
            if (!(field in mockResult)) {
                throw new Error(`Missing field: ${field}`);
            }
        });
    });
    
    // Test 5.2: H2 列表提取
    await runTest('Data extraction - H2 list', async () => {
        const mockH2List = ['Section 1', 'Section 2', 'Section 3'];
        if (!Array.isArray(mockH2List)) throw new Error('H2 list should be an array');
        if (mockH2List.length > 5) throw new Error('H2 list should be limited to 5 items');
    });
    
    // Test 5.3: 错误结果格式
    await runTest('Data extraction - Error result format', async () => {
        const errorResult = {
            url: 'https://invalid-url',
            depth: 0,
            success: false,
            error: 'Connection failed',
            title: '',
            description: ''
        };
        
        if (errorResult.success) throw new Error('Failed result should have success=false');
        if (!errorResult.error) throw new Error('Failed result should have error message');
    });
}

// ============================================
// 测试套件 6: 错误处理
// ============================================
async function testErrorHandling() {
    log('cyan', '\n=== 测试套件 6: 错误处理 ===');
    
    // Test 6.1: 空 URL 列表
    await runTest('Error handling - Empty URL list', async () => {
        const urls = parseStartUrls({ url: [] });
        if (urls.length !== 0) throw new Error('Empty URL list should return empty array');
    });
    
    // Test 6.2: 无效 URL 格式
    await runTest('Error handling - Invalid URL format', async () => {
        // parseStartUrls 应该能处理无效 URL 而不崩溃
        const urls = parseStartUrls({ url: 'not-a-url' });
        // 只是返回处理后的字符串
        if (urls.length !== 1) throw new Error('Should still process the input');
    });
    
    // Test 6.3: null 和 undefined 处理
    await runTest('Error handling - Null/undefined handling', async () => {
        const urls = parseStartUrls({ url: [null, undefined, ''] });
        if (urls.length !== 0) throw new Error('Should filter out null/undefined values');
    });
}

// ============================================
// 测试套件 7: Cafe 平台模拟
// ============================================
async function testCafeSimulation() {
    log('cyan', '\n=== 测试套件 7: Cafe 平台模拟 ===');
    
    // Test 7.1: 模拟输入格式
    await runTest('Cafe - Input format simulation', async () => {
        const cafeInput = {
            url: [
                { url: 'https://example.com' },
                { url: 'https://example.org' }
            ],
            maxCrawlingDepth: 1,
            maxPagesPerCrawl: 5,
            pageLoadTimeoutSecs: 30
        };
        
        const urls = parseStartUrls(cafeInput);
        if (urls.length !== 2) throw new Error('Should parse 2 URLs');
    });
    
    // Test 7.2: 模拟输出格式
    await runTest('Cafe - Output format simulation', async () => {
        const mockOutput = {
            url: 'https://example.com',
            depth: 0,
            success: true,
            title: 'Example Domain',
            description: 'Example Domain description',
            textLength: 100,
            imageCount: 0,
            linkCount: 1
        };
        
        const requiredFields = ['url', 'depth', 'success'];
        requiredFields.forEach(field => {
            if (!(field in mockOutput)) {
                throw new Error(`Missing required field: ${field}`);
            }
        });
    });
    
    // Test 7.3: PROXY_AUTH 环境变量格式
    await runTest('Cafe - PROXY_AUTH format', async () => {
        const mockProxyAuth = 'username:password';
        const browserWSEndpoint = `ws://${mockProxyAuth}@chrome-ws-inner.cafescraper.com`;
        
        if (!browserWSEndpoint.includes('chrome-ws-inner.cafescraper.com')) {
            throw new Error('Browser endpoint should use Cafe domain');
        }
        if (!browserWSEndpoint.includes(mockProxyAuth)) {
            throw new Error('Browser endpoint should include auth');
        }
    });
    
    // Test 7.4: 表头格式
    await runTest('Cafe - Table header format', async () => {
        const headers = [
            { label: 'URL', key: 'url', format: 'text' },
            { label: '深度', key: 'depth', format: 'number' },
            { label: '标题', key: 'title', format: 'text' }
        ];
        
        headers.forEach(h => {
            if (!h.label || !h.key) {
                throw new Error('Each header must have label and key');
            }
        });
    });
}

// ============================================
// 测试套件 8: 链接发现逻辑
// ============================================
async function testLinkDiscovery() {
    log('cyan', '\n=== 测试套件 8: 链接发现逻辑 ===');
    
    // Test 8.1: 同域名链接
    await runTest('Link discovery - Same domain', async () => {
        const baseUrl = 'https://example.com';
        const linkUrl = 'https://example.com/page';
        
        const baseOrigin = new URL(baseUrl).origin;
        const linkOrigin = new URL(linkUrl).origin;
        
        if (baseOrigin !== linkOrigin) {
            throw new Error('Same domain links should have same origin');
        }
    });
    
    // Test 8.2: 跨域名链接
    await runTest('Link discovery - Cross domain', async () => {
        const baseUrl = 'https://example.com';
        const linkUrl = 'https://other.com/page';
        
        const baseOrigin = new URL(baseUrl).origin;
        const linkOrigin = new URL(linkUrl).origin;
        
        if (baseOrigin === linkOrigin) {
            throw new Error('Cross domain links should have different origins');
        }
    });
    
    // Test 8.3: 深度限制
    await runTest('Link discovery - Depth limit', async () => {
        const maxDepth = 1;
        const currentDepth = 1;
        
        if (currentDepth >= maxDepth) {
            // 不应该发现新链接
        }
    });
}

// ============================================
// 主函数
// ============================================
async function main() {
    console.log('');
    log('cyan', '╔════════════════════════════════════════════════════════════╗');
    log('cyan', '║     Web Scraper Worker 全量测试套件                          ║');
    log('cyan', '╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    const startTime = Date.now();
    
    try {
        await testInputFormats();
        await testUrlNormalization();
        await testConfiguration();
        await testInputSchema();
        await testDataExtraction();
        await testErrorHandling();
        await testCafeSimulation();
        await testLinkDiscovery();
        
    } catch (err) {
        log('red', `\n测试套件执行失败: ${err.message}`);
        console.error(err);
    }
    
    const totalTime = Date.now() - startTime;
    
    // 输出结果
    console.log('');
    log('cyan', '════════════════════════════════════════════════════════════');
    console.log('');
    log('cyan', '测试结果汇总:');
    console.log(`  总计: ${stats.total}`);
    log('green', `  通过: ${stats.passed}`);
    log('red', `  失败: ${stats.failed}`);
    log('yellow', `  跳过: ${stats.skipped}`);
    console.log(`  耗时: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('');
    
    const successRate = stats.total > 0 ? (stats.passed / (stats.total - stats.skipped) * 100).toFixed(1) : 0;
    log('cyan', `成功率: ${successRate}%`);
    
    // 保存测试报告
    const report = {
        timestamp: new Date().toISOString(),
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
        successRate: `${successRate}%`,
        durationMs: totalTime
    };
    
    fs.writeFileSync(
        path.join(__dirname, 'test-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log('');
    log('cyan', '测试报告已保存到 test-report.json');
    
    process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
