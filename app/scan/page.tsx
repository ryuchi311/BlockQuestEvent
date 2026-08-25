"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScanRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/gate-scan");
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07090e",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-secondary)",
      fontSize: "0.9rem"
    }}>
      Redirecting to Gate Scanner...
    </div>
  );
}
