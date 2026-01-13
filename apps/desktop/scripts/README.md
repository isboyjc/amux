# Desktop App Build Scripts

## 图标构建脚本 (build-icons.js)

### 功能

将 SVG logo 转换为 electron-builder 所需的各种尺寸 PNG 图标。

**特性**：
- ✅ 白色背景（专业应用图标标准）
- ✅ 60% 内容区域（遵循 macOS Big Sur 安全区域规范）
- ✅ 自动添加适当 padding（20% 每边）
- ✅ 圆角处理（22.5% 半径，模拟 macOS squircle）
- ✅ 多种尺寸，确保在不同显示场景下清晰
- ✅ 与其他应用图标大小和风格一致

### 使用方法

```bash
# 手动构建图标
pnpm build:icons

# 打包时自动构建（已配置 prepackage）
pnpm package:mac   # 会自动先运行 build:icons
```

### 输出文件

- `resources/icon.png` (1024x1024) - electron-builder 主图标
- `resources/icons/*.png` - 多尺寸图标（16, 32, 64, 128, 256, 512, 1024）

### 生成的尺寸

| 尺寸 | 用途 |
|------|------|
| 16x16 | macOS, Windows (小图标) |
| 32x32 | macOS, Windows (小图标) |
| 64x64 | macOS |
| 128x128 | macOS, Windows |
| 256x256 | macOS, Windows |
| 512x512 | macOS, Linux |
| 1024x1024 | macOS (Retina) |

### 依赖

- `sharp` - 高性能图像处理库（已配置为 devDependency）

### 注意事项

1. **源文件**: `resources/icons/logo.svg`
2. **自动执行**: 打包时会自动运行此脚本
3. **跨平台**: 支持 macOS, Windows, Linux
4. **白色背景**: 生成的 PNG 使用白色背景（专业应用标准）
5. **内容区域**: 图标内容占 60%（macOS Big Sur 安全区域），四周各有 20% padding
6. **圆角效果**: 自动添加 22.5% 半径的圆角（模拟 macOS squircle）

### 自定义配置

如需调整背景颜色或内容比例，编辑 `scripts/build-icons.js`：

```javascript
const CONFIG = {
  // 图标内容占比（建议 0.55-0.65，macOS Big Sur 标准是 0.60）
  contentRatio: 0.60,
  
  // 背景颜色
  backgroundColor: { r: 255, g: 255, b: 255, alpha: 1 }, // 白色
  
  // 是否添加圆角
  addRoundedCorners: true,
  
  // 圆角半径比例（macOS Big Sur squircle ≈ 0.225）
  borderRadiusRatio: 0.225,
  
  // 其他颜色示例：
  // backgroundColor: { r: 0, g: 0, b: 0, alpha: 1 },     // 黑色
  // backgroundColor: { r: 66, g: 135, b: 245, alpha: 1 }, // 蓝色
  // backgroundColor: { r: 0, g: 0, b: 0, alpha: 0 },      // 透明
}
```

**推荐配置（按平台）**：
- **macOS Big Sur/Monterey/Sonoma**: 
  - `contentRatio: 0.60` (60% 内容，40% padding)
  - `borderRadiusRatio: 0.225` (22.5% 圆角)
  - 这是标准的 macOS squircle 安全区域

- **Windows 11**: 
  - `contentRatio: 0.65` (65% 内容)
  - `borderRadiusRatio: 0.15` (15% 圆角)
  - Windows 11 风格的轻微圆角

- **Linux**: 
  - `contentRatio: 0.70` (70% 内容)
  - `borderRadiusRatio: 0.10` (10% 圆角或不添加圆角)

### 修改 Logo

如果需要更新应用图标：

1. 替换 `resources/icons/logo.svg`
2. 运行 `pnpm build:icons`
3. 重新打包 `pnpm package:mac`

### 故障排查

**错误: sharp 未安装**
```bash
pnpm install
```

**错误: SVG 文件不存在**
确保 `resources/icons/logo.svg` 文件存在

**错误: 权限问题**
```bash
chmod +x scripts/build-icons.js
```
