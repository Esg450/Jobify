import { Sparkles, Undo2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useAiSettings, useTidyResume, useUploadResume } from '../api/hooks';
import { RESUME_FILE_ACCEPT, RESUME_FILE_MAX_BYTES } from '../api/types';
import { cn } from '../lib/cn';
import { Button } from './ui/Button';
import { Alert, errorText } from './ui/feedback';
import { Field, Textarea } from './ui/fields';

const FORMAT_NAMES = { pdf: 'PDF', docx: 'Word document', text: 'text file' } as const;

interface ResumeFieldProps {
  label: string;
  hint?: ReactNode;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (text: string) => void;
}

/**
 * A resume textarea with two ways to fill it besides typing: uploading a file, whose text the
 * server reads out, and (when AI is set up) a tidy-up pass that repairs the layout without
 * changing the words. Both only change the field; nothing is saved until the form is. Used by
 * the profile and by the per-job resume in the AI panel.
 */
export function ResumeField({
  label,
  hint,
  placeholder = 'Paste your resume here, or drop a file.',
  rows = 10,
  value,
  onChange,
}: ResumeFieldProps) {
  const { data: ai } = useAiSettings();
  const upload = useUploadResume();
  const tidy = useTidyResume();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning'; text: ReactNode } | null>(null);
  const [undo, setUndo] = useState<{ label: string; text: string } | null>(null);
  const [tooLarge, setTooLarge] = useState<string | null>(null);
  const busy = upload.isPending || tidy.isPending;

  /** Replaces the text, remembering what it was so the user can change their mind. */
  const replace = (text: string, undoLabel: string) => {
    setUndo({ label: undoLabel, text: value });
    onChange(text);
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    upload.reset();
    tidy.reset();
    setNotice(null);
    if (file.size > RESUME_FILE_MAX_BYTES) {
      setTooLarge(`${file.name} is larger than ${RESUME_FILE_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setTooLarge(null);
    upload.mutate(file, {
      onSuccess: ({ text, format, truncated }) => {
        replace(text, 'Undo upload');
        setNotice(
          truncated
            ? {
                tone: 'warning',
                text: `Read the ${FORMAT_NAMES[format]}, but it was longer than the field can hold, so the end was left out. Review the text, then save.`,
              }
            : {
                tone: 'info',
                text: `Read ${file.name}. Check that the text came through as expected, then save.`,
              },
        );
      },
    });
  };

  const runTidy = () => {
    upload.reset();
    setNotice(null);
    setTooLarge(null);
    tidy.mutate(value, {
      onSuccess: ({ text }) => {
        replace(text, 'Undo tidy-up');
        setNotice({
          tone: 'info',
          text: 'Tidied up the layout. The wording is unchanged; look it over, then save.',
        });
      },
    });
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  };

  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex flex-col gap-2">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={cn('rounded-lg', dragging && 'ring-2 ring-indigo-500 ring-offset-2')}
          >
            <Textarea
              id={id}
              rows={rows}
              className="font-mono text-[13px]"
              placeholder={placeholder}
              value={value}
              onChange={(event) => {
                setUndo(null);
                onChange(event.target.value);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept={RESUME_FILE_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                pick(event.target.files?.[0]);
                // Let the same file be chosen again after an undo.
                event.target.value = '';
              }}
            />
            <Button
              size="sm"
              icon={<Upload aria-hidden className="size-3.5" />}
              loading={upload.isPending}
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              Upload file
            </Button>
            {ai?.configured && (
              <Button
                size="sm"
                icon={<Sparkles aria-hidden className="size-3.5" />}
                loading={tidy.isPending}
                disabled={busy || !value.trim()}
                onClick={runTidy}
                title="Fix the layout and spacing without changing any of the words"
              >
                Tidy up with AI
              </Button>
            )}
            {undo && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Undo2 aria-hidden className="size-3.5" />}
                disabled={busy}
                onClick={() => {
                  onChange(undo.text);
                  setUndo(null);
                  setNotice(null);
                }}
              >
                {undo.label}
              </Button>
            )}
          </div>
          {tooLarge && <Alert>{tooLarge}</Alert>}
          {upload.isError && <Alert>{errorText(upload.error)}</Alert>}
          {tidy.isError && <Alert>{errorText(tidy.error)}</Alert>}
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        </div>
      )}
    </Field>
  );
}
