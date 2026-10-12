# MICROCosmos — Phase 2 Scientific Content Architecture

**Status:** implementation-ready requirements specification  
**Scope:** NCBI Taxonomy, CDC DPDx media and GBIF occurrence enrichment  
**Out of scope:** homepage redesign, Diary Feed redesign, unrelated modules, clinical decision support and automatic fact-checking of author-written prose  
**Last reviewed:** 2026-10-10

## 1. Product invariant

Ynara's required publishing flow remains:

1. Upload an image.
2. Choose or write a title.
3. Select a category.
4. Write the content.
5. Publish.

Scientific enrichment is optional, asynchronous and server-managed. A post may publish without any scientific enrichment. A timeout, ambiguous match, insufficient record set, missing licence or upstream outage must never add a mandatory editorial step.

The base post and each enrichment are separate publication units:

- Ynara's base post follows the existing publishing contract.
- An API-derived taxonomy, image or occurrence block becomes visitor-visible only after its own safety gate passes.
- Failure of an optional enrichment omits or safely degrades that block; it does not invent data and does not block the base post.
- The system does not present API-derived text as if Ynara wrote or confirmed it.
- Author-uploaded content remains subject to the product's existing moderation and rights policy. This architecture does not claim to fact-check author-written prose.

## 2. System boundary

```text
Existing editor -> existing publish command -> base post -> Homepage / Diary Feed
                         |
                         +-> enrichment request (optional, asynchronous)
                                  |
                         server-side adapters and safety gates
                         NCBI | CDC DPDx | GBIF
                                  |
                         versioned cache + provenance record
                                  |
                         eligible enrichment projection
```

The editor must not call scientific APIs directly. Server-side adapters own authentication, rate limiting, normalization, retries, caching, provenance and safety decisions. The public UI reads only normalized, gated projections; it never renders raw upstream payloads.

## 3. Shared trust model

### 3.1 Enrichment lifecycle

Every enrichment uses one of these states:

| State | Meaning | May be public? |
|---|---|---:|
| `not_requested` | No enrichment was requested. | No block is rendered. |
| `pending` | Background lookup or validation is running. | No scientific assertion or external image is rendered. |
| `verified` | All source-specific gates passed. | Yes, with required attribution and limitations. |
| `ambiguous` | More than one plausible identity or interpretation remains. | No confirmed assertion; an optional neutral unavailable state may render. |
| `insufficient` | Valid data exists but is not adequate for a responsible visualization. | Only the informative empty state may render. |
| `blocked` | Rights or safety gate failed. | No protected content; safe fallback only. |
| `unavailable` | Upstream error, timeout or malformed response. | Cached verified data may render while fresh; otherwise omit/empty state. |

No state is promoted by a client request. Only the server-side validator may transition an enrichment to `verified`.

### 3.2 Provenance envelope

Every stored enrichment must include:

```ts
type ScientificProvenance = {
  provider: 'ncbi-taxonomy' | 'cdc-dpdx' | 'gbif-occurrence';
  sourceUrl: string;
  sourceRecordIds: string[];
  fetchedAt: string;       // ISO 8601
  checkedAt: string;       // ISO 8601
  adapterVersion: string;
  upstreamVersion?: string;
  status: 'pending' | 'verified' | 'ambiguous' | 'insufficient' | 'blocked' | 'unavailable';
  reasonCodes: string[];   // stable, machine-testable codes
  attribution: string;
  licenceOrRights?: string;
  rawPayloadDigest: string; // digest, not a public raw-payload dump
};
```

Never invent missing scientific information. Missing values remain absent or `null`; they are never filled with plausible-sounding text, inferred certainty or zero.

### 3.3 Cache rules

- Cache normalized responses and validation outcomes server-side by provider, query identity and adapter version.
- A cached item keeps its original `fetchedAt`, source identifiers, rights evidence and validation result.
- Configure separate refresh windows by provider; a refresh failure must not silently extend rights approval forever.
- Rights verification has its own expiry/recheck policy and is never inferred from a previously seen hostname.
- Stale verified scientific data may be shown only when the source policy permits it and the UI exposes the last verification date in source details.
- A cached `ambiguous`, `blocked`, `insufficient` or `unavailable` result must not become `verified` merely because it was cached.
- Cache invalidation must be possible by source record ID, licence/rights change, adapter version and manual safety revocation.

## 4. NCBI Taxonomy adapter

### 4.1 Allowed purpose

Use NCBI Taxonomy only for name lookup, taxon identifier, rank, synonyms/status when supplied, and lineage/classification. Attribute the result to NCBI Taxonomy and link to the source record.

NCBI Taxonomy is not a substitute for clinical, pathological, diagnostic, treatment, epidemiological or lifecycle references. It must not be described as a primary taxonomic or phylogenetic authority.

