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

The audit can be validated against the official [W3C ACT rules test cases](https://www.w3.org/WAI/standards-guidelines/act/rules/). The benchmark is a local development tool only and is neither part of the GitHub Actions workflow nor of the Docker image.

```
npm run benchmark:fetch                                 # download all test cases
node benchmark/fetch-testcases.mjs --rules=bc4a75       # or only selected ACT rules
npm run benchmark
```

The results (TP / FP / TN / FN, precision, recall and false positive rate per ACT rule) are written to `benchmark/results/`.
