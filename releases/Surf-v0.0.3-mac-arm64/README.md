# Surf v0.0.3 - 安装说明

## 版本说明
- **版本**: 0.0.3
- **构建时间**: 2025-10-26
- **支持平台**: macOS (Apple Silicon 和 Intel)

## 文件说明

### ZIP包（推荐）
- `Surf-v0.0.3-mac-arm64.zip` - Apple Silicon (M1/M2/M3/M4) 版本
- `Surf-v0.0.3-mac-x64.zip` - Intel 版本

## 安装方法

### 方法一：直接运行（推荐）
1. 下载对应您Mac芯片架构的ZIP文件
   - Apple Silicon Mac: 下载 `Surf-v0.0.3-mac-arm64.zip`
   - Intel Mac: 下载 `Surf-v0.0.3-mac-x64.zip`

2. 解压ZIP文件到任意目录
3. 解压后会有一个包含以下文件的目录：
   - `out/` - 应用程序文件
   - `package.json` - 应用配置
   - `resources/` - 资源文件

4. 运行应用：
   ```bash
   # 进入应用目录
   cd [解压后的目录]

   # 启动应用
   electron out/main/index.js
   ```

### 方法二：使用npx运行
1. 确保系统已安装Node.js (建议版本18+)
2. 解压ZIP文件到任意目录
3. 在解压目录中运行：
   ```bash
   npx electron out/main/index.js
   ```

## 安全说明
由于这是未签名的应用，首次运行时macOS可能会显示安全警告。如果遇到警告：

1. **方法一**: 右键点击应用 → 选择"打开" → 点击"打开"确认
2. **方法二**:
   - 打开"系统偏好设置" → "安全性与隐私"
   - 在"通用"标签页中找到被阻止的应用
   - 点击"仍要打开"

## 功能特性
- 网页浏览功能
- Notebook笔记功能
- PDF查看和注释
- 文本高亮和注释
- OCR文字识别

## 系统要求
- macOS 10.15 或更高版本
- Node.js 18.0 或更高版本（如果使用npx方法）
- 至少 4GB RAM
- 200MB 可用磁盘空间

## 问题排查
如果应用无法启动：

1. 检查Node.js版本：`node --version`
2. 检查是否正确解压所有文件
3. 确保文件权限正确：`chmod +x out/main/index.js`
4. 查看错误日志以获取更多信息

## 技术支持
如遇到问题，请检查终端输出的错误信息。