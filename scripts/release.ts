#!/usr/bin/env node

/**
 * Amux Monorepo 统一发版脚本
 *
 * 功能：
 * 1. 自动检测待发布的包（packages, desktop, apps）
 * 2. 执行 changeset:version 更新版本
 * 3. 创建对应的 git tags
 * 4. 推送触发 GitHub Actions
 *
 * 使用：
 * - pnpm release          # 智能发版（推荐）
 * - pnpm release:packages # 只发布 npm 包
 * - pnpm release:desktop  # 只发布 Desktop
 */

import { execSync } from 'child_process'
import { readFileSync, readdirSync } from 'fs'
import { writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import * as p from '@clack/prompts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// 类型定义
interface PackageInfo {
  name: string
  version: string
  path: string
  type: 'npm' | 'desktop' | 'app'
}

interface VersionChange {
  name: string
  path: string
  type: 'npm' | 'desktop' | 'app'
  oldVersion: string
  newVersion: string
}

interface GitStatus {
  branch: string
  hasUncommitted: boolean
  status: string
}

interface DesktopReleaseInfo {
  releaseType: ReleaseType
  version: string
}

type ReleaseType = 'stable' | 'beta' | 'alpha' | 'rc'

// 颜色工具
const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
} as const

// 执行命令
function exec(
  cmd: string,
  options: { silent?: boolean; ignoreError?: boolean } = {}
): string {
  try {
    return execSync(cmd, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    }).trim()
  } catch (error) {
    if (!options.ignoreError) {
      throw error
    }
    return ''
  }
}

// 读取 package.json
function readPackageJson(
  path: string
): { name: string; version: string; private?: boolean } | null {
  try {
    return JSON.parse(
      readFileSync(join(rootDir, path, 'package.json'), 'utf-8')
    )
  } catch {
    return null
  }
}

// 获取所有包
function getAllPackages(): PackageInfo[] {
  const packages: PackageInfo[] = []

  // Packages (npm)
  const packagesDir = join(rootDir, 'packages')
  readdirSync(packagesDir).forEach((name) => {
    const path = join('packages', name)
    const pkg = readPackageJson(path)
    if (pkg && !pkg.private) {
      packages.push({
        name: pkg.name,
        version: pkg.version,
        path,
        type: 'npm',
      })
    }
  })

  // Apps
  const appsDir = join(rootDir, 'apps')
  readdirSync(appsDir).forEach((name) => {
    const path = join('apps', name)
    const pkg = readPackageJson(path)
    if (pkg) {
      const type: PackageInfo['type'] = name === 'desktop' ? 'desktop' : 'app'
      packages.push({
        name: pkg.name,
        version: pkg.version,
        path,
        type,
      })
    }
  })

  return packages
}

// 检查是否有待处理的 changesets
function hasChangesets(): boolean {
  const changesetDir = join(rootDir, '.changeset')
  const files = readdirSync(changesetDir)
  return files.some((f) => f.endsWith('.md') && f !== 'README.md')
}

// 检查 git 状态
function checkGitStatus(): GitStatus {
  const status = exec('git status --porcelain', { silent: true })
  const branch = exec('git branch --show-current', { silent: true })
  const hasUncommitted = status.length > 0

  return { branch, hasUncommitted, status }
}

// 检测是否有未提交的版本更新
function hasUncommittedVersionChanges(): boolean {
  const status = exec('git status --porcelain', { silent: true })
  const lines = status.split('\n').filter((line) => line.trim())

  // 检查是否有 package.json 或 CHANGELOG.md 的修改
  return lines.some((line) => {
    return (
      line.includes('package.json') ||
      line.includes('CHANGELOG.md') ||
      line.includes('.changeset/')
    )
  })
}

