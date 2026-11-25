# Contributing to pdfkit

## Table of Contents

- [Contributing to pdfkit](#contributing-to-pdfkit)
  - [Table of Contents](#table-of-contents)
  - [Code Organization](#code-organization)
  - [Setting Up the project locally](#setting-up-the-project-locally)
  - [Running and writing tests](#running-and-writing-tests)
  - [Submitting a Pull Request](#submitting-a-pull-request)


## Code Organization

pdfkit is organized in the following folders:

- `lib`: The actual source code.
- `dist`: The Vite-built package. Run `npm run build` to generate it.
- `docs`: Code and artifacts to generate documentation.
- `examples`: Feature examples, a Node and browser quickstart, and the editable playground.
- `tests/unit`: Tests behavior of specific classes / methods.
- `tests/visual`: Compare the pdf output against a reference.

**Working on your first Pull Request?** You can learn how from this _free_ series [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github)

## Setting Up the project locally

To install the project you need to have `node`

1.  [Fork](https://help.github.com/articles/fork-a-repo/) the project, clone your fork:

    ```
    # Clone your fork
    git clone https://github.com/<your-username>/pdfkit.git

    # Navigate to the newly cloned directory
    cd pdfkit
    ```

2.  `npm ci` to install dependencies from the lockfile
3.  `npm run build` to build the library
4.  `npm run dev` to open the editable browser playground

## Running and writing tests

Tests use [Vitest](https://vitest.dev/).

Visual tests check the pdf image screenshot against a reference stored as snapshots.

Unit tests check behavior of specific classes / methods isolatedly.

Test commands
* `npm test -- --run`: Run all configured tests once
* `npm test -- --run --project unit`: Run unit tests
* `npm test -- --run --project visual`: Check rendered PDF snapshots
* `npm run build && npm run test:package`: Check the ESM package entry point
* `npm run biome:ci`: Check lint and formatting

To write new tests, look for the `*.spec.js` files in `tests/unit` and `tests/visual`.

> Visual tests should use an embedded font, instead of system fonts, to ensure uniform rendering between different environments

## Documentation

See `README.md` in the `docs` subdirectory for more information.

## Submitting a Pull Request

Please go through existing issues and pull requests to check if somebody else is already working on it.

Also, make sure to run the tests and lint the code before you commit your changes.

> Tests should be added to check the changed behavior even if is a bug fix.

If the proposed change affects document structure a unit test should be added, if affects rendering, add a visual test
