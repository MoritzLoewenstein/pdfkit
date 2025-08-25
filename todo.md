# TODO

## Build

- [ ] fix png.js
- [ ] fix jpeg.js
- [ ] fix attachments.js
- [ ] fix security.js

## Tests

- [ ] remove vite.config.js excluded files when developing on module
- [ ] check describe.skip / test.skip test cases
- [ ] replace `jest-image-snapshot` with vitest equivalent
- [ ] replace `jest-environment-jsdom` with vitest equivalent

## other stuff

- [ ] replace all `Buffer` usage with `Uint8Array` in png-js
- [ ] check if nodejs buffer binary encoding is equivalent to utf8 (search: "TODO binary")
- [ ] rewrite utility scripts to use esm
- [ ] rewrite examples?

## libraries

### crypto-js

- this is the biggest clusterfuck right now, but it is contained to security.js and attachments.js
- [ ] implement crypto.node.js and crypto.browser.js to replace crypto-js (only needed functions in security.js and attachments.js)

### png-js

- replacement or rewrite? fast-png?
- https://github.com/image-js/fast-png
- attempt to modernize: https://github.com/diegomura/react-pdf/tree/master/packages/png-js

### jpeg-exif

- replacement or rewrite?

### node:zlib

- use separate browser and node builds
- replace browser zlib usage with pako / pako-esm
- fast-png uses pako?
- only function used: deflateSync
- https://github.com/telerik/pako-esm

## progress

- node:fs one usage remaining in tests (readFileSync in png.spec.js)
- node:buffer one known usage remaining in tests (canvas.toBuffer() in pdf2png.js)
- node:crypto one known usage remaining in tests (crypto.createHash() in attachments.spec.js)
- node:assert some usage remaining in tests (pdf2png.js)
