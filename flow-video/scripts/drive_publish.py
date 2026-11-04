#!/usr/bin/env python3
"""Upload a recorded flow-video folder to the owner's Google Drive (private, never shared).

The browser that signs in may be on another machine (a Mac driving this WSL box), so the
sign-in does not need a callback server: Google redirects to http://127.0.0.1:<port>/ which
fails to load, and the owner pastes that failed URL back. The code in it is exchanged once
for a refresh token limited to `drive.file` (only files this tool creates).

Credentials come from the environment and are never printed:
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   an OAuth client of type "Desktop app"
  GOOGLE_DRIVE_REFRESH_TOKEN               written by `auth-code` (run via `infisical run`)

Usage:
  drive_publish.py auth-url                       print the sign-in link (saves PKCE state, mode 600)
  drive_publish.py auth-code '<pasted url>' --out <file>
                                                  exchange the code; write the refresh token to <file> (mode 600)
  drive_publish.py upload <dir> [--name <Drive folder>] [--parent <folder id>]
                                                  upload <dir> recursively; prints the Drive folder link
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import secrets
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SCOPE = "https://www.googleapis.com/auth/drive.file"
REDIRECT = "http://127.0.0.1:53999/"
STATE_FILE = Path.home() / ".local/state/flow-video/drive-auth.json"
SKIP = {".raw"}
CHUNK = 8 * 1024 * 1024
TOKEN_MARGIN = 300  # renew the access token this many seconds before it expires
# Give up when the server acknowledges no new bytes this many times in a row.
MAX_STALLS = 5
# Transient server or network failures in a row before giving up on a file.
MAX_RETRIES = 5
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
mimetypes.add_type("video/webm", ".webm")
mimetypes.add_type("text/vtt", ".vtt")
mimetypes.add_type("text/markdown", ".md")


def env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        sys.exit(
            f"drive_publish: {name} is not set (run under `infisical run --path /google`)"
        )
    return value


def write_private(path: Path, text: str) -> None:
    """Write a secret so that no other user can read it, not even for a moment."""
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # A fresh 0600 file swapped into place: an existing file, hard link or symlink at
    # `path` is replaced, never written through.
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def post_form(url: str, fields: dict) -> dict:
    req = urllib.request.Request(url, urllib.parse.urlencode(fields).encode())
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        body = json.loads(e.read() or b"{}")
        sys.exit(
            f"drive_publish: {url} → {e.code} {body.get('error')}: {body.get('error_description', '')}"
        )


def auth_url() -> None:
    verifier = secrets.token_urlsafe(64)
    state = secrets.token_urlsafe(16)
    write_private(STATE_FILE, json.dumps({"verifier": verifier, "state": state}))
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .rstrip(b"=")
        .decode()
    )
    query = urllib.parse.urlencode(
        {
            "client_id": env("GOOGLE_CLIENT_ID"),
            "redirect_uri": REDIRECT,
            "response_type": "code",
            "scope": SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    print(f"https://accounts.google.com/o/oauth2/v2/auth?{query}")


def auth_code(pasted: str, out: str) -> None:
    saved = json.loads(STATE_FILE.read_text())
    params = urllib.parse.parse_qs(urllib.parse.urlparse(pasted.strip()).query)
    if params.get("error"):
        sys.exit(f"drive_publish: Google returned {params['error'][0]}")
    if params.get("state", [""])[0] != saved["state"]:
        sys.exit(
            "drive_publish: state does not match the last auth-url; run auth-url again"
        )
    if "code" not in params:
        sys.exit("drive_publish: no code in the pasted URL")
    token = post_form(
        "https://oauth2.googleapis.com/token",
        {
            "client_id": env("GOOGLE_CLIENT_ID"),
            "client_secret": env("GOOGLE_CLIENT_SECRET"),
            "code": params["code"][0],
            "code_verifier": saved["verifier"],
            "redirect_uri": REDIRECT,
            "grant_type": "authorization_code",
        },
    )
    if "refresh_token" not in token:
        sys.exit("drive_publish: Google returned no refresh token")
    if SCOPE not in token.get("scope", ""):
        sys.exit(f"drive_publish: token lacks {SCOPE} (got {token.get('scope')})")
    path = Path(out).expanduser()
    write_private(path, token["refresh_token"])
    STATE_FILE.unlink(missing_ok=True)
    print(
        f"drive_publish: refresh token (drive.file) written to {path} (mode 600); store it in Infisical, then delete the file"
    )


class AccessToken:
    """An access token that renews itself before it expires (they last about an hour)."""

    def __init__(self) -> None:
        self.value = ""
        self.expires = 0.0

    def get(self) -> str:
        if time.monotonic() >= self.expires - TOKEN_MARGIN:
            res = post_form(
                "https://oauth2.googleapis.com/token",
                {
                    "client_id": env("GOOGLE_CLIENT_ID"),
                    "client_secret": env("GOOGLE_CLIENT_SECRET"),
                    "refresh_token": env("GOOGLE_DRIVE_REFRESH_TOKEN"),
                    "grant_type": "refresh_token",
                },
            )
            self.value = res["access_token"]
            self.expires = time.monotonic() + int(res.get("expires_in", 3600))
        return self.value


def api(
    token: str,
    method: str,
    url: str,
    body: bytes | None = None,
    headers: dict | None = None,
):
    req = urllib.request.Request(
        url,
        body,
        method=method,
        headers={"Authorization": f"Bearer {token}", **(headers or {})},
    )
    try:
        return urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        if "accessNotConfigured" in detail or "has not been used" in detail:
            sys.exit(
                "drive_publish: the Google Drive API is not enabled for this OAuth client's project; enable it in Cloud Console and retry\n"
                + detail
            )
        sys.exit(f"drive_publish: {method} {url.split('?')[0]} → {e.code}: {detail}")


def check_private_parent(token: AccessToken, parent: str) -> None:
    """Refuse a --parent folder that is shared, so recordings never land where others can see them."""
    query = urllib.parse.urlencode(
        {"fields": "mimeType,shared", "supportsAllDrives": "true"}
    )
    meta = json.load(
        api(
            token.get(),
            "GET",
            f"https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(parent)}?{query}",
        )
    )
    if meta.get("mimeType") != "application/vnd.google-apps.folder":
        sys.exit(f"drive_publish: --parent {parent} is not a folder")
    if meta.get("shared") is not False:
        sys.exit(
            f"drive_publish: --parent {parent} is shared; recordings are private, so pick an unshared folder"
        )


def make_folder(token: AccessToken, name: str, parent: str | None) -> str:
    meta = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        **({"parents": [parent]} if parent else {}),
    }
    res = api(
        token.get(),
        "POST",
        "https://www.googleapis.com/drive/v3/files?fields=id&ignoreDefaultVisibility=true",
        json.dumps(meta).encode(),
        {"Content-Type": "application/json"},
    )
    return json.load(res)["id"]


def acknowledged_end(headers) -> int:
    """The offset after the last byte the server stored, from a 308 reply's Range header (absent = none)."""
    rng = headers.get("Range") if headers else None
    return int(rng.rsplit("-", 1)[1]) + 1 if rng else 0


