package reports

import "time"

type ImportStatus string

const (
	ImportSucceeded ImportStatus = "succeeded"
	ImportFailed    ImportStatus = "failed"
)

type Report struct {
	ID               string       `json:"id"`
	ReportDate       time.Time    `json:"reportDate"`
	PeriodStart      time.Time    `json:"periodStart"`
	PeriodEnd        time.Time    `json:"periodEnd"`
	InstitutionType  string       `json:"institutionType"`
	Source           string       `json:"source"`
	OriginalFilename string       `json:"originalFilename"`
	RawFilePath      string       `json:"rawFilePath"`
	RawFileHash      string       `json:"rawFileHash"`
	ParserVersion    string       `json:"parserVersion"`
	ImportStatus     ImportStatus `json:"importStatus"`
	ImportError      string       `json:"importError,omitempty"`
	ImportedAt       time.Time    `json:"importedAt"`
	CreatedAt        time.Time    `json:"createdAt"`
}
type SectorFlow struct {
	ID                    string    `json:"id"`
	ReportID              string    `json:"reportId"`
	ReportDate            time.Time `json:"reportDate"`
	PeriodStart           time.Time `json:"periodStart"`
	PeriodEnd             time.Time `json:"periodEnd"`
	InstitutionType       string    `json:"institutionType"`
	SectorCode            string    `json:"sectorCode"`
	SectorName            string    `json:"sectorName"`
	EquityNetInvestmentCr float64   `json:"equityNetInvestmentCr"`
	EquityAUCCr           float64   `json:"equityAucCr"`
	CreatedAt             time.Time `json:"createdAt"`
}
