#!/usr/bin/env -S npx tsx
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateQuoteImage } from '../src/image-generator.js';
import { DEFAULT_CONFIG } from '../src/constants.js';
import { exec } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 47321;
const OUTPUT_DIR = path.resolve('web/output');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

    // Serve generated images
    if (url.pathname.startsWith('/output/')) {
        const filename = path.basename(url.pathname);
        const filePath = path.join(OUTPUT_DIR, filename);
        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            fs.createReadStream(filePath).pipe(res);
            return;
        }
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    // Generate image API
    if (url.pathname === '/generate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const { quote, source, output } = JSON.parse(body);

                if (!quote?.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '引用文は必須です' }));
                    return;
                }

                const filename = output?.trim()
                    ? output.trim().endsWith('.png') ? output.trim() : `${output.trim()}.png`
                    : `quotto-${Date.now()}.png`;

                const outputPath = path.join(OUTPUT_DIR, path.basename(filename));

                await generateQuoteImage(
                    {
                        quote: quote.trim(),
                        title: source?.trim() || undefined,
                        author: undefined,
                    },
                    outputPath,
                    DEFAULT_CONFIG
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ url: `/output/${path.basename(outputPath)}` }));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: message }));
            }
        });
        return;
    }

    // Serve index.html
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
});

server.listen(PORT, () => {
    console.log(`Quotto web UI running at http://localhost:${PORT}`);
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCmd} http://localhost:${PORT}`);
});
