/**
 * Download cloudflared binaries for packaging
 * This script downloads the appropriate cloudflared binary for each platform
 * during the build process, so users don't need to install it manually.
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Cloudflare cloudflared GitHub releases
const CLOUDFLARED_VERSION = 'latest' // or specify a version like '2024.1.5'
const GITHUB_RELEASE_URL = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'

// Platform-specific download URLs
const DOWNLOAD_URLS = {
  'darwin-x64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
  'darwin-arm64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz', // Same as x64, cloudflared is universal
  'win32-x64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  'win32-arm64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
  'linux-x64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64',
  'linux-arm64': 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64',
}

// Target platforms (can be overridden by command line args)
const platforms = process.argv[2] ? [process.argv[2]] : [
  'darwin-x64',
  'darwin-arm64',
  'win32-x64',
  'linux-x64',
]

// Output directory
const BIN_DIR = path.join(__dirname, '..', 'resources', 'bin')

// Ensure bin directory exists
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true })
}

/**
 * Download a file from URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from ${url}...`)
    
    const protocol = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(destPath)
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'amux-desktop-build'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(destPath)
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject)
      }
      
      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(destPath)
        return reject(new Error(`Failed to download: ${response.statusCode}`))
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10)
      let downloadedSize = 0
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1)
        process.stdout.write(`\rProgress: ${percent}%`)
      })
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        console.log('\n✅ Download complete')
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      fs.unlinkSync(destPath)
      reject(err)
    })
  })
}

/**
 * Extract tar.gz file (for macOS)
 */
function extractTarGz(tarPath, destDir) {
  console.log('Extracting archive...')
  try {
    execSync(`tar -xzf "${tarPath}" -C "${destDir}"`, { stdio: 'inherit' })
    fs.unlinkSync(tarPath) // Remove archive after extraction
    console.log('✅ Extraction complete')
  } catch (error) {
    console.error('❌ Extraction failed:', error.message)
    throw error
  }
}

/**
 * Make file executable (Unix-like systems)
 */
function makeExecutable(filePath) {
  if (process.platform !== 'win32') {
    console.log('Setting executable permissions...')
    fs.chmodSync(filePath, 0o755)
    console.log('✅ Executable permissions set')
  }
}

/**
 * Download cloudflared for a specific platform
 */
async function downloadForPlatform(platform) {
  console.log(`\n📦 Downloading cloudflared for ${platform}...`)
  
  const url = DOWNLOAD_URLS[platform]
  if (!url) {
    console.warn(`⚠️  No download URL for platform: ${platform}`)
    return
  }
  
  const [os, arch] = platform.split('-')
  const isWindows = os === 'win32'
  const isMacOS = os === 'darwin'
  
  // Determine file name
  let fileName = 'cloudflared'
  if (isWindows) {
    fileName = 'cloudflared.exe'
  }
  
  // Platform-specific subdirectory
  const platformDir = path.join(BIN_DIR, platform)
  if (!fs.existsSync(platformDir)) {
    fs.mkdirSync(platformDir, { recursive: true })
  }
  
  const destPath = path.join(platformDir, fileName)
  
  // Check if already exists
  if (fs.existsSync(destPath)) {
    console.log(`✅ cloudflared already exists for ${platform}`)
    return
  }
  
  try {
    // Download
    if (isMacOS && url.endsWith('.tgz')) {
      // macOS: Download tar.gz and extract
      const tarPath = path.join(platformDir, 'cloudflared.tgz')
      await downloadFile(url, tarPath)
      extractTarGz(tarPath, platformDir)
      
      // Rename if needed
      const extractedName = 'cloudflared-darwin-amd64'
      const extractedPath = path.join(platformDir, extractedName)
      if (fs.existsSync(extractedPath)) {
        fs.renameSync(extractedPath, destPath)
      }
    } else {
      // Windows/Linux: Direct download
      await downloadFile(url, destPath)
    }
    
    // Make executable
    makeExecutable(destPath)
    
    // Verify
    const stats = fs.statSync(destPath)
    console.log(`✅ Successfully downloaded cloudflared for ${platform}`)
    console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Path: ${destPath}`)
    
  } catch (error) {
    console.error(`❌ Failed to download cloudflared for ${platform}:`, error.message)
    throw error
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting cloudflared download for packaging...\n')
  console.log(`Target platforms: ${platforms.join(', ')}\n`)
  
  // Download for current platform first (for development)
  const currentPlatform = `${process.platform}-${process.arch}`
  if (platforms.includes(currentPlatform)) {
    await downloadForPlatform(currentPlatform)
  }
  
  // Download for other platforms
  for (const platform of platforms) {
    if (platform !== currentPlatform) {
      await downloadForPlatform(platform)
    }
  }
  
  console.log('\n✅ All downloads complete!')
  console.log(`\nBinaries saved to: ${BIN_DIR}`)
  console.log('\n📝 Next steps:')
  console.log('   1. Run `npm run build` or `npm run package` to build the app')
  console.log('   2. cloudflared will be bundled in the app package')
  console.log('   3. Users can use tunnel feature without manual installation\n')
}

// Run
main().catch((error) => {
  console.error('\n❌ Download failed:', error)
  process.exit(1)
})
