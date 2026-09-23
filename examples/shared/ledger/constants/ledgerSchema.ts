import type { FlareSchema } from "@priemskiyyy/flare";
import { z } from "zod";

/** What Ledger's reports may carry, including the context each error boundary adds. */
export const LEDGER_SCHEMA = {
  tags: {
    area: z.enum(["billing", "attachments", "preview", "reminders"]),
    plan: z.enum(["free", "pro"]),
  },
  contexts: {
    company: z.object({ name: z.string() }),
    payment: z.object({
      invoice: z.string(),
      amount: z.number(),
      cardToken: z.string(),
      iban: z.string(),
    }),
    react: z.object({ componentStack: z.string() }),
    vue: z.object({ info: z.string() }),
  },
  breadcrumbs: {
    signedIn: z.object({ company: z.string() }),
    invoiceOpened: z.object({ invoice: z.string() }),
    attachmentStarted: z.object({ file: z.string() }),
  },
} satisfies FlareSchema;
