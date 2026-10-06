# Symmetry Lab

[中文](README.md) · **English**

An interactive introduction to point groups and crystal structures for MATSCI 402, connecting Lectures L03, L04 and L05. Rotate the models, step through an operation, track coordinates, and compare the final state with the original.

**[Open the website](https://ideaschangeworld.github.io/symmetry-lab/)** · [Lecture content map](https://ideaschangeworld.github.io/symmetry-lab/course-guide.html)

Use **English / 中文** in the top bar to switch languages. The switch preserves your model, operation, playback progress and answers. The website remembers the language on this browser; the course guide uses the same preference. Both languages are included locally, with no translation service or additional network dependency.

## Explore

- **Operation Lab:** identity, rotation, reflection, inversion, rotoinversion and rotoreflection, using molecular examples and a tracer. Compare final states, atom mappings and matrices.
- **32 Point Groups:** every crystallographic point group has an interactive colored 3D model, complete operation list, symmetry axes and mirror planes. Explore the crystallographic restriction on rotation orders 1, 2, 3, 4 and 6.
- **Composition & Groups:** compare AB with BA and explore the four group axioms and the multiplication table of water's mm2 / C₂ᵥ group.
- **Advanced Symmetry:** stereographic projections of all 32 groups, five subgroup embeddings, symmetry constraints on ordinary polar vectors and symmetric rank-two tensors, two-color antisymmetry, and nine introductory spatial operations.
- **Crystal Structures:** 14 Bravais lattices; primitive and conventional cells; 17 ideal periodic prototypes; ABAB and ABC stacking; tetrahedral and octahedral voids; occupancy, coordination polyhedra and local hard-sphere radius ratios.
- **Practice:** 20 prediction questions, explanations, links back to the relevant demonstrations, and a 16-entry glossary.

The crystal prototypes include SC, BCC, FCC, HCP, diamond, graphite, NaCl, CsCl, NiAs, zinc blende, wurtzite, CdI₂, CdCl₂, rutile, anatase, fluorite and antifluorite. Coordination is calculated from the infinite periodic structure, including neighbors outside the displayed cell.

## Controls and offline use

Drag a model to rotate the view, scroll to zoom, or use the arrow and plus/minus keys. Several scenes support clicking an atom or point to track it. Buttons and form controls support keyboard navigation; animations respect reduced-motion settings.

Download and extract this repository, then open **symmetry-lab.html** for the self-contained offline app. All application styles, translation catalogues and scripts are embedded. **index.html** is the source version. The course guide is a separate local page, and reference links require internet access.

To rebuild the offline app with Python 3:

```sh
python3 build.py
```

The application is plain HTML, CSS and JavaScript. It does not require a package manager, account, backend or external graphics library. Source changes can be previewed with a local static server, or deployed using GitHub Pages.

## Scientific scope

These are ideal teaching models, not experimental CIFs. Atomic lengths are normalized and free structural parameters use documented teaching values. The ordinary symmetric rank-two tensor examples illustrate Neumann's principle; they do not predict measured material properties, higher-rank tensors or axial spin behavior. Polar symmetry does not establish ferroelectricity, and noncentrosymmetry does not establish chirality.

The spatial-operation examples introduce translations, screw axes and glide planes; they do not enumerate all 230 space groups. The application does not automatically identify the complete point group of arbitrary input. CrCl₃ polytypes, CrI₃ magnetism, historical materials and sample population statistics are connected through scoped further reading.

The lectures informed the teaching route. The public repository contains original visualizations and explanations, and does not include the lecture PDFs or slide screenshots. Sources and lecture-page mappings are in the bilingual [course guide](course-guide.html) and [content map](COURSE_GUIDE.md). Less elementary prototype coordinates were checked against AFLOW; symmetry references include IUCr educational resources.

## Validation

Run the files under **tests/** with Node.js. The checks cover operation closure, all 32 models, lattice restrictions, projections, invariant tensors, subgroup embeddings, primitive-cell volumes and counts, periodic coordination, FCC voids, hard-sphere contacts, affine powers and English catalogue coverage. Browser checks also verify state-preserving language switching, refreshed language preferences and responsive layouts.
