---
name: ZPOS measurement boundary
description: Distinguish measured document compression from causal inference-token or cost savings.
---
Measure source/result document content with the same pinned reference tokenizer.
Report reference-token reduction separately from provider-reported usage and model-reported compression.
Do not attribute the entire SPARTAN compression result exclusively to ZPOS.

**Why:** The user requested defensible ZPOS savings figures, but historical compression certificates contain model estimates, not paired measured baselines. Document reduction alone cannot establish inference-cost savings, and compression generation itself consumes tokens.

**How to apply:** Preserve negative reductions for expansion, calculate aggregate percentages from summed counts rather than average ratios, label historical missing measurements honestly, and never run paid baseline comparisons without authorization. Reference counts are not exact billed tokens for every provider or proof of semantic fidelity.
