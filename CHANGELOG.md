## [3.1.6](https://github.com/kleydon/prisma-session-store/compare/v3.1.5...v3.1.6) (2022-06-20)

### Bug Fixes

- fixed deletion in prune function ([698a25b](https://github.com/kleydon/prisma-session-store/commit/698a25b42508f12eabfd74811fecdcfc29734c58))

## [3.1.5](https://github.com/kleydon/prisma-session-store/compare/v3.1.4...v3.1.5) (2022-05-10)

### Bug Fixes

- addresses interval errors ([ddc1884](https://github.com/kleydon/prisma-session-store/commit/ddc1884facfa5d88cd2bf1fdfafef5bc14ab23b4))

## [3.1.4](https://github.com/kleydon/prisma-session-store/compare/v3.1.3...v3.1.4) (2022-05-10)

### Bug Fixes

- prevent crash in set ([3c774eb](https://github.com/kleydon/prisma-session-store/commit/3c774eb5537ad70f17b273b4cc9e3cd4cdfd5e6f)), closes [#82](https://github.com/kleydon/prisma-session-store/issues/82)

## [3.1.3](https://github.com/kleydon/prisma-session-store/compare/v3.1.2...v3.1.3) (2022-01-26)

### Bug Fixes

- double defer in destroy function ([d34595e](https://github.com/kleydon/prisma-session-store/commit/d34595e083a397466271d9d8f88b44bf35d5a6d3))

## [3.1.2](https://github.com/kleydon/prisma-session-store/compare/v3.1.1...v3.1.2) (2021-12-06)

### Bug Fixes

- removed accidental package-lock.json file ([4156faf](https://github.com/kleydon/prisma-session-store/commit/4156faf78cc261a873a137067a11389ad038ef03))
- synced prisma client and prisma dependency versions ([178f0d7](https://github.com/kleydon/prisma-session-store/commit/178f0d7531bbca8a44d75d8417e2182e348478fb))

## [3.1.1](https://github.com/kleydon/prisma-session-store/compare/v3.1.0...v3.1.1) (2021-12-06)

### Bug Fixes

- change commit lint overrides to warnings ([ff3bd79](https://github.com/kleydon/prisma-session-store/commit/ff3bd79c65751db64e504a69d1c8b4815fdb5a03))
- trigger release ([a84ab3b](https://github.com/kleydon/prisma-session-store/commit/a84ab3b3266e399f2d744b579142552419e8a141))
- trigger release and trivially clean up readme ([39d1a56](https://github.com/kleydon/prisma-session-store/commit/39d1a56069b770845c8a28af76266d1d1c92b7e1)), closes [#63](https://github.com/kleydon/prisma-session-store/issues/63)

# [3.1.0](https://github.com/kleydon/prisma-session-store/compare/v3.0.1...v3.1.0) (2021-08-16)

### Bug Fixes

- sessionModelName jsdoc typo ([c0fe3ec](https://github.com/kleydon/prisma-session-store/commit/c0fe3ec043733d46fdea50719b9ad1849a51ed76))

### Features

- custom model name ([d9273ff](https://github.com/kleydon/prisma-session-store/commit/d9273ff96a9fad8dc43a9fd1ebcb318783275632))

## [3.0.1](https://github.com/kleydon/prisma-session-store/compare/v3.0.0...v3.0.1) (2021-02-16)

### Bug Fixes

- peer dependency version ([cd71f7d](https://github.com/kleydon/prisma-session-store/commit/cd71f7d1c6accf063e6701a6c21ce4b6695a483d))

# [3.0.0](https://github.com/kleydon/prisma-session-store/compare/v2.0.0...v3.0.0) (2021-02-16)

- feat!: changed expires to expiresAt ([5cbc11b](https://github.com/kleydon/prisma-session-store/commit/5cbc11bcf8f8a0b9255dd57e1eb64b0b923636d7))

### BREAKING CHANGES

- expiresAt now used in place of expires - within Prisma schema and database.

# [2.0.0](https://github.com/kleydon/prisma-session-store/compare/v1.1.2...v2.0.0) (2021-01-12)

- fix!: update downstream dependencies ([fa7ee82](https://github.com/kleydon/prisma-session-store/commit/fa7ee82a809420a7984b60576956fe6206db27e2))

### BREAKING CHANGES

- Changes to the types from `@types/express-session` and `@types/express`

Signed-off-by: William Sedlacek <wsedlacekc@gmail.com>

## [1.1.2](https://github.com/kleydon/prisma-session-store/compare/v1.1.1...v1.1.2) (2020-12-02)

### Bug Fixes

- changed findOne to findUnique, for Prisma 2.12.0+ ([f1311c1](https://github.com/kleydon/prisma-session-store/commit/f1311c12e7df3cec10ef1ff4cecaf305ed34ca91))

## [1.1.1](https://github.com/kleydon/prisma-session-store/compare/v1.1.0...v1.1.1) (2020-11-26)

### Bug Fixes

- security update ([c950d45](https://github.com/kleydon/prisma-session-store/commit/c950d45e7c52761f6ce0300de6d2e7e7deae0b1d))

# [1.1.0](https://github.com/kleydon/prisma-session-store/compare/v1.0.0...v1.1.0) (2020-09-13)

### Bug Fixes

- round TTL only to powers of 10 ([2a591e7](https://github.com/kleydon/prisma-session-store/commit/2a591e770d75caee27f4c95df10f975d169cc2b1))
- use orginal packages ([0aa39b4](https://github.com/kleydon/prisma-session-store/commit/0aa39b41e9a696365a0d7d753afb824abd94db76))

### Features

- contribution guide ([c514643](https://github.com/kleydon/prisma-session-store/commit/c5146434860b842bbbb9fc9c0e2b1ce9192e6568))
- recommended extensions ([fb280a9](https://github.com/kleydon/prisma-session-store/commit/fb280a9c9f86c448be12329f8570d3f09212ba14))
- setup CI/CD ([e78accf](https://github.com/kleydon/prisma-session-store/commit/e78accf7c302e08e15801bc54bcf894b565cd63b))
- setup commit lint ([fd939b5](https://github.com/kleydon/prisma-session-store/commit/fd939b56214fa40b9ac4745a05961fd7ee66306d))
- setup commitizen ([ac394d0](https://github.com/kleydon/prisma-session-store/commit/ac394d09401be1ba8c9329c016fa5f48368fb1cb))
