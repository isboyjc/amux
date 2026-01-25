'use client';

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { content, type Locale } from '@/lib/i18n-content';

interface CodeExampleSectionProps {
  lang: string;
}

const examples = {
  'openai-to-anthropic': {
    inbound: 'openaiAdapter',
    outbound: 'anthropicAdapter',
    apiKey: 'ANTHROPIC_API_KEY',
    model: 'gpt-4',
  },
  'anthropic-to-openai': {
    inbound: 'anthropicAdapter',
    outbound: 'openaiAdapter',
    apiKey: 'OPENAI_API_KEY',
    model: 'claude-3-5-sonnet-20241022',
  },
  'deepseek-to-gemini': {
    inbound: 'deepseekAdapter',
    outbound: 'geminiAdapter',
    apiKey: 'GEMINI_API_KEY',
    model: 'deepseek-chat',
  },
};

type ExampleKey = keyof typeof examples;

export function CodeExampleSection({ lang }: CodeExampleSectionProps) {
  const locale = (lang === 'zh' ? 'zh' : 'en') as Locale;
  const t = content[locale];
  const [activeExample, setActiveExample] = useState<ExampleKey>('openai-to-anthropic');
  
  const example = examples[activeExample];

  return (
    <section className="border-t border-fd-border">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t.codeExample.title}
          </h2>
          <p className="text-fd-muted-foreground text-lg mb-6">
            {t.codeExample.subtitle}
          </p>
          
          {/* Conversion Direction Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <button
              onClick={() => setActiveExample('openai-to-anthropic')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeExample === 'openai-to-anthropic'
                  ? 'bg-fd-primary text-fd-primary-foreground'
                  : 'bg-fd-accent hover:bg-fd-accent/80'
              }`}
            >
              OpenAI <ArrowLeftRight className="w-4 h-4" /> Anthropic
            </button>
            <button
              onClick={() => setActiveExample('anthropic-to-openai')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeExample === 'anthropic-to-openai'
                  ? 'bg-fd-primary text-fd-primary-foreground'
                  : 'bg-fd-accent hover:bg-fd-accent/80'
              }`}
            >
              Anthropic <ArrowLeftRight className="w-4 h-4" /> OpenAI
            </button>
            <button
              onClick={() => setActiveExample('deepseek-to-gemini')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeExample === 'deepseek-to-gemini'
                  ? 'bg-fd-primary text-fd-primary-foreground'
                  : 'bg-fd-accent hover:bg-fd-accent/80'
              }`}
            >
              DeepSeek <ArrowLeftRight className="w-4 h-4" /> Gemini
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-fd-border bg-[#1e1e1e] overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-fd-border/20">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-sm text-gray-400">example.ts</span>
            </div>
            <pre className="p-6 text-sm overflow-x-auto">
              <code className="text-gray-300">
                <span className="text-gray-500">{t.codeExample.comment1}</span>
                {'\n'}
                <span className="text-purple-400">const</span>{' '}
                <span className="text-blue-300">bridge</span>{' '}
                <span className="text-purple-400">=</span>{' '}
                <span className="text-yellow-300">createBridge</span>
                <span className="text-gray-400">{'({'}</span>
                {'\n'}
                {'  '}
                <span className="text-blue-300">inbound</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-green-300">{example.inbound}</span>
                <span className="text-gray-400">,</span>
                {'\n'}
                {'  '}
                <span className="text-blue-300">outbound</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-green-300">{example.outbound}</span>
                <span className="text-gray-400">,</span>
                {'\n'}
                {'  '}
                <span className="text-blue-300">config</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-gray-400">{'{ '}</span>
                <span className="text-blue-300">apiKey</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-orange-300">
                  process.env.{example.apiKey}
                </span>{' '}
                <span className="text-gray-400">{' }'}</span>
                {'\n'}
                <span className="text-gray-400">{'});'}</span>
                {'\n\n'}
                <span className="text-gray-500">{t.codeExample.comment2}</span>
                {'\n'}
                <span className="text-purple-400">const</span>{' '}
                <span className="text-blue-300">response</span>{' '}
                <span className="text-purple-400">=</span>{' '}
                <span className="text-purple-400">await</span>{' '}
                <span className="text-blue-300">bridge</span>
                <span className="text-gray-400">.</span>
                <span className="text-yellow-300">chat</span>
                <span className="text-gray-400">{'({'}</span>
                {'\n'}
                {'  '}
                <span className="text-blue-300">model</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-orange-300">&apos;{example.model}&apos;</span>
                <span className="text-gray-400">,</span>
                {'\n'}
                {'  '}
                <span className="text-blue-300">messages</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-gray-400">[{'{ '}</span>
                <span className="text-blue-300">role</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-orange-300">&apos;user&apos;</span>
                <span className="text-gray-400">,</span>{' '}
                <span className="text-blue-300">content</span>
                <span className="text-gray-400">:</span>{' '}
                <span className="text-orange-300">&apos;Hello!&apos;</span>
                <span className="text-gray-400">{' }]'}</span>
                {'\n'}
                <span className="text-gray-400">{'});'}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
