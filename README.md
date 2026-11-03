# Full Accessibility Audit

## What?

This tool automatically checks your JavaScript web application for digital accessibility.

## How?

The application is scanned for all relevant subpages using an autonomous crawler.

These pages are then checked for compliance with WCAG 2.2 based on the axe-core engine and additional rules.

## Installation Guide

To use the finalized test environment, you must either create a new `.yml` file in the .github/workflows directory or edit an existing `.yml` file.

For the specified jobs, please insert the following code:

```
jobs:
    full-accessibility-audit:
        uses: StackOverflowIsBetterThanAnyAI/full-accessibility-audit/.github/workflows/full-accessibility-audit.yml@master
        with:
            app_port: "5173"                                # specify the port of your app
            start_command: "npx vite --port 5173 --host"    # specify the start command for your app with port and host flags being set
			node_version: "20"	                            # optional, default: "24"
			skip_crawler: true	                            # optional, default: false
            base_path: "/path"                              # optional, default: "/"
            config_file: "sitemap.json"                     # optional, default: "sitemap.json"

```

This ensures that the code is checked for digital barriers every time the file is run in this GitHub Actions pipeline.

## Benchmark

The audit can be validated against the official [W3C ACT rules test cases](https://www.w3.org/WAI/standards-guidelines/act/rules/). The benchmark is a development tool and is neither part of the audit workflow nor of the Docker image.

```
npm run benchmark:fetch                                 # download all test cases
node benchmark/fetch-testcases.mjs --rules=bc4a75       # or only selected ACT rules
npm run benchmark
```

The results (TP / FP / TN / FN, precision, recall and false positive rate per ACT rule) are written to `benchmark/results/`.

## Regression Tests

The workflow `.github/workflows/regression-tests.yml` runs every day and can also be started manually:

- **Crawler tests** (`npm run test:crawler`): the crawler is tested against local test sites in `crawler-tests/sites/`. All tests must pass.
- **W3C ACT benchmark**: the outcome of every test case is compared with `benchmark/baseline.json` (`npm run benchmark:compare`). The run fails if a test case gets a worse outcome than in the baseline, e.g. a new false positive or false negative. Improvements and new W3C test cases are only reported.

After an intended change of the results, the baseline has to be updated and committed:

```
npm run benchmark
npm run benchmark:update-baseline
```

As fonts and rendering differ between operating systems, the baseline should be created in the CI environment: start the workflow manually with `update_baseline` and commit the `act-benchmark-baseline` artifact as `benchmark/baseline.json`.
