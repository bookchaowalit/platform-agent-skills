"""Tests for the flow-video Google Drive uploader (no network: urllib is mocked)."""

from __future__ import annotations

import io
import json
import os
import stat
import sys
import tempfile
import unittest
import urllib.error
from email.message import Message
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[1] / "flow-video" / "scripts"
sys.path.insert(0, str(SCRIPTS))

import drive_publish

ENV = {
    "GOOGLE_CLIENT_ID": "id",
    "GOOGLE_CLIENT_SECRET": "secret",
    "GOOGLE_DRIVE_REFRESH_TOKEN": "refresh",
}


def reply(body: dict | None = None, headers: dict | None = None) -> mock.Mock:
    res = mock.Mock()
    res.read.return_value = json.dumps(body or {}).encode()
    res.headers = headers or {}
    return res


def resume_incomplete(range_header: str | None) -> urllib.error.HTTPError:
    headers = Message()
    if range_header:
        headers["Range"] = range_header
    return urllib.error.HTTPError(
        "https://upload", 308, "Resume Incomplete", headers, io.BytesIO(b"")
    )


class StubToken(drive_publish.AccessToken):
    def get(self) -> str:
        return "access"


class WritePrivateTest(unittest.TestCase):
    def test_new_and_existing_files_end_up_mode_600(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sub" / "token"
            drive_publish.write_private(path, "one")
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            path.chmod(0o644)
            drive_publish.write_private(path, "two")
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(path.read_text(), "two")

    def test_file_is_never_created_world_readable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "token"
            real_open = os.open
            modes = []

            def spy(p, flags, mode=0o777):
                modes.append(mode)
                return real_open(p, flags, mode)

            with mock.patch.object(drive_publish.os, "open", spy):
                drive_publish.write_private(path, "secret")
            self.assertEqual(modes, [0o600])


class UploadResumeTest(unittest.TestCase):
    def test_resumes_from_the_acknowledged_offset_not_the_sent_end(self) -> None:
        data = bytes(range(256)) * 40  # 10240 bytes
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "video.webm"
            path.write_bytes(data)
            sent = []

            def urlopen(req):
                sent.append((req.headers["Content-range"], req.data))
                if len(sent) == 1:
                    raise resume_incomplete(
                        "bytes=0-999"
                    )  # server kept only the first 1000 bytes
                return reply({"id": "file"})

            with (
                mock.patch.object(drive_publish, "CHUNK", 4096),
                mock.patch.object(
                    drive_publish,
                    "api",
                    return_value=reply(headers={"Location": "https://upload"}),
                ),
                mock.patch.object(drive_publish.urllib.request, "urlopen", urlopen),
            ):
                drive_publish.upload_file(StubToken(), path, "parent")

            self.assertEqual(sent[0][0], "bytes 0-4095/10240")
            self.assertEqual(sent[1][0], "bytes 1000-5095/10240")
            self.assertEqual(sent[1][1], data[1000:5096])

    def test_no_range_header_means_start_again_and_stalls_abort(self) -> None:
        self.assertEqual(drive_publish.acknowledged_end({}), 0)
        self.assertEqual(drive_publish.acknowledged_end({"Range": "bytes=0-41"}), 42)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "a.vtt"
            path.write_bytes(b"x" * 10)

            def urlopen(req):
                raise resume_incomplete(None)

            with (
                mock.patch.object(
                    drive_publish,
                    "api",
                    return_value=reply(headers={"Location": "https://upload"}),
                ),
                mock.patch.object(drive_publish.urllib.request, "urlopen", urlopen),
                self.assertRaises(SystemExit) as stop,
            ):
                drive_publish.upload_file(StubToken(), path, "parent")
            self.assertIn("stalled", str(stop.exception))


class AccessTokenTest(unittest.TestCase):
    def test_renews_before_expiry_and_caches_otherwise(self) -> None:
        clock = [1000.0]
        calls = []

        def post_form(url, fields):
            calls.append(fields["grant_type"])
            return {"access_token": f"t{len(calls)}", "expires_in": 3600}

        with (
            mock.patch.dict(os.environ, ENV),
            mock.patch.object(drive_publish, "post_form", post_form),
            mock.patch.object(drive_publish.time, "monotonic", lambda: clock[0]),
        ):
            token = drive_publish.AccessToken()
            self.assertEqual(token.get(), "t1")
            clock[0] += 1800
            self.assertEqual(token.get(), "t1")
            clock[0] += 1600  # within TOKEN_MARGIN of the hour
            self.assertEqual(token.get(), "t2")
        self.assertEqual(calls, ["refresh_token", "refresh_token"])


class DefaultVisibilityTest(unittest.TestCase):
    def test_every_create_ignores_the_domain_default_visibility(self) -> None:
        urls = []

        def api(token, method, url, body=None, headers=None):
            urls.append((method, url))
            return reply({"id": "new"}, {"Location": "https://upload"})

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "a.vtt"
            path.write_bytes(b"x")
            with (
                mock.patch.object(drive_publish, "api", api),
                mock.patch.object(
                    drive_publish.urllib.request,
                    "urlopen",
                    return_value=reply({"id": "f"}),
                ),
            ):
                drive_publish.make_folder(StubToken(), "flows", None)
                drive_publish.upload_file(StubToken(), path, "parent")
        creates = [url for method, url in urls if method == "POST"]
        self.assertEqual(len(creates), 2)
        for url in creates:
            self.assertIn("ignoreDefaultVisibility=true", url)


class PrivateParentTest(unittest.TestCase):
    def check(self, meta: dict) -> None:
        with mock.patch.object(drive_publish, "api", return_value=reply(meta)):
            drive_publish.check_private_parent(StubToken(), "folder-id")

    def test_unshared_folder_passes(self) -> None:
        self.check({"mimeType": "application/vnd.google-apps.folder", "shared": False})

    def test_shared_unknown_or_non_folder_parent_is_refused(self) -> None:
        for meta in (
            {"mimeType": "application/vnd.google-apps.folder", "shared": True},
            {"mimeType": "application/vnd.google-apps.folder"},
            {"mimeType": "video/webm", "shared": False},
        ):
            with self.subTest(meta=meta), self.assertRaises(SystemExit):
                self.check(meta)

    def test_upload_checks_the_parent_before_creating_anything(self) -> None:
        with (
            tempfile.TemporaryDirectory() as tmp,
            mock.patch.object(drive_publish, "AccessToken", StubToken),
            mock.patch.object(
                drive_publish, "check_private_parent", side_effect=SystemExit("shared")
            ),
            mock.patch.object(drive_publish, "make_folder") as make_folder,
            self.assertRaises(SystemExit),
        ):
            drive_publish.upload(tmp, None, "shared-folder")
        make_folder.assert_not_called()


if __name__ == "__main__":
    unittest.main()
