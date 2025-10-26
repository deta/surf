# Claude Code - Master PR Rules

**Version:** 1.3.0 (Unified)
**Last Updated:** 2025-10-26
**Auto-Activate Keywords:** `pull request` | `PR` | `#PR` | `@PR` | `/pr`

---

## 📖 Overview

These Master PR Rules ensure production-ready pull requests by automatically adapting to repository type and applying only relevant changes. This unified document combines the comprehensive detail of the original guide with the token-optimized format and specialized security workflows of the latest version.

### ✨ Features

- **Intelligent Repository Analysis** - Detects project type and skips irrelevant changes.
- **Specialized Security Workflows** - Includes mandatory security protocols for sensitive projects like macOS Tahoe UI/UX.
- **Adaptive Documentation** - Creates guides tailored to your project.
- **Consistent Git Workflow** - Follows best practices for commits and PRs.
- **Comprehensive Testing** - Provides detailed testing checklists.
- **Platform Optimizations** - Applies performance improvements when applicable.

---

## 🎯 How to Use

### In Claude Code CLI

Place this file in your project root or `.claude/` directory, then:

```bash
# Option 1: Reference in conversation
"Read PR.md and create a pull request for feature X"

# Option 2: Use with slash command (if .claude/commands/pr.md exists)
/pr Add feature X
```

### In Claude Web Interface

1. Drag this file into the conversation.
2. Ask: "Follow these rules and create a PR for feature X".

---

## 📋 Master PR Rules

### 1. Repository Analysis Phase (Always Required)

Before making any changes, analyze the repository to determine its type, structure, and conventions.

| Type | Focus On | Skip |
|------|----------|------|
| **CLI Tool** | Commands, output formatting, error handling | UI/UX, frontend frameworks |
| **Backend API** | Performance, endpoints, security | Frontend components, browser compatibility |
| **Frontend App** | UI/UX, components, accessibility | Backend database optimization |
| **Documentation** | Content, structure, examples | Code optimization, performance |
| **Library/Package** | API design, types, performance | Application-specific features |
| **Full-Stack App** | All relevant improvements | None (comprehensive) |

### 2. Adaptive Code Changes (Based on Repo Type)

- **Backend/API:** Performance optimizations (database, caching, algorithms), API endpoint refactoring, security improvements, error handling and logging.
- **Frontend:** UI/UX improvements, component optimization, accessibility enhancements, responsive design.
- **CLI:** Command structure improvements, output formatting, error messages and help text, cross-platform compatibility.
- **Docs:** Content improvements, structure reorganization, examples and code snippets, link validation.
- **Library:** API design improvements, type definitions, performance optimization, breaking change documentation, backward compatibility.

### 3. Platform-Specific Optimizations (If Applicable)

- **Apple Silicon:** LTO, target-cpu=native, native ARM64 builds, memory efficiency.
- **Linux Server:** SystemD integration, container optimization, resource limits.
- **Windows:** NSIS installer configuration, registry handling, path compatibility.
- **Cross-Platform:** Consistent behavior across platforms, path normalization.
- **Skip if:** Platform-agnostic library, web-only application, or documentation project.

### 4. Documentation (Always Required)

#### A. Deployment/Installation Guide
Create or update a comprehensive guide (e.g., `DEPLOYMENT.md`, `VIBECODER.md`). It must include system requirements, installation steps, configuration, testing, and troubleshooting.

#### B. README.md Updates
Always update the README with a summary of changes, new features, breaking changes, updated requirements, and performance improvements.

#### C. API/Integration Documentation (if applicable)
Document supported integrations, configuration examples, migration guides, and environment variables.

### 5. Testing Procedures (Always Required)

Provide a comprehensive testing checklist adapted to the repository type, covering unit, integration, build, and performance tests. For documentation, verify links, examples, and formatting.

### 6. Git Workflow (Always Required)

- **Branch Naming:** Use descriptive prefixes like `feature/`, `fix/`, `docs/`, `perf/`, `refactor/`.
- **Commit Process:** Stage relevant files, create a detailed commit message following the format below, and push to the remote branch.