// 检测版本变化（比较 changeset:version 前后）
function detectVersionChanges(): VersionChange[] {
  const before = getAllPackages()

  // 执行 changeset:version
  p.log.step('执行 changeset:version 更新版本...')
  exec('pnpm changeset:version')

  const after = getAllPackages()
  const changes: VersionChange[] = []

  after.forEach((pkg) => {
    const beforePkg = before.find((p) => p.name === pkg.name)
    if (beforePkg && beforePkg.version !== pkg.version) {
      changes.push({
        name: pkg.name,
        path: pkg.path,
        type: pkg.type,
        oldVersion: beforePkg.version,
        newVersion: pkg.version,
      })
    }
  })

  return changes
}

// 创建 tags
function createTags(
  changes: VersionChange[],
  releaseType: ReleaseType = 'stable'
): string[] {
  const tags: string[] = []

  // 按类型分组
  const npmPackages = changes.filter((c) => c.type === 'npm')
  const desktopPackages = changes.filter((c) => c.type === 'desktop')

  // npm 包：创建统一的 packages tag
  if (npmPackages.length > 0) {
    // 使用第一个包的版本作为 packages 版本
    const version = npmPackages[0].newVersion
    tags.push(`packages-v${version}`)
  }

  // Desktop: 创建 desktop tag
  if (desktopPackages.length > 0) {
    const version = desktopPackages[0].newVersion
    let tag = `desktop-v${version}`

    // 如果是 pre-release，保持版本号中的 beta/alpha/rc
    if (releaseType !== 'stable' && !version.includes('-')) {
      tag = `desktop-v${version}-${releaseType}.1`
    }

    tags.push(tag)
  }

  return tags
}

