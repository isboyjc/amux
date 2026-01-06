# Contributing to LLM Bridge

Thank you for your interest in contributing to LLM Bridge! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 18 or higher
- pnpm 8 or higher
- Git

### Clone and Install

```bash
git clone https://github.com/isboyjc/llm-bridge.git
cd llm-bridge
pnpm install
```

### Build All Packages

```bash
pnpm build
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
cd packages/core && pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Run Examples

```bash
cd examples/basic
pnpm start
```

## Project Structure

```
llm-bridge/
├── packages/
│   ├── core/              # Core IR + Bridge
│   ├── utils/             # Shared utilities
│   ├── adapter-openai/    # OpenAI adapter
│   ├── adapter-anthropic/ # Anthropic adapter
│   ├── adapter-deepseek/  # DeepSeek adapter
│   ├── adapter-kimi/      # Kimi adapter
│   ├── adapter-qwen/      # Qwen adapter
│   └── adapter-gemini/    # Gemini adapter
├── apps/
│   └── docs/              # Documentation site
├── examples/              # Usage examples
└── docs/                  # Additional documentation
```

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/isboyjc/llm-bridge/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node version, OS, etc.)

### Suggesting Features

1. Check [Issues](https://github.com/isboyjc/llm-bridge/issues) for existing feature requests
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach

### Adding a New Adapter

To add support for a new LLM provider:

1. Create a new package in `packages/adapter-{provider}/`
2. Implement the `LLMAdapter` interface
3. Add tests
4. Update documentation
5. Submit a pull request

See [Custom Adapters Guide](./docs/custom-adapters.md) for details.

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass (`pnpm test`)
6. Ensure code is properly formatted (`pnpm format`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to your branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Pull Request Guidelines

- **One feature per PR** - Keep PRs focused on a single feature or bug fix
- **Tests required** - All new features must include tests
- **Documentation** - Update relevant documentation
- **Code style** - Follow existing code style (enforced by ESLint/Prettier)
- **Commit messages** - Use clear, descriptive commit messages

## Code Style

We use ESLint and Prettier to enforce code style:

```bash
# Check code style
pnpm lint

# Format code
pnpm format
```

## Testing Guidelines

- Write unit tests for all new features
- Aim for 80%+ code coverage
- Use descriptive test names
- Test edge cases and error conditions

Example test structure:

```typescript
describe('Feature', () => {
  describe('Subfeature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = ...

      // Act
      const result = ...

      // Assert
      expect(result).toBe(...)
    })
  })
})
```

## Documentation

- Update README.md if adding new features
- Add JSDoc comments for public APIs
- Update relevant documentation in `docs/`
- Add examples for new features

## Release Process

We use Changesets for version management:

```bash
# Add a changeset
pnpm changeset

# Version packages
pnpm changeset:version

# Publish packages
pnpm changeset:publish
```

## Community

- [GitHub Issues](https://github.com/isboyjc/llm-bridge/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/isboyjc/llm-bridge/discussions) - Questions and discussions

## License

By contributing to LLM Bridge, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to ask questions in [GitHub Discussions](https://github.com/isboyjc/llm-bridge/discussions) or open an issue.

Thank you for contributing! 🎉
