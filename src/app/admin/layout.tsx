import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Acesso editorial", template: "%s" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <section className="admin-shell"><div className="admin-wrap">{children}</div></section>;
}
