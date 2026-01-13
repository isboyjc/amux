#!/usr/bin/env node

/**
 * Build Icons Script
 * 
 * Converts SVG logo to PNG icons for electron-builder
 * 
 * Features:
 * - White background for all icons
 * - Proper padding following macOS icon guidelines (85% content area)
 * - Multiple sizes for optimal display quality
 * 
 * Requirements:
 * - sharp (npm install sharp)
 * 
 * Output:
 * - icon.png (1024x1024) - Main icon for electron-builder
 * - icons/16x16.png, 32x32.png, ... - Multiple sizes for better quality
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const INPUT_SVG = path.join(__dirname, '../resources/icons/logo.svg')
const OUTPUT_DIR = path.join(__dirname, '../resources')
const ICONS_DIR = path.join(OUTPUT_DIR, 'icons')

// electron-builder recommended icon sizes
const SIZES = [
  16,   // macOS, Windows
  32,   // macOS, Windows
  64,   // macOS
  128,  // macOS, Windows
  256,  // macOS, Windows
  512,  // macOS, Linux
  1024  // macOS (main icon)
]

// Icon configuration - 遵循 macOS Big Sur / Windows 11 / Linux 设计规范
const CONFIG = {
  // ⭐ 图标内容占比（相对于背景的比例）
  contentRatio: 0.70,
  
  // ⭐ 背景相对于整个画布的比例（留出透明边距）
  // 调整为更小的背景，让整体图标看起来更精致
  backgroundRatio: 0.85,
  
  // 背景颜色（白色，符合大多数应用标准）
  backgroundColor: { r: 255, g: 255, b: 255, alpha: 1 },
  
  // ⭐ 是否添加圆角（启用以匹配 macOS/Windows 的视觉效果）
  addRoundedCorners: true,
  
  // 圆角半径比例（相对于背景大小）
  // macOS Big Sur squircle ≈ 22-23% 圆角半径
  borderRadiusRatio: 0.225
}

/**
 * 创建圆角遮罩 SVG (Squircle - 超椭圆)
 * 使用 SVG 的圆角矩形来模拟 macOS Big Sur 的 squircle 效果
 */
function createRoundedCornerMask(size) {
  const radius = Math.round(size * CONFIG.borderRadiusRatio)
  
  // 生成圆角矩形的 SVG 遮罩
  const svg = `
    <svg width="${size}" height="${size}">
      <rect
        x="0"
        y="0"
        width="${size}"
        height="${size}"
        rx="${radius}"
        ry="${radius}"
        fill="white"
      />
    </svg>
  `
  
  return Buffer.from(svg)
}

/**
 * 生成带白色背景、适当 padding 和圆角的图标
 * 背景本身会小于画布尺寸，周围有透明边距
 */
async function generateIconWithBackground(svgBuffer, size) {
  // 计算实际背景大小（小于整个画布）
  const backgroundSize = Math.round(size * CONFIG.backgroundRatio)
  const backgroundMargin = Math.round((size - backgroundSize) / 2)
  
  // 计算图标内容实际大小（相对于背景）
  const contentSize = Math.round(backgroundSize * CONFIG.contentRatio)
  const padding = Math.round((backgroundSize - contentSize) / 2)
  
  // 第一步：将 SVG 调整为内容大小
  const iconBuffer = await sharp(svgBuffer)
    .resize(contentSize, contentSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 } // 保持透明
    })
    .png()
    .toBuffer()
  
  // 第二步：创建较小的白色背景并将图标居中放置
  let iconWithBackground = await sharp({
    create: {
      width: backgroundSize,
      height: backgroundSize,
      channels: 4,
      background: CONFIG.backgroundColor
    }
  })
  .composite([
    {
      input: iconBuffer,
      top: padding,
      left: padding
    }
  ])
  .png()
  .toBuffer()
  
  // 第三步：如果启用圆角，应用圆角遮罩（使用背景大小）
  if (CONFIG.addRoundedCorners) {
    const roundedMask = createRoundedCornerMask(backgroundSize)
    
    iconWithBackground = await sharp(iconWithBackground)
      .composite([
        {
          input: roundedMask,
          blend: 'dest-in' // 使用遮罩裁切
        }
      ])
      .png()
      .toBuffer()
  }
  
  // 第四步：将带圆角的背景放置到透明画布中心（整个画布大小）
  const finalIcon = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } // 透明背景
    }
  })
  .composite([
    {
      input: iconWithBackground,
      top: backgroundMargin,
      left: backgroundMargin
    }
  ])
  .png()
  .toBuffer()
  
  return finalIcon
}

