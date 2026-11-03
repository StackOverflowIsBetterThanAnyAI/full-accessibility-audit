# Full Accessibility Audit

## What?

This tool automatically checks your JavaScript web application for digital accessibility.

## How?

The application is scanned for all relevant subpages using an autonomous crawler.

These pages are then checked for compliance with WCAG 2.2 based on the axe-core engine and additional rules.

The results are stored as `full-accessibility-audit.json` and `full-accessibility-audit.md` in the `full-accessibility-audit` artifact. Violations of level A and AA fail the workflow. Findings beyond that, like level AAA (e.g. generic link texts) or best practices (e.g. skipped heading levels), are listed separately as hints and do not fail the workflow.

## Installation Guide

To use the finalized test environment, you must either create a new `.yml` file in the .github/workflows directory or edit an existing `.yml` file.

For the specified jobs, please insert the following code:

```
jobs:
   full-accessibility-audit:
      uses: StackOverflowIsBetterThanAnyAI/full-accessibility-audit/.github/workflows/full-accessibility-audit.yml@master
      with:
         app_port: "5173"				# specify the port of your app
         start_command: "npx vite --port 5173 --host"	# specify the start command for your app with port and host flags being set
         node_version: "22"				# optional, default: "24"
         skip_crawler: true				# optional, default: false
         base_path: "/path"				# optional, default: ""
         config_file: "config.json"			# optional, default: "sitemap.json"
         image_tag: "1.2.0"				# optional, default: "latest", also "sha-<commit>" works

```

This ensures that the code is checked for digital barriers every time the file is run in this GitHub Actions pipeline.

The audit runs inside a Docker container and reaches your app via the IP address of the runner. Therefore your app has to listen on all network interfaces instead of `localhost` only, e.g. with `--host` for Vite or `-H 0.0.0.0` for Next.js.

## Configuration

The optional config file `cypress/fixtures/sitemap.json` (or the name given in `config_file`) controls which pages are audited:

```
{
    "config": {
        "only": [],
        "included": ["/landing-page"],
        "excluded": ["/admin/*", "/logout"],
        "queryParams": ["page"],
        "maxPages": 500
    }
}
```

| Option        | Description                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `only`        | Audits exactly these paths without crawling. `included` is ignored.                                                            |
| `included`    | Additional start pages for the crawler, e.g. pages that are not linked anywhere. They are audited and their links are crawled. |
| `excluded`    | Patterns of pages that are neither visited nor audited, e.g. logout links. Always takes priority over `only` and `included`.   |
| `queryParams` | Query parameters that lead to separate pages. By default, urls that only differ in their query parameters count as one page.   |
| `maxPages`    | Maximum amount of pages the crawler visits, default: `500`.                                                                    |

All paths are relative to `base_path`. Patterns in `excluded` support `*` as a wildcard for any characters including `/`:

- `/admin/*` excludes `/admin/users` and `/admin/users/edit`, but not `/admin`. `/admin*` excludes both.
- `/logout` also excludes `/logout?redirect=1` and `/logout#/confirm`. Query parameters and hash routes only matter if the pattern contains them, e.g. `/shop?print=*`.
- The comparison is case-insensitive and ignores trailing slashes.

Hash routes like `#/about` or `#!/about` are treated as separate pages, anchors like `#section` are not. Tracking parameters like `utm_source` or `fbclid` are ignored.

The crawler stores the found pages as `urls` in the same file. With `skip_crawler: true`, these `urls` are audited directly.

## Benchmark

The audit can be validated against the official [W3C ACT rules test cases](https://www.w3.org/WAI/standards-guidelines/act/rules/). The benchmark is a development tool and is neither part of the audit workflow nor of the Docker image.

```
npm run benchmark:fetch                                 # download all test cases
node benchmark/fetch-testcases.mjs --rules=bc4a75       # or only selected ACT rules
npm run benchmark
```

The results (TP / FP / TN / FN, precision, recall and false positive rate per ACT rule) are written to `benchmark/results/`.

### Results

The results of the last daily run of the regression tests:

<!-- act-benchmark:start -->
<!-- act-benchmark:end -->

### Comparison With axe-core

`npm run benchmark:axe` runs the same test cases with axe-core only: the custom checks are skipped and the axe-core rules replaced by them are enabled again. `npm run benchmark:compare-axe` compares both runs per ACT rule and writes `benchmark/results/act-benchmark-vs-axe.md`.

<!-- act-benchmark-axe:start -->
<!-- act-benchmark-axe:end -->

## Regression Tests

The workflow `.github/workflows/regression-tests.yml` runs every day:

- **Crawler tests** (`npm run test:crawler`): the crawler is tested against local test sites in `crawler-tests/sites/`. All tests must pass.
- **W3C ACT benchmark**: the outcome of every test case is compared with `benchmark/baseline.json` (`npm run benchmark:compare`). The run fails if a test case gets a worse outcome than in the baseline, e.g. a new false positive or false negative. Improvements and new W3C test cases are only reported.
- **W3C ACT benchmark (axe-core only)**: `npm run benchmark:axe` for the comparison with axe-core.
- **README**: if the W3C ACT benchmark has no regressions, `npm run benchmark:readme` writes the results of both benchmarks into this README. The README is only committed if the results have changed.

After an intended change of the results, the baseline has to be updated and committed:

```
npm run benchmark
npm run benchmark:update-baseline
```

As fonts and rendering differ between operating systems, the baseline should be created in the CI environment: start the workflow manually with `update_baseline` and commit the `act-benchmark-baseline` artifact as `benchmark/baseline.json`.
