# [3.1.0](https://github.com/kleydon/prisma-session-store/compare/v3.0.1...v3.1.0) (2021-08-16)


### Bug Fixes

* sessionModelName jsdoc typo ([c0fe3ec](https://github.com/kleydon/prisma-session-store/commit/c0fe3ec043733d46fdea50719b9ad1849a51ed76))


### Features

* custom model name ([d9273ff](https://github.com/kleydon/prisma-session-store/commit/d9273ff96a9fad8dc43a9fd1ebcb318783275632))

## [3.0.1](https://github.com/kleydon/prisma-session-store/compare/v3.0.0...v3.0.1) (2021-02-16)


### Bug Fixes

* peer dependency version ([cd71f7d](https://github.com/kleydon/prisma-session-store/commit/cd71f7d1c6accf063e6701a6c21ce4b6695a483d))

# [3.0.0](https://github.com/kleydon/prisma-session-store/compare/v2.0.0...v3.0.0) (2021-02-16)


* feat!: changed expires to expiresAt ([5cbc11b](https://github.com/kleydon/prisma-session-store/commit/5cbc11bcf8f8a0b9255dd57e1eb64b0b923636d7))


### BREAKING CHANGES

* expiresAt now used in place of expires - within Prisma schema and database.

# [2.0.0](https://github.com/kleydon/prisma-session-store/compare/v1.1.2...v2.0.0) (2021-01-12)


* fix!: update downstream dependencies ([fa7ee82](https://github.com/kleydon/prisma-session-store/commit/fa7ee82a809420a7984b60576956fe6206db27e2))


### BREAKING CHANGES

* Changes to the types from `@types/express-session` and `@types/express`

Signed-off-by: William Sedlacek <wsedlacekc@gmail.com>

## [1.1.2](https://github.com/kleydon/prisma-session-store/compare/v1.1.1...v1.1.2) (2020-12-02)


### Bug Fixes

* changed findOne to findUnique, for Prisma 2.12.0+ ([f1311c1](https://github.com/kleydon/prisma-session-store/commit/f1311c12e7df3cec10ef1ff4cecaf305ed34ca91))

## [1.1.1](https://github.com/kleydon/prisma-session-store/compare/v1.1.0...v1.1.1) (2020-11-26)


### Bug Fixes

* security update ([c950d45](https://github.com/kleydon/prisma-session-store/commit/c950d45e7c52761f6ce0300de6d2e7e7deae0b1d))

# [1.1.0](https://github.com/kleydon/prisma-session-store/compare/v1.0.0...v1.1.0) (2020-09-13)


### Bug Fixes

* round TTL only to powers of 10 ([2a591e7](https://github.com/kleydon/prisma-session-store/commit/2a591e770d75caee27f4c95df10f975d169cc2b1))
* use orginal packages ([0aa39b4](https://github.com/kleydon/prisma-session-store/commit/0aa39b41e9a696365a0d7d753afb824abd94db76))


### Features

* contribution guide ([c514643](https://github.com/kleydon/prisma-session-store/commit/c5146434860b842bbbb9fc9c0e2b1ce9192e6568))
* recommended extensions ([fb280a9](https://github.com/kleydon/prisma-session-store/commit/fb280a9c9f86c448be12329f8570d3f09212ba14))
* setup CI/CD ([e78accf](https://github.com/kleydon/prisma-session-store/commit/e78accf7c302e08e15801bc54bcf894b565cd63b))
* setup commit lint ([fd939b5](https://github.com/kleydon/prisma-session-store/commit/fd939b56214fa40b9ac4745a05961fd7ee66306d))
* setup commitizen ([ac394d0](https://github.com/kleydon/prisma-session-store/commit/ac394d09401be1ba8c9329c016fa5f48368fb1cb))
