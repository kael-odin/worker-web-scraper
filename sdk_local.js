#!/usr/bin/env node
/**
 * Cafe 平台本地模拟 SDK
 * 模拟 CafeScraper 平台的 gRPC SDK 接口
 */
const fs = require('fs');
const path = require('path');

const INPUT_FILE = process.env.INPUT_FILE || path.join(__dirname, 'test-input.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'output.jsonl');
const LOG_FILE = process.env.LOG_FILE || path.join(__dirname, 'execution.log');

// 颜色
const colors = {
    DEBUG: '\x1b[36m',
    INFO: '\x1b[32m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    reset: '\x1b[0m',
};

class LogWriter {
    constructor() {
        this.logs = [];
    }
    
    write(level, msg) {
        const timestamp = new Date().toISOString();
        const logLine = `${timestamp} ${level}: ${msg}`;
        this.logs.push(logLine);
        
        // 控制台输出
        console.log(`${colors[level] || ''}[${level}]${colors.reset} ${msg}`);
        
        // 写入日志文件
        try {
            fs.appendFileSync(LOG_FILE, logLine + '\n');
        } catch {}
    }
}

class Parameter {
    static async getInputJSONObject() {
        try {
            const content = fs.readFileSync(INPUT_FILE, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            console.warn('[WARN] Cannot read input file:', err.message);
            return {};
        }
    }
}

class Log {
    constructor(writer) {
        this._writer = writer;
    }
    
    debug(msg) { this._writer.write('DEBUG', msg); }
    info(msg) { this._writer.write('INFO', msg); }
    warn(msg) { this._writer.write('WARN', msg); }
    error(msg) { this._writer.write('ERROR', msg); }
}

class Result {
    constructor() {
        this.headers = [];
        this.results = [];
    }
    
    async setTableHeader(headers) {
        this.headers = headers;
        console.log('\n📋 表头设置:');
        headers.forEach(h => {
            console.log(`   - ${h.label || h.key}: ${h.format || 'text'}`);
        });
    }
    
    async pushData(data) {
        this.results.push(data);
        
        // 控制台输出
        const jsonStr = JSON.stringify(data, null, 2);
        console.log(`\n📤 输出数据 #${this.results.length}:`);
        console.log(jsonStr.slice(0, 500));
        if (jsonStr.length > 500) console.log('   ... (截断)');
        
        // 写入输出文件
        try {
            fs.appendFileSync(OUTPUT_FILE, JSON.stringify(data) + '\n');
        } catch (err) {
            console.error('[ERROR] 写入输出文件失败:', err.message);
        }
    }
}

class CafeSDK {
    constructor() {
        this._logWriter = new LogWriter();
        this._result = new Result();
        
        // 大写接口 (Python 风格)
        this.Parameter = Parameter;
        this.Log = new Log(this._logWriter);
        this.Result = this._result;
        
        // 小写接口 (Node.js 风格) - Cafe 平台实际使用
        this.parameter = {
            getInputJSONObject: Parameter.getInputJSONObject
        };
        this.log = this.Log;
        this.result = this._result;
    }
    
    get logs() {
        return this._logWriter.logs;
    }
}

const cafesdk = new CafeSDK();
module.exports = cafesdk;
