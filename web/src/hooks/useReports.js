import { useEffect, useState, useCallback } from "react";
import { request } from "../api.js";

export function useReports() {
  const [reports, setReports] = useState([]);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([request("/api/reports"), request("/api/flows")]);
      setReports(r);
      setFlows(f);
      setError("");
      return { reports: r, flows: f };
    } catch (e) {
      setError("Could not load your reports. " + e.message);
      return { reports: [], flows: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (files) => {
    if (!files.length) return;
    setBusy(true);
    setMessage("");
    const results = [];
    for (const file of files) {
      try {
        const body = new FormData();
        body.append("file", file);
        const d = await request("/api/reports/import", { method: "POST", body });
        results.push(`${file.name}: added ${d.sectorCount} sectors`);
      } catch (e) {
        results.push(`${file.name}: ${e.message}`);
      }
    }
    await load();
    setMessage(results.join(" · "));
    setBusy(false);
  };

  return { reports, flows, loading, busy, error, message, load, upload };
}
