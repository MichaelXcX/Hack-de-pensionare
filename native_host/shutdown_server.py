#!/usr/bin/env python3
"""
Anarchist Shutdown Server
Run with sudo so it has permission to call `shutdown -h now`.

Usage:
    sudo python3 shutdown_server.py

The extension calls POST http://127.0.0.1:6660/shutdown with JSON {"token": "..."}.
Set ANARCHIST_SECRET env var to override the default token.
"""

import json
import os
import platform
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = os.environ.get('ANARCHIST_SECRET', 'anarchist-nuclear-2026')
PORT   = 6660
HOST   = '127.0.0.1'


def do_shutdown():
    os_name = platform.system()
    if os_name == 'Darwin':
        subprocess.Popen(['shutdown', '-h', 'now'], start_new_session=True, close_fds=True)
    elif os_name == 'Linux':
        subprocess.Popen(['shutdown', '-h', 'now'], start_new_session=True, close_fds=True)
    elif os_name == 'Windows':
        subprocess.Popen(['shutdown', '/s', '/t', '0'], start_new_session=True, close_fds=True)
    else:
        print(f'[anarchist] Unknown OS: {os_name}', flush=True)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin',  'chrome-extension://belabclfnngllmegebahnpibbpnbimgk')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        """Preflight for CORS."""
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/ping':
            self._send_json(200, {'ok': True, 'msg': 'anarchist server is alive'})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != '/shutdown':
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get('Content-Length', 0))
        body   = json.loads(self.rfile.read(length)) if length else {}

        if body.get('token') != SECRET:
            self._send_json(403, {'ok': False, 'error': 'unauthorized'})
            return

        self._send_json(200, {'ok': True, 'msg': 'Shutting down...'})
        do_shutdown()

    def _send_json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type',   'application/json')
        self.send_header('Content-Length', str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        print(f'[anarchist] {self.address_string()} - {fmt % args}', flush=True)


if __name__ == '__main__':
    if os.name != 'nt' and os.geteuid() != 0:
        print('WARNING: not running as root — shutdown command will likely fail.')
        print('         Start with: sudo python3 shutdown_server.py')

    server = HTTPServer((HOST, PORT), Handler)
    print(f'[anarchist] Shutdown server listening on {HOST}:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[anarchist] Stopped.')
