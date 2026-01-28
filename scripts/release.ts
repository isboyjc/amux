#!/usr/bin/env node

/**
 * Amux Desktop 发版脚本
 *
 * 注意：
 * - NPM 包发版请使用手动发布（详见 README.md）
 * - 此脚本专门用于 Desktop 应用发版
 *
 * 功能：
 * 1. 读取 Desktop 应用版本
 * 2. 选择发布类型（stable/beta/alpha/rc）
 * 3. 创建 git tag
 * 4. 推送触发 GitHub Actions 构建
 *
 * 使用：
 * - pnpm release          # Desktop 发版
 * - pnpm release:desktop  # Desktop 发版（同上）
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import * as p from '@clack/prompts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// 类型定义
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
    const result = execSync(cmd, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    })
    return result ? result.trim() : ''
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
    const content = readFileSync(join(rootDir, path, 'package.json'), 'utf-8')
    if (!content || content.trim() === '') {
      return null
    }
    const pkg = JSON.parse(content)
    if (!pkg || !pkg.name || !pkg.version) {
      return null
    }
    return pkg
  } catch (error) {
    return null
  }
}

// 获取 Desktop 应用信息
function getDesktopInfo(): { name: string; version: string } | null {
  const pkg = readPackageJson('apps/desktop')
  if (!pkg) {
    return null
  }
  return {
    name: pkg.name,
    version: pkg.version,
  }
}

// 检查 git 状态
function checkGitStatus(): GitStatus {
  const status = exec('git status --porcelain', { silent: true })
  const branch = exec('git branch --show-current', { silent: true })
  const hasUncommitted = status.length > 0

  return { branch, hasUncommitted, status }
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

  p.intro(`${colors.blue}🚀 Amux Desktop 发版工具${colors.reset}`)

  // 获取 Desktop 应用信息
  const desktopInfo = getDesktopInfo()
  if (!desktopInfo) {
    p.log.error('未找到 Desktop 应用')
    p.outro('请检查 apps/desktop/package.json 是否存在')
    process.exit(1)
  }

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

  // 显示 Desktop 版本
  console.log('')
  console.log(`${colors.blue}🖥️  Desktop App:${colors.reset}`)
  console.log(
    `  ${desktopInfo.name}: ${colors.green}v${desktopInfo.version}${colors.reset}`
  )
  console.log('')

  // Desktop pre-release 处理
  const desktopReleaseInfo = await handleDesktopPreRelease(desktopInfo.version)

  if (desktopReleaseInfo.version !== desktopInfo.version) {
    p.log.info(
      `Desktop 版本将修改为: ${colors.green}${desktopReleaseInfo.version}${colors.reset}`
    )

    // 修改 package.json
    const desktopPkgPath = join(rootDir, 'apps/desktop', 'package.json')
    const desktopPkg = JSON.parse(readFileSync(desktopPkgPath, 'utf-8'))
    desktopPkg.version = desktopReleaseInfo.version
    await writeFile(desktopPkgPath, JSON.stringify(desktopPkg, null, 2) + '\n')

    console.log('')
  }

  // 创建 tag
  let tag = `desktop-v${desktopReleaseInfo.version}`

  p.log.step('将创建以下 tag:')
  console.log(`  ${colors.green}${tag}${colors.reset}`)
  console.log('')

  // 确认发布
  const confirmRelease = await p.confirm({
    message: '确认创建 tag 并推送？',
    initialValue: true,
  })

  if (!confirmRelease || p.isCancel(confirmRelease)) {
    p.cancel('操作已取消')
    if (desktopReleaseInfo.version !== desktopInfo.version) {
      p.log.warn('如需恢复修改，运行: git restore apps/desktop/package.json')
    }
    process.exit(0)
  }

  const spinner = p.spinner()

  // 如果修改了版本号，先提交
  if (desktopReleaseInfo.version !== desktopInfo.version) {
    spinner.start('提交版本更新...')

    try {
      exec('git add apps/desktop/package.json')
      exec(`git commit -m "chore(desktop): bump version to ${desktopReleaseInfo.version}"`)
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
   git add apps/desktop/package.json
   git commit -m "chore(desktop): bump version to ${desktopReleaseInfo.version}"

或回滚：
   git restore apps/desktop/package.json`,
        '❌ 错误'
      )
      process.exit(1)
    }
  }

  // 推送
  const shouldPush = await p.confirm({
    message: '推送到远程仓库？',
    initialValue: true,
  })

  if (!shouldPush || p.isCancel(shouldPush)) {
    p.cancel('操作已取消')
    p.log.info('版本已更新并提交（如果有修改），但未推送')
    p.log.info(`手动推送: git push && git tag -a ${tag} -m "Release ${tag}" && git push origin ${tag}`)
    process.exit(0)
  }

  spinner.start('推送到远程...')

  try {
    // 推送代码（如果有修改）
    if (desktopReleaseInfo.version !== desktopInfo.version) {
      exec(`git push origin ${gitStatus.branch}`)
    }

    // 创建并推送 tag
    exec(`git tag -a ${tag} -m "Release ${tag}"`)
    exec(`git push origin ${tag}`)

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
   git push origin ${tag}

如果 tag 已存在：
   # 删除本地 tag
   git tag -d ${tag}
   # 删除远程 tag（如需要）
   git push origin :refs/tags/${tag}
   # 重新创建并推送
   git tag -a ${tag} -m "Release ${tag}"
   git push origin ${tag}`,
      '❌ 错误'
    )
    process.exit(1)
  }

  // 完成
  console.log('')
  p.log.success('Desktop 发版流程完成！')
  console.log('')

  p.note(
    `🖥️  Desktop 应用将通过 GitHub Actions 构建发布

查看构建状态: https://github.com/isboyjc/amux/actions/workflows/release-desktop.yml
Tag: ${tag}`,
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
