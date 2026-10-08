# Publishing strategy

## Canonical project home: GitHub + GitHub Pages

The interactive explorer, processing code, issue tracker, methodology, and version history belong in the repository. GitHub Pages is the primary public experience because Wikimedia Commons does not host raw source code or general-purpose interactive web applications.

Recommended public URL:

`https://mariomarcolongo.github.io/protein-by-bodyweight-country/`

## Archival release: Zenodo

Create tagged GitHub releases and archive them through Zenodo. Each release receives a DOI and preserves the exact code and eligible derived outputs used for that version.

The repository includes `CITATION.cff` so GitHub and Zenodo can expose structured citation metadata.

## Wikimedia Commons: educational media showcase

Commons is highly valuable for reach and reuse, but it should host outputs rather than the application itself:

- SVG world maps for selected years;
- SVG methodology diagrams;
- PNG fallbacks;
- WebM or GIF animations of changes over time;
- chart graphics designed for Wikipedia articles;
- multilingual captions and detailed source attribution.

Do not upload the repository source code to Commons. Avoid using Commons merely as portfolio advertising; every upload should be independently educational and realistically reusable.

## Commons tabular data

Commons supports `.tab`, `.map`, and `.chart` pages in the `Data:` namespace. A tabular upload is appropriate only after confirming that all source and database rights are compatible with the licence required by the namespace. Do not waive attribution obligations that the project does not own.

## Licence policy

- Software: AGPL-3.0-or-later.
- Original documentation, editorial text, interface design, and exported figures: CC BY-SA 4.0.
- Original project metadata: CC0 where practical.
- Third-party and derived data: original source terms govern; attribution and provenance remain attached.

CC BY-SA is a good choice for reusable visual outputs. It is not the best licence for software, and it cannot override restrictions or attribution requirements inherited from source datasets.

## Recommended release order

1. Make the repository public when documentation and the preview build are stable.
2. Enable GitHub Pages and publish the interactive explorer.
3. Tag `v0.1.0-preview` and archive it on Zenodo.
4. Export a small set of excellent SVG figures and upload them to Commons.
5. Add the Commons files to relevant Wikipedia/Wikimedia pages only where editorially appropriate.
6. Repeat with versioned releases as the all-age model and demographic layers mature.
