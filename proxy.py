#!/usr/bin/env python3
"""Lightweight CORS proxy for Jira API requests. Runs on port 8788."""

import http.server
import urllib.request
import urllib.error
import json
import sys

PORT = 8788

class CORSProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        self._proxy_request('GET')

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Target-URL')
        self.send_header('Access-Control-Max-Age', '86400')

    def _proxy_request(self, method):
        target_url = self.headers.get('X-Target-URL')
        if not target_url:
            self.send_response(400)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing X-Target-URL header'}).encode())
            return

        req_headers = {}
        if self.headers.get('Authorization'):
            req_headers['Authorization'] = self.headers['Authorization']
        req_headers['Accept'] = 'application/json'

        try:
            req = urllib.request.Request(target_url, headers=req_headers, method=method)
            with urllib.request.urlopen(req) as resp:
                body = resp.read()
                self.send_response(resp.status)
                self._send_cors_headers()
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(502)
            self._send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def log_message(self, format, *args):
        sys.stderr.write(f"[proxy] {args[0]}\n")

if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', PORT), CORSProxyHandler)
    print(f'CORS proxy running on http://127.0.0.1:{PORT}')
    server.serve_forever()
