"use client";

import { apiFetch, selectSociety } from "@/lib/api-client";
import { useApiData } from "@/hooks/useApiData";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { AgreementDialog } from "@/components/AgreementDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { OnboardingProgress } from "@/components/ui/OnboardingProgress";
import { cn } from "@/components/ui/cn";
import { PlacesAutocompleteInput } from "@/components/PlacesAutocompleteInput";
import { PhoneOtpModal } from "@/components/PhoneOtpModal";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/types";
import { FlatNumberInput } from "@/components/FlatNumberInput";

/** How the resident reached the join page: an invite link or the society search */
export type JoinTarget = { societyCode: string } | { societyId: string };

export function JoinSocietyForm({ target }: { target: JoinTarget }) {
  const router = useRouter();
  const { user, society, isAuthenticated, refreshAuth } = useAuth();

  // Registration requires a verified mobile number (phone OTP sign-in) first
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const signedInUser = verifiedUser ?? (isAuthenticated ? user : null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [gender, setGender] = useState("MALE");

  // Multi-clause legal disclaimer modal
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [agreePeerOnly, setAgreePeerOnly] = useState(false);
  const [agreeTrustOrLeave, setAgreeTrustOrLeave] = useState(false);
  const [agreeNoDeveloperObligation, setAgreeNoDeveloperObligation] =
    useState(false);
  const [agreeSocietyRules, setAgreeSocietyRules] = useState(false);

  const isLegalFullyAccepted =
    agreePeerOnly &&
    agreeTrustOrLeave &&
    agreeNoDeveloperObligation &&
    agreeSocietyRules;

  const [submitted, setSubmitted] = useState(false);

  // An existing member who opens the invite link goes straight in, not to the form again
  const checkPath = signedInUser
    ? `/api/v1/societies/membership?${"societyCode" in target ? `code=${encodeURIComponent(target.societyCode)}` : `id=${encodeURIComponent(target.societyId)}`}`
    : "";
  const { data: existing } = useApiData(
    checkPath || "/api/v1/societies/membership?id=none",
    (json) =>
      json as {
        societyId: string;
        societyName: string;
        status: string | null;
        registered: boolean;
      },
    "Could not check your membership.",
    `${signedInUser?.id ?? ""}:${checkPath}`,
  );
  const alreadyIn =
    signedInUser &&
    existing &&
    (existing.status === "ACTIVE" ||
      (existing.status === "PENDING_APPROVAL" && existing.registered))
      ? existing
      : null;
  const openSociety = async (societyId: string) => {
    selectSociety(societyId);
    await refreshAuth();
    router.push("/");
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLegalFullyAccepted) {
      setShowLegalModal(true);
      setError(
        "Please review and check all mandatory clauses in the Club House Legal Agreement popup.",
      );
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const res = await apiFetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...target,
          fullName,
          email,
          flatNumber,
          gender,
          workLocationName: workLocation,
        }),
      });

      if (res.ok) {
        // The SMS sign-in on this page skipped the app reload, so load the
        // session now; otherwise Home still shows the signed-out screen
        await refreshAuth();
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Registration failed");
      }
    } catch (e) {
      console.error(e);
      setError("Connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const doneCard = (
    icon: React.ReactNode,
    title: string,
    body: string,
    action: React.ReactNode,
  ) => (
    <Card
      padding="lg"
      className="grid justify-items-center text-center gap-3 py-10"
    >
      {icon}
      <h2
        role="status"
        className="font-display text-section font-bold text-ink"
      >
        {title}
      </h2>
      <p className="text-support text-ink-muted max-w-sm">{body}</p>
      {action}
    </Card>
  );

  return (
    <div className="flex-1 w-full max-w-xl mx-auto flex flex-col gap-5 px-4 sm:px-6 py-6 bg-ivory">
      <OnboardingProgress
        current={
          submitted || alreadyIn
            ? "Approval"
            : signedInUser
              ? "Details"
              : "Phone"
        }
      />
      <div className="flex items-start gap-3">
        <Link
          href="/"
          aria-label="Back"
          className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-sunken"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div>
          <p className="text-tag font-semibold uppercase tracking-wider text-terracotta-deep">
            {"societyCode" in target ? "Society invitation" : (society?.name ?? "Your society")}
          </p>
          <h1 className="font-display text-page font-bold text-ink">
            Join your society
          </h1>
        </div>
      </div>

      {alreadyIn && !submitted ? (
        doneCard(
          <span className="w-16 h-16 rounded-full bg-success-bg text-success flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </span>,
          alreadyIn.status === "ACTIVE"
            ? `You're already a member of ${alreadyIn.societyName}`
            : "You have already registered",
          alreadyIn.status === "ACTIVE"
            ? "No need to register again."
            : "Your society admin is reviewing your details. You will get in as soon as they approve.",
          <Button onClick={() => void openSociety(alreadyIn.societyId)}>
            Open Club House
          </Button>,
        )
      ) : submitted ? (
        doneCard(
          <span className="w-16 h-16 rounded-full bg-warning-bg text-warning flex items-center justify-center">
            <ShieldCheck className="w-9 h-9" aria-hidden="true" />
          </span>,
          "Sent for approval",
          "Your society admins are reviewing your registration. Once approved, you can use RideShare and Classes.",
          <Button
            onClick={async () => {
              await refreshAuth();
              router.push("/");
            }}
          >
            Return to Home
          </Button>,
        )
      ) : !signedInUser ? (
        <>
          {doneCard(
            <span className="w-16 h-16 rounded-full bg-terracotta-tint text-terracotta-deep flex items-center justify-center">
              <Phone className="w-8 h-8" aria-hidden="true" />
            </span>,
            "Verify your mobile number",
            "We'll send a one-time code by SMS. Your verified number is what co-residents see once you share a ride.",
            <Button size="lg" onClick={() => setShowOtpModal(true)}>
              Continue with your mobile
            </Button>,
          )}
          <PhoneOtpModal
            isOpen={showOtpModal}
            onClose={() => setShowOtpModal(false)}
            onSuccess={(verified) => {
              setVerifiedUser(verified);
              void refreshAuth();
            }}
            {...("societyCode" in target
              ? { societyCode: target.societyCode }
              : { societyId: target.societyId })}
            skipReload
          />
        </>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Card as="section" className="grid gap-4">
            <Input
              id="full-name"
              label="Full name"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ramesh Iyer"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <FlatNumberInput
                label="Flat number"
                config={society?.settings?.flatConfig}
                placeholder="e.g. Tower A-503"
                value={flatNumber}
                onChange={setFlatNumber}
              />
              <Select
                id="gender"
                label="Gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span className="text-support font-semibold text-ink">
                Mobile number
              </span>
              <p className="flex items-center gap-2 h-11 px-3 rounded-control border border-line bg-sunken text-body text-ink">
                <CheckCircle2
                  className="w-4 h-4 text-success shrink-0"
                  aria-hidden="true"
                />
                {signedInUser?.mobile || "Verified"}
                {signedInUser?.mobile && (
                  <span className="ml-auto text-tag font-semibold text-success">Verified</span>
                )}
              </p>
            </div>
            <Input
              id="email-address"
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="resident@example.com"
            />
            <PlacesAutocompleteInput
              value={workLocation}
              onChange={(loc) => setWorkLocation(loc)}
              placeholder="Search office, tech park or metro"
              label="Where you usually go"
            />
          </Card>

          <Card as="section" className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-support font-semibold text-ink">
                Agreement and community rules
              </p>
              <span
                className={cn(
                  "shrink-0 text-tag font-semibold px-2 py-0.5 rounded-full",
                  isLegalFullyAccepted
                    ? "bg-success-bg text-success"
                    : "bg-warning-bg text-warning",
                )}
              >
                {isLegalFullyAccepted ? "Accepted" : "To do"}
              </span>
            </div>
            <Button
              variant="secondary"
              fullWidth
              icon={ShieldCheck}
              onClick={() => setShowLegalModal(true)}
            >
              {isLegalFullyAccepted
                ? "Review the agreement"
                : "Read and accept the agreement"}
            </Button>
          </Card>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 p-3 rounded-control bg-danger-bg text-support text-danger"
            >
              <AlertCircle
                className="w-4 h-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            {isSubmitting ? "Registering…" : "Send for approval"}
          </Button>
        </form>
      )}

      <AgreementDialog
        open={showLegalModal}
        values={[
          agreePeerOnly,
          agreeTrustOrLeave,
          agreeNoDeveloperObligation,
          agreeSocietyRules,
        ]}
        onToggle={(i, on) =>
          [
            setAgreePeerOnly,
            setAgreeTrustOrLeave,
            setAgreeNoDeveloperObligation,
            setAgreeSocietyRules,
          ][i](on)
        }
        onClose={() => setShowLegalModal(false)}
        onConfirm={() => {
          setShowLegalModal(false);
          setError("");
        }}
      />
    </div>
  );
}
