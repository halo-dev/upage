## <small>[1.0.1](https://github.com/halo-dev/upage/compare/v1.0.0...v1.0.1) (2025-10-11)</small>
### Features

- allow using chat to modify page titles ([7acc494](https://github.com/halo-dev/upage/commit/7acc4949fb4d76a2c5429769ae3d1289ac07fcc5))

### Performance Improvements

- make the generated page names unique rather than consistent ([a93a679](https://github.com/halo-dev/upage/commit/a93a679c712182c5348593df4f1b6a1c8c83ebdd))
- reduce the frequency of saving empty pages ([3af1c30](https://github.com/halo-dev/upage/commit/3af1c30d49c37a69c442e03f2c0bea30a10716ef))

### Bug Fixes
- switching pages may cause page confusion ([a672fca](https://github.com/halo-dev/upage/commit/a672fcad1c6bda7b5ea927826d0218de5e1bc274))
- resolve logical issues when generating multi-page data ([884f518](https://github.com/halo-dev/upage/commit/884f5186a6ded44832555c03661683d19ad23201))
- resolve the issue of frequent triggering of replaceState ([5b8408d](https://github.com/halo-dev/upage/commit/5b8408d7da272f66ee7bce139d56d450158fc86b))
- allow rate limit trust proxy ([196a0c3](https://github.com/halo-dev/upage/commit/196a0c39e7f970c9dc161d046d2530da053f8004))
- addressing the issues with outdated prompt information in multi-turn dialogues ([5ff32f2](https://github.com/halo-dev/upage/commit/5ff32f2c987cf8b9fa3494a5b72f4b46c48abc90))
- resolve the issue of possible abnormal text generated during page creation. ([c5d47c6](https://github.com/halo-dev/upage/commit/c5d47c680ce736f54aa7b35974e2317be0d73146))

### Miscellaneous Chores

- remove tracking script from layout ([63636fe](https://github.com/halo-dev/upage/commit/63636fef1f32130079f7ce38bb21a25e37b80cb3))

### Code Refactoring

- repartition server-side and client-side code ([e9b573a](https://github.com/halo-dev/upage/commit/e9b573a2762e86c4c4df066baa1c33c93436bdc4))