// Desktop 版本处理
async function handleDesktopPreRelease(
  version: string
): Promise<DesktopReleaseInfo> {
  const releaseTypes = [
    { value: 'stable' as const, label: 'Stable (正式版)' },
    { value: 'beta' as const, label: 'Beta (beta.1, beta.2, ...)' },
    { value: 'alpha' as const, label: 'Alpha (alpha.1, alpha.2, ...)' },
    { value: 'rc' as const, label: 'RC (rc.1, rc.2, ...)' },
  ]

  const releaseTypeResult = await p.select({
    message: 'Desktop 发布类型？',
    options: releaseTypes,
  })

  if (p.isCancel(releaseTypeResult)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  const releaseType = releaseTypeResult as ReleaseType

  if (releaseType === 'stable') {
    return { releaseType, version }
  }

  // 输入序号
  const numberResult = await p.text({
    message: `${releaseType} 版本序号？`,
    placeholder: '1',
    initialValue: '1',
    validate: (value) => {
      if (!/^\d+$/.test(value)) return '请输入数字'
    },
  })

  if (p.isCancel(numberResult)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  const number = numberResult as string

  return {
    releaseType,
    version: `${version}-${releaseType}.${number}`,
  }
}

// 主流程
async function main(): Promise<void> {
  console.clear()

  p.intro(`${colors.blue}🚀 Amux Monorepo 发版工具${colors.reset}`)

  // 检查 git 状态
  const gitStatus = checkGitStatus()

  if (gitStatus.hasUncommitted) {
    p.log.warn('工作目录有未提交的修改：')
    console.log(gitStatus.status)

    const shouldContinue = await p.confirm({
      message: '是否继续？',
    })

    if (!shouldContinue || p.isCancel(shouldContinue)) {
      p.cancel('操作已取消')
      process.exit(0)
    }
  }

  p.log.info(`当前分支: ${colors.blue}${gitStatus.branch}${colors.reset}`)

  // 检查是否有未提交的版本更新（可能是上次发版失败留下的）
  if (hasUncommittedVersionChanges()) {
    p.log.warn('检测到未提交的版本更新文件')
    console.log('')
    p.note(
      `可能是上次发版失败留下的。建议：

1. 检查修改内容：
   git status
   git diff

2. 如果要继续上次的发版：
   git add .
   git commit -m "chore: release packages"
   git tag ... && git push --tags

3. 如果要回滚重来：
   git restore .
   git restore --source=HEAD .changeset/*.md

详见: RELEASE.md 的故障排除章节`,
      '⚠️ 发现未提交的修改'
    )
    console.log('')

    const shouldContinueAnyway = await p.confirm({
      message: '是否忽略并继续？（不推荐）',
      initialValue: false,
    })

    if (!shouldContinueAnyway || p.isCancel(shouldContinueAnyway)) {
      p.cancel('操作已取消')
      process.exit(0)
    }
  }

  // 检查 changesets
  if (!hasChangesets()) {
    p.log.error('没有待处理的 changeset')
    p.outro('请先运行 pnpm changeset 创建 changeset')
    process.exit(1)
  }

  // 显示待处理的 changesets
  const changesetFiles = readdirSync(join(rootDir, '.changeset')).filter(
    (f) => f.endsWith('.md') && f !== 'README.md'
  )

  p.log.step(`发现 ${changesetFiles.length} 个待处理的 changeset`)

  // 确认继续
  const shouldContinue = await p.confirm({
    message: '开始更新版本？',
    initialValue: true,
  })

  if (!shouldContinue || p.isCancel(shouldContinue)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  // 检测版本变化
  const spinner = p.spinner()
  spinner.start('检测版本变化...')

  const changes = detectVersionChanges()

  spinner.stop('版本已更新')

  if (changes.length === 0) {
    p.log.warn('没有检测到版本变化')
    console.log('')
    p.note(
      `可能原因：
1. Changeset 文件已被之前的 changeset:version 消费
2. Changeset 内容不会产生版本变化

建议：
- 检查是否有新的改动需要发版
- 如果有，运行: pnpm changeset
- 如果没有，无需发版`,
      '提示'
    )
    p.outro('完成')
    process.exit(0)
  }

  // 显示变化
  p.log.step('检测到以下包版本更新：')
  console.log('')

  const npmChanges = changes.filter((c) => c.type === 'npm')
  const desktopChanges = changes.filter((c) => c.type === 'desktop')
  const appChanges = changes.filter((c) => c.type === 'app')

  if (npmChanges.length > 0) {
    console.log(`${colors.blue}📦 NPM 包:${colors.reset}`)
    npmChanges.forEach((c) => {
      console.log(
        `  ${c.name}: ${colors.yellow}${c.oldVersion}${colors.reset} → ${colors.green}${c.newVersion}${colors.reset}`
      )
    })
    console.log('')
  }

  if (desktopChanges.length > 0) {
    console.log(`${colors.blue}🖥️  Desktop:${colors.reset}`)
    desktopChanges.forEach((c) => {
      console.log(
        `  ${c.name}: ${colors.yellow}${c.oldVersion}${colors.reset} → ${colors.green}${c.newVersion}${colors.reset}`
      )
    })
    console.log('')
  }

  if (appChanges.length > 0) {
    console.log(`${colors.blue}📱 其他应用:${colors.reset}`)
    appChanges.forEach((c) => {
      console.log(
        `  ${c.name}: ${colors.yellow}${c.oldVersion}${colors.reset} → ${colors.green}${c.newVersion}${colors.reset}`
      )
    })
    console.log('')
  }

  // Desktop pre-release 处理
  let desktopReleaseInfo: DesktopReleaseInfo | null = null
  if (desktopChanges.length > 0) {
    const desktopVersion = desktopChanges[0].newVersion
    desktopReleaseInfo = await handleDesktopPreRelease(desktopVersion)

    if (desktopReleaseInfo.version !== desktopVersion) {
      p.log.info(
        `Desktop 版本将修改为: ${colors.green}${desktopReleaseInfo.version}${colors.reset}`
      )

      // 修改 package.json
      const desktopPkgPath = join(
        rootDir,
        desktopChanges[0].path,
        'package.json'
      )
      const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, 'utf-8'))
      desktopPkg.version = desktopReleaseInfo.version
      await writeFile(
        desktopPkgPath,
        JSON.stringify(desktopPkg, null, 2) + '\n'
      )
    }
  }

  // 确认发布
  const confirmRelease = await p.confirm({
    message: '确认发布？',
    initialValue: true,
  })

  if (!confirmRelease || p.isCancel(confirmRelease)) {
    p.cancel('操作已取消')
    p.log.warn('如需恢复修改，运行: git restore .')
    process.exit(0)
  }

  // 提交版本更新
  spinner.start('提交版本更新...')

  try {
    exec('git add .')
    exec('git commit -m "chore: release packages"')
    spinner.stop('版本更新已提交')
  } catch (error) {
    spinner.stop('提交失败')
    p.log.error('Git 提交失败')
    console.log('')
    p.note(
      `可能原因：
- Git hooks 失败（pre-commit, commit-msg 等）
- 没有需要提交的修改

恢复建议：
1. 检查错误信息
2. 修复问题后，手动提交：
   git add .
   git commit -m "chore: release packages"

或回滚：
   git restore .

详见: RELEASE.md 的故障排除章节`,
      '❌ 错误'
    )
    process.exit(1)
  }

  // 创建 tags
  const tags = createTags(changes, desktopReleaseInfo?.releaseType)

  if (tags.length === 0) {
    p.log.warn('没有需要创建的 tag')
    p.outro('完成')
    process.exit(0)
  }

  p.log.step('将创建以下 tags:')
  tags.forEach((tag) => {
    console.log(`  ${colors.green}${tag}${colors.reset}`)
  })
  console.log('')

  // 推送
  const shouldPush = await p.confirm({
    message: '推送到远程仓库？',
    initialValue: true,
  })

  if (!shouldPush || p.isCancel(shouldPush)) {
    p.cancel('操作已取消')
    p.log.info('版本已更新并提交，但未推送')
    p.log.info('手动推送: git push && git push --tags')
    process.exit(0)
  }

  spinner.start('推送到远程...')

  try {
    // 推送代码
    exec(`git push origin ${gitStatus.branch}`)

    // 创建并推送 tags
    tags.forEach((tag) => {
      exec(`git tag -a ${tag} -m "Release ${tag}"`)
    })
    exec('git push --tags')

    spinner.stop('推送完成')
  } catch (error) {
    spinner.stop('推送失败')
    p.log.error('Git 推送失败')
    console.log('')
    p.note(
      `可能原因：
- 网络问题
- 没有推送权限
- 远程分支冲突
- Tag 已存在

恢复建议：
1. 检查网络连接
2. 检查是否有推送权限
3. 手动推送：
   git push origin ${gitStatus.branch}
   git push --tags

如果 tag 已存在：
   # 删除本地 tag
   git tag -d TAG_NAME
   # 删除远程 tag（如需要）
   git push origin :refs/tags/TAG_NAME
   # 重新创建并推送
   git tag -a TAG_NAME -m "..."
   git push origin TAG_NAME

详见: RELEASE.md 的故障排除章节`,
      '❌ 错误'
    )
    process.exit(1)
  }

  // 完成
  console.log('')
  p.log.success('发版流程完成！')
  console.log('')

  p.note(
    `${npmChanges.length > 0 ? '📦 NPM 包将通过 GitHub Actions 发布到 npm\n' : ''}${desktopChanges.length > 0 ? '🖥️  Desktop 应用将通过 GitHub Actions 构建发布\n' : ''}\n查看构建状态: https://github.com/isboyjc/amux/actions`,
    '后续步骤'
  )

  p.outro('✨ 完成')
}

// 错误处理
process.on('uncaughtException', (error: Error) => {
  p.log.error(error.message)
  process.exit(1)
})

// 运行
main().catch((error: Error) => {
  p.log.error(error.message)
  process.exit(1)
})