### 4.2 Matching contract

The normalized match contains:

```ts
type TaxonomyMatch = {
  query: string;
  taxId: string | null;
  scientificName: string | null;
  rank: string | null;
  lineage: Array<{ taxId: string; name: string; rank: string | null }>;
  matchStatus: 'exact' | 'accepted_synonym' | 'ambiguous' | 'not_found' | 'unavailable';
  candidateTaxIds: string[];
  provenance: ScientificProvenance;
};
```

Verification requires a unique stable taxon ID and an `exact` or safely resolved `accepted_synonym` result. Multiple plausible candidates, homonyms, rank conflicts or unresolved identifiers produce `ambiguous`, never a confirmed taxon.

The adapter must not generate clinical, pathological or lifecycle claims from taxonomy. Empty ranks, names or lineage nodes stay empty.

### 4.3 Visitor presentation

The compact block may show scientific name and classification. Its source details must include:

- “Taxonomic classification: NCBI Taxonomy” and a source link;
- access/verification date;
- a concise note that taxonomy describes naming/classification and does not replace clinical, pathological or lifecycle references.

## 5. CDC DPDx media adapter

### 5.1 Per-asset rights gate

Every candidate image is a separate rights decision. Domain, agency or collection membership is not proof of unrestricted reuse.

```ts
type ExternalImageRights = {
  assetUrl: string;
  sourcePageUrl: string;
  sourceName: 'CDC DPDx';
  title?: string;
  authorOrCreator: string | null;
  rightsStatement: string | null;
  licence: string | null;
  attributionText: string | null;
  evidenceUrl: string | null;
  verifiedAt: string | null;
  verificationStatus: 'permitted' | 'permission_required' | 'unverified' | 'prohibited';
  verifier: 'automated-rule' | 'documented-review';
  evidenceDigest: string | null;
};
```

An image is publishable only when the applicable statement demonstrably permits the intended MICROCosmos use and all required attribution fields are available. `unverified`, `permission_required` and `prohibited` are blocking states.

Automated allow rules must be asset-specific and evidence-backed. A generic CDC/DPDx page statement may contribute evidence but cannot override a per-image copyright notice, credited third-party author, special restriction or missing provenance.

### 5.2 Safe fallback

When rights cannot be verified:

1. Do not download, proxy, cache publicly or render the external image.
2. Use the existing author-uploaded image if it is already eligible under the product's normal policy.
3. Otherwise render a local, non-deceptive placeholder or omit the media block.
4. Never replace it with a visually similar image presented as the same specimen.

Attribution is rendered adjacent to the image or inside an immediately accessible source-details control whenever required. It must remain associated with the asset on responsive layouts and in accessible text.

## 6. GBIF occurrence adapter

### 6.1 Record validation

Each occurrence record is normalized with its `gbifID`, dataset/publisher identity, source link, taxon match, coordinates, coordinate uncertainty, issue flags, event date when available, licence and citation fields.

Hard-exclude a point when any of the following applies:

- latitude or longitude is missing, non-numeric or outside valid ranges;
- coordinates are `0,0`;
- GBIF reports `ZERO_COORDINATE`, `COORDINATE_OUT_OF_RANGE` or `COORDINATE_INVALID`;
- the record's taxonomic match is incompatible with the verified query taxon;
- the location is clearly impossible after country/continent and coordinate checks;
- the applicable dataset licence is missing, unsupported for the intended use or cannot be retained with the record.

Flags such as country-coordinate mismatch, suspicious reprojection, presumed swapped/negated coordinates, invalid uncertainty or interpretation error require exclusion unless a documented server-side rule establishes a safe normalization without concealing the original flag. Informational flags are preserved and assessed, not treated automatically as errors.

Do not “repair” a source coordinate by guesswork. Preserve `coordinateUncertaintyInMeters` when supplied and valid. If uncertainty is absent, do not manufacture precision.

### 6.2 Sufficiency gate

The map/occurrence visualization may publish only when the post-validation set meets a configurable, documented threshold (`MIN_RELIABLE_OCCURRENCES`) and no unresolved taxon ambiguity remains. The threshold value is a product/configuration decision, not a number invented in this specification.

When the gate fails, show:

> Dados de ocorrência confiáveis ainda são insuficientes para exibir este mapa.

Do not add synthetic points, jitter a location without disclosure or infer a species range polygon from an inadequate record set.

### 6.3 Visitor presentation

The concise map note must communicate:

> Os pontos representam registros disponíveis no GBIF, sujeitos a lacunas e incertezas. Eles não mostram necessariamente toda a distribuição da espécie, prevalência de doença ou risco de infecção.

