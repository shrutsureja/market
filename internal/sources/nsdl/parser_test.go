package nsdl

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseNSDLFixtures(t *testing.T) {
	cases := []struct{ file, date, start string }{
		{"2026-08-15.html", "2026-08-15", "2026-08-01"},
		{"2026-08-31.html", "2026-08-31", "2026-08-16"},
		{"2026-09-15.html", "2026-09-15", "2026-09-01"},
	}
	for _, tc := range cases {
		t.Run(tc.file, func(t *testing.T) {
			raw, err := os.ReadFile(filepath.Join("testdata", tc.file))
			if err != nil {
				t.Fatal(err)
			}
			got, err := Parse(raw)
			if err != nil {
				t.Fatal(err)
			}
			if got.ReportDate.Format("2006-01-02") != tc.date {
				t.Fatalf("date = %s", got.ReportDate)
			}
			if len(got.Flows) != 24 {
				t.Fatalf("sector count = %d", len(got.Flows))
			}
			if got.Flows[0].SectorName != "Automobile and Auto Components" {
				t.Fatalf("first sector = %q", got.Flows[0].SectorName)
			}
			if !got.PeriodEnd.Equal(got.ReportDate) || got.PeriodStart.Format("2006-01-02") != tc.start {
				t.Fatal("incorrect period metadata")
			}
		})
	}
}

func TestParseRejectsUnrecognizedStructure(t *testing.T) {
	_, err := Parse([]byte("<table><tr><td>nothing useful</td></tr></table>"))
	if err == nil {
		t.Fatal("expected validation error")
	}
}
