import type React from "react";
import type { ReactNode } from "react";

type LabFieldProps = { label: string; children: ReactNode };

export const LabField: React.FunctionComponent<LabFieldProps> = ({
  label,
  children,
}) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
    <span className="w-40 shrink-0 text-base font-medium">{label}</span>
    {children}
  </div>
);
