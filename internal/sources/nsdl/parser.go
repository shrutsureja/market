// Package nsdl imports the sector-wise section of NSDL fortnightly reports.
package nsdl

import (
	"errors"
	"fmt"
	"github.com/shrut-sureja/fpi-flow-dashboard/internal/reports"
	"html"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const ParserVersion = "1.0.0"

var datePatterns = []string{"02 January 2006", "January 02 2006", "02-Jan-2006", "02/01/2006", "02.01.2006"}

type Parsed struct {
	ReportDate, PeriodStart, PeriodEnd time.Time
	Flows                              []reports.SectorFlow
	Diagnostics                        []string
}

func Parse(raw []byte) (Parsed, error) {
	tables := tableRE.FindAllString(string(raw), -1)
	if len(tables) == 0 {
		return Parsed{}, errors.New("expected sector table not found")
	}
	var best [][]string
	for _, table := range tables {
		rows := rowsOf(table)
		if len(rows) < 5 {
			continue
		}
		joined := strings.ToLower(strings.Join(rows[0], " ") + " " + strings.Join(rows[1], " ") + " " + strings.Join(rows[2], " ") + " " + strings.Join(rows[3], " "))
		if strings.Contains(joined, "net investment") && strings.Contains(joined, "auc") && strings.Contains(joined, "equity") && strings.Contains(joined, "sectors") {
			best = rows
			break
		}
	}
	if best == nil {
		return Parsed{}, errors.New("expected sector table not found: Net Investment / AUC / Equity headers were not recognized")
	}
	date, err := reportDateFromHeaders(best[:4])
	if err != nil {
		return Parsed{}, fmt.Errorf("unsupported NSDL report structure: %w", err)
	}
	periodStart, periodEnd, err := reportPeriodFromHeaders(best[:4])
	if err != nil { return Parsed{}, fmt.Errorf("unsupported NSDL report structure: %w", err) }
	if !periodEnd.Equal(date) { return Parsed{}, errors.New("Net Investment period and AUC report date do not reconcile") }
	netCol, aucCol := columnIndexes(best[:4])
	if netCol < 0 || aucCol < 0 {
		return Parsed{}, errors.New("Net Investment / Equity or AUC / Equity column not found")
	}
	sectorCol := sectorColumn(best[:4])
	if sectorCol < 0 {
		return Parsed{}, errors.New("sector name column not found")
	}
	parsed := Parsed{ReportDate: date, PeriodStart: periodStart, PeriodEnd: periodEnd}
	for _, row := range best[4:] {
		if len(row) <= max(sectorCol, max(netCol, aucCol)) {
			continue
		}
		sector := strings.TrimSpace(row[sectorCol])
		if sector == "" || strings.Contains(strings.ToLower(sector), "grand total") {
			continue
		}
		net, ok1 := number(row[netCol])
		auc, ok2 := number(row[aucCol])
		if !ok1 || !ok2 {
			continue
		}
		parsed.Flows = append(parsed.Flows, reports.SectorFlow{SectorName: sector, SectorCode: slug(sector), EquityNetInvestmentCr: net, EquityAUCCr: auc})
	}
	if len(parsed.Flows) < 3 {
		return Parsed{}, fmt.Errorf("imported sector count is implausible (%d); no partial import was created", len(parsed.Flows))
	}
	return parsed, nil
}

func sectorColumn(headers [][]string) int {
	for _, row := range headers {
		for i, cell := range row {
			if strings.EqualFold(strings.TrimSpace(cell), "Sectors") {
				return i
			}
		}
	}
	return -1
}

var tableRE = regexp.MustCompile(`(?is)<table[^>]*>.*?</table>`)
var rowRE = regexp.MustCompile(`(?is)<tr[^>]*>(.*?)</tr>`)
var cellRE = regexp.MustCompile(`(?is)<(t[hd])([^>]*)>(.*?)</t[hd]>`)
var colspanRE = regexp.MustCompile(`(?i)colspan\s*=\s*["']?(\d+)`)
var tagRE = regexp.MustCompile(`(?is)<[^>]+>`)
var wsRE = regexp.MustCompile(`\s+`)
var dateRE = regexp.MustCompile(`(?i)(?:as on|period ended|report date)?\s*(\d{1,2}(?:st|nd|rd|th)?[ ./-][A-Za-z]{3,9}[ ./,-]\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s*\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4})`)

func clean(s string) string {
	s = tagRE.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	return wsRE.ReplaceAllString(strings.TrimSpace(s), " ")
}
func rowsOf(s string) [][]string {
	m := rowRE.FindAllStringSubmatch(s, -1)
	out := [][]string{}
	for _, r := range m {
		c := cellRE.FindAllStringSubmatch(r[1], -1)
		row := []string{}
		for _, v := range c {
			span := 1
			if m := colspanRE.FindStringSubmatch(v[2]); len(m) == 2 {
				span, _ = strconv.Atoi(m[1])
			}
			for range span {
				row = append(row, clean(v[3]))
			}
		}
		if len(row) > 0 {
			out = append(out, row)
		}
	}
	return out
}
func findDate(s string) (time.Time, error) {
	for _, m := range dateRE.FindAllStringSubmatch(s, -1) {
		v := regexp.MustCompile(`(?i)(\d)(st|nd|rd|th)\b`).ReplaceAllString(m[1], "$1")
		v = strings.ReplaceAll(v, ",", "")
		for _, layout := range datePatterns {
			if d, e := time.Parse(layout, v); e == nil {
				return d, nil
			}
		}
	}
	return time.Time{}, errors.New("report date not found")
}

func reportDateFromHeaders(headers [][]string) (time.Time, error) {
	var last time.Time
	for _, row := range headers {
		for _, cell := range row {
			if strings.Contains(strings.ToLower(cell), "auc as on") {
				if d, err := findDate(cell); err == nil {
					last = d
				}
			}
		}
	}
	if last.IsZero() {
		return time.Time{}, errors.New("current AUC report date not found")
	}
	return last, nil
}

var periodRE = regexp.MustCompile(`(?i)net investment\s+([A-Za-z]{3,9})\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})`)
func reportPeriodFromHeaders(headers [][]string) (time.Time, time.Time, error) {
	var start, end time.Time
	for _, row := range headers { for _, cell := range row {
		m := periodRE.FindStringSubmatch(cell); if len(m) != 5 { continue }
		month, err := time.Parse("January", m[1]); if err != nil { continue }
		year, _ := strconv.Atoi(m[4]); first, _ := strconv.Atoi(m[2]); last, _ := strconv.Atoi(m[3])
		start = time.Date(year, month.Month(), first, 0, 0, 0, 0, time.UTC)
		end = time.Date(year, month.Month(), last, 0, 0, 0, 0, time.UTC)
	} }
	if start.IsZero() || end.IsZero() { return time.Time{}, time.Time{}, errors.New("current Net Investment period not found") }
	return start, end, nil
}
func columnIndexes(headers [][]string) (int, int) {
	net, auc := -1, -1
	for i := 0; i < 40; i++ {
		parts := []string{}
		for _, r := range headers {
			if i < len(r) {
				parts = append(parts, strings.ToLower(r[i]))
			}
		}
		v := strings.Join(parts, " ")
		if strings.Contains(v, "net investment") && strings.Contains(v, "equity") {
			net = i
		}
		if strings.Contains(v, "auc") && strings.Contains(v, "equity") {
			auc = i
		}
	}
	return net, auc
}
func number(s string) (float64, bool) {
	s = strings.ReplaceAll(strings.TrimSpace(s), ",", "")
	s = strings.ReplaceAll(s, "₹", "")
	if s == "-" || s == "" {
		return 0, true
	}
	v, e := strconv.ParseFloat(s, 64)
	return v, e == nil
}
func slug(s string) string {
	s = strings.ToLower(s)
	s = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
