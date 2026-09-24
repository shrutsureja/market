package reports

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

type Repository interface {
	Save(Report, []SectorFlow) error
	Reports() ([]Report, error)
	Flows() ([]SectorFlow, error)
	FindByDateOrHash(string, string) (*Report, error)
}
type fileStore struct {
	mu   sync.Mutex
	path string
	data database
}
type database struct {
	Reports []Report     `json:"reports"`
	Flows   []SectorFlow `json:"flows"`
}

func NewFileRepository(dir string) (Repository, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	f := &fileStore{path: filepath.Join(dir, "db.json")}
	b, e := os.ReadFile(f.path)
	if e == nil {
		if e = json.Unmarshal(b, &f.data); e != nil {
			return nil, e
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return nil, e
	}
	return f, nil
}
func (f *fileStore) persist() error {
	b, e := json.MarshalIndent(f.data, "", "  ")
	if e != nil {
		return e
	}
	return os.WriteFile(f.path, b, 0644)
}
func (f *fileStore) Save(r Report, flows []SectorFlow) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.data.Reports = append(f.data.Reports, r)
	f.data.Flows = append(f.data.Flows, flows...)
	return f.persist()
}
func (f *fileStore) Reports() ([]Report, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	r := append([]Report(nil), f.data.Reports...)
	sort.Slice(r, func(i, j int) bool { return r[i].ReportDate.After(r[j].ReportDate) })
	return r, nil
}
func (f *fileStore) Flows() ([]SectorFlow, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]SectorFlow(nil), f.data.Flows...), nil
}
func (f *fileStore) FindByDateOrHash(date, hash string) (*Report, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, r := range f.data.Reports {
		if r.RawFileHash == hash || r.ReportDate.Format("2006-01-02") == date {
			return &r, nil
		}
	}
	return nil, nil
}
