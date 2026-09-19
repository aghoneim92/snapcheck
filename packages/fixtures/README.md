# @snapcheck/fixtures

Builds snapcheck's third-party Storybook fixtures from source at pinned
commits. Test infrastructure: private, never published.

A fixture is someone else's design system, captured through the same path a
customer uses — build Storybook, point snapcheck at the static output. It is
**cloned, never vendored**: their releases stay their problem, and a checked-in
copy would turn their merges into our conflicts.

```sh
pnpm fixture build grafana          # clone at the pin and build, or reuse a matching build
pnpm fixture verify grafana         # exit 1 unless the build on disk matches the pin
pnpm fixture path grafana           # print its staticDir
pnpm fixture bump grafana v13.3.0   # re-pin; deliberate, invalidates baselines
```

| Fixture   | Source                                                        | Build output (`staticDir`)                             |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| `grafana` | Grafana Saga — `@grafana/ui`, plus `grafana-alerting` stories | `.fixtures/grafana/packages/grafana-ui/dist/storybook` |

## The build is a one-time cost

Clones live in the gitignored `.fixtures/<name>/`. A build writes
`snapcheck-fixture.json` into its output directory, recording the repo, pinned
commit, tag, commit date, build date, Storybook version, the index's `v` field
and entry counts, and a SHA-256 of the index file. `build` reuses any build
whose manifest matches the pin and whose index still hashes to the recorded
value, so a second run takes under a second. CI caches the output directory
under a key only a pin bump or a build-procedure change moves, and consumes it
without cloning.

## Pins

`pins.json` holds each fixture's repo, release tag and the commit that tag
points at. It changes only through `pnpm fixture bump`, which resolves the tag
with `git ls-remote` — never automatically, never on a schedule.

A pin bump changes the fixture, and snapcheck refuses to compare a run against
baselines captured from a different fixture build: it exits 2 and names every
field that changed, rather than reporting the fixture's own changes as visual
regressions. Re-baseline deliberately with `--update`.

The index hash is reproducible across machines: the `v13.2.2` index built on
macOS/arm64 and in a Linux container is byte-identical, so a local build and
the CI build count as the same fixture.
