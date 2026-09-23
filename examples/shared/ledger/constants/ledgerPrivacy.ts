import { isSensitiveKey } from "@priemskiyyy/flare";
import type { FlarePrivacy } from "@priemskiyyy/flare";

// A letter-only top-level domain, so a package version such as react@19.2.0 in a
// stack frame is not taken for an address.
const EMAIL = /[\w.+-]+@(?:[\w-]+\.)+[a-z]{2,}/gi;

export const LEDGER_PRIVACY: FlarePrivacy = {
  // The defaults cover the card token; an IBAN is as sensitive.
  redact: (key) => isSensitiveKey(key) || key === "iban",
  // Customer addresses turn up in messages, where no key names them.
  scrub: (text) => text.replaceAll(EMAIL, "[email]"),
};
