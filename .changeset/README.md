# Changesets

Every pull request that changes published behavior adds a changeset:

```sh
yarn changeset
```

Pick the bump (`patch` for fixes, `minor` for features; while the version is `0.x`, breaking changes are `minor` and are called out in the summary) and describe the change for users. The release workflow turns pending changesets into a "Version Packages" pull request and publishes when that pull request is merged. See [CONTRIBUTING.md](../CONTRIBUTING.md#releases).
