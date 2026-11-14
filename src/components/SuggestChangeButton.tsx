"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useIsClient } from "@/hooks/useIsClient";
import { MessageSquarePlus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { SuggestionModule } from "@/types";

interface SuggestChangeButtonProps {
  /** Which app this is about; by default the app on screen */
  module?: SuggestionModule;
  /** What the resident is commenting on, e.g. "pick-up points" */
  topic?: string;
  /** "icon": the round button in the top bar */
  variant?: "link" | "icon";
  className?: string;
}

/** The app a page belongs to, from its path */
function moduleForPath(path: string): SuggestionModule {
  if (path.startsWith("/rides")) return "RIDESHARE";
  if (path.startsWith("/lessons")) return "CLASSES";
  return "GENERAL";
}

const TOPIC: Record<SuggestionModule, string> = {
  RIDESHARE: "RideShare",
  CLASSES: "Classes",
  GENERAL: "Club House or the society",
};

/**
 * Lets a resident suggest a change to the society's setup (a missing pick-up
 * point, a wrong emergency number…) or report a problem. Society admins see
 * these under Admin → Suggestions.
 */
export function SuggestChangeButton({
  module: moduleProp,
  topic: topicProp,
  variant = "link",
  className,
}: SuggestChangeButtonProps) {
  const pathname = usePathname() ?? "/";
  const appModule = moduleProp ?? moduleForPath(pathname);
  const topic = topicProp ?? TOPIC[appModule];
  const messageId = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"SUGGESTION" | "REPORT">("SUGGESTION");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const isClient = useIsClient();

  const close = () => {
    setOpen(false);
    setSent(false);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // React events bubble through portals; keep this from submitting a surrounding form
    e.stopPropagation();
    setSending(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/suggestions", {
        json: { module: appModule, kind, message },
      });
      if (res.ok) {
        setSent(true);
        setMessage("");
      } else {
        setError(
          await apiErrorMessage(res, "Could not send this. Please try again."),
        );
      }
    } catch {
      setError("Connection problem. Check your internet and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Suggest a change or report a problem"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-surface border border-line text-ink hover:bg-sunken"
        >
          <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            className ??
            "inline-flex items-center gap-1.5 min-h-11 text-meta font-semibold text-terracotta-deep underline underline-offset-2"
          }
        >
          <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
          Suggest a change or report
        </button>
      )}

      {/* Rendered at the page root: the button often sits inside another form */}
      {isClient &&
        createPortal(
          <Dialog
            open={open}
            onClose={close}
            title={`Suggest a change: ${TOPIC[appModule]}`}
            description={`Tell your society admins what should change about ${topic}, or report a problem.`}
          >
            {sent ? (
              <div className="grid gap-3">
                <p role="status" className="p-3 rounded-control bg-success-bg text-support text-success">
                  Thank you! Your society admins will take a look.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full h-11 rounded-control bg-terracotta-deep text-ink-inverse text-body font-semibold hover:bg-terracotta-deep/90"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-3">
                <fieldset className="grid grid-cols-2 gap-2">
                  <legend className="sr-only">Type</legend>
                  {(
                    [
                      ["SUGGESTION", "Suggest a change"],
                      ["REPORT", "Report a problem"],
                    ] as const
                  ).map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={kind === value}
                      onClick={() => setKind(value)}
                      className={`min-h-11 rounded-control text-support font-semibold border ${
                        kind === value
                          ? "bg-terracotta-tint border-terracotta-deep text-terracotta-deep"
                          : "bg-surface border-line-strong text-ink"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </fieldset>
                <div>
                  <label
                    htmlFor={messageId}
                    className="text-support font-semibold text-ink block mb-1.5"
                  >
                    Details
                  </label>
                  <textarea
                    id={messageId}
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      kind === "SUGGESTION"
                        ? "e.g. Please add Tower C lobby as a pick-up point"
                        : "What went wrong?"
                    }
                    className="w-full px-3 py-2.5 rounded-control border border-line-strong bg-surface text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-3 focus:ring-terracotta/30 focus:border-terracotta-deep"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-meta font-medium text-danger">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending || message.trim().length < 5}
                  className="w-full h-11 rounded-control bg-terracotta-deep text-ink-inverse text-body font-semibold hover:bg-terracotta-deep/90 disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send to society admins"}
                </button>
              </form>
            )}
          </Dialog>,
          document.body,
        )}
    </>
  );
}
