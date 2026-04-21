"use client";

import { ChangeEvent, DragEvent, useRef } from "react";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = {
  previewUrl?: string | null;
  isBusy?: boolean;
  onFileSelect: (file: File) => void;
};

export function UploadDropzone({
  previewUrl,
  isBusy,
  onFileSelect,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (file?: File | null) => {
    if (file) {
      onFileSelect(file);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
  };

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "gradient-border relative overflow-hidden rounded-[28px] p-[1px]",
        isBusy && "opacity-70",
      )}
    >
      <div className="glass flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-[28px] px-6 py-10 text-center shadow-glow">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Selected portrait preview"
            className="h-56 w-56 rounded-[24px] object-cover shadow-2xl"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 text-4xl">
            +
          </div>
        )}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Drop a portrait or browse</h2>
          <p className="max-w-md text-sm leading-6 text-muted">
            Single face recommended. JPG, PNG, or WEBP up to 10MB.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload Image
          </button>
          <span className="text-sm text-muted">No login required</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
