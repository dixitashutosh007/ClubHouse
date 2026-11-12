"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { MessageSquarePlus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import { SuggestionModule } from "@/types";

interface SuggestChangeButtonProps {
  module: SuggestionModule;
  /** What the resident is commenting on, e.g. "pick-up points" */
  topic: string;
  className?: string;
}

/**
 * Lets a resident suggest a change to the society's setup (a missing pick-up
 * point, a wrong emergency number…) or report a problem. Society admins see
 * these on the Configuration tab of the admin portal.
 */
export function SuggestChangeButton({
  module,
  topic,
  className,
}: SuggestChangeButtonProps) {
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
        json: { module, kind, message },
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 underline underline-offset-2"
        }
      >
        <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
        Suggest a change or report
      </button>

      {/* Rendered at the page root: the button often sits inside another form */}
      {isClient &&
        createPortal(
          <Dialog
            open={open}
            onClose={close}
            title="Suggest a change"
            description={`Tell your society admins what should change about ${topic}, or report a problem.`}
          >
            {sent ? (
              <div className="space-y-3">
                <p role="status" className="text-sm text-emerald-800">
                  Thank you! Your society admins will take a look.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
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
                      className={`py-2 rounded-xl text-xs font-semibold border ${
                        kind === value
                          ? "bg-emerald-700 border-emerald-700 text-white"
                          : "bg-white border-zinc-300 text-zinc-700"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </fieldset>
                <div>
                  <label
                    htmlFor={messageId}
                    className="text-xs font-semibold text-zinc-800 block mb-1"
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
                    className="w-full text-sm p-2.5 rounded-xl border border-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {error && (
                  <p role="alert" className="text-xs text-rose-700">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={sending || message.trim().length < 5}
                  className="w-full py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold disabled:opacity-60"
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
