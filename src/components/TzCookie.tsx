"use client";
import { useEffect } from "react";

/** Tell the server our timezone so server-rendered pages use the local date. */
export default function TzCookie() {
  useEffect(() => {
    document.cookie = `pg_tz=${new Date().getTimezoneOffset()}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return null;
}
