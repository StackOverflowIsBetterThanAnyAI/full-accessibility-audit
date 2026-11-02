/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'fs'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { extname, join, normalize, resolve } from 'path'

const CONTENT_TYPES: Record<string, string> = {
    '.css': 'text/css',
    '.gif': 'image/gif',
    '.htm': 'text/html',
    '.html': 'text/html',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.vtt': 'text/vtt',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.xml': 'application/xml',
}

export const startBenchmarkServer = (rootPath: string): Promise<string> => {
    const root = resolve(rootPath)

    const server = createServer((request, response) => {
        const pathname = decodeURIComponent(
            new URL(request.url || '/', 'http://localhost').pathname
        )
        const filePath = normalize(join(root, pathname))

        if (
            !filePath.startsWith(root) ||
            !existsSync(filePath) ||
            !statSync(filePath).isFile()
        ) {
            response.writeHead(404)
            response.end()
            return
        }

        response.writeHead(200, {
            'Content-Type':
                CONTENT_TYPES[extname(filePath).toLowerCase()] ||
                'application/octet-stream',
        })
        createReadStream(filePath).pipe(response)
    })

    return new Promise((resolveOrigin, reject) => {
        server.once('error', reject)
        server.listen(0, 'localhost', () => {
            const { port } = server.address() as AddressInfo
            resolveOrigin(`http://localhost:${port}`)
        })
    })
}
