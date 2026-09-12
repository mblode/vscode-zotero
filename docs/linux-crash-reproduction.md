# Linux citation picker crash investigation

Tested 8 September 2026 for [issue #36](https://github.com/mblode/vscode-zotero/issues/36).

## Result

A plain Better BibTeX CAYW HTTP request reproduced a Zotero segmentation fault under Wayland in an isolated Linux laboratory. VS Code and this extension were not running. The same profiles passed the X11 control: the citation dialog opened, Escape cancelled it, HTTP 200 with an empty body returned, and Zotero remained alive.

| Zotero                        | Better BibTeX | Display        | Result                                                                      |
| ----------------------------- | ------------- | -------------- | --------------------------------------------------------------------------- |
| Official Linux tarball 7.0.4  | 6.7.229       | Weston Wayland | Process exited with a segmentation fault; curl exit 52, empty reply         |
| Official Linux tarball 7.0.4  | 6.7.229       | Xvfb X11       | Quick Format Citation opened; cancellation returned HTTP 200; process alive |
| Official Linux tarball 10.0.1 | 9.0.63        | Weston Wayland | Process exited with a segmentation fault; curl exit 52, empty reply         |
| Official Linux tarball 10.0.1 | 9.0.63        | Xvfb X11       | Citation Dialog opened; cancellation returned HTTP 200; process alive       |
| Flathub 10.0.1                | Not reached   | Wayland        | Sandbox startup blocked by the emulator; not a picker test                  |

This is a laboratory reproduction of the symptom, **not confirmation of the original Flatpak root cause**. Both historical and current versions crashed here, making the emulation and compositor significant confounders. No extension code change or release is justified by this result alone.

## Environment and limitations

- Isolated OrbStack machine `zotero-crash-repro`, Ubuntu 22.04.5 LTS, amd64 emulated on an arm64 Mac; 4 GB memory, two CPU cores, 16 GB disk limit, host file sharing disabled.
- Kernel `7.0.14-orbstack-00380-ga7e0a2dc9535`, Weston 9.0.0 headless backend with Pixman, Xvfb display `:99`, Flatpak 1.12.7.
- Separate empty historical/current Zotero profiles and data directories under `/home/mblode/repro`; no personal library or sync account. Updates and automatic sync disabled. CAYW port 23129.
- Original report names Zotero 7 and Pop!_OS 22.04 Flatpak, with a Manjaro corroboration, but does not specify Zotero/BBT patch versions or a compositor. The selected historical pair is from September 2024, not a claimed exact match.
- Flathub 10.0.1 commit `8fe7ee2efff6729aa5743fcd6a3a6fb01b1fee6d0afb711b94dc84d63d175c15` installed, but launch failed before Zotero: `bwrap: prctl(PR_SET_SECCOMP): Invalid argument`.
- GDB could not access emulated registers: `Couldn't get registers: Input/output error.` There is no usable native backtrace, and no claim about the faulting function.
- These checks cover opening and cancelling an empty citation dialog, not selecting a populated citation or an entire editor workflow.

## Reproduction procedure

Use disposable Linux profiles with the corresponding BBT XPI in `PROFILE/extensions/better-bibtex@iris-advies.com.xpi`. Set `extensions.autoDisableScopes` to `0`, `extensions.enabledScopes` to `15`, `extensions.zotero.httpServer.port` to `23129`, and configure a separate data directory. Launch Zotero with `-no-remote -profile PROFILE -ZoteroDebugText` and capture stderr/stdout.

For the Wayland case, launch Weston with a private mode-0700 runtime directory:

```sh
XDG_RUNTIME_DIR="$REPRO_RUNTIME" weston --backend=headless-backend.so --use-pixman --socket=wayland-repro --idle-time=0
```

Launch Zotero with `XDG_RUNTIME_DIR` pointing to that directory, `WAYLAND_DISPLAY=wayland-repro`, and `MOZ_ENABLE_WAYLAND=1`. Wait until this returns `ready`:

```sh
curl --max-time 5 'http://127.0.0.1:23129/better-bibtex/cayw?probe=true'
```

Then open the picker:

```sh
curl --max-time 15 -v 'http://127.0.0.1:23129/better-bibtex/cayw?format=pandoc'
```

In both Wayland runs the ready probe succeeded, the log recorded citation integration being invoked, the process exited with `Segmentation fault`, and curl returned 52. A timeout by itself is not a crash.

For the X11 control, start `Xvfb :99 -screen 0 1280x800x24` and launch the same Zotero profile with `DISPLAY=:99` and `MOZ_ENABLE_WAYLAND=0`. Repeat the request, inspect the window title using `xdotool`, then send Escape to that specific citation window. Both controls returned HTTP 200 and retained a live Zotero process.

## Evidence and next step

Local raw logs are archived at `/tmp/zotero-crash-reproduction/linux-logs.tar.gz`; the stopped isolated machine retains the profiles, downloads and logs under `/home/mblode/repro`. The archive is temporary local evidence, not a committed fixture.

[Flathub issue #165](https://github.com/flathub/org.zotero.Zotero/issues/165) documents a closely matching historical Wayland crash and reports X11 as a workaround. Maintainers reported improvement in 7.1-beta.24 and closed it after Zotero 8.0. Those upstream reports do not prove this laboratory crash shares the same cause.

The next decisive check is native Linux, without x86 translation, using the affected desktop compositor and Flatpak. Repeat the direct HTTP trigger and X11 control while collecting a native core/backtrace. Keep #36 open until the relationship to the original report is established. No issue replies were sent during this investigation.
