# TODO

## Tests

- [ ] replace `jest` with `vitest`
- [ ] replace `jest-image-snapshot` with vitest equivalent
- [ ] replace `jest-environment-jsdom` with vitest equivalent


## Build

- [ ] replace node `stream` usage with cross-platform compatible streams
- [ ] replace node `zlib` usage with cross-platform compatible zlib
- [ ] replace node `fs` usage with cross-platform compatible fs
- [ ] create vite config for browser build (esm)
- [ ] create vite config for node build (esm)

## Rewrite Parts

- [ ] replace all `Buffer` usage with `Uint8Array`
- [ ] implement crypto.node.js and crypto.browser.js to replace crypto-js (only needed functions in security.js and attachments.js)
- [ ] replace or rewrite png-js
- [ ] rewrite utility scripts to use esm
- [ ]