"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A command to run in the terminal, with a Copy button that works by keyboard too. */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };
  return (
    <div className="space-y-1">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted pl-3">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-2 text-sm">{command}</code>
        <Button type="button" size="default" onClick={copy} aria-label={`Copy: ${command}`}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">{failed ? "Copy did not work here. Select the command and copy it." : ""}</p>
    </div>
  );
}
