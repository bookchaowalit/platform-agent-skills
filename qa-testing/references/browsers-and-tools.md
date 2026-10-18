# Browsers and tools for the UI review scripts

`ui_review.mjs` and ux-review's `ui_states.mjs` need Playwright and at least Chromium.
WebKit, Firefox and axe-core are optional: whatever is missing is reported as skipped
in `report.json` and `report.md`, and never fails the run.

## One tools folder per machine

Keep the tools outside every product repository so that no product gains a dependency:

```bash
mkdir -p ~/.cache/ui-review-tools && cd ~/.cache/ui-review-tools
npm init -y
npm i playwright axe-core          # axe-core sits next to Playwright and is found automatically
npx playwright install chromium webkit firefox
export PLAYWRIGHT_MODULE=$HOME/.cache/ui-review-tools/node_modules/playwright
```

- `PLAYWRIGHT_MODULE` is the path to the `playwright` package. The scripts also look for
  `axe-core` in the same `node_modules`. Set `AXE_CORE_PATH` to an `axe.min.js` to use
  another copy.
- With `sudo`, `npx playwright install-deps` installs every system library, and nothing
  below is needed.

## WSL or a machine without sudo

Without root, download the system libraries as `.deb` files and unpack them into a
private folder (a "libroot"). Then point the dynamic loader at it.

1. List what is missing. The launch error names the libraries; or run
   `ldd ~/.cache/ms-playwright/<browser>-<rev>/**/<binary> | grep "not found"`.
2. Download and unpack the packages without installing them:

   ```bash
   mkdir -p ~/.cache/ui-review-tools/debs ~/.cache/ui-review-tools/libroot
   cd ~/.cache/ui-review-tools/debs
   apt-get download libnss3 libnspr4 libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libxkbcommon0 libgbm1
   for f in *.deb; do dpkg-deb -x "$f" ../libroot; done
   export LD_LIBRARY_PATH=$HOME/.cache/ui-review-tools/libroot/usr/lib/x86_64-linux-gnu
   ```

   That is enough for Chromium and Firefox.

3. WebKit needs more libraries, and the exact sonames of the distribution its build
   targets. Playwright picks a WebKit build per distribution; on a release newer than the
   ones it knows, it falls back to the newest one it has, for example Ubuntu 24.04.
   Download the packages from that release's archive when your own release ships other
   versions. Find each file's package in the archive's `Contents-amd64.gz` and its pool
   path in `Packages.gz`. Typical packages are:
   - ICU, libxml2 and libxslt;
   - GStreamer base, bad and GL;
   - libsoup 3, libwoff1, libvpx, libwebp, libavif, libopus, libevent;
   - libenchant, libhyphen, libmanette, libsecret, flite and wayland-server;
   - libjpeg-turbo, libGLES and libx264.
4. WebKit's launcher (`webkit-<rev>/minibrowser-wpe/MiniBrowser`) overwrites
   `LD_LIBRARY_PATH` with its own `lib` and `sys/lib` folders. Copy the libroot libraries
   into `sys/lib`, without overwriting what is already there:

   ```bash
   W=$(ls -d ~/.cache/ms-playwright/webkit-*/minibrowser-wpe | tail -1)
   mkdir -p "$W/sys/lib" && cp -an ~/.cache/ui-review-tools/libroot/usr/lib/x86_64-linux-gnu/. "$W/sys/lib/"
   ```

5. Playwright's host check reads system package data and still reports the libraries as
   missing. Once a manual launch works, skip the check:
   `export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`.
6. Check all three browsers:

   ```bash
   node -e 'const pw=require(process.env.PLAYWRIGHT_MODULE);(async()=>{for(const n of ["chromium","webkit","firefox"]){try{const b=await pw[n].launch();console.log(n,b.version());await b.close()}catch(e){console.log(n,"FAIL",e.message.split("\n")[0])}}})()'
   ```

Keep the libroot and the tools folder on the machine. They are not evidence and do not
go into a repository.

## Devices

`--device iphone,android` maps to Playwright's `iPhone 13` and `Pixel 7` descriptors. Any
other Playwright device name also works, for example `--device "iPhone 15,Galaxy S9+"`.
Each device sets these values together:

- the viewport;
- `deviceScaleFactor`;
- `isMobile` (meta viewport and zoom-out behaviour);
- `hasTouch`;
- the user agent.

Firefox has no `isMobile` mode, so device variants run in Chromium and WebKit only.
WebKit with an iPhone descriptor is the closest local stand-in for Safari on iOS. It is
not a real device: check a release-critical page on a phone as well.

## Which engine finds what

| Engine | Typical differences |
| --- | --- |
| WebKit (Safari, every iOS browser) | `100vh` and the address bar, `position: sticky` in overflow containers, date and select inputs, font fallback for Thai, flex `gap` in old versions |
| Firefox | Scrollbar width taking layout space, form control styling, `:focus-visible` defaults |
| Chromium | The baseline most code is written against |
