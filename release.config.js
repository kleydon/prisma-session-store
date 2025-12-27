// module.exports = {
//   plugins: [
//     '@semantic-release/commit-analyzer',
//     '@semantic-release/release-notes-generator',
//     [
//       '@semantic-release/changelog',
//       {
//         changelogFile: 'CHANGELOG.md',
//       },
//     ],
//     '@semantic-release/npm',
//     '@semantic-release/github',
//     [
//       '@semantic-release/git',
//       {
//         assets: ['package.json', 'CHANGELOG.md'],
//         message:
//           'chore: ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
//       },
//     ],
//   ],
//   preset: 'angular',
// };

module.exports = {
  branches: ['master'], // release from master branch
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    '@semantic-release/github',
  ],
  //preset: 'angular',
};
