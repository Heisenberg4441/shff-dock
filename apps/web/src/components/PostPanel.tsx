import { useState } from 'react';
import { Button, Callout } from '@dock/ui';
import type { StackPostInfo } from '@dock/shared';

/**
 * Реквизиты доступа к стеку: адрес и заметки автора с подставленными
 * значениями.
 *
 * Здесь единственное место, где видно сгенерированный пароль: в форме его нет,
 * потому что генерируется он после отправки, а в .env на хосте за ним нужно
 * лезть под sudo. Поэтому рядом кнопка «скопировать» — набирать двадцать
 * случайных символов с экрана никто не станет.
 */
export function PostPanel({ post }: { post: StackPostInfo | null }) {
  const [copied, setCopied] = useState(false);

  if (!post || (!post.url && !post.notes)) {
    return <span className="dock-note">// автор стека реквизитов не оставил</span>;
  }

  const copy = (): void => {
    const text = [post.url, post.notes].filter(Boolean).join('\n\n');
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {post.url ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="dock-note">// адрес</span>
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 13 }}
          >
            {post.url}
          </a>
        </div>
      ) : null}

      {post.notes ? (
        <Callout tone="tip">
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--mono)',
              fontSize: 12.5,
              lineHeight: 1.7,
            }}
          >
            {post.notes.trimEnd()}
          </pre>
        </Callout>
      ) : null}

      <div>
        <Button size="sm" onClick={copy}>
          {copied ? 'скопировано' : 'скопировать'}
        </Button>
      </div>
    </div>
  );
}
