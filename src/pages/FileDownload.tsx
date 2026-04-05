import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Loader2 } from "lucide-react";


interface FileRecord {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  subject: string;
  created_at: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDownload() {
  const { token } = useParams<{ token: string }>();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase
      .from("partner_files")
      .select("id, file_name, file_url, file_size, file_type, subject, created_at")
      .eq("batch_token", token)
      .then(({ data, error: err }) => {
        if (err || !data || data.length === 0) setError(true);
        else setFiles(data);
        setLoading(false);
      });
  }, [token]);

  const subject = files[0]?.subject ?? "";

  return (
    <div style={{ margin: 0, padding: 0, backgroundColor: "#f3f4f6", minHeight: "100vh", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px" }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f, #2563eb)",
          padding: "28px 32px",
          textAlign: "center",
          borderRadius: "12px 12px 0 0",
        }}>
          <h1 style={{ margin: 0, color: "#ffffff", fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>Brand and Sell</h1>
          <p style={{ margin: "6px 0 0", color: "#93c5fd", fontSize: 13 }}>Twoja sieć partnerska nieruchomości</p>
        </div>

        {/* Body */}
        <div style={{
          backgroundColor: "#ffffff",
          padding: "32px 32px 24px",
          borderRadius: "0 0 12px 12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
              <p style={{ marginTop: 12, color: "#6b7280" }}>Ładowanie plików...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "#ef4444", fontWeight: 600 }}>Nie znaleziono plików</p>
              <p style={{ color: "#6b7280", fontSize: 14, marginTop: 8 }}>Link mógł wygasnąć lub jest nieprawidłowy.</p>
            </div>
          ) : (
            <>
              <h2 style={{ margin: "0 0 8px", color: "#111827", fontSize: 20 }}>📁 Pliki do pobrania</h2>
              <p style={{ margin: "0 0 24px", color: "#6b7280", fontSize: 14 }}>
                Temat: <strong style={{ color: "#374151" }}>{subject}</strong>
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {files.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 18px",
                      backgroundColor: "#f0f9ff",
                      borderRadius: 8,
                      border: "1px solid #bae6fd",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e0f2fe")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f0f9ff")}
                    onClick={async () => {
                      const path = decodeURIComponent(file.file_url.split("/partner-files/")[1] ?? "");
                      if (!path) {
                        window.open(file.file_url, "_blank");
                        return;
                      }
                      const { data, error } = await supabase.storage.from("partner-files").download(path);
                      if (error || !data) {
                        window.open(file.file_url, "_blank");
                        return;
                      }
                      const url = window.URL.createObjectURL(data);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = file.file_name;
                      document.body.appendChild(a);
                      a.click();
                      setTimeout(() => { a.remove(); window.URL.revokeObjectURL(url); }, 1000);
                    }}
                  >
                    <FileText style={{ width: 20, height: 20, color: "#0369a1", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.file_name}
                      </p>
                      {file.file_size && (
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
                          {formatFileSize(file.file_size)}
                        </p>
                      )}
                    </div>
                    <Download style={{ width: 18, height: 18, color: "#2563eb", flexShrink: 0 }} />
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ marginTop: 32, borderTop: "2px solid #e5e7eb", paddingTop: 24 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                  Pozdrawiamy serdecznie 🤝<br />
                  <strong style={{ color: "#111827", fontSize: 15 }}>Zespół Brand and Sell</strong><br />
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>Twój partner w sprzedaży nieruchomości</span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
