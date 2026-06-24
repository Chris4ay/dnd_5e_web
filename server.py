#!/usr/bin/env python3
"""DND Wiki 服务器 - 自动处理 GBK 编码"""
import os, sys, re
from io import BytesIO
from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 23333
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isfile(path):
            ext = os.path.splitext(path)[1].lower()
            if ext in ('.html', '.htm'):
                with open(path, 'rb') as f:
                    data = f.read()
                try:
                    text = data.decode('gbk')
                except:
                    try:
                        text = data.decode('utf-8')
                    except:
                        text = data.decode('gbk', errors='replace')
                text = re.sub(r'<meta\s+[^>]*charset[^>]*>', '', text, flags=re.IGNORECASE)
                body = text.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                return BytesIO(body)
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except:
            pass

with TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving on http://0.0.0.0:{PORT}", flush=True)
    httpd.serve_forever()
