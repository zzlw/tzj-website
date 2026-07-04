import Markdown from "react-markdown";
import { markdownRemarkPlugins, markdownRehypePlugins } from "@/lib/markdown";
import { markdownImageComponents } from "./markdown-components";

export function MarkdownBody({
  content,
  className = "",
}: {
  content?: string | null;
  className?: string;
}) {
  if (!content?.trim()) return null;

  return (
    <div className={className}>
      <Markdown
        remarkPlugins={markdownRemarkPlugins}
        rehypePlugins={markdownRehypePlugins}
        components={markdownImageComponents}
      >
        {content}
      </Markdown>
    </div>
  );
}
