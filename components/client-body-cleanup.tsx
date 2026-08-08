"use client";

import { useEffect, PropsWithChildren } from "react";

export default function ClientBodyCleanup({ children }: PropsWithChildren) {
  useEffect(() => {
    const cleanup = () => {
      const attrs = [
        "data-new-gr-c-s-check-loaded",
        "data-gr-ext-installed",
        "__gcrremoteFrametoken",
        "__gcruniqueid",
      ];

      attrs.forEach((attr) => {
        document.documentElement.removeAttribute(attr);
        document.body.removeAttribute(attr);
        document.querySelectorAll("*").forEach((el) => el.removeAttribute(attr));
      });

      document.querySelectorAll("input, form").forEach((el) => {
        if (el instanceof HTMLElement) {
          el.removeAttribute("__gcruniqueid");
          el.removeAttribute("__gcrremoteFrametoken");
        }
      });
    };

    cleanup();
    const id = window.setTimeout(cleanup, 0);
    return () => window.clearTimeout(id);
  }, []);

  return <>{children}</>;
}
