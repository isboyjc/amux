import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { Mermaid } from '@/components/mdx/mermaid';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { TypeTable } from 'fumadocs-ui/components/type-table';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    img: (props) => <ImageZoom {...(props as any)} />,
    ImageZoom,
    Mermaid,
    Step,
    Steps,
    Accordion,
    Accordions,
    TypeTable,
    ...components,
  } as MDXComponents;
}
