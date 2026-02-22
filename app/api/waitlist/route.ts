import { NextResponse } from "next/server";

import { saveWaitlistEmail } from "@/lib/waitlist";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirectToHomeWithStatus(
  request: Request,
  status: "joined" | "exists" | "invalid" | "consent_required"
) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("waitlist", status);
  destination.hash = "email-list";
  return NextResponse.redirect(destination, 303);
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const rawEmail = form?.get("email");
  const rawConsent = form?.get("waitlist_consent");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const consentAccepted = rawConsent === "accepted";

  if (!consentAccepted) {
    return redirectToHomeWithStatus(request, "consent_required");
  }

  if (!email || !SIMPLE_EMAIL_RE.test(email)) {
    return redirectToHomeWithStatus(request, "invalid");
  }

  const result = await saveWaitlistEmail(email);
  return redirectToHomeWithStatus(request, result.created ? "joined" : "exists");
}
