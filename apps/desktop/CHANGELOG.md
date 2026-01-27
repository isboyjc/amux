# @amux/desktop

## 0.2.1

### Patch Changes

- 5b4c36e: Fix the incompatibility of native module architecture of macos Intel package better-sqlite3 #3

## 0.2.0

### Minor Changes

- feat: add version update checker and GA4 analytics tracking

  **New Features:**
  - 🔔 **Version Update Notification System**
    - Automatic update checking from GitHub Releases
    - Visual "NEW" badge on logo when updates available
    - One-click navigation to download page
    - "Check for Updates" button in settings
  - 📊 **Google Analytics 4 Integration**
    - Comprehensive feature usage tracking (20 events)
    - Anonymous user analytics with privacy protection
    - User-controllable analytics toggle
    - Async, non-blocking, silent-fail tracking
    - Track: app startup, provider/proxy management, chat, tunnel, OAuth, errors

  **Technical Improvements:**
  - Add updater service with GitHub API integration
  - Implement GA4 analytics service with electron-google-analytics4
  - Enhanced settings page with update checker and analytics controls
  - Error boundary for React error tracking
  - i18n support for update notifications

  **Privacy & Security:**
  - Anonymous client IDs
  - No sensitive data collection (no API keys, tokens, or message content)
  - User can disable analytics in settings
  - All tracking complies with privacy best practices

## 0.1.4

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @amux.ai/adapter-anthropic@0.1.2
  - @amux.ai/adapter-deepseek@0.1.2
  - @amux.ai/adapter-moonshot@0.1.2
  - @amux.ai/adapter-google@0.1.2
  - @amux.ai/adapter-openai@0.1.2
  - @amux.ai/adapter-zhipu@0.1.2
  - @amux.ai/adapter-qwen@0.1.2
  - @amux.ai/llm-bridge@0.3.0

## 0.1.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @amux.ai/adapter-google@0.1.1
  - @amux.ai/llm-bridge@0.2.0
  - @amux.ai/adapter-anthropic@0.1.1
  - @amux.ai/adapter-deepseek@0.1.1
  - @amux.ai/adapter-moonshot@0.1.1
  - @amux.ai/adapter-openai@0.1.1
  - @amux.ai/adapter-qwen@0.1.1
  - @amux.ai/adapter-zhipu@0.1.1

## 0.1.1

### Patch Changes

- Updated dependencies
  - @amux/llm-bridge@0.1.0
  - @amux/adapter-openai@0.1.0
  - @amux/adapter-anthropic@0.1.0
  - @amux/adapter-deepseek@0.1.0
  - @amux/adapter-moonshot@0.1.0
  - @amux/adapter-qwen@0.1.0
  - @amux/adapter-google@0.1.0
  - @amux/adapter-zhipu@0.1.0
