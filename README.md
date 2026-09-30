# SIGALT EcoStat

**Multivariate Ecological Analysis**

SIGALT EcoStat is an open-source platform for reproducible ecological statistics. It is designed to make multivariate workflows accessible without hiding the scientific decisions behind them.

## v0.1.0 — foundation

This first prototype implements:

- Community matrix + metadata model linked by `SampleID`
- Browser-side CSV import
- Scientific Data Check
- Errors, warnings, recommendations and passed checks
- Duplicate sample detection
- Missing/non-numeric/negative community value detection
- Empty-sample detection
- Community ↔ metadata matching
- Basic replication diagnostics
- Rare-taxon recommendation
- Clean and deliberately problematic demonstration datasets

The later v0.1.x workflow will add:

`Data → Check → Transform → Bray-Curtis → nMDS → PERMANOVA → PERMDISP → Export`

## Scientific principle

EcoStat is not intended to be a p-value machine. Statistical output must be interpreted in the context of sampling design, effect size, dispersion, ecological relevance and study limitations. The software does not silently alter ecological data.

## Validation

Numerical analyses intended for v1.0.0 will be validated against reference implementations in R, principally `vegan`, using fixed datasets, seeds and documented numerical tolerances.

## Local development

```bash
npm install
npm run dev
```

Build for Netlify:

```bash
npm run build
```

## License

MIT.
