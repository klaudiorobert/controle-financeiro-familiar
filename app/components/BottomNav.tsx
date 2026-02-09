"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/lancamentos", label: "Lançar", icon: "➕" },
  { href: "/cartoes", label: "Cartões", icon: "💳" },
  { href: "/assinaturas", label: "Assinaturas", icon: "🔁" },
  { href: "/relatorios", label: "Relatórios", icon: "📊" },
  { href: "/config", label: "Config", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-50
        backdrop-blur-md
        border-t
      "
      style={{
        background: "rgba(255,255,255,0.85)",
        boxShadow: "0 -8px 30px rgba(124,58,237,0.08)",
      }}
    >
      <div className="mx-auto max-w-md">
        <div className="flex justify-between px-2 py-2">
          {items.map((it) => {
            const active =
              pathname === it.href ||
              (it.href !== "/" && pathname.startsWith(it.href));

            return (
              <Link
                key={it.href}
                href={it.href}
                className="
                  relative flex flex-1 flex-col items-center justify-center
                  py-2 text-[11px] transition
                "
              >
                {/* Ícone */}
                <span
                  className={`text-lg leading-none transition ${
                    active ? "brand-primary" : "text-gray-500"
                  }`}
                >
                  {it.icon}
                </span>

                {/* Texto */}
                <span
                  className={`mt-0.5 transition ${
                    active ? "font-semibold brand-primary" : "text-gray-500"
                  }`}
                >
                  {it.label}
                </span>

                {/* Pill roxa do ativo */}
                {active && (
                  <span
                    className="
                      absolute -bottom-1 h-1 w-6 rounded-full
                    "
                    style={{
                      background:
                        "linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
