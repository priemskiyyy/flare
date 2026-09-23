import type { FlareUser } from "@priemskiyyy/flare";
import { useDestinationStatus, useFlare } from "@priemskiyyy/flare-react";
import { useState } from "react";

import "src/components/Header/Header.css";

const ACCOUNTS: readonly FlareUser[] = [
  { id: "u_1", name: "Ada" },
  { id: "u_2", name: "Grace" },
];

export const Header = () => {
  const flare = useFlare();
  const backend = useDestinationStatus("backend");
  const [user, setUser] = useState<FlareUser | null>(null);

  const handleAccountChange = (next: FlareUser | null) => {
    flare.user(next);

    if (next !== null) {
      flare.breadcrumb("signedIn", { name: next.name ?? next.id });
    }

    setUser(next);
  };

  return (
    <header className="application-header">
      <div className="header-inner">
        <a className="brand" href="#main" aria-label="Flare playground">
          <svg
            className="brand-mark"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M16 3v8m0 10v8M3 16h8m10 0h8M7 7l6 6m6 6 6 6M7 25l6-6m6-6 6-6"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <strong>Flare</strong>
          <span>React playground</span>
        </a>
        <div className="backend-state" data-state={backend.state}>
          <span className="status-dot" /> Demo backend{" "}
          <strong>{backend.state}</strong>
        </div>
        <div className="account-control" role="group" aria-label="Account">
          <span className="account-label">Session</span>
          <button
            type="button"
            aria-label="Sign out"
            aria-pressed={user === null}
            onClick={() => handleAccountChange(null)}
          >
            Anonymous
          </button>
          {ACCOUNTS.map((account) => (
            <button
              key={account.id}
              type="button"
              aria-label={`Sign in as ${account.name}`}
              aria-pressed={user?.id === account.id}
              onClick={() => handleAccountChange(account)}
            >
              {account.name}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