async function buildIcons() {
  console.log('🎨 Building application icons following platform standards...\n')
  console.log(`📐 Icon configuration:`)
  console.log(`   - Background size: ${CONFIG.backgroundRatio * 100}% (with ${(1 - CONFIG.backgroundRatio) * 50}% transparent margin)`)
  console.log(`   - Content ratio: ${CONFIG.contentRatio * 100}% (relative to background)`)
  console.log(`   - Background color: White (RGB 255, 255, 255)`)
  console.log(`   - Rounded corners: ${CONFIG.addRoundedCorners ? `Yes (${CONFIG.borderRadiusRatio * 100}%)` : 'No'}\n`)
  console.log(`🎯 Result:`)
  console.log(`   - ✅ Smaller background matches other macOS apps`)
  console.log(`   - ✅ Transparent margins prevent icon from looking too large`)
  console.log(`   - ✅ Content size remains appropriate\n`)
  
  // Check if input SVG exists
  if (!fs.existsSync(INPUT_SVG)) {
    console.error(`❌ Input SVG not found: ${INPUT_SVG}`)
    process.exit(1)
  }
  
  // Create icons directory if not exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true })
  }
  
  try {
    // Read SVG
    const svgBuffer = fs.readFileSync(INPUT_SVG)
    
    // Generate main icon (1024x1024) for electron-builder
    console.log('📦 Generating main icon.png (1024x1024)...')
    const mainIcon = await generateIconWithBackground(svgBuffer, 1024)
    await sharp(mainIcon).toFile(path.join(OUTPUT_DIR, 'icon.png'))
    console.log('   ✅ icon.png created (1024x1024 with white background)\n')
    
    // Generate multiple sizes for better quality
    console.log('📦 Generating multi-size icons...')
    for (const size of SIZES) {
      const filename = `${size}x${size}.png`
      const outputPath = path.join(ICONS_DIR, filename)
      
      const iconBuffer = await generateIconWithBackground(svgBuffer, size)
      await sharp(iconBuffer).toFile(outputPath)
      
      const backgroundSize = Math.round(size * CONFIG.backgroundRatio)
      const contentSize = Math.round(backgroundSize * CONFIG.contentRatio)
      console.log(`   ✅ ${filename} (bg: ${backgroundSize}x${backgroundSize}, content: ${contentSize}x${contentSize})`)
    }
    
    console.log('\n✨ All icons generated successfully!')
    console.log('\n📂 Output:')
    console.log(`   - ${OUTPUT_DIR}/icon.png (main icon for electron-builder)`)
    console.log(`   - ${ICONS_DIR}/*.png (multi-size icons)`)
    console.log('\n🎯 Icon specifications:')
    console.log(`   - ✅ Background: ${CONFIG.backgroundRatio * 100}% of canvas (with transparent margins)`)
    console.log(`   - ✅ Content: ${CONFIG.contentRatio * 100}% of background`)
    console.log(`   - ✅ Rounded corners: ${CONFIG.borderRadiusRatio * 100}% radius`)
    console.log(`   - ✅ White background with squircle shape`)
    console.log('\n💡 Result:')
    console.log(`   The background is now smaller with transparent margins around it.`)
    console.log(`   This matches the size of other macOS apps like remio and Antigravity Tools!\n`)
    
  } catch (error) {
    console.error('\n❌ Error generating icons:', error.message)
    console.error('\n💡 Make sure sharp is installed:')
    console.error('   pnpm add -D sharp\n')
    process.exit(1)
  }
}

// Run
buildIcons()
