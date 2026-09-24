package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/shrut-sureja/fpi-flow-dashboard/internal/reports"
	"github.com/shrut-sureja/fpi-flow-dashboard/internal/sources/nsdl"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type server struct {
	repo   reports.Repository
	rawDir string
}

func New(repo reports.Repository, dataDir string) http.Handler {
	s := server{repo: repo, rawDir: filepath.Join(dataDir, "raw")}
	_ = os.MkdirAll(s.rawDir, 0755)
	m := http.NewServeMux()
	m.HandleFunc("/health", s.health)
	m.HandleFunc("/api/reports/import", s.importReport)
	m.HandleFunc("/api/reports", s.listReports)
	m.HandleFunc("/api/flows/latest", s.latest)
	m.HandleFunc("/api/flows", s.flows)
	m.HandleFunc("/api/analytics/rotation", s.rotation)
	return cors(m)
}
func (s server) health(w http.ResponseWriter, r *http.Request) {
	write(w, 200, map[string]string{"status": "ok"})
}
func (s server) importReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		method(w)
		return
	}
	if e := r.ParseMultipartForm(20 << 20); e != nil {
		fail(w, 400, "invalid upload", e)
		return
	}
	f, h, e := r.FormFile("file")
	if e != nil {
		fail(w, 400, "file field is required", e)
		return
	}
	defer f.Close()
	raw, e := io.ReadAll(io.LimitReader(f, 20<<20))
	if e != nil || len(raw) == 0 {
		fail(w, 400, "file is empty or too large", e)
		return
	}
	sum := sha256.Sum256(raw)
	hash := hex.EncodeToString(sum[:])
	parsed, e := nsdl.Parse(raw)
	date := ""
	if !parsed.ReportDate.IsZero() {
		date = parsed.ReportDate.Format("2006-01-02")
	}
	dupe, _ := s.repo.FindByDateOrHash(date, hash)
	if dupe != nil {
		fail(w, 409, "report for this date or file already exists", nil)
		return
	}
	filename := fmt.Sprintf("%s-%s", time.Now().UTC().Format("20060102T150405Z"), filepath.Base(h.Filename))
	path := filepath.Join(s.rawDir, filename)
	if e := os.WriteFile(path, raw, 0644); e != nil {
		fail(w, 500, "could not retain raw source", e)
		return
	}
	now := time.Now().UTC()
	report := reports.Report{ID: hash[:16], ReportDate: parsed.ReportDate, PeriodStart: parsed.PeriodStart, PeriodEnd: parsed.PeriodEnd, InstitutionType: "FPI", Source: "NSDL", OriginalFilename: h.Filename, RawFilePath: path, RawFileHash: hash, ParserVersion: nsdl.ParserVersion, ImportStatus: reports.ImportSucceeded, ImportedAt: now, CreatedAt: now}
	if e != nil {
		report.ImportStatus = reports.ImportFailed
		report.ImportError = e.Error()
		_ = s.repo.Save(report, nil)
		fail(w, 422, e.Error(), nil)
		return
	}
	for i := range parsed.Flows {
		p := &parsed.Flows[i]
		p.ID = report.ID + "-" + p.SectorCode
		p.ReportID = report.ID
		p.ReportDate = report.ReportDate
		p.PeriodStart = report.PeriodStart
		p.PeriodEnd = report.PeriodEnd
		p.InstitutionType = "FPI"
		p.CreatedAt = now
	}
	if e := s.repo.Save(report, parsed.Flows); e != nil {
		fail(w, 500, "could not save import", e)
		return
	}
	write(w, 201, map[string]any{"report": report, "sectorCount": len(parsed.Flows), "diagnostics": parsed.Diagnostics})
}
func (s server) listReports(w http.ResponseWriter, r *http.Request) {
	x, e := s.repo.Reports()
	if e != nil {
		fail(w, 500, "could not load reports", e)
		return
	}
	write(w, 200, x)
}
func (s server) flows(w http.ResponseWriter, r *http.Request) {
	x, e := s.repo.Flows()
	if e != nil {
		fail(w, 500, "could not load flows", e)
		return
	}
	write(w, 200, x)
}
func (s server) latest(w http.ResponseWriter, r *http.Request) {
	x, e := s.repo.Flows()
	if e != nil {
		fail(w, 500, "could not load flows", e)
		return
	}
	sort.Slice(x, func(i, j int) bool { return x[i].EquityNetInvestmentCr > x[j].EquityNetInvestmentCr })
	write(w, 200, x)
}
func (s server) rotation(w http.ResponseWriter, r *http.Request) {
	x, _ := s.repo.Flows()
	by := map[string][]reports.SectorFlow{}
	for _, f := range x {
		by[f.SectorCode] = append(by[f.SectorCode], f)
	}
	out := []map[string]any{}
	for _, v := range by {
		sort.Slice(v, func(i, j int) bool { return v[i].ReportDate.Before(v[j].ReportDate) })
		last := v[len(v)-1]
		m := 0.0
		label := "New data"
		if len(v) > 1 {
			prev := v[len(v)-2]
			m = last.EquityNetInvestmentCr - prev.EquityNetInvestmentCr
			label = transition(prev.EquityNetInvestmentCr, last.EquityNetInvestmentCr)
		}
		out = append(out, map[string]any{"sector": last.SectorName, "latest": last.EquityNetInvestmentCr, "momentum": m, "transition": label})
	}
	sort.Slice(out, func(i, j int) bool { return out[i]["momentum"].(float64) > out[j]["momentum"].(float64) })
	write(w, 200, out)
}
func transition(a, b float64) string {
	if a >= 0 && b >= 0 {
		return "Continued inflow"
	}
	if a < 0 && b < 0 {
		return "Continued outflow"
	}
	if b >= 0 {
		return "Reversal to inflow"
	}
	return "Reversal to outflow"
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, msg string, e error) {
	if e != nil {
		msg += ": " + e.Error()
	}
	write(w, status, map[string]string{"error": msg})
}
func method(w http.ResponseWriter) { fail(w, 405, "method not allowed", nil) }
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

var _ = strings.TrimSpace
