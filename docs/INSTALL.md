## Installing Surf

- [Download](#download)
- [macOS Security Warning](#macos-security-warning)
- [Windows Security Warning](#windows-security-warning)

### Download

Get the latest version of Surf from [GitHub Releases](https://github.com/deta/surf/releases/latest).

| Platform              | Download File                |
| --------------------- | ---------------------------- |
| macOS (Apple Silicon) | `Surf-x.y.z.arm64.dmg`       |
| macOS (Intel)         | `Surf-x.y.z.x64.dmg`         |
| Windows (x64)         | `Surf-x.y.z-setup.exe`       |
| Linux (x64 AppImage)  | `Surf-x.y.z.x86_64.AppImage` |

_Note: Replace `x.y.z` with the version number from the latest release._

### Security Warnings

When installing or opening Surf, you may see security warnings from your operating system. This is expected because the open source releases aren't currently signed. Follow the steps below for your platform.

#### macOS Security Warning

MacOS may display a warning that "Surf can't be opened because Apple cannot check it for malicious software."

**Quick fix:** Right-click the Surf app and select "Open" from the menu. You only need to do this once.

**If that doesn't work:**

1. Try opening Surf again using the right-click method, then click the `?` icon in the top-left corner of the warning dialog.

<img src="./assets/install-warnings/macos-warn-q.png" width="400" alt="macOS warning with help icon">

2. Click on "Open Privacy and Security Settings for me" from the help guide.

<img src="./assets/install-warnings/macos-warn-guide.png" width="400" alt="macOS help guide">

3. In System Preferences, scroll to the "Security" section and click "Open Anyway" on the message displayed for Surf.

<img src="./assets/install-warnings/macos-warn-open-anyway.png" width="400" alt="macOS Security and Privacy settings">

#### Windows Security Warning

Windows Defender may warn that "Windows protected your PC."

Click **"Run anyway"** (or **"More Info"** then **"Run anyway"**) to proceed with installation.

<img src="./assets/install-warnings/win-warn-more-info.png" width="400" alt="Windows Defender warning">

<img src="./assets/install-warnings/win-warn-run-anyway.png" width="400" alt="Windows Defender run anyway button">