Expandable source details include GBIF attribution, contributing dataset/publisher citations or a suitable derived-dataset/download citation, access date, included-record count, excluded-record count by reason, preserved uncertainty and a plain-language explanation of relevant flags. Ownership identifiers and licence data stay attached to each underlying record.

## 7. UX and accessibility

- Render one contextual information control per scientific block, not a repeated warning after every field or point.
- Use a visible text label such as “Fonte e limitações” on expansion; an icon alone is not an accessible name.
- The control must be keyboard operable, expose `aria-expanded` and `aria-controls`, keep focus visible and place expanded content in reading order.
- Essential attribution must remain available without hover. Tooltips may supplement, never contain the only rights or safety information.
- Loading states must not imply that data has been verified.
- Empty states explain absence without blaming Ynara or asking her to complete scientific review.
- Scientific blocks must not displace, reorder or change the semantics of existing homepage cards or Diary Feed entries.

## 8. Failure behavior and observability

Use stable reason codes, including at minimum:

```text
TAXON_NOT_FOUND
TAXON_AMBIGUOUS
TAXON_UPSTREAM_UNAVAILABLE
IMAGE_RIGHTS_UNVERIFIED
IMAGE_PERMISSION_REQUIRED
IMAGE_REUSE_PROHIBITED
OCCURRENCE_INVALID_COORDINATES
OCCURRENCE_TAXON_MISMATCH
OCCURRENCE_QUALITY_FLAG_REJECTED
OCCURRENCE_LICENCE_UNSUPPORTED
OCCURRENCE_INSUFFICIENT_RELIABLE_RECORDS
UPSTREAM_TIMEOUT
UPSTREAM_MALFORMED_RESPONSE
```

Log provider, source record IDs, adapter version, state transition, reason codes and timing. Do not log secrets, private draft content or unnecessary raw upstream payloads. Metrics should distinguish upstream failure, ambiguity, rights blocks, validation exclusions, cache hit/miss and visitor-visible enrichment.

Retries must be bounded and use backoff. Circuit breaking and stale-cache fallback must not weaken the publication gate. A provider outage must not cause an unverified block to appear or prevent base-post publication.

## 9. Testable acceptance criteria

The IDs below are release gates for the scientific enrichment scope.

### Publishing-flow invariants

**AC-PUB-01 — No new required field**  
Given scientific integrations are enabled, when Ynara supplies only image, title, category and content, then the existing publish action succeeds with no required scientific field, confirmation screen or rights-review task added by these integrations.

**AC-PUB-02 — Optional failure does not block the post**  
Given all three providers time out, when Ynara publishes a valid base post, then the base post publishes and no unverified scientific block appears.

**AC-PUB-03 — Server-side gate cannot be bypassed**  
Given a client submits `status: verified`, when the server has no successful validation record, then the value is ignored/rejected and the enrichment remains non-public.

**AC-PUB-04 — No invented values**  
For fixture responses with missing ranks, authors, rights, uncertainty or coordinates, snapshots and API responses contain `null`/absence or the defined safe state, never generated substitute facts or zero values.

### NCBI Taxonomy

**AC-NCBI-01 — Unique match**  
Given a fixture with one exact taxon and stable tax ID, when validation completes, then status is `verified`, the source link/attribution is stored, and only returned classification fields are displayed.

**AC-NCBI-02 — Ambiguous match**  
Given two plausible candidates, when validation completes, then status is `ambiguous`, candidate IDs are retained internally, and neither candidate is displayed as confirmed.

**AC-NCBI-03 — Scope limitation**  
Given a verified taxon, then the visitor details state the classification limitation and no clinical, pathological or lifecycle statement is generated by the taxonomy adapter.

**AC-NCBI-04 — Not found/outage**  
Given `not_found`, malformed payload or timeout, then no taxonomy claim is published and the base post remains publishable.

### CDC DPDx images

**AC-DPDX-01 — Per-image evidence**  
Given two images from the same DPDx page with different rights statements, when processed, then each receives an independent rights record and publication decision.

**AC-DPDX-02 — Demonstrably permitted**  
Given asset-specific evidence permits the intended reuse and required creator/attribution fields are present, then the image may publish with the required attribution and retained evidence URL/digest.

**AC-DPDX-03 — Unverified rights block**  
Given missing or conflicting rights evidence, when validation completes, then status is `unverified` or `permission_required`, the external image bytes/URL are not public, and the safe fallback renders.

**AC-DPDX-04 — Known restriction wins**  
Given a page-level public-domain statement and an asset-level copyright restriction, then the asset is blocked until the original rights holder grants applicable permission.

**AC-DPDX-05 — Accessible attribution**  
Given a permitted image requiring attribution, then the author/source/licence are reachable by keyboard, associated with that image and not available only on hover.

### GBIF occurrence

