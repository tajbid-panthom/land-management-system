import { useId, useRef, useState, type ChangeEvent } from "react";

type FileChooseFieldProps = {
  id?: string;
  name?: string;
  accept?: string;
  required?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  emptyLabel?: string;
  className?: string;
  onFileChange?: (file: File | null) => void;
};

/**
 * Visible file picker used across the app.
 * Avoids native file-button styling bugs from global input CSS.
 */
export function FileChooseField({
  id,
  name,
  accept,
  required,
  disabled,
  buttonLabel = "Choose file",
  emptyLabel = "No file selected",
  className,
  onFileChange,
}: FileChooseFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setFileName(file?.name ?? null);
    onFileChange?.(file);
  }

  return (
    <div
      className={
        className ??
        "relative flex flex-wrap items-center gap-3 rounded-md border border-sky-200 bg-sky-50 p-3"
      }
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex shrink-0 items-center justify-center rounded-md border border-teal-800 bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        tabIndex={-1}
        onChange={handleChange}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
        {fileName ?? emptyLabel}
      </span>
    </div>
  );
}
