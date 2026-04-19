"""GitHub webhook receiver — runs git pull + restarts links-bio on push to main."""
import hashlib
import hmac
import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = b"ac762fa786699f845a96a54053b196cc3bd8c604634b69d5eed7b92ae86c7a3a"
WORKDIR = "/home/banar/Desktop/links-bio"
BRANCH = "main"
PORT = 9000


class WebhookHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(format % args, flush=True)

    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        sig = self.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Invalid signature")
            return

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        ref = payload.get("ref", "")
        if ref != f"refs/heads/{BRANCH}":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Ignored (not main branch)")
            return

        try:
            subprocess.run(["git", "-C", WORKDIR, "pull", "--ff-only"], check=True)
            subprocess.run(["sudo", "systemctl", "restart", "links-bio"], check=True)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Deployed")
            print("Deploy triggered successfully", flush=True)
        except subprocess.CalledProcessError as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Deploy failed: {e}".encode())
            print(f"Deploy failed: {e}", flush=True)


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), WebhookHandler)
    print(f"Webhook receiver listening on port {PORT}", flush=True)
    server.serve_forever()