**AC-GBIF-01 — Invalid coordinates excluded**  
Given out-of-range, zero, non-numeric and valid coordinates, then only valid coordinates survive and each exclusion has a stable reason code.

**AC-GBIF-02 — Taxon mismatch excluded**  
Given a record incompatible with the verified query taxon, then it does not appear on the map and is counted under `OCCURRENCE_TAXON_MISMATCH`.

**AC-GBIF-03 — Flags and uncertainty preserved**  
Given a retained record with a non-fatal flag and valid uncertainty, then both remain available in source details and are not silently erased.

**AC-GBIF-04 — Insufficient records**  
Given fewer reliable records than configured after validation, then no points or inferred distribution render and the informative empty state appears.

**AC-GBIF-05 — Limitations are explicit**  
Given a published occurrence block, then the concise note says records are incomplete and are not measures of complete distribution, disease prevalence or infection risk.

**AC-GBIF-06 — Attribution retained**  
Given records from multiple datasets, then ownership identifiers and licences remain attached per record and visitor source details provide appropriate publisher/dataset citation.

### Caching, accessibility and regression

**AC-CACHE-01 — Cache cannot upgrade trust**  
Given a cached blocked or ambiguous record, then a cache hit returns the same non-public state until fresh evidence passes validation.

**AC-CACHE-02 — Rights revocation**  
Given an image rights record is revoked or its evidence changes, then invalidation removes the public image projection without unpublishing the base post.

**AC-A11Y-01 — Source details**  
Automated accessibility tests and keyboard checks confirm labelled controls, correct expanded state, focus visibility, reading order and non-hover access to essential attribution.

**AC-REG-01 — Homepage preserved**  
Existing homepage visual, interaction and data-contract regression tests pass unchanged except for an explicitly approved additive scientific block fixture.

**AC-REG-02 — Diary Feed preserved**  
Existing Diary Feed ordering, cards, navigation, loading/empty/error states and publishing projection tests pass unchanged; scientific provider failures do not alter feed availability.

**AC-REG-03 — No unrelated surface**  
The release diff contains only scientific adapter/gate/cache/projection code, additive source-details UI, tests and this documentation; no unrelated module is started.

## 10. Minimum verification suite

1. Unit tests for normalization and every state transition using recorded, sanitized fixtures.
2. Contract tests that reject malformed upstream schemas and client-forged verification states.
3. Rights-policy table tests, including page-level versus asset-level conflicts.
4. Property tests for latitude/longitude boundaries and null handling.
5. Integration tests with provider timeouts, rate limits, 4xx/5xx responses and cache behavior.
6. Accessibility tests plus manual keyboard verification for source details.
7. Existing homepage and Diary Feed regression suites.
8. A release test proving an unverified enrichment cannot become public even when the base post is public.

Live-provider smoke tests are diagnostic only and must not replace deterministic fixtures. Tests must not depend on undocumented upstream copy remaining unchanged.

## 11. Release gate and evidence

Phase 2 scientific enrichment is releasable only when:

- every applicable acceptance criterion passes in CI;
- production configuration defines cache and sufficiency thresholds rather than inheriting guessed defaults;
- public projections contain provenance and required attribution;
- unverified/ambiguous/blocked fixtures are proven non-public;
- homepage and Diary Feed regression evidence is green;
- the release diff contains no unrelated module; and
- no automatic commit or deployment is performed without explicit authorization.

If the repository is unavailable, this document is a specification only. It is not evidence that adapters, UI, tests or regressions have been implemented.

## 12. Source basis

Official sources reviewed on 2026-10-10:

- [NCBI — How to reference the NCBI taxonomy database](https://www.ncbi.nlm.nih.gov/Taxonomy/taxonomyhome.html/index.cgi?chapter=howcite): states that the database is not a primary taxonomic/phylogenetic source or authority.
- [NCBI — Website and Data Usage Policies and Disclaimers](https://www.ncbi.nlm.nih.gov/home/about/policies/): provides data-use and accuracy/rights caveats.
- [CDC — About DPDx](https://www.cdc.gov/dpdx/about.html): distinguishes broadly reusable material from specifically copyrighted image groups and requires source citation.
- [GBIF — Occurrence issues and flags](https://techdocs.gbif.org/en/data-use/occurrence-issues-and-flags): defines coordinate and other data-quality flags.
- [GBIF — Data processing](https://techdocs.gbif.org/en/data-processing/): explains coordinate interpretation and that not every issue flag is necessarily an error.
- [GBIF — Data User Agreement](https://www.gbif.org/terms/data-user): requires retention of ownership identifiers, publisher acknowledgement and licence compliance.
- [GBIF — Citation guidelines](https://www.gbif.org/citation-guidelines): explains citation for downloads, API-derived datasets, occurrences and media.

This specification deliberately treats upstream data as evidence with provenance, not as automatically publishable truth.

