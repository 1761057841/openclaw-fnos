# OpenClaw fnOS application

This directory is the redesigned fnOS application source tree. It keeps the
Node runtime, OpenClaw package, configuration, workspace, and agent state under
the application data directory instead of using system-wide Node or npm.

## Design boundaries

- OpenClaw is installed with the official `install-cli.sh` local-prefix flow.
- No OpenClaw version is embedded in the application package.
- OpenClaw upgrades are performed by the official `openclaw update` command.
- Node upgrades are performed by the local runtime updater in `bin/update-node`.
- The fnOS application does not implement or hide OpenClaw channels.
- The application server only provides the fnOS entry page and proxies the
  local OpenClaw Gateway; Gateway authentication and authorization remain
  OpenClaw's responsibility.

## Runtime layout after installation

```text
/vol1/@apphome/openclaw/data/
├── home/                     # local prefix: Node + OpenClaw + third-party tools
│   ├── bin/                  # OpenClaw launcher
│   └── tools/
│       ├── node/             # private Node.js runtime
│       └── gh/               # private GitHub CLI
├── openclaw/                 # HOME and OpenClaw state
│   └── .openclaw/
└── runtime/                  # transient pid/log/socket data
    └── gh-install.*          # temporary GitHub CLI download files
```

## Maintenance commands

The fnOS application exposes the following application-local commands. They
must be run as the package user or through the fnOS application maintenance
context; they do not modify system Node or a system-wide npm prefix.

```sh
# Install the current official runtime on first use
/var/apps/openclaw/target/bin/ensure-runtime

# Update only the private Node runtime
/var/apps/openclaw/target/bin/update-node

# Let OpenClaw perform its own release/channel update
/var/apps/openclaw/target/bin/update-openclaw

# Diagnostics
/var/apps/openclaw/target/bin/doctor
```

The fnOS app version in `manifest` is only the wrapper/package version. It is
not an OpenClaw version pin. The application deliberately does not include an
`openclaw-version.env`, vendor patch bundle, channel-management page, config
reconciler, or a second Gateway proxy.

The package itself must not contain `data/`. fnOS creates and owns that
directory at runtime.

## Private GitHub CLI

The app optionally downloads the official GitHub CLI (`gh`) into
`data/home/tools/gh` on first start. It never uses `apt-get` and never
modifies the fnOS system installation. GitHub authentication is stored under
the app-owned `HOME/.config/gh` directory.

On upgrade from versions using the inverse directory names, the first start
performs a one-time safe exchange only when it recognizes both old directory
signatures. It then writes `data/.layout-home-openclaw-v1`; do not delete this
marker unless deliberately restoring the old layout.

From the management terminal, use the constrained wrapper form:

```text
openclaw gh auth login --web
openclaw gh auth status
openclaw gh repo list OWNER
openclaw gh issue list --repo OWNER/REPO
openclaw gh pr list --repo OWNER/REPO
```

The terminal does not allow shell syntax, token-printing commands, or cloning
outside the OpenClaw workspace. If GitHub CLI download fails, OpenClaw and the
management UI continue to start; GitHub commands report that `gh` is unavailable.

Third-party tools use the controlled installer. It accepts only approved tool
names and installs into the app-private prefix; it does not accept URLs or use
system package management:

```sh
/var/apps/openclaw/target/bin/install-third-party-tool list
/var/apps/openclaw/target/bin/install-third-party-tool install gh
```

The desktop entry uses the fnOS unified-gateway `type: iframe` entry. The
management page is served over `app.sock` at `/app/openclaw`.
The lifecycle starts the service as the package user. It prepares the target
directory with setgid and sticky-bit permissions so the service can create its
gateway socket there without making the target world-writable; the socket is
group-readable and group-writable, not world-accessible.

The package includes `wizard/uninstall`, which lets fnOS collect whether the
user wants to keep or delete persistent OpenClaw data before
`cmd/uninstall_init` runs.

## Uninstall data policy

Uninstall is data-safe by default: the package is removed, but
`/vol1/@apphome/openclaw/data` is retained so a later reinstall can reuse
configuration, sessions, the private runtime, and the Gateway token.

The uninstall hook accepts an explicit deletion mode:

```sh
# Preserve data (default)
cmd/uninstall_init --keep-data

# Delete all OpenClaw application data
cmd/uninstall_init --delete-data
```

The fnOS uninstall wizard supplies `wizard_uninstall_data` with either
`keep-data` or `delete-data`. The same modes can also be supplied by a
maintenance context with `TRIM_UNINSTALL_MODE=keep-data` or
`TRIM_UNINSTALL_MODE=delete-data`. Unknown or missing modes always preserve
data. Deletion is restricted to the
application's protected fnOS data-volume path and occurs only after the
application has been stopped.

## Build and test

This tree is intentionally source-only. Build it on a fnOS development host
with the official fnOS tooling, then install the generated `.fpk` on a test NAS.

The tree now contains the required fnOS manifest, lifecycle scripts, runtime
files, UI entry, and icons. Before building, create or verify it with the
official fnOS developer tooling, then run:

```sh
fnpack build .
```

The `ui/config` entry points at the fnOS unified-gateway path
`/app/openclaw`, backed by `app.sock`; it does not add a second
channel-management UI or a vendor-specific settings layer. The application
uses the standard fnOS `cmd/main` lifecycle scripts.

Do not run a project compilation or APK build from this workspace.