def backoff(retries: int, path: Path, why: str) -> int:
    """Wait before retrying a transient failure; exit once MAX_RETRIES in a row have failed."""
    if retries >= MAX_RETRIES:
        sys.exit(
            f"drive_publish: upload of {path.name} failed {retries} times in a row (last: {why})"
        )
    time.sleep(min(2**retries, 32))
    return retries + 1


def upload_file(token: AccessToken, path: Path, parent: str) -> None:
    size = path.stat().st_size
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    meta = json.dumps({"name": path.name, "parents": [parent]}).encode()
    start = api(
        token.get(),
        "POST",
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id&ignoreDefaultVisibility=true",
        meta,
        {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mime,
            "X-Upload-Content-Length": str(size),
        },
    )
    session = start.headers["Location"]
    with path.open("rb") as fh:
        offset = 0
        stalls = 0
        retries = 0
        probe = False  # after a failure, ask the server how much it stored before sending more
        while True:
            fh.seek(offset)
            chunk = b"" if probe else fh.read(CHUNK)
            end = offset + len(chunk) - 1
            headers = {
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {offset}-{end}/{size}"
                if chunk
                else f"bytes */{size}",
            }
            req = urllib.request.Request(session, chunk, method="PUT", headers=headers)
            try:
                urllib.request.urlopen(req)
                return
            except urllib.error.HTTPError as e:
                if e.code in RETRY_STATUSES:
                    retries = backoff(retries, path, f"HTTP {e.code}")
                    probe = True
                    continue
                if e.code != 308:
                    sys.exit(
                        f"drive_publish: upload of {path.name} failed → {e.code}: {e.read().decode(errors='replace')[:300]}"
                    )
                # The server may keep fewer bytes than were sent; resume from what it acknowledged.
                acked = acknowledged_end(e.headers)
            except (urllib.error.URLError, OSError) as e:
                retries = backoff(retries, path, str(getattr(e, "reason", e)))
                probe = True
                continue
            if not probe:
                stalls = stalls + 1 if acked <= offset else 0
            probe = False
            retries = 0
            if stalls >= MAX_STALLS:
                sys.exit(
                    f"drive_publish: upload of {path.name} stalled at byte {offset} of {size}"
                )
            offset = acked


def upload(directory: str, name: str | None, parent: str | None) -> None:
    root = Path(directory).expanduser().resolve()
    if not root.is_dir():
        sys.exit(f"drive_publish: not a folder: {root}")
    token = AccessToken()
    if parent:
        check_private_parent(token, parent)
    folders = {root: make_folder(token, name or root.name, parent)}
    files = sorted(
        p
        for p in root.rglob("*")
        if p.is_file() and not SKIP.intersection(p.relative_to(root).parts)
    )
    total = sum(p.stat().st_size for p in files)
    done = 0
    for path in files:
        for folder in reversed(
            path.relative_to(root).parents[:-1]
            if len(path.relative_to(root).parts) > 1
            else []
        ):
            full = root / folder
            if full not in folders:
                folders[full] = make_folder(token, full.name, folders[full.parent])
        upload_file(token, path, folders[path.parent])
        done += path.stat().st_size
        print(
            f"drive_publish: {path.relative_to(root)} ({done * 100 // max(total, 1)}%)",
            flush=True,
        )
    print(
        f"drive_publish: {len(files)} files, {total / 1e6:.1f} MB → https://drive.google.com/drive/folders/{folders[root]}"
    )


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("auth-url")
    a = sub.add_parser("auth-code")
    a.add_argument("url")
    a.add_argument("--out", required=True)
    u = sub.add_parser("upload")
    u.add_argument("dir")
    u.add_argument("--name")
    u.add_argument("--parent")
    args = ap.parse_args()
    if args.cmd == "auth-url":
        auth_url()
    elif args.cmd == "auth-code":
        auth_code(args.url, args.out)
    else:
        upload(args.dir, args.name, args.parent)


if __name__ == "__main__":
    main()
