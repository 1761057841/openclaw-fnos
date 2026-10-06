# Errors

Command failures and integration errors.

---

## [ERR-20261005-001] github-cli-install-curl-exit-16

**Logged**: 2026-10-05T18:43:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
GitHub CLI manual installation failed on fnOS with curl exit code 16.

### Error
```text
GitHub CLI 安装失败退出码 16
```

### Context
- The fixed installer requests GitHub release metadata from api.github.com and then downloads the official Linux archive.
- The installer currently does not identify which request failed or preserve the curl diagnostic in the UI response.
- Exit code 16 is consistent with an HTTP/2 framing/transport failure, but the exact failing request is not yet proven.

### Suggested Fix
Force HTTP/1.1 for the GitHub metadata and archive requests, retry the request, and prefix errors with the failing stage.

### Metadata
- Reproducible: unknown
- Related Files: app/bin/ensure-gh
- See Also: none

### Resolution
- **Resolved**: 2026-10-05T18:45:00+08:00
- **Notes**: Forced both GitHub metadata and archive downloads to HTTP/1.1 and added stage-specific curl failure messages. Built and verified the updated FPK.
<!-- project: path:/home/node/.openclaw/workspace/项目/openclaw-fnos -->
