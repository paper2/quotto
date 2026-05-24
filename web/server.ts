import { generateQuoteImage } from '../src/image-generator';
import { DEFAULT_CONFIG } from '../src/constants';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';

const PORT = 47321;
const OUTPUT_DIR = path.resolve('web/output');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const HTML = fs.readFileSync(path.resolve('web/index.html'), 'utf-8');

Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        // Serve generated images
        if (url.pathname.startsWith('/output/')) {
            const filename = path.basename(url.pathname);
            const filePath = path.join(OUTPUT_DIR, filename);
            if (fs.existsSync(filePath)) {
                return new Response(Bun.file(filePath), {
                    headers: { 'Content-Type': 'image/png' },
                });
            }
            return new Response('Not found', { status: 404 });
        }

        // Generate image API
        if (url.pathname === '/generate' && req.method === 'POST') {
            let body: { quote?: string; title?: string; author?: string; output?: string };
            try {
                body = await req.json();
            } catch {
                return Response.json({ error: 'Invalid JSON' }, { status: 400 });
            }

            const { quote, title, author, output } = body;

            if (!quote || quote.trim().length === 0) {
                return Response.json({ error: '引用文は必須です' }, { status: 400 });
            }

            const filename = output?.trim()
                ? output.trim().endsWith('.png') ? output.trim() : `${output.trim()}.png`
                : `quotto-${Date.now()}.png`;

            const outputPath = path.join(OUTPUT_DIR, path.basename(filename));

            try {
                await generateQuoteImage(
                    {
                        quote: quote.trim(),
                        title: title?.trim() || undefined,
                        author: author?.trim() || undefined,
                    },
                    outputPath,
                    DEFAULT_CONFIG
                );
                return Response.json({ url: `/output/${path.basename(outputPath)}` });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                return Response.json({ error: message }, { status: 500 });
            }
        }

        // Serve index.html
        return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    },
});

console.log(`Server running at http://localhost:${PORT}`);

// Open browser automatically
const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
exec(`${openCmd} http://localhost:${PORT}`);
