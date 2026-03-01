const SUPPORTED_PRIVATE_INVITE_IMAGE_PATH = /\.(png|jpe?g|webp)$/i;

export const PRIVATE_INVITE_IMAGE_CAPTION_MAX = 120;

export function validatePrivateInviteImageUrl(
  input: string,
): { ok: true; canonicalUrl: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "private_invite_image_url cannot be empty" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "private_invite_image_url must be a valid absolute URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "private_invite_image_url must use https" };
  }

  if (!SUPPORTED_PRIVATE_INVITE_IMAGE_PATH.test(parsed.pathname)) {
    return {
      ok: false,
      error: "private_invite_image_url must end with .png, .jpg, .jpeg, or .webp",
    };
  }

  return { ok: true, canonicalUrl: parsed.toString() };
}

export function validatePrivateInviteImageCaption(
  input: string,
): { ok: true; caption: string } | { ok: false; error: string } {
  const caption = input.trim();
  if (caption.length > PRIVATE_INVITE_IMAGE_CAPTION_MAX) {
    return {
      ok: false,
      error: `private_invite_image_caption must be ${PRIVATE_INVITE_IMAGE_CAPTION_MAX} characters or fewer`,
    };
  }
  return { ok: true, caption };
}