### 7. Commit Message Format (Always Required)

Use the Conventional Commits standard.

**Template:**
```
<type>: <short description (max 72 chars)>

<detailed description paragraph explaining WHY and WHAT>

## <Category 1>
- Change detail 1
- Change detail 2

**Performance Gains:** (if applicable)
- 20-30% faster processing

**Breaking Changes:** (if any)
- API endpoint /old/path removed, use /new/path

**System Requirements:** (if changed)
- Node.js 18+ now required

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```
**Types:** `feat`, `fix`, `docs`, `perf`, `refactor`, `test`, `chore`, `style`, `ci`.

### 8. Intelligent Skipping Rules

Automatically **SKIP** irrelevant sections based on repository type to ensure efficiency. For example, skip UI/UX changes for a CLI tool, and skip code optimization for a documentation repo.

### 9. Quality Checklist (Always Verify)

Before pushing, verify code quality, documentation completeness, test coverage, compatibility, performance, security, and Git hygiene.

### 10. PR Readiness Confirmation (Always Provide)

End the process with a summary report detailing file changes, a breakdown by category, testing checklist status, documentation updates, and next steps for the reviewer.

---

## 🔐 Specialized Workflows

### macOS Tahoe UI/UX Development

**Applies to:** All macOS Tahoe UI/UX development and optimization tasks. This workflow is mandatory for such projects to ensure security and integrity.

**Workflow Steps:**

1.  **Initial Review and `vibecoder.md` Creation**
    *   Perform a thorough code review and security verification of the existing codebase.
    *   Create the `vibecoder.md` documentation, which outlines the project's specific operational and deployment context.

2.  **Mandatory Security Check**
    *   **Crucial:** Upon the creation of `vibecoder.md`, a security scan must be re-initiated. This scan confirms that no sensitive files, such as `.env` files or other private credentials, have been inadvertently staged for commit. This step is vital for ensuring a clean and secure codebase before proceeding.

3.  **Vibecoding Phase** (Triggered when `.env` requires examination)
    *   Test and debug the application using the `.env` file for environment variables.
    *   Verify all system functionality with the necessary secrets and configurations in place.

4.  **Deployment**
    *   Deploy the system with the `.env` file in place to the target environment.
    *   Validate the deployment's success and functionality.

5.  **Pre-GitHub Security Cleanup (⚠️ CRITICAL)**
    *   **Remove ALL `.env` files from the project directory.**
    *   **Remove ALL other security-sensitive files (e.g., private keys, credential files).**
    *   Prepare the final codebase for merging into the main GitHub repository.

6.  **Post-Cleanup Verification**
    *   Re-review the code to ensure system stability and that no critical dependencies on the removed files exist.
    *   Validate that the application runs correctly in a development environment without the `.env` file (using a `.env.template` or similar).

---

## 🚀 Platform-Specific Optimization Examples

### Apple Silicon (macOS) - Rust
```toml
# Cargo.toml
[profile.release]
opt-level = 3
lto = "fat"
codegen-units = 1
strip = true
panic = "abort"

[target.'cfg(all(target_arch = "aarch64", target_os = "macos"))']
rustflags = ["-C", "target-cpu=native"]
```

### Linux Server - SystemD
```ini
# /etc/systemd/system/your-service.service
[Unit]
Description=Your Service
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/app/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 🎯 Quick Reference Card

### Trigger Keywords
`pull request` | `PR` | `#PR` | `@PR` | `/pr`

### Always Do
✅ Analyze repository type first
✅ Apply only relevant changes
✅ Create comprehensive docs
✅ Provide testing checklist
✅ Follow git best practices
✅ Document breaking changes

### Never Do
❌ Apply irrelevant changes
❌ Skip documentation
❌ Use vague commit messages
❌ Forget testing procedures
❌ Ignore backward compatibility

### Specialized Workflow
🔐 **macOS Tahoe UI/UX:** Requires `vibecoder.md` and a mandatory security cleanup before any GitHub merge.

---
